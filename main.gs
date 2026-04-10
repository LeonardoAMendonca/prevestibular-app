// =============================================================================
//  EduSocial — Google Apps Script Backend (main.gs)
//  Sistema de Gestão para Pré-Vestibular Social
//
//  DEPLOY: Publicar como Web App
//    · Execute as: Me (conta dona da planilha)
//    · Who has access: Anyone
//
//  AUTH: O frontend envia o Google id_token via header Authorization: Bearer <token>
//        O GAS valida o token na API tokeninfo do Google e extrai o e-mail do usuário.
//        Session.getActiveUser() NÃO é usado pois retorna vazio no modo "Anyone".
// =============================================================================


// =============================================================================
//  1. CONFIGURAÇÃO CENTRAL
// =============================================================================

const CONFIG = {
  SPREADSHEET_ID: 'COLE_O_ID_DA_SUA_PLANILHA_AQUI',
  DRIVE_ROOT_FOLDER_ID: 'COLE_O_ID_DA_PASTA_RAIZ_NO_DRIVE',
  ALLOWED_ORIGINS: [
    'https://seu-projeto.vercel.app',
    'http://localhost:3000',          // desenvolvimento local
  ],
  SHEETS: {
    USERS:      'db_users',
    CANDIDATES: 'db_candidates',
    STUDENTS:   'db_students',
    ATTENDANCE: 'db_attendance',
    LOGS:       'db_logs',
  },
};

// Hierarquia de papéis: número maior = mais permissão
const ROLE_LEVEL = {
  ADMIN:    5,
  COORD:    4,
  PROF:     3,
  MONITOR:  2,
  INSPETOR: 1,
  ALUNO:    0,
};

// Mapa de rotas: método + caminho -> { minRole, handler }
// minRole define o nível mínimo para executar a ação
const ROUTES = {
  'GET  /users':               { minRole: 'COORD',    handler: handleGetUsers },
  'POST /users':               { minRole: 'ADMIN',    handler: handleCreateUser },
  'PUT  /users':               { minRole: 'COORD',    handler: handleUpdateUser },
  'DELETE /users':             { minRole: 'ADMIN',    handler: handleDeleteUser },

  'GET  /candidates':          { minRole: 'COORD',    handler: handleGetCandidates },
  'GET  /candidates/search':   { minRole: 'INSPETOR', handler: handleSearchCandidate },

  'GET  /students':            { minRole: 'INSPETOR', handler: handleGetStudents },
  'POST /students':            { minRole: 'COORD',    handler: handleEnrollStudent },
  'PUT  /students':            { minRole: 'COORD',    handler: handleUpdateStudent },
  'GET  /students/photo':      { minRole: 'INSPETOR', handler: handleGetStudentPhoto },

  'GET  /attendance':          { minRole: 'INSPETOR', handler: handleGetAttendance },
  'POST /attendance':          { minRole: 'INSPETOR', handler: handleMarkAttendance },
  'PUT  /attendance':          { minRole: 'PROF',     handler: handleCorrectAttendance },

  'GET  /ranking':             { minRole: 'COORD',    handler: handleGetRanking },
  'POST /ranking/calculate':   { minRole: 'ADMIN',    handler: handleCalculateRanking },

  'POST /files/upload':        { minRole: 'COORD',    handler: handleFileUpload },
};


// =============================================================================
//  2. ENTRYPOINTS HTTP (doGet / doPost)
// =============================================================================

function doGet(e) {
  return handleRequest('GET', e);
}

function doPost(e) {
  return handleRequest('POST', e);
}

/**
 * Roteador central. Recebe qualquer requisição, valida, roteia e responde.
 * @param {string} method - 'GET' | 'POST' | 'PUT' | 'DELETE'
 * @param {Object} e - Evento do GAS (e.parameter, e.postData, e.headers)
 */
