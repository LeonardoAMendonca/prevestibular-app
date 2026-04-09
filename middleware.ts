// =============================================================================
//  middleware.ts — Proteção de Rotas por Papel (RBAC no Edge)
// =============================================================================

import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { UserRole } from './types';

const ROLE_LEVEL: Record<UserRole, number> = {
  ADMIN: 5, COORD: 4, PROF: 3, MONITOR: 2, INSPETOR: 1, ALUNO: 0,
};

const ROUTE_GUARDS: Record<string, UserRole> = {
  '/dashboard/coord':    'COORD',
  '/dashboard/prof':     'PROF',
  '/dashboard/monitor':  'MONITOR',
  '/dashboard/inspetor': 'INSPETOR',
  '/matricula':          'COORD',
};

export default withAuth(
  function middleware(req) {
    const role     = (req.nextauth.token?.role as UserRole) ?? 'ALUNO';
    const pathname = req.nextUrl.pathname;

    for (const [prefix, minRole] of Object.entries(ROUTE_GUARDS)) {
      if (pathname.startsWith(prefix)) {
        if (ROLE_LEVEL[role] < ROLE_LEVEL[minRole]) {
          return NextResponse.redirect(new URL('/dashboard', req.url));
        }
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  },
);

export const config = {
  matcher: ['/dashboard/:path*', '/matricula/:path*'],
};
