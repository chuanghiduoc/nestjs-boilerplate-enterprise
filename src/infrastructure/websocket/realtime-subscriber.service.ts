import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { LOGGER, type ILogger } from '@core/domain/ports/services';
import type { QueueConfig } from '@config/queue.config';
import {
  REALTIME_NOTIFICATION_EVENT,
  type RealtimeNotificationEvent,
} from '../jobs/realtime/realtime-event';
import { WebSocketService } from './websocket.service';

/** Delivers worker-published events to sockets connected to this API replica. */
@Injectable()
export class RealtimeSubscriberService implements OnModuleInit, OnModuleDestroy {
  private readonly subscriber: Redis;
  private readonly channel: string;

  constructor(
    configService: ConfigService,
    private readonly webSocketService: WebSocketService,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {
    const config = configService.get<QueueConfig>('queue');
    this.channel = config?.realtimeChannel ?? 'app:realtime';
    this.subscriber = new Redis({
      host: config?.redis.host ?? 'localhost',
      port: config?.redis.port ?? 6379,
      password: config?.redis.password,
      db: config?.redis.db ?? 0,
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
  }

  async onModuleInit(): Promise<void> {
    this.subscriber.on('message', (channel, rawEvent) => {
      if (channel === this.channel) {
        this.deliver(rawEvent);
      }
    });
    this.subscriber.on('error', (error) => {
      this.logger.error('Realtime Redis subscriber error', error);
    });

    await this.subscriber.connect();
    await this.subscriber.subscribe(this.channel);
    this.logger.info('Realtime Redis subscriber started', { channel: this.channel });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriber.status !== 'end') {
      await this.subscriber.quit();
    }
  }

  private deliver(rawEvent: string): void {
    try {
      const event = JSON.parse(rawEvent) as Partial<RealtimeNotificationEvent>;
      if (
        event.type !== REALTIME_NOTIFICATION_EVENT ||
        typeof event.userId !== 'string' ||
        !event.notification ||
        typeof event.notification.createdAt !== 'string'
      ) {
        this.logger.warn('Ignored invalid realtime event');
        return;
      }

      this.webSocketService.sendNotification(event.userId, {
        ...event.notification,
        createdAt: new Date(event.notification.createdAt),
      });
    } catch (error) {
      this.logger.error('Failed to decode realtime event', error as Error);
    }
  }
}
