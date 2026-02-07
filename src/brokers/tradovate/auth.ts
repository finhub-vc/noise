/**
 * Tradovate Authentication
 * OAuth 2.0 flow with token caching in D1
 */

import type { TradovateCredentials, TradovateTokenResponse, TradovateTokenCache } from './types.js';
import { createLogger } from '@/utils/index.js';

const log = createLogger('TRADOVATE_AUTH');

const AUTH_URL = 'https://demo.tradovateapi.com/v1/auth/oauth2/token';

export class TradovateAuth {
  private tokenCache: TradovateTokenCache | null = null;
  private credentials: TradovateCredentials;

  constructor(
    private db: D1Database,
    credentials: TradovateCredentials,
    _isLive: boolean = false
  ) {
    this.credentials = credentials;
  }

  async authenticate(): Promise<string> {
    // Try to load from cache first
    const cached = await this.loadTokenFromCache();
    if (cached && !this.isTokenExpired(cached)) {
      this.tokenCache = cached;
      log.info('Using cached token');
      return cached.accessToken;
    }

    // Need to get new token
    log.info('Fetching new access token');
    return await this.fetchNewToken();
  }

  async refreshToken(): Promise<string> {
    if (!this.tokenCache) {
      return await this.authenticate();
    }

    // Use refresh token to get new access token
    log.info('Refreshing access token');
    return await this.fetchNewToken();
  }

  private async fetchNewToken(): Promise<string> {
    const response = await fetch(AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'password',
        username: this.credentials.username,
        password: this.credentials.password,
        app_id: this.credentials.appId,
        cid: this.credentials.cid,
        secret: this.credentials.secret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      log.error('Authentication failed', new Error(error));
      throw new Error(`Tradovate authentication failed: ${response.status}`);
    }

    const data: TradovateTokenResponse = await response.json();

    this.tokenCache = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: Date.now() + (data.expiresIn * 1000),
      updatedAt: Date.now(),
    };

    // Save to D1 cache
    await this.saveTokenToCache(this.tokenCache);

    log.info('Access token retrieved and cached');
    return data.accessToken;
  }

  private isTokenExpired(cache: TradovateTokenCache): boolean {
    // Refresh 5 minutes before actual expiration
    return cache.expiresAt < Date.now() + 300000;
  }

  private async loadTokenFromCache(): Promise<TradovateTokenCache | null> {
    try {
      const result = await this.db.prepare(
        'SELECT * FROM broker_tokens WHERE broker = ?'
      ).bind('tradovate').first();

      if (!result) return null;

      const cache: TradovateTokenCache = {
        accessToken: result.access_token as string,
        refreshToken: result.refresh_token as string,
        expiresAt: result.expires_at as number,
        updatedAt: result.updated_at as number,
      };

      this.tokenCache = cache;
      return cache;
    } catch (error) {
      log.error('Failed to load token from cache', error as Error);
      return null;
    }
  }

  private async saveTokenToCache(cache: TradovateTokenCache): Promise<void> {
    try {
      await this.db.prepare(
        `INSERT OR REPLACE INTO broker_tokens (broker, access_token, refresh_token, expires_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(
        'tradovate',
        cache.accessToken,
        cache.refreshToken,
        cache.expiresAt,
        cache.updatedAt
      ).run();

      log.info('Token saved to cache');
    } catch (error) {
      log.error('Failed to save token to cache', error as Error);
    }
  }

  getAccessToken(): string | null {
    return this.tokenCache?.accessToken ?? null;
  }
}
