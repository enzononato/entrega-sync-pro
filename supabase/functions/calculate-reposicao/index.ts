import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TX_REPOSICAO_ID = "c4c40e3e-f23b-46ce-a576-885c610f2df7";
const DEFAULT_META = 49.8;

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
    // Optional: restrict to a specific month "YYYY-MM"
    const { mes } = body as { mes?: string };

    // ── Step 1: Load meta from goals ──
    let meta = DEFAULT_META;
    const { data: goalRow } = await supabase
      .from("goals")
      .select("valor_meta")
      .eq("indicator_id", TX_REPOSICAO_ID)
      .eq("ativo", true)
      .eq("periodo_tipo", "mensal")
      .or("worker_type.eq.motorista,worker_type.is.null")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (goalRow) meta = goalRow.valor_meta;
    console.log("Meta TX_REPOSICAO:", meta);

    // ── Step 2: Link mot_user_id on reposicao rows that are unlinked ──
    const { data: allUsers } = await supabase
      .from("users")
      .select("id, matricula")
      .neq("matricula", "")
      .eq("ativo", true);

    const matriculaMap = new Map<string, string>();
    if (allUsers) {
      for (const u of allUsers) {
        if (u.matricula) matriculaMap.set(u.matricula.trim(), u.id);
      }
    }

    // Link motorista
    const PAGE = 1000;
    let offset = 0;
    let linkedCount = 0;
    while (true) {
      const { data: unlinked } = await supabase
        .from("reposicao_031805")
        .select("id, motorista_codigo")
        .is("mot_user_id", null)
        .not("motorista_codigo", "is", null)
        .neq("motorista_codigo", "")
        .range(offset, offset + PAGE - 1);

      if (!unlinked || unlinked.length === 0) break;

      for (const row of unlinked) {
        const userId = matriculaMap.get(row.motorista_codigo?.trim() ?? "");
        if (userId) {
          await supabase
            .from("reposicao_031805")
            .update({ mot_user_id: userId })
            .eq("id", row.id);
          linkedCount++;
        }
      }
      if (unlinked.length < PAGE) break;
      offset += PAGE;
    }
    if (linkedCount > 0) console.log(`Linked ${linkedCount} reposicao rows`);

    // ── Step 3: Fetch reposicao data grouped by user + month ──
    // We'll fetch all rows with mot_user_id set, then aggregate in memory
    let allRows: { mot_user_id: string; data_solicitacao: string; valor: number }[] = [];
    offset = 0;
    while (true) {
      let q = supabase
        .from("reposicao_031805")
        .select("mot_user_id, data_solicitacao, valor")
        .not("mot_user_id", "is", null)
        .not("data_solicitacao", "is", null);

      if (mes) {
        // Filter to specific month: "YYYY-MM"
        const [year, month] = mes.split("-");
        const startDate = `${year}-${month}-01`;
        const endMonth = parseInt(month, 10);
        const endYear = parseInt(year, 10);
        const nextMonth = endMonth === 12 ? 1 : endMonth + 1;
        const nextYear = endMonth === 12 ? endYear + 1 : endYear;
        const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
        q = q.gte("data_solicitacao", startDate).lt("data_solicitacao", endDate);
      }

      const { data: chunk, error } = await q.range(offset, offset + PAGE - 1);
      if (error) throw error;
      if (!chunk || chunk.length === 0) break;

      for (const r of chunk) {
        if (r.mot_user_id && r.data_solicitacao && r.valor != null) {
          allRows.push({
            mot_user_id: r.mot_user_id,
            data_solicitacao: r.data_solicitacao,
            valor: Number(r.valor) || 0,
          });
        }
      }
      if (chunk.length < PAGE) break;
      offset += PAGE;
    }

    console.log(`Total reposicao rows to process: ${allRows.length}`);

    // ── Step 4: Aggregate by user + month ──
    // Key: "userId|YYYY-MM", Value: sum of valor
    const aggregated = new Map<string, number>();
    for (const row of allRows) {
      const monthKey = row.data_solicitacao.substring(0, 7); // "YYYY-MM"
      const key = `${row.mot_user_id}|${monthKey}`;
      aggregated.set(key, (aggregated.get(key) || 0) + row.valor);
    }

    // ── Step 5: Write to user_indicator_daily ──
    // For monthly indicators, we use the first day of the month as data_referencia
    const upserts: {
      user_id: string;
      indicator_id: string;
      data_referencia: string;
      valor: number;
      meta: number;
      percentual_atingimento: number;
      status: string;
      origem_dado: string;
    }[] = [];

    for (const [key, totalValor] of aggregated) {
      const [userId, monthStr] = key.split("|");
      const dataRef = `${monthStr}-01`;
      const rounded = Math.round(totalValor * 100) / 100;
      const withinTarget = rounded <= meta;

      upserts.push({
        user_id: userId,
        indicator_id: TX_REPOSICAO_ID,
        data_referencia: dataRef,
        valor: rounded,
        meta,
        percentual_atingimento: withinTarget ? 100 : 0,
        status: withinTarget ? "dentro_meta" : "abaixo_meta",
        origem_dado: "reposicao_031805",
      });
    }

    // Delete existing records for affected users+months, then insert
    const affectedKeys = new Set<string>();
    for (const u of upserts) {
      affectedKeys.add(`${u.user_id}|${u.data_referencia}`);
    }

    for (const ak of affectedKeys) {
      const [uid, dataRef] = ak.split("|");
      await supabase
        .from("user_indicator_daily")
        .delete()
        .eq("user_id", uid)
        .eq("indicator_id", TX_REPOSICAO_ID)
        .eq("data_referencia", dataRef)
        .eq("origem_dado", "reposicao_031805");
    }

    // Insert in batches
    let totalInserted = 0;
    for (let i = 0; i < upserts.length; i += 200) {
      const batch = upserts.slice(i, i + 200);
      const { error: insertErr } = await supabase
        .from("user_indicator_daily")
        .insert(batch);
      if (insertErr) throw insertErr;
      totalInserted += batch.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_rows_processed: allRows.length,
        total_aggregated: aggregated.size,
        total_inserted: totalInserted,
        meta_used: meta,
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
