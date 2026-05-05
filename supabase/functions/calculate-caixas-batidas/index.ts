import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json().catch(() => ({}));
    const mes: string = body.mes || new Date().toISOString().slice(0, 7); // YYYY-MM
    const [year, month] = mes.split('-').map(Number);
    const firstDay = `${mes}-01`;
    const lastDay = new Date(year, month, 0).toISOString().slice(0, 10);

    // 1. Read CX_BATIDAS rule
    const { data: indicator } = await supabase
      .from('indicators')
      .select('id')
      .eq('codigo', 'CX_BATIDAS')
      .maybeSingle();
    if (!indicator) throw new Error('Indicador CX_BATIDAS não encontrado');

    const { data: rules } = await supabase
      .from('incentive_rules')
      .select('*')
      .eq('indicator_id', indicator.id)
      .eq('ativo', true);

    const rule = rules?.find((r: any) => r.regra_json?.tipo === 'caixas_batidas');
    if (!rule) throw new Error('Regra de Caixas Batidas não configurada');

    const cfg = rule.regra_json as any;
    // Backward-compat: legacy fator_0/1/2 used as MOTORISTA defaults
    const fatorMot0 = Number(cfg.fator_mot_0 ?? cfg.fator_0 ?? 0.19);
    const fatorMot1 = Number(cfg.fator_mot_1 ?? cfg.fator_1 ?? 0.18);
    const fatorMot2 = Number(cfg.fator_mot_2 ?? cfg.fator_2 ?? 0.06);
    const fatorAju1 = Number(cfg.fator_aju_1 ?? cfg.fator_1 ?? 0.18);
    const fatorAju2 = Number(cfg.fator_aju_2 ?? cfg.fator_2 ?? 0.06);
    const tetoMot = Number(cfg.teto_motorista ?? 624);
    const tetoAju = Number(cfg.teto_ajudante ?? 416);

    // 2. Read all maps in month (paginated to bypass 1000-row limit)
    const mapas: any[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data: chunk, error: mapErr } = await supabase
        .from('mapa_historico')
        .select('id, mapa, data_operacao, cx_entreg, mot_user_id, aju1_user_id, aju2_user_id')
        .gte('data_operacao', firstDay)
        .lte('data_operacao', lastDay)
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (mapErr) throw mapErr;
      if (!chunk || chunk.length === 0) break;
      mapas.push(...chunk);
      if (chunk.length < PAGE) break;
    }

    // 3. Aggregate per user
    type UserAgg = {
      bruto: number;
      total_caixas: number;
      qtd_mapas: number;
      mapas: Array<{ mapa: string; data: string; fator: number; valor_caixa: number; caixas: number; valor: number; role: string }>;
    };
    const agg = new Map<string, UserAgg>();
    const mapaErrors: Array<{ mapa: string; data: string; motivo: string }> = [];
    const userErrors: Array<{ user_id: string; nome?: string; motivo: string }> = [];

    const addToUser = (userId: string, info: any) => {
      if (!agg.has(userId)) agg.set(userId, { bruto: 0, total_caixas: 0, qtd_mapas: 0, mapas: [] });
      const a = agg.get(userId)!;
      a.bruto += info.valor;
      a.total_caixas += info.caixas;
      a.qtd_mapas += 1;
      a.mapas.push(info);
    };

    for (const m of mapas ?? []) {
      try {
        const cx = Number(m.cx_entreg ?? 0);
        if (cx <= 0) {
          mapaErrors.push({ mapa: m.mapa, data: m.data_operacao, motivo: 'cx_entreg = 0 (mapa ignorado)' });
          continue;
        }
        const ajudantes = [m.aju1_user_id, m.aju2_user_id].filter(Boolean);
        const numAju = ajudantes.length;
        const fatorMot = numAju === 0 ? fatorMot0 : numAju === 1 ? fatorMot1 : fatorMot2;
        const fatorAju = numAju === 1 ? fatorAju1 : numAju === 2 ? fatorAju2 : 0;
        const baseMapa = { mapa: m.mapa, data: m.data_operacao, fator: numAju, caixas: cx };

        if (!m.mot_user_id && ajudantes.length === 0) {
          mapaErrors.push({ mapa: m.mapa, data: m.data_operacao, motivo: 'sem motorista nem ajudantes vinculados' });
          continue;
        }
        if (!m.mot_user_id) {
          mapaErrors.push({ mapa: m.mapa, data: m.data_operacao, motivo: 'sem motorista vinculado' });
        }

        if (m.mot_user_id) {
          addToUser(m.mot_user_id, { ...baseMapa, valor_caixa: fatorMot, valor: cx * fatorMot, role: 'motorista' });
        }
        for (const aju of ajudantes) {
          addToUser(aju as string, { ...baseMapa, valor_caixa: fatorAju, valor: cx * fatorAju, role: 'ajudante' });
        }
      } catch (e: any) {
        mapaErrors.push({ mapa: m.mapa, data: m.data_operacao, motivo: 'erro ao processar: ' + (e?.message ?? String(e)) });
      }
    }

    // 4. Get worker_types
    const userIds = Array.from(agg.keys());
    const userTypes = new Map<string, string>();
    const userNames = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, worker_type, nome')
        .in('id', userIds);
      usersData?.forEach((u: any) => {
        userTypes.set(u.id, u.worker_type ?? 'motorista');
        userNames.set(u.id, u.nome ?? '');
      });
      // detect users referenced but not found
      for (const uid of userIds) {
        if (!userTypes.has(uid)) {
          userErrors.push({ user_id: uid, motivo: 'usuário referenciado em mapa não encontrado em public.users' });
        }
      }
    }

    // 5. Delete previous caixas_batidas records for this month
    const { data: existing } = await supabase
      .from('user_incentives_daily')
      .select('id, detalhes_json')
      .eq('data_referencia', firstDay);
    const toDelete = (existing ?? []).filter((r: any) => r.detalhes_json?.tipo === 'caixas_batidas').map((r: any) => r.id);
    if (toDelete.length > 0) {
      await supabase.from('user_incentives_daily').delete().in('id', toDelete);
    }

    // 6. Insert new records with cap applied
    const inserts: any[] = [];
    for (const [userId, a] of agg.entries()) {
      const wt = userTypes.get(userId) ?? 'motorista';
      const teto = wt === 'ajudante' ? tetoAju : tetoMot;
      const valor_final = Math.min(a.bruto, teto);
      const valor_cortado = Math.max(0, a.bruto - teto);
      const teto_atingido = a.bruto > teto;
      inserts.push({
        user_id: userId,
        data_referencia: firstDay,
        valor_estimado: valor_final,
        status: 'estimado',
        detalhes_json: {
          tipo: 'caixas_batidas',
          mes,
          worker_type: wt,
          valor_bruto: a.bruto,
          teto,
          teto_atingido,
          valor_cortado,
          total_caixas: a.total_caixas,
          qtd_mapas: a.qtd_mapas,
          mapas: a.mapas,
        },
      });
    }

    const insertErrors: Array<{ user_id: string; nome?: string; motivo: string }> = [];
    if (inserts.length > 0) {
      // insert one-by-one to capture per-user errors
      const { error: bulkErr } = await supabase.from('user_incentives_daily').insert(inserts);
      if (bulkErr) {
        // fallback: try individually so we know which ones failed
        for (const row of inserts) {
          const { error: rowErr } = await supabase.from('user_incentives_daily').insert(row);
          if (rowErr) {
            insertErrors.push({
              user_id: row.user_id,
              nome: userNames.get(row.user_id),
              motivo: rowErr.message,
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mes,
        processados: inserts.length - insertErrors.length,
        qtd_mapas: mapas?.length ?? 0,
        mapas_ignorados: mapaErrors.length,
        erros: {
          mapas: mapaErrors,
          usuarios: userErrors,
          insercoes: insertErrors,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('calculate-caixas-batidas error:', err);
    return new Response(
      JSON.stringify({ error: err.message ?? String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
