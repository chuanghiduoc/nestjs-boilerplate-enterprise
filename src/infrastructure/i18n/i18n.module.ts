import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  I18nModule as NestI18nModule,
  AcceptLanguageResolver,
  HeaderResolver,
  QueryResolver,
  CookieResolver,
} from 'nestjs-i18n';
import * as path from 'path';
import type { I18nConfig } from '@config/i18n.config';

/**
 * I18n Module
 *
 * Provides internationalization support for the application.
 *
 * Features:
 * - Multiple language support (en, es by default)
 * - Automatic language detection from:
 *   - Query parameter (?lang=es)
 *   - Cookie (lang)
 *   - Custom header (x-lang)
 *   - Accept-Language header
 * - Fallback language support
 * - Type-safe translations
 *
 * Configuration via environment:
 * - I18N_DEFAULT_LANGUAGE: Default language (default: en)
 * - I18N_FALLBACK_LANGUAGE: Fallback when translation missing (default: en)
 * - I18N_SUPPORTED_LANGUAGES: Comma-separated list (default: en,es)
 * - I18N_TRANSLATIONS_PATH: Path to translation files
 *
 * Usage:
 * - Inject I18nService to translate messages
 * - Use @I18n() decorator to get I18nContext in controllers
 * - Use I18nValidationPipe for translated validation errors
 */
@Global()
@Module({
  imports: [
    NestI18nModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const i18nCfg = configService.get<I18nConfig>('i18n');
        const supportedLanguages = i18nCfg?.supportedLanguages || ['en', 'es'];

        // Build fallbacks dynamically based on supported languages
        const fallbacks: Record<string, string> = {};
        for (const lang of supportedLanguages) {
          fallbacks[`${lang}-*`] = lang;
        }

        const isProduction = process.env.NODE_ENV === 'production';

        return {
          fallbackLanguage: i18nCfg?.fallbackLanguage || 'en',
          fallbacks,
          loaderOptions: {
            // Translations ship alongside the compiled output (see nest-cli
            // assets), so resolve relative to this module's directory. This
            // works both in development (ts-node/ts-jest -> src) and in the
            // production build (dist).
            path: path.join(__dirname, 'translations'),
            watch: !isProduction,
          },
          // Type generation is a development-only convenience. The production
          // image does not ship the src/ tree, so attempting to write generated
          // types there would fail.
          ...(isProduction
            ? {}
            : {
                typesOutputPath: path.join(process.cwd(), 'src/generated/i18n.generated.ts'),
              }),
        };
      },
      resolvers: [
        // Order matters - first match wins
        new QueryResolver(['lang', 'locale']),
        new CookieResolver(['lang', 'locale']),
        new HeaderResolver(['x-lang', 'x-locale']),
        AcceptLanguageResolver,
      ],
      inject: [ConfigService],
    }),
  ],
  exports: [NestI18nModule],
})
export class I18nModule {}
