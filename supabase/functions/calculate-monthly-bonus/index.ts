import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// All known indicator IDs
const INDICATOR_IDS: Record<string, string> = {
  TML: "11496dac-52b6-4331-80f0-f9687e9fd1b7",
  TR: "d99beda1-c397-42f1-84e0-4eb60ae7af99",
  TI: "27fff464-bc98-4e5f-864d-b3b2b6aad46e",
  JL: "e1393945-535e-4506-8ef7-e8c28e4788b6",
  TX_DEVOLUCAO: "c4fdd7a6-27f3-4d46-a378-1242bdb556aa",
  DISP_TEMPO: "488d1de9-9d88-42f2-bf3b-625752c0db02",
  TX_REPOSICAO: "c4c40e3e-f23b-46ce-a576-885c610f2df7",
  REFUGO: "f5ded347-5b60-4b87-a2bb-d4d79d4f8e2a",
};

const ALL_INDICATOR_IDS = Object.values(INDICATOR_IDS);

// TX_REPOSICAO aggregates by sum; all others by average of daily averages
const SUM_INDICATORS = new Set([INDICATOR_IDS.TX_REPOSICAO]);

// Indicators where higher value = better (atingiu when valor >= meta)
// All others: lower is better (atingiu when valor <= meta)
const HIGHER_IS_BETTER = new Set<string>([
  "853beb35-febb-48b9-b3ae-be7173bfc6fc", // RATING
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const month: string = body.month || new Date().toISOString().substring(0, 7);
    const startDate = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const endDate = new Date(y, m, 0).toISOString().split("T")[0];

    console.log(`Calculating monthly bonus for ${month} (${startDate} to ${endDate})`);

    // ── 1. Load ALL active goals that have bonificacao > 0 ──
    const { data: goals, error: goalsErr } = await supabase
      .from("goals")
      .select("indicator_id, worker_type, valor_meta, valor_bonificacao, valor_desafio, valor_bonificacao_desafio, indicators(codigo, applies_to_worker_type)")
      .eq("ativo", true)
      .gt("valor_bonificacao", 0);

    if (goalsErr) throw new Error(goalsErr.message);
    console.log(`Found ${goals?.length ?? 0} goals with bonificacao`);

    if (!goals || goals.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No goals with bonificacao configured", results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build a set of indicator IDs that have bonificacao
    const goalIndicatorIds = [...new Set(goals.map(g => g.indicator_id))];

    // Goal lookup respeitando applies_to_worker_type do indicador.
    // Regra:
    //  - Meta com worker_type específico só vale para colaboradores desse worker_type.
    //  - Meta com worker_type=null só vale como universal SE indicator.applies_to_worker_type='ambos'.
    //  - Em qualquer caso, o indicador também precisa aplicar-se ao worker_type do colaborador.
    const findGoal = (indicatorId: string, workerType: string) => {
      // Aceita applies_to_worker_type como 'ambos', único worker_type, ou
      // lista separada por vírgula (defesa contra dados sujos no banco).
      const matchesApplies = (applies: string | undefined | null) => {
        const a = (applies ?? "ambos").toString().toLowerCase();
        if (a === "ambos") return true;
        return a.split(",").map((s) => s.trim()).includes(workerType);
      };
      const exact = goals.find(
        (g) => g.indicator_id === indicatorId && g.worker_type === workerType,
      );
      if (exact) {
        if (!matchesApplies((exact as any).indicators?.applies_to_worker_type)) return undefined;
        return exact;
      }
      const universal = goals.find(
        (g) => g.indicator_id === indicatorId && g.worker_type === null,
      );
      if (universal) {
        if (!matchesApplies((universal as any).indicators?.applies_to_worker_type)) return undefined;
        return universal;
      }
      return undefined;
    };

    // ── 2. Load all active workers ──
    const { data: users, error: usersErr } = await supabase
      .from("users")
      .select("id, worker_type, nome")
      .eq("ativo", true)
      .eq("role", "colaborador")
      .not("worker_type", "is", null);

    if (usersErr) throw new Error(usersErr.message);
    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active workers", results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 3. Fetch all daily indicator data for the month ──
    const PAGE = 1000;
    let allRows: { user_id: string; indicator_id: string; valor: number; data_referencia: string }[] = [];
    let offset = 0;
    while (true) {
      const { data: chunk, error } = await supabase
        .from("user_indicator_daily")
        .select("user_id, indicator_id, valor, data_referencia")
        .in("indicator_id", goalIndicatorIds)
        .gte("data_referencia", startDate)
        .lte("data_referencia", endDate)
        .range(offset, offset + PAGE - 1);

      if (error) throw new Error(error.message);
      if (!chunk || chunk.length === 0) break;
      allRows = allRows.concat(chunk);
      if (chunk.length < PAGE) break;
      offset += PAGE;
    }

    console.log(`Fetched ${allRows.length} daily indicator rows for month`);

    // ── 4. Aggregate per user per indicator ──
    // For SUM indicators: sum all values
    // For others: average of daily averages (group by day, average per day, then average across days)
    const dailyMap = new Map<string, Map<string, { sum: number; count: number }>>();
    const sumMap = new Map<string, number>();

    for (const row of allRows) {
      const key = `${row.user_id}|${row.indicator_id}`;
      const val = Number(row.valor) || 0;

      if (SUM_INDICATORS.has(row.indicator_id)) {
        sumMap.set(key, (sumMap.get(key) || 0) + val);
      } else {
        let dayMap = dailyMap.get(key);
        if (!dayMap) {
          dayMap = new Map();
          dailyMap.set(key, dayMap);
        }
        const dateKey = row.data_referencia;
        const dayEntry = dayMap.get(dateKey);
        if (dayEntry) {
          dayEntry.sum += val;
          dayEntry.count += 1;
        } else {
          dayMap.set(dateKey, { sum: val, count: 1 });
        }
      }
    }

    // ── 5. Calculate bonus per user ──
    const results: {
      user_id: string;
      user_name: string;
      worker_type: string;
      total_bonus: number;
      details: { indicator_id: string; indicator_code: string; valor_agregado: number; meta: number; atingiu: boolean; bonus: number; desafio: number; atingiu_desafio: boolean; bonus_desafio: number }[];
    }[] = [];

    for (const user of users) {
      const userDetails: typeof results[0]["details"] = [];
      let totalBonus = 0;

      for (const indId of goalIndicatorIds) {
        const goal = findGoal(indId, user.worker_type!);
        if (!goal || Number(goal.valor_bonificacao) <= 0) continue;

        const key = `${user.id}|${indId}`;
        const indCode = (goal as any).indicators?.codigo?.toUpperCase() ?? "";

        let valorAgregado: number | null = null;

        if (SUM_INDICATORS.has(indId)) {
          if (sumMap.has(key)) {
            valorAgregado = Math.round((sumMap.get(key) || 0) * 100) / 100;
          }
        } else {
          const dayMap = dailyMap.get(key);
          if (dayMap && dayMap.size > 0) {
            let sumOfDailyAvgs = 0;
            for (const [, day] of dayMap) {
              sumOfDailyAvgs += day.sum / day.count;
            }
            valorAgregado = Math.round((sumOfDailyAvgs / dayMap.size) * 100) / 100;
          }
        }

        // Skip if no data at all for this user/indicator
        if (valorAgregado === null) continue;

        const higherIsBetter = HIGHER_IS_BETTER.has(indId);
        const metaVal = Number(goal.valor_meta);
        const atingiu = higherIsBetter
          ? valorAgregado >= metaVal
          : valorAgregado <= metaVal;
        const bonus = atingiu ? Number(goal.valor_bonificacao) : 0;

        // Challenge check: must first hit meta, then also hit desafio
        const desafioVal = Number(goal.valor_desafio) || 0;
        const desafioBonusVal = Number(goal.valor_bonificacao_desafio) || 0;
        const atingiuDesafio = desafioVal > 0 && atingiu && (
          higherIsBetter ? valorAgregado >= desafioVal : valorAgregado <= desafioVal
        );
        const bonusDesafio = atingiuDesafio ? desafioBonusVal : 0;

        userDetails.push({
          indicator_id: indId,
          indicator_code: indCode,
          valor_agregado: valorAgregado,
          meta: metaVal,
          atingiu,
          bonus,
          desafio: desafioVal,
          atingiu_desafio: atingiuDesafio,
          bonus_desafio: bonusDesafio,
        });

        totalBonus += bonus + bonusDesafio;
      }

      if (userDetails.length > 0) {
        results.push({
          user_id: user.id,
          user_name: user.nome,
          worker_type: user.worker_type!,
          total_bonus: totalBonus,
          details: userDetails,
        });
      }
    }

    // ── 6. Replace existing bonus_mensal rows for this month ──
    // Delete-then-insert é mais robusto que upsert: a unique constraint envolve
    // `tipo` (dentro do JSON) e queremos garantir que usuários que deixaram de
    // atingir metas não fiquem com valores antigos pendurados.
    const { error: delErr } = await supabase
      .from("user_incentives_daily")
      .delete()
      .eq("data_referencia", startDate)
      .filter("detalhes_json->>tipo", "eq", "bonus_mensal");
    if (delErr) throw new Error(`delete bonus_mensal: ${delErr.message}`);

    if (results.length > 0) {
      const rows = results.map((result) => ({
        user_id: result.user_id,
        data_referencia: startDate,
        valor_estimado: result.total_bonus,
        status: "estimado",
        detalhes_json: {
          tipo: "bonus_mensal",
          mes: month,
          indicadores: result.details,
        },
      }));
      const { error: insErr } = await supabase
        .from("user_incentives_daily")
        .insert(rows);
      if (insErr) throw new Error(`insert bonus_mensal: ${insErr.message}`);
    }

    console.log(`Processed ${results.length} users, replaced monthly bonus records`);

    return new Response(
      JSON.stringify({
        success: true,
        month,
        total_users: results.length,
        total_bonus_distributed: results.reduce((s, r) => s + r.total_bonus, 0),
        results: results.map((r) => ({
          user: r.user_name,
          worker_type: r.worker_type,
          total_bonus: r.total_bonus,
          details: r.details,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
