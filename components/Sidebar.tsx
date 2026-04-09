'use client';

import Link      from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { clsx } from 'clsx';
import {
  Users, CalendarCheck, ClipboardList, UserPlus,
  BarChart3, Settings, LogOut, BookOpen, ChevronRight,
} from 'lucide-react';
import type { UserRole } from '@/types';

interface NavItem {
  href:     string;
  label:    string;
  icon:     React.ElementType;
  minRole:  UserRole;
}

const ROLE_LEVEL: Record<UserRole, number> = {
  ADMIN: 5, COORD: 4, PROF: 3, MONITOR: 2, INSPETOR: 1, ALUNO: 0,
};

const ROLE_COLOR: Record<UserRole, string> = {
  ADMIN:    'bg-amber-100 text-amber-700',
  COORD:    'bg-teal-100  text-teal-700',
  PROF:     'bg-blue-100  text-blue-700',
  MONITOR:  'bg-purple-100 text-purple-700',
  INSPETOR: 'bg-slate-100 text-slate-600',
  ALUNO:    'bg-slate-100 text-slate-500',
};

const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN:    'Admin', COORD:    'Coordenação', PROF: 'Professor',
  MONITOR:  'Monitor', INSPETOR: 'Inspetor', ALUNO: 'Aluno',
};

const NAV: NavItem[] = [
  { href: '/dashboard/inspetor',       label: 'Chamada',         icon: CalendarCheck, minRole: 'INSPETOR' },
  { href: '/dashboard/prof',           label: 'Minhas Aulas',    icon: BookOpen,      minRole: 'PROF'     },
  { href: '/dashboard/monitor',        label: 'Monitorias',      icon: ClipboardList, minRole: 'MONITOR'  },
  { href: '/matricula',                label: 'Matrícula',       icon: UserPlus,      minRole: 'COORD'    },
  { href: '/dashboard/coord/ranking',  label: 'Ranking',         icon: BarChart3,     minRole: 'COORD'    },
  { href: '/dashboard/coord/usuarios', label: 'Usuários',        icon: Users,         minRole: 'COORD'    },
];

export default function Sidebar() {
  const { data: session } = useSession();
  const pathname          = usePathname();
  const role              = (session?.user?.role as UserRole) ?? 'ALUNO';
  const level             = ROLE_LEVEL[role] ?? 0;

  const visibleItems = NAV.filter(item => level >= ROLE_LEVEL[item.minRole]);

  return (
    <aside
      className="flex flex-col h-screen w-60 shrink-0 sticky top-0 shadow-sidebar z-30"
      style={{ background: '#0f5456' }}
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <span
          className="text-xl tracking-tight select-none"
          style={{ fontFamily: 'var(--font-fraunces)', color: '#c9e8e8', fontWeight: 300 }}
        >
          Edu<span style={{ color: '#f8c06a' }}>Social</span>
        </span>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <p className="text-xs font-medium px-2 mb-2" style={{ color: 'rgba(201,232,232,0.45)', fontFamily: 'var(--font-jakarta)' }}>
          MENU
        </p>
        <ul className="space-y-0.5">
          {visibleItems.map(item => {
            const isActive = pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                    'font-body group',
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-teal-100/70 hover:bg-white/8 hover:text-white',
                  )}
                  style={{ fontFamily: 'var(--font-jakarta)' }}
                >
                  <item.icon size={16} className="shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight size={12} className="opacity-60" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Perfil */}
      <div className="p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        {session?.user && (
          <div className="flex items-start gap-3 mb-3">
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-medium"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#c9e8e8', fontFamily: 'var(--font-jakarta)' }}
            >
              {session.user.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: '#eef7f7', fontFamily: 'var(--font-jakarta)' }}>
                {session.user.name}
              </p>
              <span className={clsx('role-badge text-xs mt-0.5', ROLE_COLOR[role])}>
                {ROLE_LABEL[role]}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors"
          style={{ color: 'rgba(201,232,232,0.55)', fontFamily: 'var(--font-jakarta)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#c9e8e8')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(201,232,232,0.55)')}
        >
          <LogOut size={13} />
          Sair do sistema
        </button>
      </div>
    </aside>
  );
}
