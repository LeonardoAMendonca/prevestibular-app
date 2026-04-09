// =============================================================================
//  lib/auth.ts — NextAuth v4 Configuration
//
//  ENV vars required:
//    GOOGLE_CLIENT_ID        — OAuth 2.0 client ID (Google Cloud Console)
//    GOOGLE_CLIENT_SECRET    — OAuth 2.0 client secret
//    NEXTAUTH_SECRET         — openssl rand -base64 32
//    NEXTAUTH_URL            — https://seu-projeto.vercel.app
//    GAS_API_URL             — URL da sua Web App do Google Apps Script
// =============================================================================

import { NextAuthOptions } from 'next-auth';
import GoogleProvider       from 'next-auth/providers/google';
import type { UserRole }    from '@/types';

const GAS_URL = process.env.GAS_API_URL!;

/**
 * Busca o papel (role) do usuário no GAS usando o id_token recém-emitido.
 * Chamado apenas no momento do login.
 */
async function fetchUserRole(idToken: string, email: string): Promise<UserRole> {
  try {
    const res = await fetch(`${GAS_URL}?path=users&Authorization=Bearer+${idToken}`);
    if (!res.ok) return 'ALUNO';

    const data = await res.json();
    const found = (data.users as { email: string; role: UserRole }[])
      ?.find(u => u.email.toLowerCase() === email.toLowerCase());

    return found?.role ?? 'ALUNO';
  } catch {
    return 'ALUNO';
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Solicita id_token e acesso offline (para refresh)
      authorization: {
        params: {
          scope:  'openid email profile',
          prompt: 'select_account',
        },
      },
    }),
  ],

  callbacks: {
    // Persiste o id_token no JWT interno do NextAuth
    async jwt({ token, account, profile }) {
      if (account?.id_token) {
        token.idToken = account.id_token;
        token.role    = await fetchUserRole(
          account.id_token,
          (profile?.email ?? token.email) as string,
        );
      }
      return token;
    },

    // Expõe idToken e role na sessão do lado do cliente/servidor
    async session({ session, token }) {
      session.idToken       = token.idToken as string;
      session.user.role     = (token.role as UserRole) ?? 'ALUNO';
      return session;
    },
  },

  pages: {
    signIn: '/',         // login customizado na home
    error:  '/auth/error',
  },

  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }, // 8h

  secret: process.env.NEXTAUTH_SECRET,
};
