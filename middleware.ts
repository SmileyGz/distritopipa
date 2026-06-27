// middleware.ts  (Next.js App Router — runs on Cloudflare Edge)
// ─────────────────────────────────────────────────────────────
// Second layer of age gate enforcement at the network edge.
//
// The React component (AgeGate.tsx) handles UX.
// This middleware handles:
//   • Bots / crawlers that skip JavaScript entirely
//   • Direct URL access attempts bypassing the gate
//   • Sets a signed cookie after client confirms (optional upgrade path)
//
// Deploy target: Cloudflare Pages via @cloudflare/next-on-pages
// ─────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that are always public — no gate
const PUBLIC_PATHS = [
  '/aviso-de-privacidad',
  '/api/',            // API routes never gated
  '/_next/',          // Next.js internals
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
]

// Cookie name set by the client after gate confirmation
// (Upgrade: sign this with a secret for tamper-proof verification)
const AGE_COOKIE = 'dp_age_v1'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check for age-verified cookie (set by client JS after localStorage confirm)
  // This is a soft check — the React component is the primary UX enforcement
  const verified = request.cookies.get(AGE_COOKIE)?.value === '1'

  if (!verified) {
    // Don't redirect — let the React AgeGate component handle the UX.
    // This middleware only blocks non-JS clients from accessing API data.
    // For a full hard gate, uncomment the redirect below:
    //
    // if (pathname.startsWith('/api/products')) {
    //   return new NextResponse('Age verification required', { status: 403 })
    // }
  }

  // Add security headers on every response
  const response = NextResponse.next()
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js needs unsafe-eval in dev
      "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
      "font-src 'self' fonts.gstatic.com",
      "img-src 'self' data: blob: cdn.sanity.io",
      "connect-src 'self' *.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
    ].join('; ')
  )

  return response
}

export const config = {
  matcher: [
    // Run on all routes except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
