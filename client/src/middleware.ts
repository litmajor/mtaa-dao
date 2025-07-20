import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Protect all /dashboard, /profile, /vault, /proposals, /daos, /wallet, /referrals routes
const protectedRoutes = [
  '/dashboard',
  '/profile',
  '/vault',
  '/proposals',
  '/daos',
  '/wallet',
  '/referrals',
  // Add more protected routes here as needed
  '/settings', 
  '/notifications',
  '/admin', 
  '/billing',
  '/leaderboard',
  '/dao/settings',
  '/dao/reputation',
  '/dao/overview',
  '/dao/members',
  '/dao/treasury',
  '/dao/proposals',
  '/dao/tasks',
  '/dao/analytics',
  '/dao/activities',
  '/dao/announcements',
  '/dao/roles',
  '/dao/permissions',
  '/dao/archives',
  '/dao/meetings',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));
  if (!isProtected) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', req.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard',
    '/profile',
    '/vault',
    '/proposals',
    '/daos',
    '/wallet',
    '/referrals',
    '/settings',
    '/notifications',
    '/admin',
    '/billing',
    '/leaderboard',
    '/dao/settings',
    '/dao/reputation',
    '/dao/overview',
    '/dao/members',
    '/dao/treasury',
    '/dao/proposals',
    '/dao/tasks',
    '/dao/analytics',
    '/dao/activities',
    '/dao/announcements',
    '/dao/roles',
    '/dao/permissions',
    '/dao/archives',
    '/dao/meetings',
    // Add more protected routes here as needed
  ],
};
