import { Process, Processor, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bull';
import * as crypto from 'crypto';
import { type ILogger, LOGGER } from '@core/domain/ports/services';
import { NOTIFICATION_QUEUE } from '../queues/queue.constants';
import {
  NotificationJobType,
  type NotificationJobData,
  type PushNotificationData,
  type WebhookNotificationData,
  type SmsNotificationData,
  type InAppNotificationData,
} from '../queues/notification-queue.service';
import { generateUUID } from '@shared/utils';
import { assertSafeWebhookUrl, WEBHOOK_HEADER_DENYLIST } from './webhook-security';
import { RealtimePublisherService } from '../realtime/realtime-publisher.service';

/**
 * Notification Processor
 *
 * Processes notification jobs from the queue.
 */
@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor {
  constructor(
    @Inject(LOGGER) private readonly logger: ILogger,
    private readonly configService: ConfigService,
    private readonly realtimePublisher: RealtimePublisherService,
  ) {}

  @OnQueueActive()
  onActive(job: Job<NotificationJobData>): void {
    this.logger.debug(`Processing notification job ${job.id}`, {
      jobId: job.id,
      type: job.data.type,
    });
  }

  @OnQueueCompleted()
  onCompleted(job: Job<NotificationJobData>): void {
    this.logger.info(`Notification job ${job.id} completed`, {
      jobId: job.id,
      type: job.data.type,
    });
  }

  @OnQueueFailed()
  onFailed(job: Job<NotificationJobData>, error: Error): void {
    this.logger.error(`Notification job ${job.id} failed`, error, {
      jobId: job.id,
      type: job.data.type,
      attempts: job.attemptsMade,
    });
  }

  @Process(NotificationJobType.PUSH)
  processPush(job: Job<PushNotificationData>): void {
    const { userId, title, body, data, deviceTokens } = job.data;

    this.logger.info('Processing push notification', {
      userId,
      title,
      tokenCount: deviceTokens?.length || 0,
    });

    // TODO: Integrate with push notification service (Firebase, APNs, etc.)
    // For now, just log the notification
    this.logger.debug('Push notification would be sent', {
      userId,
      title,
      body,
      data,
      deviceTokens,
    });
  }

  @Process(NotificationJobType.WEBHOOK)
  async processWebhook(job: Job<WebhookNotificationData>): Promise<void> {
    const { url, method, headers, payload, secret } = job.data;
    const allowedHosts = this.configService.get<string[]>('queue.webhook.allowedHosts', []);
    const timeoutMs = this.configService.get<number>('queue.webhook.timeoutMs', 10000);

    this.logger.info('Processing webhook', {
      url: this.safeLogUrl(url),
      method,
    });

    try {
      const safeUrl = await assertSafeWebhookUrl(url, allowedHosts);
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...Object.fromEntries(
          Object.entries(headers ?? {}).filter(
            ([name]) => !WEBHOOK_HEADER_DENYLIST.has(name.toLowerCase()),
          ),
        ),
      };

      // Add signature if secret provided
      if (secret) {
        const signature = this.generateWebhookSignature(JSON.stringify(payload), secret);
        requestHeaders['X-Webhook-Signature'] = signature;
      }

      const response = await fetch(safeUrl, {
        method,
        headers: requestHeaders,
        body: JSON.stringify(payload),
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}: ${response.statusText}`);
      }

      this.logger.debug('Webhook delivered successfully', {
        url: this.safeLogUrl(url),
        status: response.status,
      });
    } catch (error) {
      this.logger.error('Webhook delivery failed', error as Error, { url: this.safeLogUrl(url) });
      throw error;
    }
  }

  @Process(NotificationJobType.SMS)
  processSms(job: Job<SmsNotificationData>): void {
    const { phoneNumber, message } = job.data;

    this.logger.info('Processing SMS notification', {
      phoneNumber: this.maskPhoneNumber(phoneNumber),
    });

    // TODO: Integrate with SMS provider (Twilio, AWS SNS, etc.)
    // For now, just log the notification
    this.logger.debug('SMS would be sent', {
      phoneNumber: this.maskPhoneNumber(phoneNumber),
      messageLength: message.length,
    });
  }

  @Process(NotificationJobType.IN_APP)
  async processInApp(job: Job<InAppNotificationData>): Promise<void> {
    const { userId, title, message, link, metadata } = job.data;

    this.logger.info('Processing in-app notification', {
      userId,
      title,
    });

    await this.realtimePublisher.publishNotification(userId, {
      id: generateUUID(),
      type: 'in-app',
      title,
      message,
      data: { link, ...metadata },
      createdAt: new Date(),
      read: false,
    });
    this.logger.debug('In-app notification published for WebSocket delivery', { userId, title });

    // Note: For persistent notifications, a NotificationRepository would be needed
    // to store notifications in the database for later retrieval
  }

  /**
   * Generate HMAC signature for webhook
   */
  private generateWebhookSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Mask phone number for logging
   */
  private maskPhoneNumber(phone: string): string {
    if (phone.length <= 4) {
      return '****';
    }
    return `${phone.slice(0, 2)}***${phone.slice(-2)}`;
  }

  private safeLogUrl(value: string): string {
    try {
      const url = new URL(value);
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch {
      return '[invalid-url]';
    }
  }
}
