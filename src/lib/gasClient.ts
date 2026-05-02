// ============================================================
//  ARQUIVO: src/lib/gasClient.ts
//  Propósito: Camada de comunicação com o Google Apps Script.
//  Pense neste arquivo como o "telefone" que o frontend usa
//  para ligar para o backend (GAS). Toda chamada à API passa aqui.
// ============================================================

// A URL do seu Web App do Google Apps Script.
// Você vai preencher após publicar o script (Passo 3 do guia).
const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL!;

// Gera o token que o backend usa para identificar o usuário.
// O token é o e-mail codificado em Base64 com um timestamp.
// Funciona como uma senha temporária: vale por 1 hora.
export function generateToken(email: string): string {
  const tokenData = JSON.stringify({
    email: email,
    timestamp: Date.now(),
  });
  // btoa() converte texto para Base64 (disponível no navegador e no Node.js)
  return btoa(tokenData);
}

// Faz uma requisição GET ao backend (busca de dados).
// Retorna o dump completo: usuários + alunos.
export async function fetchDataDump(userEmail: string) {
  const token = generateToken(userEmail);
  const url = `${GAS_URL}?token=${encodeURIComponent(token)}`;

  const response = await fetch(url, {
    method: 'GET',
    // 'no-cors' NÃO funciona aqui pois precisamos ler a resposta.
    // O backend GAS já configura os headers CORS corretos.
    cache: 'no-store', // Deixamos o SWR cuidar do cache no frontend
  });

  if (!response.ok) {
    throw new Error(`Erro HTTP: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Erro desconhecido no servidor.');
  }

  return data;
}

// Faz uma requisição POST ao backend (escrita de dados).
// Parâmetros:
//   action  - O que fazer (ex: 'ADD_STUDENT', 'UPDATE_STUDENT')
//   payload - Os dados a serem salvos
//   userEmail - E-mail do usuário autenticado
export async function postToGAS(
  action: string,
  payload: Record<string, unknown>,
  userEmail: string
) {
  const token = generateToken(userEmail);

  const response = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload, token }),
  });

  if (!response.ok) {
    throw new Error(`Erro HTTP: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Erro ao processar ação.');
  }

  return data;
}