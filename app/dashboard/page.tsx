import { getServerSession } from 'next-auth';
import { redirect }         from 'next/navigation';
import { authOptions }      from '@/lib/auth';
import type { UserRole }    from '@/types';

const ROLE_HOME: Record<UserRole, string> = {
  ADMIN:    '/dashboard/coord/usuarios',
  COORD:    '/dashboard/coord/ranking',
  PROF:     '/dashboard/prof',
  MONITOR:  '/dashboard/monitor',
  INSPETOR: '/dashboard/inspetor',
  ALUNO:    '/dashboard/inspetor',
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const role    = (session?.user?.role as UserRole) ?? 'INSPETOR';
  redirect(ROLE_HOME[role] ?? '/dashboard/inspetor');
}
