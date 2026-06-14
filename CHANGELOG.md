# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed

- **API versioning**: routes were served under `/api/vv1` because `API_VERSION`
  was `v1` while URI versioning already prepends `v`. `API_VERSION` is now
  numeric (`1`) so routes resolve at `/api/v1`. Swagger's server base path
  derives the version consistently.
- **Response envelope**: non-paginated endpoints returning `{ data }` were
  double-nested as `data.data`. The `TransformResponseInterceptor` now unwraps
  the `{ data, meta? }` controller envelope correctly.
- **Production boot crashes**: the app no longer writes generated artifacts
  under `src/` at runtime — i18n type generation is development-only and
  GraphQL uses an in-memory schema in production.
- **Email templates / i18n translations**: bundled into `dist` via nest-cli
  assets and loaded relative to the compiled output (fixes `ENOENT` in Docker).
- **Docker health check**: probes `127.0.0.1` instead of `localhost` (which may
  resolve to IPv6 `::1` while the server binds to IPv4) and targets the
  versioned liveness route `/api/v1/health/live`.
- **Mongoose**: removed duplicate indexes (`expiresAt` TTL, unique fields).
- **Express 5 / NestJS 11 routing**: use named wildcards — file routes
  (`*path`) and the correlation-id middleware (`{*splat}`).
- **Tooling**: pinned `packageManager` to `yarn@1.22.22` to stop lockfile
  drift under Corepack; the Prisma client is generated deterministically via a
  `postinstall` hook (with `openssl` and the schema available in the Docker
  build).

### Changed

- **Audit endpoints** now use the standard `{ data, meta: { pagination } }`
  envelope shared by the rest of the API.
- The E2E harness applies the exact same runtime configuration as production
  (`configureApp`) so tests exercise the real request pipeline.

### Removed

- Orphaned `shared/exceptions` HTTP exception hierarchy (the app uses domain
  exceptions handled by `DomainExceptionFilter`).
- Duplicate response-contract type definitions (`ApiResponse`, `ApiError`,
  `ErrorDetail`, `ErrorResponse`, `ResponseMeta`, `PaginationMeta`); these now
  live in a single source of truth (`shared/dtos/response.dto.ts`).
- Unused `createSuccessResponse` / `createErrorResponse` helpers.
