import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Apply baseline security headers to every response. Self-hosters can fork this
// file to tighten or relax policies for their environment.
function applySecurityHeaders(response: NextResponse) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload',
    );
  }

  // 'unsafe-eval' / 'unsafe-inline' are kept because Next.js dev mode and the
  // Remotion preview emit inline scripts/styles. Tighten in production behind a
  // strict-CSP-aware deployment if needed.
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export function middleware(_request: NextRequest) {
  return applySecurityHeaders(NextResponse.next());
}

// Skip Next.js internal asset routes — security headers on those add no value
// and the framework already serves them with reasonable defaults.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
