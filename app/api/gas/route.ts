// =============================================================================
//  app/api/gas/route.ts — Proxy Server-Side para o Google Apps Script
//
//  OBJETIVO: Evitar exposição do GAS_API_URL e resolver CORS.
//  O browser chama /api/gas, que injeta o idToken e encaminha ao GAS.
// =============================================================================

import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

const GAS_URL = process.env.GAS_API_URL!;

async function proxy(req: NextRequest, method: 'GET' | 'POST') {
  const session = await getServerSession(authOptions);

  if (!session?.idToken) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  // Repassa todos os query params para o GAS + injeta Authorization
  searchParams.set('Authorization', `Bearer ${session.idToken}`);

  const gasUrl = `${GAS_URL}?${searchParams.toString()}`;

  const init: RequestInit = { method: 'GET', redirect: 'follow' };

  if (method === 'POST') {
    const body = await req.text().catch(() => '');
    init.method = 'POST';
    init.body   = body;
    init.headers = { 'Content-Type': 'application/json' };
  }

  try {
    const gasRes  = await fetch(gasUrl, init);
    const gasData = await gasRes.json();
    return NextResponse.json(gasData, { status: gasRes.ok ? 200 : gasRes.status });
  } catch (err) {
    return NextResponse.json({ error: 'Falha ao contactar o servidor.' }, { status: 502 });
  }
}

export const GET  = (req: NextRequest) => proxy(req, 'GET');
export const POST = (req: NextRequest) => proxy(req, 'POST');