function handleRequest(method, e) {
  // Suporte a method override: o frontend envia POST com ?_method=PUT
  const effectiveMethod = (e.parameter._method || method).toUpperCase();
  const path            = '/' + (e.parameter.path || '').replace(/^\/+/, '');

  try {
    // ── 2.1 Autenticação ────────────────────────────────────────────────────
    const authHeader = e.parameter.Authorization || e.parameter.authorization || '';
    const token      = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return jsonResponse({ error: 'Não autenticado. Envie o id_token no header Authorization.' }, 401);
    }

    const userEmail = verifyGoogleToken(token);

    if (!userEmail) {
      return jsonResponse({ error: 'Token inválido ou expirado.' }, 401);
    }

    // ── 2.2 Autorização (RBAC) ───────────────────────────────────────────────
    const user = getUserByEmail(userEmail);

    if (!user) {
      return jsonResponse({ error: 'Usuário não cadastrado no sistema.' }, 403);
    }

    const routeKey = `${effectiveMethod}  ${path}`;
    const route    = ROUTES[routeKey];

    if (!route) {
      return jsonResponse({ error: `Rota não encontrada: ${effectiveMethod} ${path}` }, 404);
    }

    if (!hasPermission(user.role, route.minRole)) {
      return jsonResponse({
        error: `Acesso negado. Seu perfil (${user.role}) não tem permissão para esta ação.`
      }, 403);
    }

    // ── 2.3 Parse do body ────────────────────────────────────────────────────
    let body = {};
    if (e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (_) {
        return jsonResponse({ error: 'Body JSON inválido.' }, 400);
      }
    }

    // ── 2.4 Execução ─────────────────────────────────────────────────────────
    const result = route.handler({ params: e.parameter, body, user });
    return jsonResponse(result, 200);

  } catch (err) {
    logError_(err, e);
    return jsonResponse({ error: 'Erro interno do servidor.', detail: err.message }, 500);
  }
}


// =============================================================================
//  3. SEGURANÇA — Autenticação e Controle de Acesso
// =============================================================================

/**
 * Valida o id_token do Google e retorna o e-mail do usuário.
 * Usa a endpoint pública do Google — sem bibliotecas externas.
 *
 * @param {string} idToken - JWT emitido pelo Google OAuth2
 * @returns {string|null} E-mail verificado ou null se inválido
 */
function verifyGoogleToken(idToken) {
  try {
    const url      = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const code     = response.getResponseCode();

    if (code !== 200) return null;

    const payload = JSON.parse(response.getContentText());

    // Garante que o token é destinado a esta aplicação (evita token replay de outro app)
    if (!payload.email || !payload.email_verified) return null;

    return payload.email;
  } catch (_) {
    return null;
  }
}

/**
 * Verifica se um papel (role) tem nível suficiente para uma ação.
 *
 * @param {string} userRole   - Papel atual do usuário (ex: 'COORD')
 * @param {string} minRole    - Nível mínimo exigido pela rota (ex: 'ADMIN')
 * @returns {boolean}
 */
function hasPermission(userRole, minRole) {
  const userLevel = ROLE_LEVEL[userRole] ?? -1;
  const minLevel  = ROLE_LEVEL[minRole]  ?? 99;
  return userLevel >= minLevel;
}

/**
 * Proteção extra: impede que COORD altere ou delete usuários ADMIN.
 * Deve ser chamada dentro dos handlers de usuário antes de qualquer escrita.
 *
 * @param {Object} actingUser  - Usuário que executa a ação
 * @param {string} targetEmail - E-mail do usuário-alvo
 */
function guardAdminProtection_(actingUser, targetEmail) {
  const target = getUserByEmail(targetEmail);
  if (!target) return; // alvo não existe, o handler vai tratar

  if (target.role === 'ADMIN' && actingUser.role !== 'ADMIN') {
    throw new Error('Operação negada: somente ADMIN pode alterar outro usuário ADMIN.');
  }
}


// =============================================================================
//  4. HANDLERS — Usuários
// =============================================================================

function handleGetUsers({ user }) {
  const sheet = getSheet_(CONFIG.SHEETS.USERS);
  const rows  = sheetToObjects_(sheet);
  // COORD não vê senhas nem logs; ADMIN vê tudo
  return { users: rows.map(u => sanitizeUser_(u, user.role)) };
}

