/**
 * Helper Functions
 * Utility functions for the NOISE trading engine
 */

// =============================================================================
// Formatting Functions
// =============================================================================

export function formatPrice(price: number, decimals: number = 2): string {
  return price.toFixed(decimals);
}

export function formatQuantity(quantity: number, decimals: number = 4): string {
  return quantity.toFixed(decimals);
}

export function formatPercent(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatCurrency(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
  }).format(value);
}

export function formatDate(timestamp: number, format: 'iso' | 'readable' | 'time' = 'iso'): string {
  const date = new Date(timestamp);

  switch (format) {
    case 'iso':
      return date.toISOString();
    case 'readable':
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    case 'time':
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    default:
      return date.toISOString();
  }
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// =============================================================================
// ID Generation
// =============================================================================

export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

export function generateOrderId(): string {
  return generateId('order');
}

export function generateSignalId(): string {
  return generateId('signal');
}

export function generateTradeId(): string {
  return generateId('trade');
}

// =============================================================================
// Math Functions
// =============================================================================

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function roundToTickSize(value: number, tickSize: number): number {
  return Math.round(value / tickSize) * tickSize;
}

export function calculatePercentChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

export function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  return Math.sqrt(calculateMean(squaredDiffs));
}

export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// =============================================================================
// Array Functions
// =============================================================================

export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

export function last<T>(array: T[]): T | undefined {
  return array[array.length - 1];
}

export function first<T>(array: T[]): T | undefined {
  return array[0];
}

// =============================================================================
// Async Functions
// =============================================================================

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    jitter?: boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 16000,
    jitter = true,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      let delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

      // Add jitter if enabled (±25%)
      if (jitter) {
        delay = delay * (0.75 + Math.random() * 0.5);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

// =============================================================================
// Validation Functions
// =============================================================================

export function isValidSymbol(symbol: string): boolean {
  return /^[A-Z]{1,4}$/.test(symbol);
}

export function isValidQuantity(quantity: number): boolean {
  return quantity > 0 && Number.isFinite(quantity);
}

export function isValidPrice(price: number): boolean {
  return price > 0 && Number.isFinite(price);
}

export function isValidTimestamp(timestamp: number): boolean {
  return timestamp > 0 && timestamp <= Date.now() + 86400000; // Not in the far future
}

// =============================================================================
// Time Functions
// =============================================================================

export function getCurrentTimestamp(): number {
  return Date.now();
}

export function getTradingDay(timestamp: number): string {
  const date = new Date(timestamp);
  // In US markets, trading day ends at 5 PM ET
  // If it's after 5 PM, consider it the next trading day
  const hour = date.getUTCHours();
  const dayOffset = hour >= 21 ? 1 : 0; // 5 PM ET = 9 PM UTC

  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().split('T')[0];
}

export function isWeekend(timestamp: number): boolean {
  const date = new Date(timestamp);
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

export function isMarketHours(timestamp: number): boolean {
  const date = new Date(timestamp);
  const hour = date.getUTCHours();
  // 9:30 AM ET = 13:30 UTC, 4:00 PM ET = 20:00 UTC
  return hour >= 13 && hour < 20;
}

export function addMinutes(timestamp: number, minutes: number): number {
  return timestamp + minutes * 60 * 1000;
}

export function addHours(timestamp: number, hours: number): number {
  return timestamp + hours * 60 * 60 * 1000;
}

export function addDays(timestamp: number, days: number): number {
  return timestamp + days * 24 * 60 * 60 * 1000;
}

// =============================================================================
// Object Functions
// =============================================================================

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => delete result[key]);
  return result;
}

export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) result[key] = obj[key];
  });
  return result;
}
