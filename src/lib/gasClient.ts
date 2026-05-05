// ============================================================
//  ARQUIVO: src/lib/gasClient.ts
//  Propósito: Camada de comunicação com o Google Apps Script.
//  TODAS as chamadas passam pelo servidor Next.js (/api/gas)
//  para evitar erros de CORS e não expor a URL do GAS.
// ============================================================

const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL!;

// Gera o token de autenticação (e-mail + timestamp em Base64)
export function generateToken(email: string): string {
  const tokenData = JSON.stringify({ email, timestamp: Date.now() });
  return btoa(tokenData);
}

// GET: busca o dump completo de dados.
// Chamado pelo route.ts do servidor — chama o GAS diretamente (sem CORS).
export async function fetchDataDump(userEmail: string) {
  const token = generateToken(userEmail);
  const url = `${GAS_URL}?token=${encodeURIComponent(token)}`;

  const response = await fetch(url, { method: 'GET', cache: 'no-store' });

  if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);

  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Erro desconhecido no servidor.');

  return data;
}

// POST: envia ações de escrita (ADD_STUDENT, UPDATE_STUDENT, etc.)
// ⚠️  Passa SEMPRE pelo /api/gas do Next.js — nunca chama o GAS direto do browser.
//     Isso evita o erro de CORS que ocorre ao chamar o GAS de localhost.
export async function postToGAS(
  action: string,
  payload: Record<string, unknown>,
  userEmail: string
) {
  const response = await fetch('/api/gas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload, userEmail }),
  });

  if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);

  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Erro ao processar ação.');

  return data;
}