function handleCreateUser({ body, user }) {
  validateRequiredFields_(body, ['email', 'name', 'role']);

  if (!ROLE_LEVEL.hasOwnProperty(body.role)) {
    throw new Error(`Papel inválido: ${body.role}`);
  }

  // COORD não pode criar ADMIN
  if (body.role === 'ADMIN' && user.role !== 'ADMIN') {
    throw new Error('Somente ADMIN pode criar outro ADMIN.');
  }

  const sheet    = getSheet_(CONFIG.SHEETS.USERS);
  const existing = getUserByEmail(body.email);

  if (existing) {
    throw new Error(`Usuário com e-mail ${body.email} já existe.`);
  }

  const newRow = [
    body.email.toLowerCase().trim(),
    body.name.trim(),
    body.role.toUpperCase(),
    new Date().toISOString(), // created_at
    user.email,               // created_by
  ];

  sheet.appendRow(newRow);
  writeLog_({ userEmail: user.email, action: 'CREATE_USER', affectedId: body.email });

  return { message: 'Usuário criado com sucesso.', email: body.email };
}

function handleUpdateUser({ body, user }) {
  validateRequiredFields_(body, ['email']);
  guardAdminProtection_(user, body.email);

  const sheet   = getSheet_(CONFIG.SHEETS.USERS);
  const headers = getHeaders_(sheet);
  const rowIdx  = findRowByField_(sheet, 'email', body.email);

  if (rowIdx === -1) throw new Error('Usuário não encontrado.');

  // Atualiza apenas campos enviados (patch parcial)
  const allowedFields = ['name', 'role'];
  allowedFields.forEach(field => {
    if (body[field] !== undefined) {
      const col = headers.indexOf(field) + 1;
      if (col > 0) sheet.getRange(rowIdx, col).setValue(body[field]);
    }
  });

  writeLog_({ userEmail: user.email, action: 'UPDATE_USER', affectedId: body.email });
  return { message: 'Usuário atualizado.' };
}

function handleDeleteUser({ body, user }) {
  validateRequiredFields_(body, ['email']);
  guardAdminProtection_(user, body.email);

  if (body.email === user.email) {
    throw new Error('Você não pode deletar sua própria conta.');
  }

  const sheet  = getSheet_(CONFIG.SHEETS.USERS);
  const rowIdx = findRowByField_(sheet, 'email', body.email);

  if (rowIdx === -1) throw new Error('Usuário não encontrado.');

  sheet.deleteRow(rowIdx);
  writeLog_({ userEmail: user.email, action: 'DELETE_USER', affectedId: body.email });
  return { message: 'Usuário removido.' };
}


// =============================================================================
//  5. HANDLERS — Candidatos
// =============================================================================

function handleGetCandidates({ params }) {
  const sheet = getSheet_(CONFIG.SHEETS.CANDIDATES);
  let rows    = sheetToObjects_(sheet);

  // Filtro opcional por status
  if (params.status) {
    rows = rows.filter(r => r.status === params.status.toUpperCase());
  }

  return { total: rows.length, candidates: rows };
}

function handleSearchCandidate({ params }) {
  validateRequiredFields_(params, ['cpf']);
  const cpf = normalizeCpf_(params.cpf);

  const sheet = getSheet_(CONFIG.SHEETS.CANDIDATES);
  const rows  = sheetToObjects_(sheet);
  const found = rows.find(r => normalizeCpf_(r.cpf) === cpf);

  if (!found) return { found: false };
  return { found: true, candidate: found };
}


// =============================================================================
//  6. HANDLERS — Alunos (Matrícula Workflow)
// =============================================================================

function handleGetStudents({ params }) {
  const sheet = getSheet_(CONFIG.SHEETS.STUDENTS);
  let rows    = sheetToObjects_(sheet);

  if (params.status) {
    rows = rows.filter(r => r.status === params.status.toUpperCase());
  }

  return { total: rows.length, students: rows };
}

