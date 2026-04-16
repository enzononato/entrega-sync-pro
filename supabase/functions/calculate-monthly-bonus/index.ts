import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Indicator IDs
const TX_DEVOLUCAO_ID = "c4fdd7a6-27f3-4d46-a378-1242bdb556aa";
const DISP_TEMPO_ID = "488d1de9-9d88-42f2-bf3b-625752c0db02";
const TX_REPOSICAO_ID = "c4c40e3e-f23b-46ce-a576-885c610f2df7";

const MONTHLY_INDICATORS = [TX_DEVOLUCAO_ID, DISP_TEMPO_ID, TX_REPOSICAO_ID];

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
    // month format: "2026-04"
    const month: string = body.month || new Date().toISOString().substring(0, 7);
    const startDate = `${month}-01`;
    // End date: last day of month
    const [y, m] = month.split("-").map(Number);
    const endDate = new Date(y, m, 0).toISOString().split("T")[0];

    console.log(`Calculating monthly bonus for ${month} (${startDate} to ${endDate})`);

    // ── 1. Load monthly goals with bonificacao ──
    const { data: goals, error: goalsErr } = await supabase
      .from("goals")
      .select("indicator_id, worker_type, valor_meta, valor_bonificacao, valor_desafio, valor_bonificacao_desafio")
      .in("indicator_id", MONTHLY_INDICATORS)
      .eq("periodo_tipo", "mensal")
      .eq("ativo", true);

    if (goalsErr) throw new Error(goalsErr.message);
    console.log(`Found ${goals?.length ?? 0} monthly goals`);

    if (!goals || goals.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No monthly goals configured", results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 2. Load all active users ──
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

    // ── 3. Fetch all daily indicator data for the month for these indicators ──
    const PAGE = 1000;
    let allRows: { user_id: string; indicator_id: string; valor: number; data_referencia: string }[] = [];
    let offset = 0;
    while (true) {
      const { data: chunk, error } = await supabase
        .from("user_indicator_daily")
        .select("user_id, indicator_id, valor, data_referencia")
        .in("indicator_id", MONTHLY_INDICATORS)
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
    // TX_DEVOLUCAO & DISP_TEMPO: average of daily averages (group by day first)
    // TX_REPOSICAO: sum of all values
    // Structure: Map<"userId|indicatorId", Map<"date", { sum, count }>>
    const dailyMap = new Map<string, Map<string, { sum: number; count: number }>>();
    // For TX_REPOSICAO we just need total sum
    const sumMap = new Map<string, number>();

    for (const row of allRows) {
      const key = `${row.user_id}|${row.indicator_id}`;
      const val = Number(row.valor) || 0;

      if (row.indicator_id === TX_REPOSICAO_ID) {
        sumMap.set(key, (sumMap.get(key) || 0) + val);
      } else {
        // Group by day for averaging
        let dayMap = dailyMap.get(key);
        if (!dayMap) {
          dayMap = new Map();
          dailyMap.set(key, dayMap);
        }
        const dateKey = (row as any).data_referencia as string;
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
      details: { indicator_id: string; valor_agregado: number; meta: number; atingiu: boolean; bonus: number; desafio: number; atingiu_desafio: boolean; bonus_desafio: number }[];
    }[] = [];

    for (const user of users) {
      const userDetails: typeof results[0]["details"] = [];
      let totalBonus = 0;

      for (const indId of MONTHLY_INDICATORS) {
        // Find matching goal for this indicator + worker_type
        const goal = goals.find(
          (g) => g.indicator_id === indId && (g.worker_type === user.worker_type || !g.worker_type),
        );
        if (!goal || goal.valor_bonificacao <= 0) continue;

        const key = `${user.id}|${indId}`;

        let valorAgregado: number;
        if (indId === TX_REPOSICAO_ID) {
          // Sum total for reposicao
          valorAgregado = Math.round((sumMap.get(key) || 0) * 100) / 100;
        } else {
          // Average of daily averages for TX_DEVOLUCAO and DISP_TEMPO
          const dayMap = dailyMap.get(key);
          if (dayMap && dayMap.size > 0) {
            let sumOfDailyAvgs = 0;
            for (const [, day] of dayMap) {
              sumOfDailyAvgs += day.sum / day.count;
            }
            valorAgregado = Math.round((sumOfDailyAvgs / dayMap.size) * 100) / 100;
          } else {
            valorAgregado = 0;
          }
        }

        // For these indicators, lower is better (must be <= meta)
        const atingiu = valorAgregado <= goal.valor_meta;
        const bonus = atingiu ? Number(goal.valor_bonificacao) : 0;

        // Challenge check
        const desafioVal = Number(goal.valor_desafio) || 0;
        const desafioBonusVal = Number(goal.valor_bonificacao_desafio) || 0;
        const atingiuDesafio = desafioVal > 0 && atingiu && valorAgregado <= desafioVal;
        const bonusDesafio = atingiuDesafio ? desafioBonusVal : 0;

        userDetails.push({
          indicator_id: indId,
          valor_agregado: valorAgregado,
          meta: goal.valor_meta,
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

    // ── 6. Upsert results into user_incentives_daily with first day of month as reference ──
    for (const result of results) {
      await supabase
        .from("user_incentives_daily")
        .upsert(
          {
            user_id: result.user_id,
            data_referencia: startDate,
            valor_estimado: result.total_bonus,
            status: "estimado",
            detalhes_json: {
              tipo: "bonus_mensal",
              mes: month,
              indicadores: result.details,
            },
          },
          { onConflict: "user_id,data_referencia" },
        );
    }

    console.log(`Processed ${results.length} users, upserted monthly bonus records`);

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
