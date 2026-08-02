import type { NotificationPayload } from '../../websocket/websocket.service';

export const REALTIME_NOTIFICATION_EVENT = 'notification' as const;

export interface RealtimeNotificationEvent {
  type: typeof REALTIME_NOTIFICATION_EVENT;
  userId: string;
  notification: Omit<NotificationPayload, 'createdAt'> & { createdAt: string };
}