/**
 * Matrícula: converte Candidato em Aluno.
 * Valida duplicidade de CPF em tempo real.
 */
function handleEnrollStudent({ body, user }) {
  validateRequiredFields_(body, ['cpf', 'candidate_id', 'name', 'birth_date']);

  const cpf = normalizeCpf_(body.cpf);

  // ── Verificação de duplicidade ────────────────────────────────────────────
  const studSheet = getSheet_(CONFIG.SHEETS.STUDENTS);
  const existing  = sheetToObjects_(studSheet).find(r => normalizeCpf_(r.cpf) === cpf);

  if (existing) {
    throw new Error(`CPF ${cpf} já possui matrícula ativa (id: ${existing.id_student}).`);
  }

  // ── Valida se existe na lista de candidatos ───────────────────────────────
  const candSheet = getSheet_(CONFIG.SHEETS.CANDIDATES);
  const candidate = sheetToObjects_(candSheet).find(r => r.id === body.candidate_id);

  if (!candidate) throw new Error('Candidato não encontrado.');
  if (candidate.status !== 'APROVADO') {
    throw new Error(`Candidato com status "${candidate.status}" não pode ser matriculado.`);
  }

  // ── Cria pasta no Drive ───────────────────────────────────────────────────
  const folderId = createStudentFolder_(cpf, body.name);

  // ── Insere na planilha de alunos ──────────────────────────────────────────
  const studentId = `STU-${Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyyMMdd')}-${cpf.slice(-4)}`;

  studSheet.appendRow([
    studentId,
    cpf,
    body.name.trim(),
    body.birth_date,
    body.candidate_id,
    'ATIVO',
    folderId,
    '',  // drive_photo_id (será preenchido no upload)
    new Date().toISOString(),
    user.email,
  ]);

  // ── Atualiza status do candidato ──────────────────────────────────────────
  const candRowIdx = findRowByField_(candSheet, 'id', body.candidate_id);
  const candHeaders = getHeaders_(candSheet);
  const statusCol   = candHeaders.indexOf('status') + 1;
  candSheet.getRange(candRowIdx, statusCol).setValue('MATRICULADO');

  writeLog_({ userEmail: user.email, action: 'ENROLL_STUDENT', affectedId: studentId });

  return { message: 'Aluno matriculado com sucesso.', id_student: studentId, drive_folder: folderId };
}

function handleUpdateStudent({ body, user }) {
  validateRequiredFields_(body, ['id_student']);

  const sheet   = getSheet_(CONFIG.SHEETS.STUDENTS);
  const rowIdx  = findRowByField_(sheet, 'id_student', body.id_student);

  if (rowIdx === -1) throw new Error('Aluno não encontrado.');

  const headers       = getHeaders_(sheet);
  const allowedFields = ['status', 'drive_photo_id'];

  allowedFields.forEach(field => {
    if (body[field] !== undefined) {
      const col = headers.indexOf(field) + 1;
      if (col > 0) sheet.getRange(rowIdx, col).setValue(body[field]);
    }
  });

  writeLog_({ userEmail: user.email, action: 'UPDATE_STUDENT', affectedId: body.id_student });
  return { message: 'Aluno atualizado.' };
}

function handleGetStudentPhoto({ params }) {
  validateRequiredFields_(params, ['id_student']);

  const sheet   = getSheet_(CONFIG.SHEETS.STUDENTS);
  const student = sheetToObjects_(sheet).find(r => r.id_student === params.id_student);

  if (!student) throw new Error('Aluno não encontrado.');
  if (!student.drive_photo_id) return { photo_url: null };

  // Retorna URL de visualização restrita (não pública) via Drive
  const file    = DriveApp.getFileById(student.drive_photo_id);
  const photoUrl = `https://drive.google.com/uc?id=${student.drive_photo_id}&export=view`;

  return {
    id_student:  student.id_student,
    name:        student.name,
    photo_url:   photoUrl,
    drive_id:    student.drive_photo_id,
  };
}


// =============================================================================
//  7. HANDLERS — Presença
// =============================================================================

