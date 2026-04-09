'use client';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: 'var(--c-surface)' }}>
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#fef2f2' }}>
          <AlertTriangle size={24} style={{ color: '#dc2626' }} />
        </div>
        <h1 className="text-2xl mb-2" style={{ fontFamily: 'var(--font-fraunces)', fontWeight: 300 }}>
          Acesso negado
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
          Seu e-mail não está cadastrado no sistema. Solicite acesso à coordenação.
        </p>
        <Link href="/" className="btn-primary inline-flex">
          Tentar novamente
        </Link>
      </div>
    </div>
  );
}
