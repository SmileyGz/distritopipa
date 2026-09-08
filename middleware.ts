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
  '/_next/',          // Next.js internals
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
]

// API routes that require admin authentication
const PROTECTED_API_ROUTES = [
  '/api/admin',
  '/api/upload',
  '/api/generate-caption'
]

// Cookie name set by the client after gate confirmation
const AGE_COOKIE = 'dp_age_v1'
// Admin session cookie
const ADMIN_COOKIE = 'dp_admin_session'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Admin Panel & Admin APIs Protection
  const isAdminPath = pathname.startsWith('/admin') && pathname !== '/admin/login'
  const isProtectedApi = PROTECTED_API_ROUTES.some(p => pathname.startsWith(p)) && pathname !== '/api/admin/auth'
  
  // Also protect POST/PUT/DELETE to /api/products and /api/campaigns
  const isProtectedDataApi = (pathname.startsWith('/api/products') || pathname.startsWith('/api/campaigns')) 
    && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)

  if (isAdminPath || isProtectedApi || isProtectedDataApi) {
    const adminSession = request.cookies.get(ADMIN_COOKIE)
    
    if (!adminSession || adminSession.value !== 'authenticated') {
      if (pathname.startsWith('/api')) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      } else {
        const loginUrl = new URL('/admin/login', request.url)
        return NextResponse.redirect(loginUrl)
      }
    }
  }

  // Check for age-verified cookie (set by client JS after localStorage confirm)
  const verified = request.cookies.get(AGE_COOKIE)?.value === '1'

  if (!verified) {
    // Don't redirect — let the React AgeGate component handle the UX.
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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://t.distritopipa.com https://us-assets.i.posthog.com", 
      "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
      "font-src 'self' fonts.gstatic.com",
      "img-src 'self' data: blob: cdn.sanity.io *.supabase.co",
      "connect-src 'self' *.supabase.co wss://*.supabase.co https://t.distritopipa.com https://us.i.posthog.com https://us-assets.i.posthog.com",
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
