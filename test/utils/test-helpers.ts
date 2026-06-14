import type { INestApplication } from '@nestjs/common';
import request, { type Test } from 'supertest';
import type { App } from 'supertest/types';

interface RequestHelper {
  get: (url: string) => Test;
  post: (url: string) => Test;
  put: (url: string) => Test;
  patch: (url: string) => Test;
  delete: (url: string) => Test;
  authGet: (url: string, token: string) => Test;
  authPost: (url: string, token: string) => Test;
  authPut: (url: string, token: string) => Test;
  authPatch: (url: string, token: string) => Test;
  authDelete: (url: string, token: string) => Test;
}

/**
 * Test Helpers
 *
 * Utility functions for E2E tests.
 */

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Generate a random email for testing
 */
export function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `test-${timestamp}-${random}@example.com`;
}

/**
 * Generate test user data
 */
export function generateTestUser(): TestUser {
  return {
    email: generateTestEmail(),
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
  };
}

/**
 * Create a test request helper
 */
export function createRequestHelper(app: INestApplication<App>): RequestHelper {
  const server = app.getHttpServer();

  return {
    get: (url: string) => request(server).get(url),
    post: (url: string) => request(server).post(url),
    put: (url: string) => request(server).put(url),
    patch: (url: string) => request(server).patch(url),
    delete: (url: string) => request(server).delete(url),

    // Authenticated requests
    authGet: (url: string, token: string) =>
      request(server).get(url).set('Authorization', `Bearer ${token}`),
    authPost: (url: string, token: string) =>
      request(server).post(url).set('Authorization', `Bearer ${token}`),
    authPut: (url: string, token: string) =>
      request(server).put(url).set('Authorization', `Bearer ${token}`),
    authPatch: (url: string, token: string) =>
      request(server).patch(url).set('Authorization', `Bearer ${token}`),
    authDelete: (url: string, token: string) =>
      request(server).delete(url).set('Authorization', `Bearer ${token}`),
  };
}

/**
 * Register a user and return tokens
 */
export async function registerAndLogin(
  app: INestApplication<App>,
  user: TestUser,
): Promise<AuthTokens | null> {
  const req = createRequestHelper(app);

  // Register user
  await req.post('/api/v1/auth/register').send(user);

  // Login
  const loginResponse = await req.post('/api/v1/auth/login').send({
    email: user.email,
    password: user.password,
  });

  if (loginResponse.status === 200 || loginResponse.status === 201) {
    const body = loginResponse.body as { accessToken: string; refreshToken: string };
    return {
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
    };
  }

  return null;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Assert that a response has a specific structure
 */
export function assertResponseStructure(
  response: Record<string, unknown>,
  expectedKeys: string[],
): void {
  for (const key of expectedKeys) {
    expect(response).toHaveProperty(key);
  }
}

/**
 * Assert pagination response structure
 */
export function assertPaginatedResponse(response: Record<string, unknown>): void {
  expect(response).toHaveProperty('data');
  expect(response).toHaveProperty('meta');
  expect(Array.isArray(response.data)).toBe(true);

  const meta = response.meta as Record<string, unknown>;
  expect(meta).toHaveProperty('total');
  expect(meta).toHaveProperty('page');
  expect(meta).toHaveProperty('limit');
  expect(meta).toHaveProperty('totalPages');
}

/**
 * Assert error response structure.
 *
 * Errors follow the standard envelope: { success: false, error: { code, message, ... } }
 */
export function assertErrorResponse(response: Record<string, unknown>): void {
  expect(response).toHaveProperty('success', false);
  expect(response).toHaveProperty('error');

  const error = response.error as Record<string, unknown>;
  expect(error).toHaveProperty('code');
  expect(error).toHaveProperty('message');
  expect(error).toHaveProperty('timestamp');
  expect(error).toHaveProperty('path');
  expect(error).toHaveProperty('requestId');
}
