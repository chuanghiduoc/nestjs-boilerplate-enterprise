import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue, JobOptions } from 'bull';
import { NOTIFICATION_QUEUE } from './queue.constants';

/**
 * Notification Job Types
 */
export enum NotificationJobType {
  PUSH = 'push',
  WEBHOOK = 'webhook',
  SMS = 'sms',
  IN_APP = 'in-app',
}

/**
 * Push Notification Data
 */
export interface PushNotificationData {
  type: NotificationJobType.PUSH;
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  deviceTokens?: string[];
}

/**
 * Webhook Notification Data
 */
export interface WebhookNotificationData {
  type: NotificationJobType.WEBHOOK;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  payload: Record<string, unknown>;
  secret?: string;
}

/**
 * SMS Notification Data
 */
export interface SmsNotificationData {
  type: NotificationJobType.SMS;
  phoneNumber: string;
  message: string;
}

/**
 * In-App Notification Data
 */
export interface InAppNotificationData {
  type: NotificationJobType.IN_APP;
  userId: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

export type NotificationJobData =
  PushNotificationData | WebhookNotificationData | SmsNotificationData | InAppNotificationData;

/**
 * Notification Queue Service
 *
 * Provides methods to add notification jobs to the queue.
 */
@Injectable()
export class NotificationQueueService {
  constructor(
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue<NotificationJobData>,
  ) {}

  /**
   * Send push notification
   */
  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
    deviceTokens?: string[],
  ): Promise<void> {
    await this.notificationQueue.add(NotificationJobType.PUSH, {
      type: NotificationJobType.PUSH,
      userId,
      title,
      body,
      data,
      deviceTokens,
    });
  }

  /**
   * Send webhook
   */
  async sendWebhook(
    url: string,
    payload: Record<string, unknown>,
    options?: {
      method?: 'POST' | 'PUT' | 'PATCH';
      headers?: Record<string, string>;
      secret?: string;
    },
  ): Promise<void> {
    await this.notificationQueue.add(NotificationJobType.WEBHOOK, {
      type: NotificationJobType.WEBHOOK,
      url,
      method: options?.method || 'POST',
      headers: options?.headers,
      payload,
      secret: options?.secret,
    });
  }

  /**
   * Send SMS notification
   */
  async sendSms(phoneNumber: string, message: string): Promise<void> {
    await this.notificationQueue.add(NotificationJobType.SMS, {
      type: NotificationJobType.SMS,
      phoneNumber,
      message,
    });
  }

  /**
   * Send in-app notification
   */
  async sendInAppNotification(
    userId: string,
    title: string,
    message: string,
    link?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.notificationQueue.add(NotificationJobType.IN_APP, {
      type: NotificationJobType.IN_APP,
      userId,
      title,
      message,
      link,
      metadata,
    });
  }

  /**
   * Add a custom notification job
   */
  async addJob(data: NotificationJobData, options?: JobOptions): Promise<void> {
    await this.notificationQueue.add(data.type, data, options);
  }

  /**
   * Schedule a notification for later
   */
  async scheduleNotification(
    data: NotificationJobData,
    delay: number,
    options?: JobOptions,
  ): Promise<void> {
    await this.notificationQueue.add(data.type, data, {
      delay,
      ...options,
    });
  }

  /**
   * Get queue status
   */
  async getQueueStatus(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.notificationQueue.getWaitingCount(),
      this.notificationQueue.getActiveCount(),
      this.notificationQueue.getCompletedCount(),
      this.notificationQueue.getFailedCount(),
      this.notificationQueue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }
}
