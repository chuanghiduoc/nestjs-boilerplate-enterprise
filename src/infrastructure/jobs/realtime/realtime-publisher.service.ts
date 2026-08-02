import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { LOGGER, type ILogger } from '@core/domain/ports/services';
import type { QueueConfig } from '@config/queue.config';
import type { NotificationPayload } from '../../websocket/websocket.service';
import { REALTIME_NOTIFICATION_EVENT, type RealtimeNotificationEvent } from './realtime-event';

/** Publishes worker events for every API replica to deliver to local sockets. */
@Injectable()
export class RealtimePublisherService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly channel: string;

  constructor(
    configService: ConfigService,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {
    const config = configService.get<QueueConfig>('queue');
    this.channel = config?.realtimeChannel ?? 'app:realtime';
    this.client = new Redis({
      host: config?.redis.host ?? 'localhost',
      port: config?.redis.port ?? 6379,
      password: config?.redis.password,
      db: config?.redis.db ?? 0,
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
  }

  async publishNotification(userId: string, notification: NotificationPayload): Promise<void> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }

    const event: RealtimeNotificationEvent = {
      type: REALTIME_NOTIFICATION_EVENT,
      userId,
      notification: {
        ...notification,
        createdAt: notification.createdAt.toISOString(),
      },
    };

    await this.client.publish(this.channel, JSON.stringify(event));
    this.logger.debug('Published realtime notification', { userId, channel: this.channel });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit();
    }
  }
}
