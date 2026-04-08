import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.1/cors";

const INDICATOR_IDS: Record<string, string> = {
  TML: "11496dac-52b6-4331-80f0-f9687e9fd1b7",
  TR:  "d99beda1-c397-42f1-84e0-4eb60ae7af99",
  TI:  "27fff464-bc98-4e5f-864d-b3b2b6aad46e",
  JL:  "e1393945-535e-4506-8ef7-e8c28e4788b6",
};

const METAS: Record<string, number> = {
  TML: 30,
  TR: 560,
  TI: 30,
  JL: 620,
};

function parseTime(hhmm: string): number | null {
  const clean = hhmm.replace(/[^\d:]/g, "");
  const parts = clean.split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function normalizeFase(fase: string): string {
  return fase
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function findPhaseTime(rows: any[], keywords: string[]): number | null {
  for (const row of rows) {
    const fase = normalizeFase(row.fase);
    if (keywords.some(k => fase.includes(k))) {
      const t = parseTime(row.hora_operacao);
      if (t !== null) return t;
    }
  }
  return null;
}

function calcStatus(valor: number, meta: number, lowerIsBetter: boolean): string {
  const pct = meta > 0 ? (valor / meta) * 100 : 0;
  if (lowerIsBetter) {
    if (valor <= meta) return "dentro_meta";
    return "abaixo_meta";
  }
  if (pct >= 100) return "acima_meta";
  if (pct >= 80) return "dentro_meta";
  return "abaixo_meta";
}

interface IndicatorResult {
  indicator_id: string;
  valor: number;
  meta: number;
  percentual_atingimento: number;
  status: string;
}

function calculateIndicators(rows: any[]): IndicatorResult[] {
  // Sort rows by time
  const sorted = [...rows].sort((a, b) => {
    const ta = parseTime(a.hora_operacao) ?? 0;
    const tb = parseTime(b.hora_operacao) ?? 0;
    return ta - tb;
  });

  const results: IndicatorResult[] = [];

  // Find phase times
  const saidaCdd = findPhaseTime(sorted, ["SAIDA CDD", "SAIDA FAB"]);
  const entradaCdd = findPhaseTime(sorted, ["ENTRADA CDD", "ENTRADA FAB"]);
  const pcFisica = findPhaseTime(sorted, ["PC_FISICA", "PC FISICA"]);
  const pcFinanceira = findPhaseTime(sorted, ["PC_FINANCEIRA", "PC FINANCEIRA"]);

  // TML: diff between Saída CDD and 07:50. If saída > 08:20 → lost (meta exceeded)
  const REF_TIME = 7 * 60 + 50; // 07:50
  const LIMIT_TIME = 8 * 60 + 20; // 08:20
  let tmlVal: number | null = null;
  if (saidaCdd !== null) {
    if (saidaCdd > LIMIT_TIME) {
      // Lost TML - set to a high value (exceeded limit)
      tmlVal = saidaCdd - REF_TIME;
    } else {
      tmlVal = Math.max(0, saidaCdd - REF_TIME);
    }
  }

  // TR: Entrada CDD - Saída CDD
  let trVal: number | null = null;
  if (entradaCdd !== null && saidaCdd !== null) {
    trVal = Math.max(0, entradaCdd - saidaCdd);
  }

  // TI: (PC Física - Entrada CDD) + (PC Financeira - PC Física)
  let tiVal: number | null = null;
  if (pcFisica !== null && entradaCdd !== null && pcFinanceira !== null) {
    const part1 = Math.max(0, pcFisica - entradaCdd);
    const part2 = Math.max(0, pcFinanceira - pcFisica);
    tiVal = part1 + part2;
  } else if (pcFisica !== null && entradaCdd !== null) {
    tiVal = Math.max(0, pcFisica - entradaCdd);
  }

  // Build results for calculated indicators
  const addResult = (code: string, valor: number | null) => {
    if (valor === null) return;
    const meta = METAS[code];
    // All time indicators: lower is better
    const pct = meta > 0 ? Math.round((valor / meta) * 100) : 0;
    const status = valor <= meta ? "dentro_meta" : "abaixo_meta";
    results.push({
      indicator_id: INDICATOR_IDS[code],
      valor,
      meta,
      percentual_atingimento: pct,
      status,
    });
  };

  addResult("TML", tmlVal);
  addResult("TR", trVal);
  addResult("TI", tiVal);

  // JL = TML + TR + TI
  if (tmlVal !== null && trVal !== null && tiVal !== null) {
    addResult("JL", tmlVal + trVal + tiVal);
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const { data_referencia } = body;

    // Get all distinct dates to process
    let dates: string[] = [];
    if (data_referencia) {
      dates = Array.isArray(data_referencia) ? data_referencia : [data_referencia];
    } else {
      // Get all distinct dates from mapa_historico
      const { data: allDates } = await supabase
        .from("mapa_historico")
        .select("data_operacao")
        .order("data_operacao", { ascending: false });
      
      if (allDates) {
        dates = [...new Set(allDates.map((d: any) => d.data_operacao))];
      }
    }

    let totalInserted = 0;

    for (const date of dates) {
      // Get all mapa_historico for this date
      const { data: mapas, error: fetchErr } = await supabase
        .from("mapa_historico")
        .select("*")
        .eq("data_operacao", date);

      if (fetchErr) throw fetchErr;
      if (!mapas || mapas.length === 0) continue;

      // Group by user_id (skip null user_id)
      const byUser: Record<string, any[]> = {};
      for (const row of mapas) {
        if (!row.user_id) continue;
        if (!byUser[row.user_id]) byUser[row.user_id] = [];
        byUser[row.user_id].push(row);
      }

      const upserts: any[] = [];

      for (const [userId, userRows] of Object.entries(byUser)) {
        // Group by mapa number - pick the first mapa for this user
        // A user may have multiple mapas on same day; use the one with Saída CDD
        const byMapa: Record<string, any[]> = {};
        for (const r of userRows) {
          if (!byMapa[r.mapa]) byMapa[r.mapa] = [];
          byMapa[r.mapa].push(r);
        }

        // Combine all phases from all mapas for this user on this date
        const allRows = userRows;
        const indicators = calculateIndicators(allRows);

        for (const ind of indicators) {
          upserts.push({
            user_id: userId,
            indicator_id: ind.indicator_id,
            data_referencia: date,
            valor: ind.valor,
            meta: ind.meta,
            percentual_atingimento: ind.percentual_atingimento,
            status: ind.status,
            origem_dado: "mapa_historico",
          });
        }
      }

      if (upserts.length > 0) {
        // Delete existing auto-calculated records for these dates/indicators
        const indicatorIds = Object.values(INDICATOR_IDS);
        const userIds = [...new Set(upserts.map(u => u.user_id))];

        for (const uid of userIds) {
          await supabase
            .from("user_indicator_daily")
            .delete()
            .eq("user_id", uid)
            .eq("data_referencia", date)
            .in("indicator_id", indicatorIds)
            .eq("origem_dado", "mapa_historico");
        }

        // Insert new
        const { error: insertErr } = await supabase
          .from("user_indicator_daily")
          .insert(upserts);

        if (insertErr) throw insertErr;
        totalInserted += upserts.length;
      }
    }

    return new Response(
      JSON.stringify({ success: true, total_inserted: totalInserted, dates_processed: dates.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? String(err) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
