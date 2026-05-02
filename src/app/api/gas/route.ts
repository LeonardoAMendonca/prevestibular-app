// ============================================================
//  ARQUIVO: src/app/api/gas/route.ts
//  Propósito: Ponte segura entre o browser e o Google Apps Script.
//
//  POR QUE ESTE ARQUIVO EXISTE?
//  Se o browser chamasse o GAS diretamente, a URL do GAS
//  ficaria visível para qualquer pessoa inspecionando o tráfego.
//  Ao rotear pelo servidor Next.js, escondemos essa URL e
//  também ganhamos um ponto central para adicionar rate limiting
//  e outros controles de segurança no futuro.
//
//  FLUXO: Browser → /api/gas (Next.js) → GAS → resposta
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { fetchDataDump } from '@/lib/gasClient';

// ─── Rota POST: Busca o dump de dados ─────────────────────────
// Chamada pelo AuthContext quando o usuário faz login.
export async function POST(request: NextRequest) {
  try {
    // Verifica se existe sessão válida no servidor.
    // Isso é uma segunda camada de segurança: mesmo que alguém
    // tente chamar /api/gas diretamente, sem sessão Google válida
    // o servidor rejeita a requisição.
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Sessão inválida. Faça login novamente.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const userEmail = body.userEmail || session.user.email;

    // Confirmação extra: o e-mail do body deve bater com a sessão
    if (userEmail !== session.user.email) {
      return NextResponse.json(
        { success: false, error: 'Inconsistência de sessão detectada.' },
        { status: 403 }
      );
    }

    // Chama o GAS e retorna o dump de dados
    const gasData = await fetchDataDump(userEmail);

    return NextResponse.json(gasData);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';

    // Diferencia erros de "usuário não autorizado" de erros técnicos
    if (message.includes('Acesso negado') || message.includes('não cadastrado')) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Falha na comunicação com o servidor de dados: ' + message },
      { status: 500 }
    );
  }
}

// ─── Rota GET: Health check ────────────────────────────────────
// Útil para verificar se a rota está ativa.
// Acesse /api/gas no browser para confirmar.
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'API PJU está no ar.',
    timestamp: new Date().toISOString(),
  });
}