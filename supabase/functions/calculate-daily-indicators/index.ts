import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

interface IndicatorResult {
  indicator_id: string;
  valor: number;
  meta: number;
  percentual_atingimento: number;
  status: string;
}

function calculateIndicatorsForMapa(rows: any[]): IndicatorResult[] {
  const sorted = [...rows].sort((a, b) => {
    const ta = parseTime(a.hora_operacao) ?? 0;
    const tb = parseTime(b.hora_operacao) ?? 0;
    return ta - tb;
  });

  const results: IndicatorResult[] = [];

  const saidaCdd = findPhaseTime(sorted, ["SAIDA CDD", "SAIDA FAB"]);
  const entradaCdd = findPhaseTime(sorted, ["ENTRADA CDD", "ENTRADA FAB"]);
  const pcFisica = findPhaseTime(sorted, ["PC_FISICA", "PC FISICA"]);
  const pcFinanceira = findPhaseTime(sorted, ["PC_FINANCEIRA", "PC FINANCEIRA"]);

  // TML: diff between Saída CDD and 07:50. If > 08:20 → lost
  const REF_TIME = 7 * 60 + 50;
  const LIMIT_TIME = 8 * 60 + 20;
  let tmlVal: number | null = null;
  if (saidaCdd !== null) {
    if (saidaCdd > LIMIT_TIME) {
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
    tiVal = Math.max(0, pcFisica - entradaCdd) + Math.max(0, pcFinanceira - pcFisica);
  } else if (pcFisica !== null && entradaCdd !== null) {
    tiVal = Math.max(0, pcFisica - entradaCdd);
  }

  const addResult = (code: string, valor: number | null) => {
    if (valor === null) return;
    const meta = METAS[code];
    // Binary logic: either met the goal (100) or not (0)
    const withinTarget = valor <= meta;
    results.push({
      indicator_id: INDICATOR_IDS[code],
      valor,
      meta,
      percentual_atingimento: withinTarget ? 100 : 0,
      status: withinTarget ? "dentro_meta" : "abaixo_meta",
    });
  };

  addResult("TML", tmlVal);
  addResult("TR", trVal);
  addResult("TI", tiVal);

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

    // ── Step 1: Link user_id on mapa_historico rows that have no user_id ──
    // Fetch all users with matricula
    const { data: allUsers } = await supabase
      .from("users")
      .select("id, matricula")
      .neq("matricula", "")
      .eq("ativo", true);

    if (allUsers && allUsers.length > 0) {
      const matriculaMap = new Map<string, string>();
      for (const u of allUsers) {
        if (u.matricula) matriculaMap.set(u.matricula.trim(), u.id);
      }

      // Fetch unlinked rows
      let unlinked: any[] = [];
      let offset = 0;
      const PAGE = 1000;
      while (true) {
        const { data: chunk } = await supabase
          .from("mapa_historico")
          .select("id, motorista_matricula")
          .is("user_id", null)
          .neq("motorista_matricula", "")
          .range(offset, offset + PAGE - 1);
        if (!chunk || chunk.length === 0) break;
        unlinked = unlinked.concat(chunk);
        if (chunk.length < PAGE) break;
        offset += PAGE;
      }

      console.log(`Found ${unlinked.length} unlinked mapa_historico rows`);

      // Update each unlinked row
      let linked = 0;
      for (const row of unlinked) {
        const userId = matriculaMap.get(row.motorista_matricula.trim());
        if (userId) {
          await supabase
            .from("mapa_historico")
            .update({ user_id: userId })
            .eq("id", row.id);
          linked++;
        }
      }
      console.log(`Linked ${linked} rows to users`);
    }

    // ── Step 2: Get all distinct dates to process ──
    let dates: string[] = [];
    if (data_referencia) {
      dates = Array.isArray(data_referencia) ? data_referencia : [data_referencia];
    } else {
      const { data: allDates } = await supabase
        .from("mapa_historico")
        .select("data_operacao")
        .order("data_operacao", { ascending: false })
        .limit(10000);
      
      if (allDates) {
        dates = [...new Set(allDates.map((d: any) => d.data_operacao))];
      }
    }

    let totalInserted = 0;
    const indicatorIds = Object.values(INDICATOR_IDS);

    for (const date of dates) {
      // Fetch all mapa_historico for this date
      let allMapas: any[] = [];
      let offset = 0;
      const PAGE = 1000;
      while (true) {
        const { data: chunk, error: fetchErr } = await supabase
          .from("mapa_historico")
          .select("*")
          .eq("data_operacao", date)
          .range(offset, offset + PAGE - 1);
        if (fetchErr) throw fetchErr;
        if (!chunk || chunk.length === 0) break;
        allMapas = allMapas.concat(chunk);
        if (chunk.length < PAGE) break;
        offset += PAGE;
      }

      if (allMapas.length === 0) continue;

      // Group by mapa number
      const byMapa: Record<string, any[]> = {};
      for (const row of allMapas) {
        if (!byMapa[row.mapa]) byMapa[row.mapa] = [];
        byMapa[row.mapa].push(row);
      }

      // For each mapa, find the motorista (user_id) and calculate indicators
      const upserts: any[] = [];
      const affectedUserIds = new Set<string>();

      for (const [mapaNum, mapaRows] of Object.entries(byMapa)) {
        const userId = mapaRows.find(r => r.user_id)?.user_id;
        if (!userId) continue;

        affectedUserIds.add(userId);

        const indicators = calculateIndicatorsForMapa(mapaRows);

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
            mapa_numero: mapaNum,
          });
        }
      }

      if (upserts.length > 0) {
        // Delete existing auto-calculated records for affected users on this date
        for (const uid of affectedUserIds) {
          await supabase
            .from("user_indicator_daily")
            .delete()
            .eq("user_id", uid)
            .eq("data_referencia", date)
            .in("indicator_id", indicatorIds)
            .eq("origem_dado", "mapa_historico");
        }

        // Insert in batches of 200
        for (let i = 0; i < upserts.length; i += 200) {
          const batch = upserts.slice(i, i + 200);
          const { error: insertErr } = await supabase
            .from("user_indicator_daily")
            .insert(batch);
          if (insertErr) throw insertErr;
        }

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
