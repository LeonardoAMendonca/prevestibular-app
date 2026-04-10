// =============================================================================
//  EduSocial — TypeScript Types
// =============================================================================

export type UserRole = 'ADMIN' | 'COORD' | 'PROF' | 'MONITOR' | 'INSPETOR' | 'ALUNO';

export interface EduUser {
  email:      string;
  name:       string;
  role:       UserRole;
  created_at?: string;
  created_by?: string;
}

export type CandidateStatus =
  | 'INSCRITO'
  | 'CLASSIFICADO'
  | 'APROVADO'
  | 'MATRICULADO'
  | 'REPROVADO';

export interface Candidate {
  id:                string;
  name:              string;
  cpf:               string;
  email:             string;
  phone:             string;
  birth_date:        string;
  rg:                string;
  endereco:          string;
  renda_familiar:    number;
  renda_per_capita:  number;
  num_membros:       number;
  escola_publica:    'SIM' | 'NÃO';
  risco_social:      'SIM' | 'NÃO';
  pontuacao?:        number;
  status:            CandidateStatus;
  submitted_at:      string;
}

export type StudentStatus = 'ATIVO' | 'INATIVO';

export interface Student {
  id_student:       string;
  cpf:              string;
  name:             string;
  birth_date:       string;
  candidate_id:     string;
  status:           StudentStatus;
  drive_folder_id:  string;
  drive_photo_id?:  string;
  enrolled_at:      string;
  enrolled_by:      string;
}

export type AttendanceStatus = 'P' | 'F';
export type AttendanceType   = 'REGULAR' | 'MONITORIA';

export interface AttendanceRecord {
  id_event:    string;
  student_id:  string;
  date:        string;
  status:      AttendanceStatus;
  type:        AttendanceType;
  assigned_by: string;
  recorded_at: string;
}

export interface RankedCandidate extends Candidate {
  posicao: number;
}

export interface LogEntry {
  timestamp:   string;
  user_email:  string;
  action:      string;
  affected_id: string;
  detail:      string;
}

// API response wrappers
export interface ApiOk<T>  { status: 200; data: T }
export interface ApiErr    { status: number; error: string }
export type     ApiResult<T> = ApiOk<T> | ApiErr;

// NextAuth extension
declare module 'next-auth' {
  interface Session {
    idToken?: string;
    user: EduUser & { image?: string };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    idToken?: string;
    role?: UserRole;
  }
}
