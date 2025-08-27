import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const PUBLIC_PATHS = [
  '/coming-soon',
  '/favicon',
  '/robots.txt',
  '/sitemap.xml',
  '/assets',
  '/api/preview',
  '/_next', // Next.js internals and static assets
]

export function middleware(req: NextRequest) {
  const url = req.nextUrl
  const { pathname, searchParams, hostname } = url

  // Always allow internal/static/public routes
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Allow all Vercel Preview deployments to bypass the gate
  if (process.env.VERCEL_ENV === 'preview' || hostname.endsWith('.vercel.app')) {
    return NextResponse.next()
  }

  // One-time key unlock via query param (?key=...)
  const expected = process.env.NEXT_PUBLIC_PREVIEW_KEY || 'opensesame'
  const provided = searchParams.get('key')
  if (provided && provided === expected) {
    const res = NextResponse.redirect(new URL(pathname, url.origin))
    res.cookies.set('preview', '1', { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 })
    return res
  }

  // Cookie unlock after /api/preview or key flow
  const hasPreviewCookie = req.cookies.get('preview')?.value === '1'
  if (hasPreviewCookie) {
    return NextResponse.next()
  }

  // Default: show Coming Soon on Production
  const rewrite = url.clone()
  rewrite.pathname = '/coming-soon'
  rewrite.search = ''
  return NextResponse.rewrite(rewrite)
}
