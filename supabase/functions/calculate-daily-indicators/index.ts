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
  TX_DEVOLUCAO: "c4fdd7a6-27f3-4d46-a378-1242bdb556aa",
};

// Default fallbacks — overridden by goals table values
const DEFAULT_METAS: Record<string, number> = {
  TML: 30,
  TR: 560,
  TI: 30,
  JL: 620,
  TX_DEVOLUCAO: 5,
};

let METAS: Record<string, number> = { ...DEFAULT_METAS };

/**
 * Parse "HH:MM" or "HH:MM:SS" into total minutes.
 */
function parseTime(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const clean = hhmm.replace(/[^\d:]/g, "");
  const parts = clean.split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

interface IndicatorResult {
  indicator_id: string;
  valor: number;
  meta: number;
  percentual_atingimento: number;
  status: string;
}

/**
 * Calculate indicators for a single mapa row using its columns directly.
 *
 * TML: based on hr_sai. Reference = 07:50 (470min). Within target if hr_sai <= 08:20 (500min).
 *      Value = hr_sai - 07:50 (can be 0 if on time).
 * TR:  hr_entr - hr_sai (time on road in minutes).
 * TI:  tmpo_interno column directly (already a duration).
 * JL:  TML + TR + TI.
 * TX_DEVOLUCAO: 1 - (cx_entreg / cx_carreg) as percentage.
 */
function calculateIndicatorsForRow(row: any): IndicatorResult[] {
  const results: IndicatorResult[] = [];

  const hrSai = parseTime(row.hr_sai);
  const hrEntr = parseTime(row.hr_entr);
  const tiVal = parseTime(row.tmpo_interno);

  // TML: minutes after 07:50 reference
  const REF_TIME = 7 * 60 + 50; // 07:50
  const LIMIT_TIME = 8 * 60 + 20; // 08:20
  let tmlVal: number | null = null;
  if (hrSai !== null) {
    tmlVal = Math.max(0, hrSai - REF_TIME);
  }

  // TR: hr_entr - hr_sai
  let trVal: number | null = null;
  if (hrEntr !== null && hrSai !== null) {
    trVal = Math.max(0, hrEntr - hrSai);
  }

  // TX_DEVOLUCAO: 1 - (cx_entreg / cx_carreg) * 100
  let txDevVal: number | null = null;
  const cxCarreg = Number(row.cx_carreg);
  const cxEntreg = Number(row.cx_entreg);
  if (cxCarreg > 0 && !isNaN(cxCarreg) && !isNaN(cxEntreg)) {
    txDevVal = Math.round(((1 - cxEntreg / cxCarreg) * 100) * 100) / 100;
    if (txDevVal < 0) txDevVal = 0;
  }

  const addResult = (code: string, valor: number | null) => {
    if (valor === null) return;
    const meta = METAS[code];
    // TML: within target if hr_sai <= 08:20 (i.e. tmlVal <= 30)
    // Others: within target if valor <= meta
    let withinTarget: boolean;
    if (code === "TML") {
      withinTarget = hrSai !== null && hrSai <= LIMIT_TIME;
    } else if (code === "TX_DEVOLUCAO") {
      withinTarget = valor <= meta;
    } else {
      withinTarget = valor <= meta;
    }

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
  addResult("TX_DEVOLUCAO", txDevVal);

  // JL: sum of TML + TR + TI
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

    // ── Step 0: Load metas from goals table ──
    const { data: goalsData } = await supabase
      .from("goals")
      .select("valor_meta, indicators(codigo)")
      .eq("ativo", true);

    if (goalsData) {
      METAS = { ...DEFAULT_METAS };
      for (const g of goalsData) {
        const code = (g as any).indicators?.codigo?.toUpperCase();
        if (code && !METAS[code]) {
          METAS[code] = g.valor_meta;
        }
      }
      console.log("Loaded metas from DB:", METAS);
    }

    // ── Step 1: Link user_id on mapa_historico rows that have no user_id ──
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

      // Fetch unlinked rows (mot)
      let unlinkedMot: any[] = [];
      let offset = 0;
      const PAGE = 1000;
      while (true) {
        const { data: chunk } = await supabase
          .from("mapa_historico")
          .select("id, cd_mot")
          .is("mot_user_id", null)
          .neq("cd_mot", "")
          .neq("cd_mot", "0")
          .range(offset, offset + PAGE - 1);
        if (!chunk || chunk.length === 0) break;
        unlinkedMot = unlinkedMot.concat(chunk);
        if (chunk.length < PAGE) break;
        offset += PAGE;
      }

      for (const row of unlinkedMot) {
        const userId = matriculaMap.get(row.cd_mot?.trim());
        if (userId) {
          await supabase.from("mapa_historico").update({ mot_user_id: userId }).eq("id", row.id);
        }
      }

      // Link aju1
      let unlinkedAju1: any[] = [];
      offset = 0;
      while (true) {
        const { data: chunk } = await supabase
          .from("mapa_historico")
          .select("id, cd_aju1")
          .is("aju1_user_id", null)
          .neq("cd_aju1", "")
          .neq("cd_aju1", "0")
          .range(offset, offset + PAGE - 1);
        if (!chunk || chunk.length === 0) break;
        unlinkedAju1 = unlinkedAju1.concat(chunk);
        if (chunk.length < PAGE) break;
        offset += PAGE;
      }

      for (const row of unlinkedAju1) {
        const userId = matriculaMap.get(row.cd_aju1?.trim());
        if (userId) {
          await supabase.from("mapa_historico").update({ aju1_user_id: userId }).eq("id", row.id);
        }
      }

      // Link aju2
      let unlinkedAju2: any[] = [];
      offset = 0;
      while (true) {
        const { data: chunk } = await supabase
          .from("mapa_historico")
          .select("id, cd_aju2")
          .is("aju2_user_id", null)
          .neq("cd_aju2", "")
          .neq("cd_aju2", "0")
          .range(offset, offset + PAGE - 1);
        if (!chunk || chunk.length === 0) break;
        unlinkedAju2 = unlinkedAju2.concat(chunk);
        if (chunk.length < PAGE) break;
        offset += PAGE;
      }

      for (const row of unlinkedAju2) {
        const userId = matriculaMap.get(row.cd_aju2?.trim());
        if (userId) {
          await supabase.from("mapa_historico").update({ aju2_user_id: userId }).eq("id", row.id);
        }
      }

      console.log(`Linked: mot=${unlinkedMot.length}, aju1=${unlinkedAju1.length}, aju2=${unlinkedAju2.length}`);
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

      const upserts: any[] = [];
      const affectedUserIds = new Set<string>();

      for (const row of allMapas) {
        const userId = row.mot_user_id;
        if (!userId) continue;

        affectedUserIds.add(userId);

        const indicators = calculateIndicatorsForRow(row);

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
            mapa_numero: row.mapa,
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