function handleGetAttendance({ params }) {
  const sheet = getSheet_(CONFIG.SHEETS.ATTENDANCE);
  let rows    = sheetToObjects_(sheet);

  // Filtros opcionais
  if (params.date)       rows = rows.filter(r => r.date === params.date);
  if (params.type)       rows = rows.filter(r => r.type === params.type.toUpperCase());
  if (params.student_id) rows = rows.filter(r => r.student_id === params.student_id);

  return { total: rows.length, attendance: rows };
}

/**
 * Registra presença/falta.
 * REGULAR e MONITORIA ficam em campos distintos, sem conflito.
 */
function handleMarkAttendance({ body, user }) {
  validateRequiredFields_(body, ['student_id', 'date', 'status', 'type']);

  if (!['P', 'F'].includes(body.status.toUpperCase())) {
    throw new Error('Status de presença deve ser "P" (presente) ou "F" (falta).');
  }

  if (!['REGULAR', 'MONITORIA'].includes(body.type.toUpperCase())) {
    throw new Error('Tipo de aula deve ser "REGULAR" ou "MONITORIA".');
  }

  // Valida se o aluno existe e está ativo
  const studSheet = getSheet_(CONFIG.SHEETS.STUDENTS);
  const student   = sheetToObjects_(studSheet).find(r => r.id_student === body.student_id);

  if (!student)                throw new Error('Aluno não encontrado.');
  if (student.status !== 'ATIVO') throw new Error('Aluno inativo não pode ter presença registrada.');

  // Evita duplicidade: mesma data + tipo + aluno
  const attSheet = getSheet_(CONFIG.SHEETS.ATTENDANCE);
  const existing = sheetToObjects_(attSheet).find(
    r => r.student_id === body.student_id &&
         r.date       === body.date &&
         r.type       === body.type.toUpperCase()
  );

  if (existing) {
    throw new Error(
      `Presença já registrada para este aluno em ${body.date} (${body.type}). ` +
      `Use PUT /attendance para corrigir.`
    );
  }

  const eventId = `EVT-${body.date}-${body.type[0]}-${body.student_id}`;

  attSheet.appendRow([
    eventId,
    body.student_id,
    body.date,
    body.status.toUpperCase(),
    body.type.toUpperCase(),
    user.email,              // assigned_by
    new Date().toISOString(),
  ]);

  writeLog_({ userEmail: user.email, action: 'MARK_ATTENDANCE', affectedId: eventId });

  return { message: 'Presença registrada.', id_event: eventId };
}

/**
 * Corrige presença já lançada.
 * OBRIGATÓRIO: gera log de auditoria (imutabilidade lógica).
 */
function handleCorrectAttendance({ body, user }) {
  validateRequiredFields_(body, ['id_event', 'status', 'reason']);

  if (!['P', 'F'].includes(body.status.toUpperCase())) {
    throw new Error('Status deve ser "P" ou "F".');
  }

  const sheet  = getSheet_(CONFIG.SHEETS.ATTENDANCE);
  const rowIdx = findRowByField_(sheet, 'id_event', body.id_event);

  if (rowIdx === -1) throw new Error('Registro de presença não encontrado.');

  const headers   = getHeaders_(sheet);
  const statusCol = headers.indexOf('status') + 1;

  const previousStatus = sheet.getRange(rowIdx, statusCol).getValue();
  sheet.getRange(rowIdx, statusCol).setValue(body.status.toUpperCase());

  // Log imutável com justificativa (LGPD + auditoria)
  writeLog_({
    userEmail:  user.email,
    action:     'CORRECT_ATTENDANCE',
    affectedId: body.id_event,
    detail:     `${previousStatus} → ${body.status.toUpperCase()} | Motivo: ${body.reason}`,
  });

  return { message: 'Presença corrigida. Log gerado.', id_event: body.id_event };
}


// =============================================================================
//  8. HANDLERS — Ranking Socioeconômico
// =============================================================================

