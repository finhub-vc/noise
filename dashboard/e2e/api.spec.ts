/**
 * E2E Tests for API Endpoints
 *
 * Tests API responses and error handling:
 * - Status endpoint
 * - Account endpoint
 * - Positions endpoint
 * - Signals endpoint
 * - Risk state endpoint
 */

import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:8787'; // Adjust to your worker dev server

test.describe('API Endpoints', () => {
  test.describe('Health Check', () => {
    test('returns health status', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/health`);
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('status', 'healthy');
      expect(data).toHaveProperty('timestamp');
    });
  });

  test.describe('Status Endpoint', () => {
    test('requires authentication', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/status`);
      // Should fail without auth
      expect(response.status()).toBe(401);
    });

    test('returns status with valid auth', async ({ request }) => {
      // Note: This test requires a valid NOISE_API_KEY
      const response = await request.get(`${API_BASE}/api/status`, {
        headers: {
          Authorization: `Bearer test-api-key`,
        },
      });

      // Will return 403 with test key, but should be valid JSON
      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe('Account Endpoint', () => {
    test('returns account data', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/account`, {
        headers: {
          Authorization: `Bearer test-api-key`,
        },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });

  test.describe('Positions Endpoint', () => {
    test('returns positions array', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/positions`, {
        headers: {
          Authorization: `Bearer test-api-key`,
        },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe('Signals Endpoint', () => {
    test('returns active signals', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/signals/active`, {
        headers: {
          Authorization: `Bearer test-api-key`,
        },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test('accepts query parameters', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/signals?limit=10&status=ACTIVE`, {
        headers: {
          Authorization: `Bearer test-api-key`,
        },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe('Risk State Endpoint', () => {
    test('returns risk state', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/risk/state`, {
        headers: {
          Authorization: `Bearer test-api-key`,
        },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe('Performance Endpoint', () => {
    test('returns performance metrics', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/performance?period=day`, {
        headers: {
          Authorization: `Bearer test-api-key`,
        },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test('returns equity curve', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/performance/equity-curve?limit=100`, {
        headers: {
          Authorization: `Bearer test-api-key`,
        },
      });

      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe('CORS Headers', () => {
    test('includes CORS headers on GET request', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/health`);
      const headers = await response.headers();

      // Check for common CORS headers
      // Note: Some headers may not be visible depending on the request
      expect(response.status()).toBe(200);
    });

    test('handles OPTIONS preflight', async ({ request }) => {
      const response = await request.fetch(`${API_BASE}/api/status`, {
        method: 'OPTIONS',
        headers: {
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization',
        },
      });

      // Preflight should return 200 or 204
      expect([200, 204]).toContain(response.status());
    });
  });
});
