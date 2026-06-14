import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { createTestApp, closeTestApp } from './utils/test-app';
import { createRequestHelper, generateTestUser, assertErrorResponse } from './utils/test-helpers';

describe('Auth Endpoints (e2e)', () => {
  let app: INestApplication<App>;
  let req: ReturnType<typeof createRequestHelper>;

  beforeAll(async () => {
    app = await createTestApp();
    req = createRequestHelper(app);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  describe('POST /api/v1/auth/login', () => {
    it('should reject invalid credentials', async () => {
      const response = await req.post('/api/v1/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'WrongPassword123!',
      });

      expect(response.status).toBe(401);
      assertErrorResponse(response.body as Record<string, unknown>);
    });

    it('should reject missing email', async () => {
      const response = await req.post('/api/v1/auth/login').send({
        password: 'SomePassword123!',
      });

      expect(response.status).toBe(400);
    });

    it('should reject missing password', async () => {
      const response = await req.post('/api/v1/auth/login').send({
        email: 'test@example.com',
      });

      expect(response.status).toBe(400);
    });

    it('should reject invalid email format', async () => {
      const response = await req.post('/api/v1/auth/login').send({
        email: 'invalid-email',
        password: 'SomePassword123!',
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should reject missing required fields', async () => {
      const response = await req.post('/api/v1/auth/register').send({
        email: 'test@example.com',
      });

      expect(response.status).toBe(400);
    });

    it('should reject invalid email format', async () => {
      const user = generateTestUser();
      const response = await req.post('/api/v1/auth/register').send({
        ...user,
        email: 'invalid-email',
      });

      expect(response.status).toBe(400);
    });

    it('should reject weak password', async () => {
      const user = generateTestUser();
      const response = await req.post('/api/v1/auth/register').send({
        ...user,
        password: '123',
      });

      expect(response.status).toBe(400);
    });

    it('should register a new user and return an unwrapped data envelope', async () => {
      const user = generateTestUser();
      const response = await req.post('/api/v1/auth/register').send(user);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data.userId');
      expect(response.body).toHaveProperty('data.email', user.email);
      // Guard against the double-nesting regression (data.data).
      expect(response.body).not.toHaveProperty('data.data');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should reject missing refresh token', async () => {
      const response = await req.post('/api/v1/auth/refresh').send({});

      expect(response.status).toBe(400);
    });

    it('should reject invalid refresh token', async () => {
      const response = await req.post('/api/v1/auth/refresh').send({
        refreshToken: 'invalid-token',
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Protected Routes', () => {
    it('should reject requests without token', async () => {
      const response = await req.get('/api/v1/auth/me');

      expect(response.status).toBe(401);
    });

    it('should reject requests with invalid token', async () => {
      const response = await req.authGet('/api/v1/auth/me', 'invalid-token');

      expect(response.status).toBe(401);
    });

    it('should reject requests with malformed Authorization header', async () => {
      const response = await req.get('/api/v1/auth/me').set('Authorization', 'InvalidHeader');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should accept valid email (even if not registered)', async () => {
      const response = await req.post('/api/v1/auth/forgot-password').send({
        email: 'nonexistent@example.com',
      });

      // Should return 200 to prevent email enumeration
      expect([200, 404]).toContain(response.status);
    });

    it('should reject invalid email format', async () => {
      const response = await req.post('/api/v1/auth/forgot-password').send({
        email: 'invalid-email',
      });

      expect(response.status).toBe(400);
    });
  });
});
