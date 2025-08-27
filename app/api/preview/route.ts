import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const redirectTo = url.searchParams.get('to') || '/'
  const res = NextResponse.redirect(new URL(redirectTo, url.origin))
  res.cookies.set('preview', '1', { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 })
  return res
}