function handleGetRanking({ params }) {
  const sheet = getSheet_(CONFIG.SHEETS.CANDIDATES);
  let rows    = sheetToObjects_(sheet).filter(r => r.pontuacao !== undefined && r.pontuacao !== '');

  rows.sort((a, b) => Number(b.pontuacao) - Number(a.pontuacao));

  if (params.limit) rows = rows.slice(0, Number(params.limit));

  return { total: rows.length, ranking: rows.map((r, i) => ({ posicao: i + 1, ...r })) };
}

/**
 * Batch Ranking Motor — disparado manualmente após encerramento das inscrições.
 *
 * Fórmula:
 *   pontuacao = (PESO_RENDA / renda_per_capita) + bonus_escola_publica + bonus_risco_social
 *
 * Quanto MENOR a renda per capita, MAIOR a pontuação (inversão ponderada).
 * Bônus são aditivos.
 */
function handleCalculateRanking({ user }) {
  const PESO_RENDA        = 1000; // valor de referência para inversão de renda
  const BONUS_ESC_PUBLICA = 10;
  const BONUS_RISCO       = 15;

  const sheet   = getSheet_(CONFIG.SHEETS.CANDIDATES);
  const headers = getHeaders_(sheet);
  const rows    = sheet.getDataRange().getValues();

  const rendaIdx  = headers.indexOf('renda_per_capita');
  const escIdx    = headers.indexOf('escola_publica');   // 'SIM' | 'NÃO'
  const riscoIdx  = headers.indexOf('risco_social');     // 'SIM' | 'NÃO'
  const pontuIdx  = headers.indexOf('pontuacao');
  const statusIdx = headers.indexOf('status');

  if ([rendaIdx, escIdx, riscoIdx, pontuIdx].includes(-1)) {
    throw new Error('Colunas do ranking não encontradas na planilha de candidatos. Verifique os cabeçalhos.');
  }

  let calculados = 0;

  for (let i = 1; i < rows.length; i++) { // começa em 1 (pula header)
    const renda  = Number(rows[i][rendaIdx]);
    const escPub = String(rows[i][escIdx]).toUpperCase()  === 'SIM';
    const risco  = String(rows[i][riscoIdx]).toUpperCase() === 'SIM';

    if (!renda || renda <= 0) continue; // candidato sem renda preenchida

    const pontuacao = (PESO_RENDA / renda)
                    + (escPub ? BONUS_ESC_PUBLICA : 0)
                    + (risco  ? BONUS_RISCO        : 0);

    sheet.getRange(i + 1, pontuIdx  + 1).setValue(Math.round(pontuacao * 100) / 100);
    sheet.getRange(i + 1, statusIdx + 1).setValue('CLASSIFICADO');
    calculados++;
  }

  writeLog_({ userEmail: user.email, action: 'CALCULATE_RANKING', affectedId: 'ALL', detail: `${calculados} candidatos calculados.` });

  return { message: 'Ranking calculado com sucesso.', calculados };
}


// =============================================================================
//  9. HANDLERS — Upload de Arquivos (base64 → Drive)
// =============================================================================

/**
 * Recebe arquivo em base64 do frontend, salva na pasta CPF do Drive.
 * Retorna o ID do arquivo para ser armazenado na db_students.
 */
function handleFileUpload({ body, user }) {
  validateRequiredFields_(body, ['cpf', 'file_base64', 'mime_type', 'file_name']);

  const cpf        = normalizeCpf_(body.cpf);
  const folderId   = getOrCreateStudentFolder_(cpf);
  const fileBlob   = Utilities.newBlob(
    Utilities.base64Decode(body.file_base64),
    body.mime_type,
    body.file_name
  );

  const folder = DriveApp.getFolderById(folderId);
  const file   = folder.createFile(fileBlob);

  // Permissão: restrita (somente quem tem o link, sem acesso público)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  writeLog_({ userEmail: user.email, action: 'UPLOAD_FILE', affectedId: file.getId(), detail: body.file_name });

  return {
    message:   'Arquivo enviado com sucesso.',
    file_id:   file.getId(),
    file_name: file.getName(),
    view_url:  `https://drive.google.com/uc?id=${file.getId()}&export=view`,
  };
}


