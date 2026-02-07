/**
 * E2E Tests for Performance Page
 *
 * Tests the performance metrics and charts:
 * - Performance metrics display
 * - Equity curve chart
 * - Win/loss distribution
 * - Trade statistics
 */

import { test, expect } from '@playwright/test';

test.describe('Performance Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/performance');
  });

  test('displays performance page', async ({ page }) => {
    await expect(page.locator('h2').filter({ hasText: 'Performance' })).toBeVisible();
  });

  test('shows performance metrics', async ({ page }) => {
    // Wait for data to load
    await page.waitForSelector('text=Total Trades', { timeout: 10000 });

    // Check for key metrics
    await expect(page.locator('text=Total Trades')).toBeVisible();
    await expect(page.locator('text=Win Rate')).toBeVisible();
    await expect(page.locator('text=Total P&L')).toBeVisible();
    await expect(page.locator('text=Sharpe Ratio')).toBeVisible();
  });

  test('shows additional metrics', async ({ page }) => {
    await page.waitForSelector('text=Profit Factor', { timeout: 10000 });

    await expect(page.locator('text=Profit Factor')).toBeVisible();
    await expect(page.locator('text=Gross Profit')).toBeVisible();
    await expect(page.locator('text=Gross Loss')).toBeVisible();
  });
});

test.describe('Equity Curve Chart', () => {
  test('displays equity curve chart', async ({ page }) => {
    await page.goto('/performance');

    // Wait for chart to render
    await page.waitForSelector('text=Equity Curve', { timeout: 10000 });

    // Check for chart container
    await expect(page.locator('text=Equity Curve')).toBeVisible();
  });
});

test.describe('Win/Loss Distribution', () => {
  test('displays pie chart', async ({ page }) => {
    await page.goto('/performance');

    // Wait for pie chart to render
    await page.waitForSelector('text=Win/Loss Distribution', { timeout: 10000 });

    await expect(page.locator('text=Win/Loss Distribution')).toBeVisible();
  });

  test('shows trade statistics', async ({ page }) => {
    await page.goto('/performance');

    // Wait for stats to load
    await page.waitForSelector('text=Trade Statistics', { timeout: 10000 });

    await expect(page.locator('text=Winning Trades')).toBeVisible();
    await expect(page.locator('text=Losing Trades')).toBeVisible();
    await expect(page.locator('text=Win Rate')).toBeVisible();
  });
});

test.describe('Performance Loading States', () => {
  test('shows loading state', async ({ page }) => {
    // Slow down the API response
    await page.route('**/api/performance*', (route) => {
      setTimeout(() => route.continue(), 2000);
    });

    await page.goto('/performance');

    // Should show loading message
    await expect(page.locator('text=Loading performance data')).toBeVisible();
  });

  test('handles empty data', async ({ page }) => {
    // Mock empty performance data
    await page.route('**/api/performance*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          period: 'all',
          summary: {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            winRate: 0,
            totalPnl: 0,
            grossProfit: 0,
            grossLoss: 0,
            profitFactor: 0,
            sharpeRatio: 0,
          },
          equityCurve: [],
          timestamp: Date.now(),
        }),
      });
    });

    await page.goto('/performance');

    // Should show zeros for empty data
    await expect(page.locator('text=0')).toBeVisible();
  });
});
