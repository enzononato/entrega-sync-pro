import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Create auth users
    const demoUsers = [
      { email: "admin@empresa.com", nome: "Ana Silva", role: "administrador", worker_type: null, matricula: "ADM001" },
      { email: "carlos@empresa.com", nome: "Carlos Oliveira", role: "colaborador", worker_type: "motorista", matricula: "MOT001" },
      { email: "roberto@empresa.com", nome: "Roberto Santos", role: "colaborador", worker_type: "motorista", matricula: "MOT002" },
      { email: "pedro@empresa.com", nome: "Pedro Lima", role: "colaborador", worker_type: "ajudante", matricula: "AJU001" },
      { email: "joao@empresa.com", nome: "João Ferreira", role: "colaborador", worker_type: "ajudante", matricula: "AJU002" },
    ];

    const password = "Entrega@2026";
    const createdUsers: Record<string, string> = {}; // email -> users table id

    for (const u of demoUsers) {
      // Check if auth user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((eu: any) => eu.email === u.email);
      
      let authUserId: string;
      if (existing) {
        authUserId = existing.id;
      } else {
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: u.email,
          password,
          email_confirm: true,
          user_metadata: { nome: u.nome },
        });
        if (authError) throw new Error(`Auth error for ${u.email}: ${authError.message}`);
        authUserId = authData.user.id;
      }

      // Wait a moment for trigger to create profile
      await new Promise(r => setTimeout(r, 500));

      // Get or update profile
      const { data: profile, error: profErr } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", authUserId)
        .single();
      
      if (profErr) throw new Error(`Profile error for ${u.email}: ${profErr.message}`);
      createdUsers[u.email] = profile.id;
    }

    // 2. Create unit
    const { data: unit } = await supabase.from("units").upsert({
      codigo: "SP01",
      nome: "São Paulo Centro",
      cidade: "São Paulo",
      estado: "SP",
      ativo: true,
    }, { onConflict: "codigo" }).select().single();
    const unitId = unit!.id;

    // 3. Create routes
    const { data: routeNorte } = await supabase.from("routes").upsert({
      codigo: "RN01",
      nome: "Rota Norte",
      descricao: "Zona Norte de São Paulo",
      unidade_id: unitId,
      ativo: true,
    }, { onConflict: "codigo" }).select().single();

    const { data: routeSul } = await supabase.from("routes").upsert({
      codigo: "RS01",
      nome: "Rota Sul",
      descricao: "Zona Sul de São Paulo",
      unidade_id: unitId,
      ativo: true,
    }, { onConflict: "codigo" }).select().single();

    // 4. Update user profiles with unit/route/role
    const userUpdates = [
      { email: "admin@empresa.com", role: "administrador", worker_type: null, unidade_id: unitId, rota_id: null, matricula: "ADM001" },
      { email: "carlos@empresa.com", role: "colaborador", worker_type: "motorista", unidade_id: unitId, rota_id: routeNorte!.id, matricula: "MOT001" },
      { email: "roberto@empresa.com", role: "colaborador", worker_type: "motorista", unidade_id: unitId, rota_id: routeSul!.id, matricula: "MOT002" },
      { email: "pedro@empresa.com", role: "colaborador", worker_type: "ajudante", unidade_id: unitId, rota_id: routeNorte!.id, matricula: "AJU001" },
      { email: "joao@empresa.com", role: "colaborador", worker_type: "ajudante", unidade_id: unitId, rota_id: routeSul!.id, matricula: "AJU002" },
    ];

    for (const upd of userUpdates) {
      const userId = createdUsers[upd.email];
      await supabase.from("users").update({
        role: upd.role,
        worker_type: upd.worker_type,
        unidade_id: upd.unidade_id,
        rota_id: upd.rota_id,
        matricula: upd.matricula,
      }).eq("id", userId);
    }

    // 5. Create indicators
    const indicatorDefs = [
      { codigo: "TML", nome: "Tempo Médio de Loading", categoria: "operacional", unidade_medida: "min", applies_to_worker_type: "ambos" },
      { codigo: "TR", nome: "Taxa de Retorno", categoria: "operacional", unidade_medida: "%", applies_to_worker_type: "ambos" },
      { codigo: "TI", nome: "Taxa de Insucessos", categoria: "operacional", unidade_medida: "%", applies_to_worker_type: "ambos" },
      { codigo: "JL_LIQUIDA", nome: "Jornada Líquida", categoria: "produtividade", unidade_medida: "h", applies_to_worker_type: "ambos" },
      { codigo: "JL_LABORAL", nome: "Jornada Laboral", categoria: "produtividade", unidade_medida: "h", applies_to_worker_type: "ambos" },
      { codigo: "DEV", nome: "Devoluções", categoria: "qualidade", unidade_medida: "un", applies_to_worker_type: "ambos" },
      { codigo: "DISP", nome: "Dispersão de Rota", categoria: "operacional", unidade_medida: "km", applies_to_worker_type: "motorista" },
      { codigo: "RAT", nome: "Rating de Atendimento", categoria: "qualidade", unidade_medida: "pts", applies_to_worker_type: "ambos" },
      { codigo: "CX", nome: "Caixas Entregues", categoria: "produtividade", unidade_medida: "un", applies_to_worker_type: "ambos" },
      { codigo: "REP", nome: "Reposições", categoria: "qualidade", unidade_medida: "un", applies_to_worker_type: "motorista" },
      { codigo: "REF", nome: "Refugo", categoria: "qualidade", unidade_medida: "un", applies_to_worker_type: "ajudante" },
    ];

    const indicatorIds: Record<string, string> = {};
    for (const ind of indicatorDefs) {
      const { data } = await supabase.from("indicators").upsert(ind, { onConflict: "codigo" }).select().single();
      if (data) indicatorIds[ind.codigo] = data.id;
    }

    // 6. Create goals (metas)
    const today = new Date().toISOString().split("T")[0];
    // Metas where lower is better
    const lowerIsBetter = ["TML", "TR", "TI", "DEV", "DISP", "REF", "REP"];
    const goalDefs: { codigo: string; motorista: number; ajudante: number }[] = [
      { codigo: "TML", motorista: 25, ajudante: 25 },
      { codigo: "TR", motorista: 5, ajudante: 5 },
      { codigo: "TI", motorista: 8, ajudante: 8 },
      { codigo: "JL_LIQUIDA", motorista: 8, ajudante: 8 },
      { codigo: "JL_LABORAL", motorista: 9, ajudante: 9 },
      { codigo: "DEV", motorista: 3, ajudante: 3 },
      { codigo: "DISP", motorista: 15, ajudante: 0 },
      { codigo: "RAT", motorista: 4.5, ajudante: 4.5 },
      { codigo: "CX", motorista: 150, ajudante: 150 },
      { codigo: "REP", motorista: 5, ajudante: 0 },
      { codigo: "REF", motorista: 0, ajudante: 5 },
    ];

    for (const g of goalDefs) {
      const indId = indicatorIds[g.codigo];
      if (!indId) continue;
      if (g.motorista > 0) {
        await supabase.from("goals").upsert({
          indicator_id: indId, worker_type: "motorista", valor_meta: g.motorista,
          periodo_tipo: "diario", vigencia_inicio: today, ativo: true,
        }, { onConflict: "indicator_id,worker_type,unidade_id,user_id" }).select();
      }
      if (g.ajudante > 0) {
        await supabase.from("goals").upsert({
          indicator_id: indId, worker_type: "ajudante", valor_meta: g.ajudante,
          periodo_tipo: "diario", vigencia_inicio: today, ativo: true,
        }, { onConflict: "indicator_id,worker_type,unidade_id,user_id" }).select();
      }
    }

    // 7. Create daily indicator data for today
    const colaboradores = ["carlos@empresa.com", "roberto@empresa.com", "pedro@empresa.com", "joao@empresa.com"];
    
    function calcStatus(valor: number, meta: number, codigo: string) {
      const isLower = lowerIsBetter.includes(codigo);
      let pct: number;
      if (isLower) {
        pct = meta > 0 ? (meta / valor) * 100 : 0;
      } else {
        pct = meta > 0 ? (valor / meta) * 100 : 0;
      }
      pct = Math.round(pct * 100) / 100;
      const status = pct >= 100 ? "acima_meta" : pct >= 90 ? "dentro_meta" : "abaixo_meta";
      return { percentual_atingimento: pct, status };
    }

    const dailyData: Record<string, Record<string, number>> = {
      "carlos@empresa.com": { TML: 22, TR: 4, TI: 7, JL_LIQUIDA: 8.2, JL_LABORAL: 9.1, DEV: 2, DISP: 13, RAT: 4.7, CX: 160, REP: 3 },
      "roberto@empresa.com": { TML: 28, TR: 6, TI: 10, JL_LIQUIDA: 7.5, JL_LABORAL: 8.5, DEV: 4, DISP: 18, RAT: 4.2, CX: 130, REP: 6 },
      "pedro@empresa.com": { TML: 20, TR: 3, TI: 5, JL_LIQUIDA: 8.5, JL_LABORAL: 9.3, DEV: 1, RAT: 4.8, CX: 170, REF: 3 },
      "joao@empresa.com": { TML: 30, TR: 7, TI: 12, JL_LIQUIDA: 7, JL_LABORAL: 8, DEV: 5, RAT: 3.8, CX: 120, REF: 7 },
    };

    for (const email of colaboradores) {
      const userId = createdUsers[email];
      const workerType = email.includes("carlos") || email.includes("roberto") ? "motorista" : "ajudante";
      const data = dailyData[email];

      for (const [codigo, valor] of Object.entries(data)) {
        const indId = indicatorIds[codigo];
        if (!indId) continue;
        const goalDef = goalDefs.find(g => g.codigo === codigo);
        const meta = workerType === "motorista" ? (goalDef?.motorista ?? 0) : (goalDef?.ajudante ?? 0);
        if (meta === 0) continue;
        const { percentual_atingimento, status } = calcStatus(valor, meta, codigo);

        await supabase.from("user_indicator_daily").upsert({
          user_id: userId,
          indicator_id: indId,
          data_referencia: today,
          valor,
          meta,
          percentual_atingimento,
          status,
          origem_dado: "manual",
        }, { onConflict: "user_id,indicator_id,data_referencia" });
      }
    }

    // 8. Create incentives
    for (const email of colaboradores) {
      const userId = createdUsers[email];
      const estimado = Math.round((Math.random() * 80 + 40) * 100) / 100;
      await supabase.from("user_incentives_daily").upsert({
        user_id: userId,
        data_referencia: today,
        valor_estimado: estimado,
        status: "estimado",
        detalhes_json: {},
      }, { onConflict: "user_id,data_referencia" });
    }

    // 9. Create root causes + action plans
    const carlosId = createdUsers["carlos@empresa.com"];
    const joaoId = createdUsers["joao@empresa.com"];

    const { data: causa1 } = await supabase.from("root_cause_records").insert({
      user_id: carlosId,
      indicator_id: indicatorIds["TML"],
      data_referencia: today,
      descricao_problema: "Tempo de loading acima da meta devido a fila no CD",
      categoria_causa: "processo",
      causa_raiz: "Falta de organização na doca de carregamento",
      impacto: "Atraso nas entregas e insatisfação dos clientes",
    }).select().single();

    const { data: causa2 } = await supabase.from("root_cause_records").insert({
      user_id: joaoId,
      indicator_id: indicatorIds["TI"],
      data_referencia: today,
      descricao_problema: "Alta taxa de insucessos na rota Sul",
      categoria_causa: "externo",
      causa_raiz: "Endereços incorretos no cadastro de clientes",
      impacto: "Redução na taxa de entrega e aumento de custos",
    }).select().single();

    if (causa1) {
      await supabase.from("action_plans").insert({
        root_cause_id: causa1.id,
        responsavel_user_id: carlosId,
        descricao_acao: "Reorganizar processo de carregamento com horários escalonados",
        prazo: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
        status: "em_andamento",
        observacoes: "Iniciado conversa com supervisor do CD",
      });
    }

    if (causa2) {
      // Overdue plan
      await supabase.from("action_plans").insert({
        root_cause_id: causa2.id,
        responsavel_user_id: joaoId,
        descricao_acao: "Validar endereços dos clientes com erro antes da saída",
        prazo: new Date(Date.now() - 5 * 86400000).toISOString().split("T")[0],
        status: "aberto",
        observacoes: "",
      });
    }

    // 10. Create feedbacks
    await supabase.from("feedbacks").insert([
      {
        user_id: carlosId,
        unidade_id: unitId,
        rota_id: routeNorte!.id,
        data_referencia: today,
        tipo: "operacao",
        titulo: "Caminhão com problema no freio",
        descricao: "O caminhão placa XYZ-1234 está com ruído no freio traseiro. Precisa de manutenção urgente para segurança.",
        urgencia: "critica",
        status: "aberto",
      },
      {
        user_id: createdUsers["pedro@empresa.com"],
        unidade_id: unitId,
        rota_id: routeNorte!.id,
        data_referencia: today,
        tipo: "sugestao",
        titulo: "App de roteirização mais intuitivo",
        descricao: "Seria bom se o aplicativo de rotas mostrasse o trânsito em tempo real e sugerisse rotas alternativas automaticamente.",
        urgencia: "media",
        status: "aberto",
      },
      {
        user_id: joaoId,
        unidade_id: unitId,
        rota_id: routeSul!.id,
        data_referencia: today,
        tipo: "seguranca",
        titulo: "Área de entrega perigosa na rua X",
        descricao: "A rua X no bairro Y tem sido reportada como área de risco. Sugiro que entregas nessa região sejam feitas apenas pela manhã.",
        urgencia: "alta",
        status: "em_analise",
        resposta_lideranca: "Estamos avaliando junto à segurança patrimonial.",
        respondido_por: createdUsers["admin@empresa.com"],
        responded_at: new Date().toISOString(),
      },
    ]);

    return new Response(
      JSON.stringify({ success: true, message: "Dados de demonstração criados com sucesso!", users: Object.keys(createdUsers) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
