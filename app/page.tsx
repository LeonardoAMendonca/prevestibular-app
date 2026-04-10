'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter }          from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const { status } = useSession();
  const router     = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
  }, [status, router]);

  async function handleLogin() {
    setLoading(true);
    await signIn('google', { callbackUrl: '/dashboard' });
  }

  return (
    <main className="min-h-screen flex" style={{ background: 'var(--c-surface)' }}>

      {/* ── Painel esquerdo — branding ── */}
      <aside
        className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 p-12"
        style={{ background: '#0c6665' }}
      >
        {/* Logo */}
        <div>
          <span
            className="text-3xl tracking-tight"
            style={{ fontFamily: 'var(--font-fraunces)', color: '#c9e8e8', fontWeight: 300 }}
          >
            Edu<span style={{ color: '#f8c06a' }}>Social</span>
          </span>
        </div>

        {/* Headline central */}
        <div>
          <h1
            className="text-5xl leading-[1.15] mb-6"
            style={{ fontFamily: 'var(--font-fraunces)', color: '#eef7f7', fontWeight: 300 }}
          >
            Gestão que<br />
            <em style={{ fontStyle: 'italic', color: '#f8c06a' }}>transforma</em><br />
            trajetórias.
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: '#9dd4d4', fontFamily: 'var(--font-jakarta)' }}>
            Sistema integrado de gestão para o Pré-Vestibular Social —
            matrículas, presença e comunicação em um só lugar.
          </p>
        </div>

        {/* Rodapé do painel */}
        <p className="text-xs" style={{ color: '#4aabaa', fontFamily: 'var(--font-jakarta)' }}>
          Acesso restrito a colaboradores cadastrados.
        </p>
      </aside>

      {/* ── Painel direito — formulário de login ── */}
      <section className="flex flex-1 items-center justify-center p-8">
        <div
          className="w-full max-w-sm animate-fade-in"
          style={{ animationDuration: '0.5s' }}
        >
          {/* Logo mobile */}
          <p
            className="lg:hidden text-2xl mb-10 tracking-tight"
            style={{ fontFamily: 'var(--font-fraunces)', color: '#0c6665', fontWeight: 300 }}
          >
            Edu<span style={{ color: '#e8952a' }}>Social</span>
          </p>

          <h2
            className="text-2xl mb-1"
            style={{ fontFamily: 'var(--font-fraunces)', color: '#1a1917', fontWeight: 400 }}
          >
            Entrar no sistema
          </h2>
          <p className="text-sm mb-8" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
            Use a conta Google institucional ou de voluntário.
          </p>

          {/* Botão Google */}
          <button
            onClick={handleLogin}
            disabled={loading || status === 'loading'}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl
                       bg-white border border-slate-200 hover:border-slate-300
                       text-sm font-medium text-slate-700 transition-all duration-150
                       shadow-card hover:shadow-card-hover disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ fontFamily: 'var(--font-jakarta)' }}
          >
            {loading ? (
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#dddbd4" strokeWidth="3"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="#0c6665" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            ) : (
              <GoogleIcon />
            )}
            {loading ? 'Redirecionando…' : 'Continuar com Google'}
          </button>

          {/* Divisor */}
          <div className="flex items-center gap-3 my-7">
            <div className="flex-1 h-px" style={{ background: 'var(--c-border)' }}/>
            <span className="text-xs" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
              Acesso seguro via OAuth 2.0
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--c-border)' }}/>
          </div>

          {/* Aviso LGPD */}
          <p className="text-xs text-center leading-relaxed" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
            Os dados são tratados em conformidade com a{' '}
            <span style={{ color: 'var(--c-primary)' }}>LGPD (Lei 13.709/2018)</span>.
            Apenas colaboradores cadastrados têm acesso.
          </p>
        </div>
      </section>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2a10.3 10.3 0 0 0-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.83.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.34A9 9 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3-2.34Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.32 0 2.5.45 3.44 1.34l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3 2.34C4.67 5.16 6.66 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}
