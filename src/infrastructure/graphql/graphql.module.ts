import { Module } from '@nestjs/common';
import { GraphQLModule as NestGraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';

/**
 * GraphQL Module
 *
 * Configures Apollo GraphQL server with NestJS.
 *
 * Features:
 * - Code-first approach with auto-generated schema
 * - Playground enabled in development
 * - Introspection for development
 * - Context with request info
 */
@Module({
  imports: [
    NestGraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const isDev = configService.get('app.nodeEnv') !== 'production';

        return {
          // Code-first approach.
          // In development the schema is written to src/generated for tooling
          // (e.g. frontend codegen). In production it is generated in memory —
          // the runtime image is read-only and does not ship the src/ tree.
          autoSchemaFile: isDev ? join(process.cwd(), 'src/generated/schema.gql') : true,
          sortSchema: true,

          // Development settings
          playground: isDev,
          introspection: isDev,

          // Context builder
          context: ({ req, res }: { req: Request; res: Response }) => ({
            req,
            res,
          }),

          // Format errors
          formatError: (error) => {
            const originalError = error.extensions?.originalError as
              | Record<string, unknown>
              | undefined;

            return {
              message: error.message,
              code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
              path: error.path,
              ...(isDev && {
                extensions: {
                  stacktrace: error.extensions?.stacktrace,
                  originalError,
                },
              }),
            };
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class GraphQLModule {}
