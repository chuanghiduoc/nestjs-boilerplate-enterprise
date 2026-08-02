import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { NotificationGateway } from './gateways/notification.gateway';
import { WebSocketService } from './websocket.service';
import { PresenceService } from './presence.service';
import type { JwtConfig } from '@config/jwt.config';
import { RealtimeSubscriberService } from './realtime-subscriber.service';

/**
 * WebSocket Module
 *
 * Provides real-time communication capabilities.
 *
 * Features:
 * - Socket.io based WebSocket connections
 * - JWT authentication for connections
 * - Room management (user, tenant, custom)
 * - Presence tracking
 * - Real-time notifications
 * - Event broadcasting
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const jwtConfig = configService.get<JwtConfig>('jwt');
        return {
          secret: jwtConfig?.secret,
          signOptions: {
            expiresIn: jwtConfig?.accessTokenExpiresIn || 900,
          },
        };
      },
    }),
  ],
  providers: [NotificationGateway, WebSocketService, PresenceService, RealtimeSubscriberService],
  exports: [WebSocketService, PresenceService],
})
export class WebSocketModule {}
