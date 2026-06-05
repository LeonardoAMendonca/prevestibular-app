// ============================================================
//  CENTRAL DE PERMISSÕES DO PJU
//  ─────────────────────────────
//  Para dar ou retirar acesso de uma role a qualquer
//  funcionalidade do sistema, APENAS edite este arquivo.
//
//  COMO USAR:
//    import { can } from '@/lib/permissions';
//    if (can(currentUser.role, 'REGISTRAR_PRESENCA')) { ... }
//
//  EXEMPLO — dar acesso de edição de alunos ao INSPETOR:
//    EDITAR_ALUNOS: ['ADMIN', 'COORDENAÇÃO', 'INSPETOR'],
// ============================================================

export type UserRole = 'ADMIN' | 'COORDENAÇÃO' | 'PROFESSOR/MONITOR' | 'INSPETOR';

// ─── Matriz de permissões ─────────────────────────────────────
// Cada chave é uma permissão. O valor é a lista de roles
// que têm aquela permissão. Simples assim.
export const PERMISSIONS = {

  // ── Alunos ────────────────────────────────────────────────
  VER_ALUNOS:           ['ADMIN', 'COORDENAÇÃO', 'PROFESSOR/MONITOR'],
  CADASTRAR_ALUNOS:     ['ADMIN', 'COORDENAÇÃO'],
  EDITAR_ALUNOS:        ['ADMIN', 'COORDENAÇÃO'],
  DELETAR_ALUNOS:       ['ADMIN', 'COORDENAÇÃO'],

  // ── Presença ──────────────────────────────────────────────
  VER_PRESENCA:         ['ADMIN', 'COORDENAÇÃO', 'PROFESSOR/MONITOR', 'INSPETOR'],
  REGISTRAR_PRESENCA:   ['ADMIN', 'COORDENAÇÃO', 'PROFESSOR/MONITOR', 'INSPETOR'],

  // ── Observações ───────────────────────────────────────────
  VER_OBSERVACOES:      ['ADMIN', 'COORDENAÇÃO', 'INSPETOR'],
  ADICIONAR_OBSERVACAO: ['ADMIN', 'COORDENAÇÃO', 'INSPETOR'],

  // ── Documentos ────────────────────────────────────────────
  VER_DOCUMENTOS:       ['ADMIN', 'COORDENAÇÃO'],
  ENVIAR_DOCUMENTOS:    ['ADMIN', 'COORDENAÇÃO'],
  DELETAR_DOCUMENTOS:   ['ADMIN', 'COORDENAÇÃO'],

  // ── Usuários ──────────────────────────────────────────────
  VER_USUARIOS:         ['ADMIN', 'COORDENAÇÃO'],
  GERENCIAR_USUARIOS:   ['ADMIN'],

  // ── Relatórios e dashboard ────────────────────────────────
  VER_DASHBOARD:        ['ADMIN', 'COORDENAÇÃO', 'PROFESSOR/MONITOR', 'INSPETOR'],
  VER_ALERTAS_FALTAS:   ['ADMIN', 'COORDENAÇÃO', 'PROFESSOR/MONITOR', 'INSPETOR'],
  VER_DADOS_SENSIVEIS:  ['ADMIN', 'COORDENAÇÃO'], // renda, documentos bancários

} as const;

export type Permission = keyof typeof PERMISSIONS;

// ─── Função de verificação ────────────────────────────────────
// Uso: can(currentUser?.role, 'EDITAR_ALUNOS')
export function can(role: string | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

// ─── Constantes de configuração pedagógica ───────────────────
// Percentual máximo de faltas permitido antes de ser considerado
// em risco. Altere aqui para mudar o critério em todo o sistema.
export const LIMITE_FALTAS_PERCENT = 60; // 60% = máximo de faltas

// Quando o aluno está neste percentual ou acima, entra no alerta amarelo
export const ALERTA_FALTAS_PERCENT = 40; // 40%+ = atenção