import { NextRequest, NextResponse } from 'next/server';
import { hasValidSessionCookie } from './lib/auth/middleware-session';

const PROTECTED_PATHS = ['/', '/settings'];
const AUTH_PATHS = ['/auth/login', '/auth/register'];

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const isLoggedIn = await hasValidSessionCookie(request);

  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
  const isAuthPage = AUTH_PATHS.includes(pathname);

  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/settings/:path*', '/auth/login', '/auth/register'],
};
