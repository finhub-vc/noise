/**
 * API Client
 * Centralized API calls with authentication
 */

// Get API base URL from environment or use deployed worker
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://noise-trading-dev.finhub.workers.dev';
const API_KEY = import.meta.env.VITE_API_KEY || 'eaa6c54e8a7536a6ebf965bfe361989443a4c53e43c271e9184300244119028b';

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

/**
 * Get full API URL
 * Uses relative path for development (with Vite proxy)
 * Uses full URL for production
 */
function getApiUrl(path: string): string {
  // If it's already a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // In development, use relative path for Vite proxy
  // In production, use the deployed API URL
  if (import.meta.env.DEV) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
}

async function apiRequest(url: string, options: RequestOptions = {}): Promise<Response> {
  const fullUrl = getApiUrl(url);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add authorization header if API key is configured
  if (API_KEY && API_KEY !== 'dev-api-key-change-me') {
    headers['Authorization'] = `Bearer ${API_KEY}`;
  }

  return fetch(fullUrl, {
    ...options,
    headers,
  });
}

/**
 * API client with authentication
 */
export const api = {
  get: (url: string) => apiRequest(url),
  post: (url: string, data: unknown) => apiRequest(url, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  put: (url: string, data: unknown) => apiRequest(url, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (url: string) => apiRequest(url, {
    method: 'DELETE',
  }),
};

/**
 * Helper function to handle API responses
 */
export async function fetchJson<T>(url: string, options?: RequestOptions): Promise<T> {
  const response = await apiRequest(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}
