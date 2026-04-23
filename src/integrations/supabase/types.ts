export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      action_plans: {
        Row: {
          created_at: string
          descricao_acao: string
          id: string
          observacoes: string
          prazo: string | null
          responsavel_user_id: string
          root_cause_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao_acao?: string
          id?: string
          observacoes?: string
          prazo?: string | null
          responsavel_user_id: string
          root_cause_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao_acao?: string
          id?: string
          observacoes?: string
          prazo?: string | null
          responsavel_user_id?: string
          root_cause_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_responsavel_user_id_fkey"
            columns: ["responsavel_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_root_cause_id_fkey"
            columns: ["root_cause_id"]
            isOneToOne: false
            referencedRelation: "root_cause_records"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      feedbacks: {
        Row: {
          created_at: string
          data_referencia: string
          descricao: string
          id: string
          responded_at: string | null
          respondido_por: string | null
          resposta_lideranca: string | null
          rota_id: string | null
          status: string
          tipo: string
          titulo: string
          unidade_id: string | null
          urgencia: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_referencia?: string
          descricao?: string
          id?: string
          responded_at?: string | null
          respondido_por?: string | null
          resposta_lideranca?: string | null
          rota_id?: string | null
          status?: string
          tipo: string
          titulo?: string
          unidade_id?: string | null
          urgencia?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_referencia?: string
          descricao?: string
          id?: string
          responded_at?: string | null
          respondido_por?: string | null
          resposta_lideranca?: string | null
          rota_id?: string | null
          status?: string
          tipo?: string
          titulo?: string
          unidade_id?: string | null
          urgencia?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_respondido_por_fkey"
            columns: ["respondido_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          indicator_id: string
          periodo_tipo: string
          unidade_id: string | null
          user_id: string | null
          valor_bonificacao: number
          valor_bonificacao_desafio: number
          valor_desafio: number
          valor_meta: number
          vigencia_fim: string | null
          vigencia_inicio: string
          worker_type: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          indicator_id: string
          periodo_tipo?: string
          unidade_id?: string | null
          user_id?: string | null
          valor_bonificacao?: number
          valor_bonificacao_desafio?: number
          valor_desafio?: number
          valor_meta?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string
          worker_type?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          indicator_id?: string
          periodo_tipo?: string
          unidade_id?: string | null
          user_id?: string | null
          valor_bonificacao?: number
          valor_bonificacao_desafio?: number
          valor_desafio?: number
          valor_meta?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string
          worker_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      incentive_deductions: {
        Row: {
          created_at: string
          created_by: string | null
          data_referencia: string
          id: string
          indicator_id: string
          motivo: string
          percentual_atingimento: number
          user_id: string
          valor_desconto: number
          valor_meta: number
          valor_realizado: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_referencia?: string
          id?: string
          indicator_id: string
          motivo?: string
          percentual_atingimento?: number
          user_id: string
          valor_desconto?: number
          valor_meta?: number
          valor_realizado?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_referencia?: string
          id?: string
          indicator_id?: string
          motivo?: string
          percentual_atingimento?: number
          user_id?: string
          valor_desconto?: number
          valor_meta?: number
          valor_realizado?: number
        }
        Relationships: [
          {
            foreignKeyName: "incentive_deductions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incentive_deductions_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incentive_deductions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      incentive_rules: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          indicator_id: string
          meta: number
          peso: number
          regra_json: Json
          unidade_id: string | null
          valor_maximo: number
          valor_minimo: number
          vigencia_fim: string | null
          vigencia_inicio: string
          worker_type: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          indicator_id: string
          meta?: number
          peso?: number
          regra_json?: Json
          unidade_id?: string | null
          valor_maximo?: number
          valor_minimo?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string
          worker_type: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          indicator_id?: string
          meta?: number
          peso?: number
          regra_json?: Json
          unidade_id?: string | null
          valor_maximo?: number
          valor_minimo?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string
          worker_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "incentive_rules_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incentive_rules_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      indicators: {
        Row: {
          applies_to_worker_type: string
          ativo: boolean
          categoria: string
          codigo: string
          created_at: string
          descricao: string
          id: string
          nome: string
          unidade_medida: string
        }
        Insert: {
          applies_to_worker_type?: string
          ativo?: boolean
          categoria?: string
          codigo: string
          created_at?: string
          descricao?: string
          id?: string
          nome: string
          unidade_medida?: string
        }
        Update: {
          applies_to_worker_type?: string
          ativo?: boolean
          categoria?: string
          codigo?: string
          created_at?: string
          descricao?: string
          id?: string
          nome?: string
          unidade_medida?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          created_at: string
          failure_reason: string | null
          id: string
          identifier: string
          identifier_type: string
          ip_address: string | null
          success: boolean
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_nome: string | null
        }
        Insert: {
          created_at?: string
          failure_reason?: string | null
          id?: string
          identifier?: string
          identifier_type?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_nome?: string | null
        }
        Update: {
          created_at?: string
          failure_reason?: string | null
          id?: string
          identifier?: string
          identifier_type?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "login_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mapa_historico: {
        Row: {
          aju1_user_id: string | null
          aju2_user_id: string | null
          capacidade: number | null
          capacidade_veiculo_kg: number | null
          carga_atual: string | null
          cd_aju1: string | null
          cd_aju2: string | null
          cd_mot: string | null
          classificacao_roads: string | null
          classificacao_roadshow: string | null
          created_at: string
          custo_spot: number | null
          cx_as: number | null
          cx_carr_com: number | null
          cx_carreg: number | null
          cx_entreg: number | null
          cx_rota: number | null
          data_operacao: string
          entr_vol: string | null
          entrega: string | null
          entregas: number | null
          frota: string | null
          hr_entr: string | null
          hr_sai: string | null
          id: string
          km_desloc: number | null
          km_entr: number | null
          km_laco: number | null
          km_prev: number | null
          km_sai: number | null
          mapa: string
          mot_nao_carr: number | null
          mot_user_id: string | null
          ocupacao: number | null
          peso_carga_kg: number | null
          placa: string | null
          regiao: string | null
          rshow: number | null
          tempo_prev: string | null
          tmpo_desloc: string | null
          tmpo_interno: string | null
          tmpo_laco: string | null
          transp: number | null
          veic_bm: number | null
          veiculo: string | null
          vl_eq_ajd: number | null
          vl_eq_mot: number | null
          vl_pto_ajd: number | null
          vl_pto_mot: number | null
        }
        Insert: {
          aju1_user_id?: string | null
          aju2_user_id?: string | null
          capacidade?: number | null
          capacidade_veiculo_kg?: number | null
          carga_atual?: string | null
          cd_aju1?: string | null
          cd_aju2?: string | null
          cd_mot?: string | null
          classificacao_roads?: string | null
          classificacao_roadshow?: string | null
          created_at?: string
          custo_spot?: number | null
          cx_as?: number | null
          cx_carr_com?: number | null
          cx_carreg?: number | null
          cx_entreg?: number | null
          cx_rota?: number | null
          data_operacao?: string
          entr_vol?: string | null
          entrega?: string | null
          entregas?: number | null
          frota?: string | null
          hr_entr?: string | null
          hr_sai?: string | null
          id?: string
          km_desloc?: number | null
          km_entr?: number | null
          km_laco?: number | null
          km_prev?: number | null
          km_sai?: number | null
          mapa: string
          mot_nao_carr?: number | null
          mot_user_id?: string | null
          ocupacao?: number | null
          peso_carga_kg?: number | null
          placa?: string | null
          regiao?: string | null
          rshow?: number | null
          tempo_prev?: string | null
          tmpo_desloc?: string | null
          tmpo_interno?: string | null
          tmpo_laco?: string | null
          transp?: number | null
          veic_bm?: number | null
          veiculo?: string | null
          vl_eq_ajd?: number | null
          vl_eq_mot?: number | null
          vl_pto_ajd?: number | null
          vl_pto_mot?: number | null
        }
        Update: {
          aju1_user_id?: string | null
          aju2_user_id?: string | null
          capacidade?: number | null
          capacidade_veiculo_kg?: number | null
          carga_atual?: string | null
          cd_aju1?: string | null
          cd_aju2?: string | null
          cd_mot?: string | null
          classificacao_roads?: string | null
          classificacao_roadshow?: string | null
          created_at?: string
          custo_spot?: number | null
          cx_as?: number | null
          cx_carr_com?: number | null
          cx_carreg?: number | null
          cx_entreg?: number | null
          cx_rota?: number | null
          data_operacao?: string
          entr_vol?: string | null
          entrega?: string | null
          entregas?: number | null
          frota?: string | null
          hr_entr?: string | null
          hr_sai?: string | null
          id?: string
          km_desloc?: number | null
          km_entr?: number | null
          km_laco?: number | null
          km_prev?: number | null
          km_sai?: number | null
          mapa?: string
          mot_nao_carr?: number | null
          mot_user_id?: string | null
          ocupacao?: number | null
          peso_carga_kg?: number | null
          placa?: string | null
          regiao?: string | null
          rshow?: number | null
          tempo_prev?: string | null
          tmpo_desloc?: string | null
          tmpo_interno?: string | null
          tmpo_laco?: string | null
          transp?: number | null
          veic_bm?: number | null
          veiculo?: string | null
          vl_eq_ajd?: number | null
          vl_eq_mot?: number | null
          vl_pto_ajd?: number | null
          vl_pto_mot?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      refugo_031134: {
        Row: {
          aju1_user_id: string | null
          aju2_user_id: string | null
          bicada_concorrente: number | null
          bicada_externa: number | null
          bicada_interna: number | null
          cod_ajudante: string | null
          cod_conferente: string | null
          cod_motorista: string | null
          cor_fora_padrao: number | null
          created_at: string
          data_operacao: string
          descricao_item: string | null
          faltante: number | null
          id: string
          imported_by: string | null
          item: string | null
          logomarca_estranha: number | null
          mapa: string
          mot_user_id: string | null
          nome_ajudante: string | null
          nome_conferente: string | null
          nome_motorista: string | null
          outros: number | null
          pct_incidencia_veiculo: number | null
          pct_nao_aferido: number | null
          pct_refugo: number
          placa: string | null
          qt_boa: number | null
          quebrada: number | null
          rotulo_plastico: number | null
          segunda: number | null
          sujidade_externa: number | null
          sujidade_interna: number | null
          tampada: number | null
          tipo_sorteio: string | null
          total_aferido: number | null
          transportadora: string | null
          trincada: number | null
          veiculo: string | null
        }
        Insert: {
          aju1_user_id?: string | null
          aju2_user_id?: string | null
          bicada_concorrente?: number | null
          bicada_externa?: number | null
          bicada_interna?: number | null
          cod_ajudante?: string | null
          cod_conferente?: string | null
          cod_motorista?: string | null
          cor_fora_padrao?: number | null
          created_at?: string
          data_operacao: string
          descricao_item?: string | null
          faltante?: number | null
          id?: string
          imported_by?: string | null
          item?: string | null
          logomarca_estranha?: number | null
          mapa: string
          mot_user_id?: string | null
          nome_ajudante?: string | null
          nome_conferente?: string | null
          nome_motorista?: string | null
          outros?: number | null
          pct_incidencia_veiculo?: number | null
          pct_nao_aferido?: number | null
          pct_refugo?: number
          placa?: string | null
          qt_boa?: number | null
          quebrada?: number | null
          rotulo_plastico?: number | null
          segunda?: number | null
          sujidade_externa?: number | null
          sujidade_interna?: number | null
          tampada?: number | null
          tipo_sorteio?: string | null
          total_aferido?: number | null
          transportadora?: string | null
          trincada?: number | null
          veiculo?: string | null
        }
        Update: {
          aju1_user_id?: string | null
          aju2_user_id?: string | null
          bicada_concorrente?: number | null
          bicada_externa?: number | null
          bicada_interna?: number | null
          cod_ajudante?: string | null
          cod_conferente?: string | null
          cod_motorista?: string | null
          cor_fora_padrao?: number | null
          created_at?: string
          data_operacao?: string
          descricao_item?: string | null
          faltante?: number | null
          id?: string
          imported_by?: string | null
          item?: string | null
          logomarca_estranha?: number | null
          mapa?: string
          mot_user_id?: string | null
          nome_ajudante?: string | null
          nome_conferente?: string | null
          nome_motorista?: string | null
          outros?: number | null
          pct_incidencia_veiculo?: number | null
          pct_nao_aferido?: number | null
          pct_refugo?: number
          placa?: string | null
          qt_boa?: number | null
          quebrada?: number | null
          rotulo_plastico?: number | null
          segunda?: number | null
          sujidade_externa?: number | null
          sujidade_interna?: number | null
          tampada?: number | null
          tipo_sorteio?: string | null
          total_aferido?: number | null
          transportadora?: string | null
          trincada?: number | null
          veiculo?: string | null
        }
        Relationships: []
      }
      reposicao_031805: {
        Row: {
          aju_user_id: string | null
          ajudante_codigo: string | null
          ajudante_nome: string | null
          codigo_cliente: string | null
          created_at: string
          data_solicitacao: string | null
          descricao_produto: string | null
          descricao_unb: string | null
          hora: string | null
          id: string
          imported_by: string | null
          justificativa: string | null
          mapa_origem: string | null
          mot_user_id: string | null
          motorista_codigo: string | null
          motorista_nome: string | null
          nf_origem: string | null
          nome_cliente: string | null
          observacao: string | null
          produto: string | null
          quantidade: number | null
          sistema_origem: string | null
          solicitacao_reposicao: string | null
          status_solicitacao: string | null
          tipo_solicitacao: string | null
          unb: string | null
          unidade_medida: string | null
          valor: number | null
          valor_unitario: number | null
        }
        Insert: {
          aju_user_id?: string | null
          ajudante_codigo?: string | null
          ajudante_nome?: string | null
          codigo_cliente?: string | null
          created_at?: string
          data_solicitacao?: string | null
          descricao_produto?: string | null
          descricao_unb?: string | null
          hora?: string | null
          id?: string
          imported_by?: string | null
          justificativa?: string | null
          mapa_origem?: string | null
          mot_user_id?: string | null
          motorista_codigo?: string | null
          motorista_nome?: string | null
          nf_origem?: string | null
          nome_cliente?: string | null
          observacao?: string | null
          produto?: string | null
          quantidade?: number | null
          sistema_origem?: string | null
          solicitacao_reposicao?: string | null
          status_solicitacao?: string | null
          tipo_solicitacao?: string | null
          unb?: string | null
          unidade_medida?: string | null
          valor?: number | null
          valor_unitario?: number | null
        }
        Update: {
          aju_user_id?: string | null
          ajudante_codigo?: string | null
          ajudante_nome?: string | null
          codigo_cliente?: string | null
          created_at?: string
          data_solicitacao?: string | null
          descricao_produto?: string | null
          descricao_unb?: string | null
          hora?: string | null
          id?: string
          imported_by?: string | null
          justificativa?: string | null
          mapa_origem?: string | null
          mot_user_id?: string | null
          motorista_codigo?: string | null
          motorista_nome?: string | null
          nf_origem?: string | null
          nome_cliente?: string | null
          observacao?: string | null
          produto?: string | null
          quantidade?: number | null
          sistema_origem?: string | null
          solicitacao_reposicao?: string | null
          status_solicitacao?: string | null
          tipo_solicitacao?: string | null
          unb?: string | null
          unidade_medida?: string | null
          valor?: number | null
          valor_unitario?: number | null
        }
        Relationships: []
      }
      root_cause_records: {
        Row: {
          categoria_causa: string
          causa_raiz: string
          created_at: string
          data_referencia: string
          descricao_problema: string
          id: string
          impacto: string
          indicator_id: string
          user_id: string
        }
        Insert: {
          categoria_causa?: string
          causa_raiz?: string
          created_at?: string
          data_referencia?: string
          descricao_problema?: string
          id?: string
          impacto?: string
          indicator_id: string
          user_id: string
        }
        Update: {
          categoria_causa?: string
          causa_raiz?: string
          created_at?: string
          data_referencia?: string
          descricao_problema?: string
          id?: string
          impacto?: string
          indicator_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "root_cause_records_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "root_cause_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string
          id: string
          nome: string
          unidade_id: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao?: string
          id?: string
          nome: string
          unidade_id: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string
          id?: string
          nome?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          ativo: boolean
          cidade: string
          codigo: string
          created_at: string
          estado: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string
          codigo: string
          created_at?: string
          estado?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          cidade?: string
          codigo?: string
          created_at?: string
          estado?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      user_incentives_daily: {
        Row: {
          created_at: string
          data_referencia: string
          detalhes_json: Json
          id: string
          status: string
          user_id: string
          valor_estimado: number
          valor_fechado: number | null
        }
        Insert: {
          created_at?: string
          data_referencia?: string
          detalhes_json?: Json
          id?: string
          status?: string
          user_id: string
          valor_estimado?: number
          valor_fechado?: number | null
        }
        Update: {
          created_at?: string
          data_referencia?: string
          detalhes_json?: Json
          id?: string
          status?: string
          user_id?: string
          valor_estimado?: number
          valor_fechado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_incentives_daily_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_indicator_daily: {
        Row: {
          created_at: string
          data_referencia: string
          desafio: number | null
          id: string
          indicator_id: string
          mapa_numero: string | null
          meta: number | null
          origem_dado: string
          percentual_atingimento: number | null
          status: string | null
          status_desafio: string | null
          updated_at: string
          user_id: string
          valor: number
          valor_financeiro: number | null
        }
        Insert: {
          created_at?: string
          data_referencia?: string
          desafio?: number | null
          id?: string
          indicator_id: string
          mapa_numero?: string | null
          meta?: number | null
          origem_dado?: string
          percentual_atingimento?: number | null
          status?: string | null
          status_desafio?: string | null
          updated_at?: string
          user_id: string
          valor?: number
          valor_financeiro?: number | null
        }
        Update: {
          created_at?: string
          data_referencia?: string
          desafio?: number | null
          id?: string
          indicator_id?: string
          mapa_numero?: string | null
          meta?: number | null
          origem_dado?: string
          percentual_atingimento?: number | null
          status?: string | null
          status_desafio?: string | null
          updated_at?: string
          user_id?: string
          valor?: number
          valor_financeiro?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_indicator_daily_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_indicator_daily_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_units: {
        Row: {
          created_at: string
          id: string
          unit_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          unit_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          unit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_units_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_units_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          ativo: boolean
          auth_user_id: string
          avatar_url: string | null
          cpf: string | null
          created_at: string
          email: string
          id: string
          matricula: string
          nome: string
          role: string
          rota_id: string | null
          unidade_id: string | null
          worker_type: string | null
        }
        Insert: {
          ativo?: boolean
          auth_user_id: string
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          email: string
          id?: string
          matricula?: string
          nome: string
          role?: string
          rota_id?: string | null
          unidade_id?: string | null
          worker_type?: string | null
        }
        Update: {
          ativo?: boolean
          auth_user_id?: string
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          email?: string
          id?: string
          matricula?: string
          nome?: string
          role?: string
          rota_id?: string | null
          unidade_id?: string | null
          worker_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_id: { Args: { check_auth_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { check_user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "colaborador"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "colaborador"],
    },
  },
} as const
