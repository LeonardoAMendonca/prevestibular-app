// ============================================================
//  ARQUIVO: src/app/api/gas/route.ts
//  Propósito: Ponte segura entre o browser e o Google Apps Script.
//
//  FLUXO:
//  Browser → /api/gas (Next.js servidor) → GAS → resposta
//
//  Este servidor pode chamar o GAS sem CORS pois é uma chamada
//  servidor-para-servidor. O browser nunca fala com o GAS diretamente.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { fetchDataDump, generateToken } from '@/lib/gasClient';

const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL!;

// ─── POST: trata dois casos ────────────────────────────────
// Caso 1 (sem action): login inicial — busca dump de dados
// Caso 2 (com action): escrita — ADD_STUDENT, UPDATE_STUDENT, etc.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Sessão inválida. Faça login novamente.' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Garante que o e-mail bate com a sessão ativa
    const userEmail = body.userEmail || session.user.email;
    if (userEmail !== session.user.email) {
      return NextResponse.json(
        { success: false, error: 'Inconsistência de sessão detectada.' },
        { status: 403 }
      );
    }

    // ── Caso 1: sem action → busca dump (login inicial) ──
    if (!body.action) {
      const gasData = await fetchDataDump(userEmail);
      return NextResponse.json(gasData);
    }

    // ── Caso 2: com action → repassa ao GAS via POST ─────
    // O servidor Next.js faz a chamada ao GAS (sem CORS).
    const token = generateToken(userEmail);

    const gasResponse = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:  body.action,
        payload: body.payload,
        token,
      }),
    });

    if (!gasResponse.ok) {
      throw new Error(`Erro HTTP do GAS: ${gasResponse.status}`);
    }

    const gasData = await gasResponse.json();
    return NextResponse.json(gasData);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';

    if (message.includes('Acesso negado') || message.includes('não cadastrado')) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Falha na comunicação com o servidor: ' + message },
      { status: 500 }
    );
  }
}

// ─── GET: health check ────────────────────────────────────
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'API PJU está no ar.',
    timestamp: new Date().toISOString(),
  });
}