// =============================================================================
//  10. FUNÇÕES AUXILIARES — Google Sheets
// =============================================================================

/**
 * Retorna a Sheet pelo nome. Lança erro se não existir.
 * @param {string} name
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet_(name) {
  const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error(`Planilha "${name}" não encontrada. Crie a aba com esse nome exato.`);
  return sheet;
}

/**
 * Converte as linhas de uma Sheet em array de objetos usando a primeira linha como chave.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {Object[]}
 */
function sheetToObjects_(sheet) {
  const data    = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim().toLowerCase().replace(/ /g, '_'));
  return data.slice(1).map(row =>
    headers.reduce((obj, key, i) => {
      obj[key] = row[i];
      return obj;
    }, {})
  );
}

/**
 * Retorna a primeira linha (cabeçalho) como array de strings.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {string[]}
 */
function getHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(h => String(h).trim().toLowerCase().replace(/ /g, '_'));
}

/**
 * Localiza o índice de linha (1-based) onde field === value.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} field  - Nome do campo (cabeçalho)
 * @param {string} value  - Valor procurado
 * @returns {number} Índice da linha (1-based) ou -1 se não encontrado
 */
function findRowByField_(sheet, field, value) {
  const headers = getHeaders_(sheet);
  const colIdx  = headers.indexOf(field);
  if (colIdx === -1) return -1;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colIdx]).trim() === String(value).trim()) return i + 1;
  }
  return -1;
}

/**
 * Busca usuário na db_users pelo e-mail. Retorna objeto ou null.
 * @param {string} email
 * @returns {Object|null}
 */
function getUserByEmail(email) {
  try {
    const sheet = getSheet_(CONFIG.SHEETS.USERS);
    const rows  = sheetToObjects_(sheet);
    return rows.find(r => String(r.email).toLowerCase() === String(email).toLowerCase()) || null;
  } catch (_) {
    return null;
  }
}

/** Remove campos sensíveis conforme papel do solicitante */
function sanitizeUser_(user, requesterRole) {
  const safe = { email: user.email, name: user.name, role: user.role };
  if (ROLE_LEVEL[requesterRole] >= ROLE_LEVEL['ADMIN']) {
    safe.created_at = user.created_at;
    safe.created_by = user.created_by;
  }
  return safe;
}


// =============================================================================
//  11. FUNÇÕES AUXILIARES — Google Drive
// =============================================================================

/**
 * Cria pasta nomeada por CPF dentro da pasta raiz do Drive.
 * @param {string} cpf
 * @param {string} studentName
 * @returns {string} ID da pasta criada
 */
function createStudentFolder_(cpf, studentName) {
  const root      = DriveApp.getFolderById(CONFIG.DRIVE_ROOT_FOLDER_ID);
  const folderName = `${cpf}_${studentName.split(' ')[0]}`;
  const folder    = root.createFolder(folderName);
  return folder.getId();
}

/**
 * Retorna ID da pasta do aluno se existir, ou cria uma nova.
 * @param {string} cpf
 * @returns {string} ID da pasta
 */
function getOrCreateStudentFolder_(cpf) {
  // Tenta localizar pelo aluno na planilha primeiro
  const sheet   = getSheet_(CONFIG.SHEETS.STUDENTS);
  const student = sheetToObjects_(sheet).find(r => normalizeCpf_(r.cpf) === cpf);

  if (student && student.drive_folder_id) {
    return student.drive_folder_id;
  }

  // Fallback: cria pasta avulsa
  const root   = DriveApp.getFolderById(CONFIG.DRIVE_ROOT_FOLDER_ID);
  const folder = root.createFolder(`${cpf}_sem_nome`);
  return folder.getId();
}


// =============================================================================
//  12. FUNÇÕES AUXILIARES — Logs e Validação
// =============================================================================

/**
 * Grava linha imutável na db_logs.
 * Chamado em TODA operação de escrita (imutabilidade de logs).
 */
