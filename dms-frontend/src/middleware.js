// src/middleware.js
import { NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login'];

// These must match the actual folder structure:
// (superadmin)/dashboard → /dashboard
// (admin)/admin/dashboard → /admin/dashboard
// (employee)/employee/dashboard → /employee/dashboard
const ROLE_HOME = {
  SUPER_ADMIN:  '/dashboard',
  CLIENT_ADMIN: '/admin/dashboard',
  EMPLOYEE:     '/employee/dashboard',
};

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('dms_token')?.value;

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const home = ROLE_HOME[payload.role] || '/login';
        if (pathname === '/login') return NextResponse.redirect(new URL(home, request.url));
      } catch {}
    }
    return NextResponse.next();
  }

  if (!token) return NextResponse.redirect(new URL('/login', request.url));

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      const res = NextResponse.redirect(new URL('/login', request.url));
      res.cookies.delete('dms_token');
      return res;
    }

    // Role-based path guards
    if (pathname.startsWith('/dashboard') && payload.role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL(ROLE_HOME[payload.role] || '/login', request.url));
    }

    if (pathname.startsWith('/admin') && !['CLIENT_ADMIN', 'SUPER_ADMIN'].includes(payload.role)) {
      return NextResponse.redirect(new URL('/employee/dashboard', request.url));
    }

    if (pathname.startsWith('/employee') && payload.role === 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (pathname.startsWith('/employee') && payload.role === 'CLIENT_ADMIN') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
  } catch {
    const res = NextResponse.redirect(new URL('/login', request.url));
    res.cookies.delete('dms_token');
    return res;
  }

  return NextResponse.next();
}

export const config = {
  // Also skip any request for a static file (images, fonts, etc.) served straight
  // from /public — without this, an unauthenticated request for e.g. /banner1.png
  // gets redirected to /login like any other protected route, since it has no token.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|avif|mp4|webm|woff|woff2|ttf)$).*)'],
};
