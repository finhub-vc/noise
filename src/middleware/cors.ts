/**
 * CORS Middleware
 * Environment-specific CORS configuration with proper preflight caching and security headers
 */

interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  maxAge: number;
  exposeHeaders: string[];
}

// Get CORS configuration based on environment
function getCorsConfig(env?: string): CorsConfig {
  const isProduction = env === 'production';
  const isDevelopment = env === 'development';

  const allowedOrigins: string[] = [];
  if (isDevelopment) {
    allowedOrigins.push(
      'http://localhost:3000',  // Vite dev server (configured port)
      'http://localhost:5173',  // Vite default
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    );
  }

  // Add configured origins from environment if provided
  // In production, this would come from env.ALLOWED_ORIGINS
  if (isProduction) {
    // Production origins should be explicitly configured
    // allowedOrigins.push('https://your-domain.com');
  }

  return {
    allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : ['*'],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
    ],
    maxAge: 86400, // 24 hours in seconds
    exposeHeaders: [
      'Content-Length',
      'Content-Type',
      'X-Request-ID',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
  };
}

/**
 * Get the Origin header from request
 */
function getRequestOrigin(request: Request): string | null {
  return request.headers.get('Origin');
}

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string, config: CorsConfig): boolean {
  if (config.allowedOrigins.includes('*')) return true;
  return config.allowedOrigins.includes(origin);
}

/**
 * Build CORS headers for a request
 */
export function buildCorsHeaders(request: Request, env?: string): Record<string, string> {
  const config = getCorsConfig(env);
  const origin = getRequestOrigin(request);
  const headers: Record<string, string> = {};

  // Access-Control-Allow-Origin
  if (origin && isOriginAllowed(origin, config)) {
    headers['Access-Control-Allow-Origin'] = origin;
    // Vary header is important when origin is reflected
    headers['Vary'] = 'Origin';
  } else if (config.allowedOrigins.includes('*')) {
    headers['Access-Control-Allow-Origin'] = '*';
  }

  // Access-Control-Allow-Methods
  headers['Access-Control-Allow-Methods'] = config.allowedMethods.join(', ');

  // Access-Control-Allow-Headers
  headers['Access-Control-Allow-Headers'] = config.allowedHeaders.join(', ');

  // Access-Control-Expose-Headers
  if (config.exposeHeaders.length > 0) {
    headers['Access-Control-Expose-Headers'] = config.exposeHeaders.join(', ');
  }

  // Access-Control-Max-Age (for preflight)
  headers['Access-Control-Max-Age'] = config.maxAge.toString();

  // Allow credentials (cookies, authorization headers)
  // Only set this when specific origins are configured (not with '*')
  if (origin && isOriginAllowed(origin, config) && !config.allowedOrigins.includes('*')) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * CORS preflight response
 */
export function corsPreflightResponse(request: Request, env?: string): Response {
  const headers = buildCorsHeaders(request, env);

  return new Response(null, {
    status: 204, // No Content
    headers,
  });
}

/**
 * Wrap a Response with CORS headers
 */
export function withCorsHeaders(response: Response, request: Request, env?: string): Response {
  const corsHeaders = buildCorsHeaders(request, env);

  // Create new Headers object to avoid mutating original
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Security headers for API responses
 */
export function getSecurityHeaders(env?: string): Record<string, string> {
  const isDevelopment = env === 'development';

  return {
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',

    // Prevent clickjacking
    'X-Frame-Options': 'DENY',

    // Enable browser XSS filter (legacy but still useful)
    'X-XSS-Protection': '1; mode=block',

    // Content Security Policy (basic for API)
    'Content-Security-Policy': "default-src 'none'",

    // Referrer Policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Strict Transport Security (only in production with HTTPS)
    ...(isDevelopment ? {} : {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    }),
  };
}

/**
 * Add security headers to a response
 */
export function withSecurityHeaders(response: Response, env?: string): Response {
  const securityHeaders = getSecurityHeaders(env);

  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(securityHeaders)) {
    newHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Combine CORS and security headers
 */
export function withApiHeaders(response: Response, request: Request, env?: string): Response {
  let result = withCorsHeaders(response, request, env);
  result = withSecurityHeaders(result, env);
  return result;
}

// =============================================================================
// Middleware Helper
// =============================================================================

interface Env {
  ENVIRONMENT?: string;
  [key: string]: any;
}

/**
 * Higher-order function to wrap route handlers with CORS and security headers
 */
export function withApiHeadersMiddleware(
  handler: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response> | Response
) {
  return async (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
    // Handle preflight
    if (request.method === 'OPTIONS') {
      return corsPreflightResponse(request, env.ENVIRONMENT);
    }

    const response = await handler(request, env, ctx);
    return withApiHeaders(response, request, env.ENVIRONMENT);
  };
}