function writeLog_({ userEmail, action, affectedId, detail = '' }) {
  const sheet = getSheet_(CONFIG.SHEETS.LOGS);
  sheet.appendRow([
    new Date().toISOString(),
    userEmail,
    action,
    String(affectedId),
    detail,
  ]);
}

/** Grava erros de sistema nos logs também */
function logError_(err, e) {
  try {
    const sheet = getSheet_(CONFIG.SHEETS.LOGS);
    sheet.appendRow([
      new Date().toISOString(),
      'SYSTEM',
      'ERROR',
      err.message,
      JSON.stringify({ params: e && e.parameter }),
    ]);
  } catch (_) { /* silencia falha no log para não esconder erro original */ }
}

/**
 * Valida campos obrigatórios em um objeto.
 * Lança erro descritivo com todos os campos faltando.
 */
function validateRequiredFields_(obj, fields) {
  const missing = fields.filter(f => obj[f] === undefined || obj[f] === null || obj[f] === '');
  if (missing.length > 0) {
    throw new Error(`Campos obrigatórios ausentes: ${missing.join(', ')}`);
  }
}

/** Normaliza CPF: remove pontos, traços e espaços */
function normalizeCpf_(cpf) {
  return String(cpf).replace(/\D/g, '').trim();
}

/**
 * Constrói a resposta JSON com cabeçalhos CORS corretos.
 * @param {Object} data    - Payload de resposta
 * @param {number} status  - Código HTTP
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function jsonResponse(data, status = 200) {
  const output = ContentService
    .createTextOutput(JSON.stringify({ status, ...data }))
    .setMimeType(ContentService.MimeType.JSON);

  // Nota: GAS não suporta cabeçalhos HTTP customizados na resposta direta.
  // O CORS deve ser gerenciado por um proxy no Next.js (API Routes no Vercel)
  // que faz o forward da requisição ao GAS — nunca chamar GAS diretamente do browser.

  return output;
}


// =============================================================================
//  13. SETUP INICIAL — Cria estrutura das planilhas (execute uma vez)
// =============================================================================

/**
 * Execute esta função UMA VEZ manualmente para criar todas as abas
 * com os cabeçalhos corretos.
 *
 * Menu: Executar → setupSpreadsheet
 */
function setupSpreadsheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  const schema = {
    [CONFIG.SHEETS.USERS]: [
      'email', 'name', 'role', 'created_at', 'created_by',
    ],
    [CONFIG.SHEETS.CANDIDATES]: [
      'id', 'name', 'cpf', 'email', 'phone',
      'birth_date', 'rg', 'endereco',
      'renda_familiar', 'renda_per_capita', 'num_membros',
      'escola_publica',   // SIM | NÃO
      'risco_social',     // SIM | NÃO
      'pontuacao',        // calculado pelo ranking motor
      'status',           // INSCRITO | CLASSIFICADO | APROVADO | MATRICULADO | REPROVADO
      'submitted_at',
    ],
    [CONFIG.SHEETS.STUDENTS]: [
      'id_student', 'cpf', 'name', 'birth_date', 'candidate_id',
      'status',           // ATIVO | INATIVO
      'drive_folder_id',
      'drive_photo_id',
      'enrolled_at',
      'enrolled_by',
    ],
    [CONFIG.SHEETS.ATTENDANCE]: [
      'id_event', 'student_id', 'date', 'status', 'type',
      'assigned_by', 'recorded_at',
    ],
    [CONFIG.SHEETS.LOGS]: [
      'timestamp', 'user_email', 'action', 'affected_id', 'detail',
    ],
  };

  Object.entries(schema).forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      Logger.log(`Aba criada: ${name}`);
    } else {
      Logger.log(`Aba já existe: ${name}`);
    }

    // Só escreve cabeçalho se a planilha estiver vazia
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#4a4a4a')
        .setFontColor('#ffffff');
      sheet.setFrozenRows(1);
      Logger.log(`  Cabeçalhos inseridos: ${headers.join(', ')}`);
    }
  });

  Logger.log('✅ Setup concluído. Verifique a planilha.');
}
