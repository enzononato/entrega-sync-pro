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

    // ── Step 2: Link mot_user_id on unlinked reposicao rows ──
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
          await supabase.from("reposicao_031805").update({ mot_user_id: userId }).eq("id", row.id);
          linkedCount++;
        }
      }
      if (unlinked.length < PAGE) break;
      offset += PAGE;
    }
    if (linkedCount > 0) console.log(`Linked ${linkedCount} reposicao rows`);

    // ── Step 3: Fetch all reposição rows with user linked ──
    let allRows: { mot_user_id: string; data_solicitacao: string; valor: number; mapa_origem: string | null }[] = [];
    offset = 0;
    while (true) {
      const { data: chunk, error } = await supabase
        .from("reposicao_031805")
        .select("mot_user_id, data_solicitacao, valor, mapa_origem")
        .not("mot_user_id", "is", null)
        .not("data_solicitacao", "is", null)
        .range(offset, offset + PAGE - 1);
      if (error) throw new Error(error.message);
      if (!chunk || chunk.length === 0) break;

      for (const r of chunk) {
        if (r.mot_user_id && r.data_solicitacao && r.valor != null) {
          allRows.push({
            mot_user_id: r.mot_user_id,
            data_solicitacao: r.data_solicitacao,
            valor: Number(r.valor) || 0,
            mapa_origem: r.mapa_origem && r.mapa_origem !== "0" ? r.mapa_origem : null,
          });
        }
      }
      if (chunk.length < PAGE) break;
      offset += PAGE;
    }

    console.log(`Total reposicao rows: ${allRows.length}`);

    // ── Step 4: Aggregate by user + mapa (sum all values, keep earliest date) ──
    const aggregated = new Map<string, { valor: number; earliestDate: string }>();
    for (const row of allRows) {
      const mapa = row.mapa_origem ?? "";
      const key = `${row.mot_user_id}|${mapa}`;
      const existing = aggregated.get(key);
      if (existing) {
        existing.valor += row.valor;
        if (row.data_solicitacao < existing.earliestDate) existing.earliestDate = row.data_solicitacao;
      } else {
        aggregated.set(key, { valor: row.valor, earliestDate: row.data_solicitacao });
      }
    }

    // Monthly totals for status calculation
    const monthlyTotals = new Map<string, number>();
    for (const row of allRows) {
      const monthKey = row.data_solicitacao.substring(0, 7);
      const key = `${row.mot_user_id}|${monthKey}`;
      monthlyTotals.set(key, (monthlyTotals.get(key) || 0) + row.valor);
    }

    // ── Step 5: Build upserts ──
    const upserts: any[] = [];
    const affectedUsers = new Set<string>();

    for (const [key, agg] of aggregated) {
      const [userId, mapaStr] = key.split("|");
      const rounded = Math.round(agg.valor * 100) / 100;
      const monthKey = agg.earliestDate.substring(0, 7);
      const monthTotal = monthlyTotals.get(`${userId}|${monthKey}`) || 0;
      const withinTarget = Math.round(monthTotal * 100) / 100 <= meta;

      affectedUsers.add(userId);

      upserts.push({
        user_id: userId,
        indicator_id: TX_REPOSICAO_ID,
        data_referencia: agg.earliestDate,
        valor: rounded,
        meta,
        percentual_atingimento: withinTarget ? 100 : 0,
        status: withinTarget ? "dentro_meta" : "abaixo_meta",
        origem_dado: "reposicao_031805",
        mapa_numero: mapaStr || null,
      });
    }

    // ── Step 6: Delete ALL old reposição records for affected users, then insert ──
    for (const uid of affectedUsers) {
      await supabase
        .from("user_indicator_daily")
        .delete()
        .eq("user_id", uid)
        .eq("indicator_id", TX_REPOSICAO_ID)
        .eq("origem_dado", "reposicao_031805");
    }

    let totalInserted = 0;
    for (let i = 0; i < upserts.length; i += 200) {
      const batch = upserts.slice(i, i + 200);
      const { error: insertErr } = await supabase
        .from("user_indicator_daily")
        .insert(batch);
      if (insertErr) {
        console.error("Insert error:", JSON.stringify(insertErr));
        throw new Error(insertErr.message || JSON.stringify(insertErr));
      }
      totalInserted += batch.length;
    }

    console.log(`TX_REPOSICAO: ${totalInserted} records inserted (per-map)`);

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
