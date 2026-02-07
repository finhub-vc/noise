/**
 * E2E Tests for Settings Page
 *
 * Tests the settings page functionality:
 * - Risk configuration display
 * - Circuit breaker reset
 * - System controls
 */

import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
  });

  test('displays settings page', async ({ page }) => {
    await expect(page.locator('h2').filter({ hasText: 'Settings' })).toBeVisible();
  });

  test('shows risk configuration', async ({ page }) => {
    // Check for risk configuration section
    await expect(page.locator('text=Risk Configuration')).toBeVisible();

    // Check for individual risk settings
    await expect(page.locator('text=Max Risk Per Trade')).toBeVisible();
    await expect(page.locator('text=Max Daily Loss')).toBeVisible();
    await expect(page.locator('text=Max Weekly Loss')).toBeVisible();
    await expect(page.locator('text=Max Drawdown')).toBeVisible();
    await expect(page.locator('text=Max Position Size')).toBeVisible();
    await expect(page.locator('text=Max Concurrent Positions')).toBeVisible();
    await expect(page.locator('text=Max Correlated Exposure')).toBeVisible();
    await expect(page.locator('text=Max Total Exposure')).toBeVisible();
  });

  test('shows system controls', async ({ page }) => {
    await expect(page.locator('text=System Controls')).toBeVisible();
    await expect(page.locator('text=Reset Circuit Breaker')).toBeVisible();
    await expect(page.locator('text=Trading Mode')).toBeVisible();
    await expect(page.locator('text=API Version')).toBeVisible();
  });

  test('shows signal configuration', async ({ page }) => {
    await expect(page.locator('text=Signal Configuration')).toBeVisible();
    await expect(page.locator('text=Momentum Weight')).toBeVisible();
    await expect(page.locator('text=Mean Reversion Weight')).toBeVisible();
    await expect(page.locator('text=Breakout Weight')).toBeVisible();
  });
});

test.describe('Circuit Breaker Reset', () => {
  test('shows reset button', async ({ page }) => {
    await page.goto('/settings');
    const resetButton = page.locator('button:has-text("Reset")');
    await expect(resetButton).toBeVisible();
  });

  test('requires confirmation before reset', async ({ page }) => {
    // Mock circuit breaker triggered state
    await page.route('**/api/risk/state*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          daily_pnl: -1000,
          daily_pnl_percent: -1,
          consecutive_losses: 5,
          circuit_breaker_triggered: 1,
          circuit_breaker_reason: 'Daily loss limit exceeded',
          circuit_breaker_until: null,
          last_updated: Date.now(),
        }),
      });
    });

    await page.goto('/settings');

    // Click reset button
    await page.click('button:has-text("Reset")');

    // Should show confirmation dialog
    await expect(page.locator('text=Are you sure?')).toBeVisible();
    await expect(page.locator('text=This will re-enable trading')).toBeVisible();
  });

  test('can cancel reset', async ({ page }) => {
    await page.goto('/settings');
    await page.click('button:has-text("Reset")');

    // Click cancel
    await page.click('button:has-text("Cancel")');

    // Confirmation should be gone
    await expect(page.locator('text=Are you sure?')).not.toBeVisible();
  });

  test('successfully resets circuit breaker', async ({ page }) => {
    // Mock successful reset
    await page.route('**/api/risk/reset-circuit-breaker*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Circuit breaker reset',
          timestamp: Date.now(),
        }),
      });
    });

    await page.goto('/settings');
    await page.click('button:has-text("Reset")');
    await page.click('button:has-text("Confirm Reset")');

    // Should show success message
    await expect(page.locator('text=Circuit breaker reset successfully')).toBeVisible();
  });

  test('handles reset failure', async ({ page }) => {
    // Mock failed reset
    await page.route('**/api/risk/reset-circuit-breaker*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.goto('/settings');
    await page.click('button:has-text("Reset")');
    await page.click('button:has-text("Confirm Reset")');

    // Should show error message
    await expect(page.locator('text=Failed to reset circuit breaker')).toBeVisible();
  });
});
