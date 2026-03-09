export type UserRole = 'colaborador' | 'administrador'
export type WorkerType = 'motorista' | 'ajudante'
export type WorkerTypeAll = 'motorista' | 'ajudante' | 'ambos'
export type IndicatorStatus = 'abaixo_meta' | 'dentro_meta' | 'acima_meta'
export type PlanStatus = 'aberto' | 'em_andamento' | 'concluido' | 'atrasado' | 'cancelado'
export type FeedbackType = 'operacao' | 'sistema' | 'processo' | 'seguranca' | 'sugestao' | 'incidente'
export type FeedbackUrgency = 'baixa' | 'media' | 'alta' | 'critica'
export type FeedbackStatus = 'aberto' | 'em_analise' | 'respondido' | 'encerrado'
export type IncentiveStatus = 'estimado' | 'fechado' | 'revisao'

export interface Unit {
  id: string; nome: string; codigo: string; cidade: string;
  estado: string; ativo: boolean; created_at: string;
}

export interface Route {
  id: string; unidade_id: string; nome: string; codigo: string;
  descricao: string; ativo: boolean; created_at: string; units?: Unit;
}

export interface User {
  id: string; auth_user_id: string; nome: string; email: string;
  matricula: string; role: UserRole; worker_type: WorkerType | null;
  unidade_id: string | null; rota_id: string | null; avatar_url: string | null;
  ativo: boolean; created_at: string; units?: Unit; routes?: Route;
}

export interface Indicator {
  id: string; codigo: string; nome: string; categoria: string;
  unidade_medida: string; descricao: string;
  applies_to_worker_type: WorkerTypeAll; ativo: boolean; created_at: string;
}

export interface Goal {
  id: string; indicator_id: string; unidade_id: string | null;
  worker_type: WorkerType | null; user_id: string | null;
  valor_meta: number; periodo_tipo: string; vigencia_inicio: string;
  vigencia_fim: string | null; ativo: boolean; created_at: string;
  indicators?: Indicator; units?: Unit;
}

export interface IncentiveRule {
  id: string; indicator_id: string; worker_type: WorkerType;
  unidade_id: string | null; peso: number; meta: number;
  valor_minimo: number; valor_maximo: number;
  regra_json: Record<string, unknown>; vigencia_inicio: string;
  vigencia_fim: string | null; ativo: boolean; created_at: string;
  indicators?: Indicator; units?: Unit;
}

export interface UserIndicatorDaily {
  id: string; user_id: string; indicator_id: string;
  data_referencia: string; valor: number; meta: number | null;
  percentual_atingimento: number | null; status: IndicatorStatus | null;
  origem_dado: string; created_at: string; updated_at: string;
  users?: User; indicators?: Indicator;
}

export interface UserIncentiveDaily {
  id: string; user_id: string; data_referencia: string;
  valor_estimado: number; valor_fechado: number | null;
  status: IncentiveStatus; detalhes_json: Record<string, unknown>; created_at: string;
}

export interface RootCauseRecord {
  id: string; user_id: string; indicator_id: string; data_referencia: string;
  descricao_problema: string; categoria_causa: string; causa_raiz: string;
  impacto: string; created_at: string; users?: User; indicators?: Indicator;
}

export interface ActionPlan {
  id: string; root_cause_id: string; responsavel_user_id: string;
  descricao_acao: string; prazo: string | null; status: PlanStatus;
  observacoes: string; created_at: string; updated_at: string;
  root_cause_records?: RootCauseRecord; users?: User;
}

export interface Feedback {
  id: string; user_id: string; unidade_id: string | null; rota_id: string | null;
  data_referencia: string; tipo: FeedbackType; titulo: string; descricao: string;
  urgencia: FeedbackUrgency; status: FeedbackStatus;
  resposta_lideranca: string | null; respondido_por: string | null;
  responded_at: string | null; created_at: string;
  users?: User; units?: Unit; routes?: Route;
}
