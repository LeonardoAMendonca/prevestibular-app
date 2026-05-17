// ============================================================
//  ARQUIVO: src/lib/authOptions.ts
//  Propósito: Configuração do NextAuth com Google OAuth.
//  NextAuth é a biblioteca que gerencia o login com Google.
// ============================================================

import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions: NextAuthOptions = {
  // Define o Google como provedor de login
  providers: [
    GoogleProvider({
      // Estas variáveis ficam no arquivo .env.local (nunca no código!)
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  // Callbacks são funções executadas em momentos chave do fluxo de login
  callbacks: {
    // Executado após login bem-sucedido.
    // Se retornar false, o login é bloqueado.
    // Aqui poderíamos fazer uma pré-verificação, mas delegamos
    // essa lógica para o AuthContext (mais eficiente).
    async signIn({ account }) {
      // Aceita apenas contas Google (não outras)
      return account?.provider === 'google';
    },

    // Executado ao criar/atualizar o token JWT interno do NextAuth.
    // Guardamos o e-mail no token para ter acesso fácil depois.
    async jwt({ token, account }) {
      if (account) {
        token.provider = account.provider;
      }
      return token;
    },

    // Executado ao criar a sessão para o cliente.
    // O que retornarmos aqui fica disponível via useSession().
    async session({ session, token }) {
      if (session.user) {
        // Garante que o e-mail está sempre disponível
        session.user.email = token.email ?? session.user.email;
      }
      return session;
    },
  },

  // Página customizada de login (opcional)
  // Se não definida, NextAuth usa a página padrão dele
  pages: {
    signIn: '/login',
  },
};