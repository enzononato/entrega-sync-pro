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
    const fator0 = Number(cfg.fator_0 ?? 0.19);
    const fator1 = Number(cfg.fator_1 ?? 0.18);
    const fator2 = Number(cfg.fator_2 ?? 0.06);
    const tetoMot = Number(cfg.teto_motorista ?? 624);
    const tetoAju = Number(cfg.teto_ajudante ?? 416);

    // 2. Read all maps in month
    const { data: mapas, error: mapErr } = await supabase
      .from('mapa_historico')
      .select('id, mapa, data_operacao, cx_entreg, mot_user_id, aju1_user_id, aju2_user_id')
      .gte('data_operacao', firstDay)
      .lte('data_operacao', lastDay);
    if (mapErr) throw mapErr;

    // 3. Aggregate per user
    type UserAgg = {
      bruto: number;
      total_caixas: number;
      qtd_mapas: number;
      mapas: Array<{ mapa: string; data: string; fator: number; valor_caixa: number; caixas: number; valor: number; role: string }>;
    };
    const agg = new Map<string, UserAgg>();

    const addToUser = (userId: string, info: any) => {
      if (!agg.has(userId)) agg.set(userId, { bruto: 0, total_caixas: 0, qtd_mapas: 0, mapas: [] });
      const a = agg.get(userId)!;
      a.bruto += info.valor;
      a.total_caixas += info.caixas;
      a.qtd_mapas += 1;
      a.mapas.push(info);
    };

    for (const m of mapas ?? []) {
      const cx = Number(m.cx_entreg ?? 0);
      if (cx <= 0) continue;
      const ajudantes = [m.aju1_user_id, m.aju2_user_id].filter(Boolean);
      const numAju = ajudantes.length;
      const fator = numAju === 0 ? fator0 : numAju === 1 ? fator1 : fator2;
      const valor = cx * fator;
      const baseInfo = { mapa: m.mapa, data: m.data_operacao, fator: numAju, valor_caixa: fator, caixas: cx, valor };

      if (m.mot_user_id) addToUser(m.mot_user_id, { ...baseInfo, role: 'motorista' });
      for (const aju of ajudantes) {
        addToUser(aju as string, { ...baseInfo, role: 'ajudante' });
      }
    }

    // 4. Get worker_types
    const userIds = Array.from(agg.keys());
    const userTypes = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, worker_type')
        .in('id', userIds);
      usersData?.forEach((u: any) => userTypes.set(u.id, u.worker_type ?? 'motorista'));
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
    const inserts = Array.from(agg.entries()).map(([userId, a]) => {
      const wt = userTypes.get(userId) ?? 'motorista';
      const teto = wt === 'ajudante' ? tetoAju : tetoMot;
      const valor_final = Math.min(a.bruto, teto);
      const valor_cortado = Math.max(0, a.bruto - teto);
      const teto_atingido = a.bruto > teto;
      return {
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
      };
    });

    if (inserts.length > 0) {
      const { error: insErr } = await supabase.from('user_incentives_daily').insert(inserts);
      if (insErr) throw insErr;
    }

    return new Response(
      JSON.stringify({ success: true, mes, processados: inserts.length, qtd_mapas: mapas?.length ?? 0 }),
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
