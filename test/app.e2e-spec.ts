import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { createTestApp, closeTestApp } from './utils/test-app';
import { createRequestHelper } from './utils/test-helpers';

describe('App (e2e)', () => {
  let app: INestApplication<App>;
  let req: ReturnType<typeof createRequestHelper>;

  beforeAll(async () => {
    app = await createTestApp();
    req = createRequestHelper(app);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  describe('GET /api/v1', () => {
    it('should return welcome message wrapped in the standard envelope', async () => {
      const response = await req.get('/api/v1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data.message');
    });
  });

  describe('API Versioning', () => {
    it('should have /api/v1 prefix', async () => {
      // Health endpoint should be accessible with version prefix
      const response = await req.get('/api/v1/health/live');

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await req.get('/api/v1/unknown-route-12345');

      expect(response.status).toBe(404);
    });

    it('should return proper error envelope', async () => {
      const response = await req.get('/api/v1/unknown-route-12345');

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error.code');
      expect(response.body).toHaveProperty('error.message');
      expect(response.body).toHaveProperty('error.path', '/api/v1/unknown-route-12345');
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const response = await req.get('/api/v1').set('Origin', 'http://localhost:3000');

      // CORS headers should be present
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('Content-Type', () => {
    it('should return JSON content type for API endpoints', async () => {
      const response = await req.get('/api/v1/health/live');

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });
});
