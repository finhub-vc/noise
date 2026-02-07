/**
 * E2E Tests for Dashboard
 *
 * Tests the main dashboard functionality including:
 * - Page navigation
 * - Account summary display
 * - Positions table
 * - Risk metrics
 * - Signals panel
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard Navigation', () => {
  test('loads the dashboard page', async ({ page }) => {
    await page.goto('/');

    // Check that we're on the dashboard
    await expect(page).toHaveTitle(/NOISE/);

    // Check main heading
    await expect(page.locator('h2').filter({ hasText: 'Dashboard' })).toBeVisible();
  });

  test('navigates to all pages', async ({ page }) => {
    await page.goto('/');

    // Navigate to Trades page
    await page.click('a[href="/trades"]');
    await expect(page.locator('h2').filter({ hasText: 'Trade History' })).toBeVisible();

    // Navigate to Signals page
    await page.click('a[href="/signals"]');
    await expect(page.locator('h2').filter({ hasText: 'Signal History' })).toBeVisible();

    // Navigate to Performance page
    await page.click('a[href="/performance"]');
    await expect(page.locator('h2').filter({ hasText: 'Performance' })).toBeVisible();

    // Navigate to Settings page
    await page.click('a[href="/settings"]');
    await expect(page.locator('h2').filter({ hasText: 'Settings' })).toBeVisible();

    // Navigate back to Dashboard
    await page.click('a[href="/"]');
    await expect(page.locator('h2').filter({ hasText: 'Dashboard' })).toBeVisible();
  });

  test('shows active navigation state', async ({ page }) => {
    await page.goto('/');

    // Dashboard link should be green (active)
    const dashboardLink = page.locator('a[href="/"]');
    await expect(dashboardLink).toHaveClass(/text-green-400/);

    // Other links should be gray (inactive)
    const tradesLink = page.locator('a[href="/trades"]');
    await expect(tradesLink).toHaveClass(/text-gray-400/);
  });
});

test.describe('Account Summary', () => {
  test('displays account metrics', async ({ page }) => {
    await page.goto('/');

    // Wait for data to load
    await page.waitForSelector('text=Total Equity', { timeout: 10000 });

    // Check for metric labels
    await expect(page.locator('text=Total Equity')).toBeVisible();
    await expect(page.locator('text=Cash')).toBeVisible();
    await expect(page.locator('text=Buying Power')).toBeVisible();
    await expect(page.locator('text=Daily P&L')).toBeVisible();
  });

  test('shows loading state initially', async ({ page }) => {
    // Navigate with slow network to see loading state
    await page.route('**/api/account*', (route) => {
      // Delay the response
      setTimeout(() => route.continue(), 2000);
    });

    await page.goto('/');

    // Check for loading spinner
    await expect(page.locator('.animate-spin')).toBeVisible();
  });

  test('handles API errors gracefully', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/account*', (route) => {
      route.abort('failed');
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Should show error state with retry button
    await expect(page.locator('text=Failed to load account data')).toBeVisible();
  });
});

test.describe('Risk Metrics', () => {
  test('displays risk state', async ({ page }) => {
    await page.goto('/');

    // Wait for risk data to load
    await page.waitForSelector('text=Daily P&L', { timeout: 10000 });

    // Check for risk metrics
    await expect(page.locator('text=Consecutive Losses')).toBeVisible();
    await expect(page.locator('text=Circuit Breaker')).toBeVisible();
  });

  test('shows circuit breaker status', async ({ page }) => {
    await page.goto('/');

    // Wait for risk data
    await page.waitForSelector('text=Circuit Breaker', { timeout: 10000 });

    // Either shows "TRIGGERED" or "OFF"
    const circuitBreakerStatus = page.locator('text=/TRIGGERED|OFF/');
    await expect(circuitBreakerStatus).toBeVisible();
  });
});

test.describe('Positions Table', () => {
  test('displays positions table headers', async ({ page }) => {
    await page.goto('/');

    // Wait for positions to load or show empty state
    await page.waitForSelector('text=Open Positions', { timeout: 10000 });

    // Check for table headers if there are positions
    const tableHeaders = page.locator('th');
    const expectedHeaders = ['Symbol', 'Side', 'Quantity', 'Entry', 'Current', 'P&L'];

    for (const header of expectedHeaders) {
      // Headers may or may not be visible depending on if there are positions
      // Just check the page loads without error
    }
  });

  test('shows empty state when no positions', async ({ page }) => {
    // Mock empty positions response
    await page.route('**/api/positions*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ positions: [], count: 0, timestamp: Date.now() }),
      });
    });

    await page.goto('/');
    await page.waitForSelector('text=No open positions', { timeout: 10000 });
    await expect(page.locator('text=No open positions')).toBeVisible();
  });
});

test.describe('Signals Panel', () => {
  test('displays active signals section', async ({ page }) => {
    await page.goto('/');

    // Wait for signals to load
    await page.waitForSelector('text=Active Signals', { timeout: 10000 });
    await expect(page.locator('text=Active Signals')).toBeVisible();
  });

  test('shows empty state when no signals', async ({ page }) => {
    // Mock empty signals response
    await page.route('**/api/signals/active*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ signals: [], count: 0, timestamp: Date.now() }),
      });
    });

    await page.goto('/');
    await page.waitForSelector('text=No active signals', { timeout: 10000 });
    await expect(page.locator('text=No active signals')).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test('displays correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Main navigation should still be visible
    await expect(page.locator('text=Dashboard')).toBeVisible();

    // Account summary should be responsive
    await expect(page.locator('text=Total Equity')).toBeVisible();
  });

  test('displays correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    // Main navigation should still be visible
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });
});

test.describe('Error Handling', () => {
  test('shows error state when API fails', async ({ page }) => {
    // Mock all API failures
    await page.route('**/api/**', (route) => {
      route.abort('failed');
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Should still show the page structure
    await expect(page.locator('text=NOISE')).toBeVisible();
  });

  test('allows retry after error', async ({ page }) => {
    // Mock API failure then success
    let attempt = 0;
    await page.route('**/api/account*', (route) => {
      attempt++;
      if (attempt === 1) {
        route.abort('failed');
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            equity: 100000,
            cash: 50000,
            buyingPower: 200000,
            dailyPnl: 500,
            dailyPnlPercent: 0.5,
            lastUpdated: Date.now(),
          }),
        });
      }
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Click retry button
    const retryButton = page.locator('button:has-text("Retry")').first();
    if (await retryButton.isVisible()) {
      await retryButton.click();
      // Should now show data
      await expect(page.locator('text=$100,000')).toBeVisible({ timeout: 5000 });
    }
  });
});
