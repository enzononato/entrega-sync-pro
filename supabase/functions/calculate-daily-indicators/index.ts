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
  DISP_TEMPO: "488d1de9-9d88-42f2-bf3b-625752c0db02",
  TX_REPOSICAO: "c4c40e3e-f23b-46ce-a576-885c610f2df7",
};

const DEFAULT_METAS: Record<string, number> = {
  TML: 30, TR: 560, TI: 30, JL: 620, TX_DEVOLUCAO: 5, DISP_TEMPO: 0, TX_REPOSICAO: 49.8,
};

// Indicators that only apply to motoristas
const MOTORISTA_ONLY = new Set(["TX_DEVOLUCAO", "DISP_TEMPO"]);

// All indicator codes for ajudantes (excludes motorista-only)
const AJUDANTE_CODES = Object.keys(INDICATOR_IDS).filter(c => !MOTORISTA_ONLY.has(c));

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
  code: string;
}

// Metas structure: code -> workerType -> value
// workerType keys: "motorista", "ajudante", "default"
type MetasMap = Record<string, Record<string, number>>;

function getMetaForWorker(metas: MetasMap, code: string, workerType: string): number {
  const byCode = metas[code];
  if (!byCode) return DEFAULT_METAS[code] ?? 0;
  return byCode[workerType] ?? byCode["default"] ?? DEFAULT_METAS[code] ?? 0;
}

function calculateIndicatorsForRow(row: any, workerType: string, metas: MetasMap): IndicatorResult[] {
  const results: IndicatorResult[] = [];
  const isAjudante = workerType === "ajudante";

  const hrSai = parseTime(row.hr_sai);
  const hrEntr = parseTime(row.hr_entr);
  const tiVal = parseTime(row.tmpo_interno);

  const REF_TIME = 7 * 60 + 50;
  const LIMIT_TIME = 8 * 60 + 20;

  let tmlVal: number | null = null;
  if (hrSai !== null) {
    tmlVal = Math.max(0, hrSai - REF_TIME);
  }

  let trVal: number | null = null;
  if (hrEntr !== null && hrSai !== null) {
    trVal = Math.max(0, hrEntr - hrSai);
  }

  const addResult = (code: string, valor: number | null) => {
    if (valor === null) return;
    // Skip motorista-only indicators for ajudantes
    if (isAjudante && MOTORISTA_ONLY.has(code)) return;

    const meta = getMetaForWorker(metas, code, workerType);
    let withinTarget: boolean;
    if (code === "TML") {
      withinTarget = hrSai !== null && hrSai <= LIMIT_TIME;
    } else if (code === "DISP_TEMPO") {
      withinTarget = valor >= meta;
    } else {
      withinTarget = valor <= meta;
    }

    results.push({
      indicator_id: INDICATOR_IDS[code],
      valor,
      meta,
      percentual_atingimento: withinTarget ? 100 : 0,
      status: withinTarget ? "dentro_meta" : "abaixo_meta",
      code,
    });
  };

  addResult("TML", tmlVal);
  addResult("TR", trVal);
  addResult("TI", tiVal);

  // JL: sum of TML + TR + TI
  if (tmlVal !== null && trVal !== null && tiVal !== null) {
    addResult("JL", tmlVal + trVal + tiVal);
  }

  // Motorista-only indicators
  if (!isAjudante) {
    // TX_DEVOLUCAO
    let txDevVal: number | null = null;
    const cxCarreg = Number(row.cx_carreg);
    const cxEntreg = Number(row.cx_entreg);
    if (cxCarreg > 0 && !isNaN(cxCarreg) && !isNaN(cxEntreg)) {
      txDevVal = Math.round(((1 - cxEntreg / cxCarreg) * 100) * 100) / 100;
      if (txDevVal < 0) txDevVal = 0;
    }
    addResult("TX_DEVOLUCAO", txDevVal);

    // DISP_TEMPO
    let dispTempoVal: number | null = null;
    if (row.tempo_prev && hrEntr !== null && hrSai !== null) {
      const cleanTP = row.tempo_prev.replace(/[^\d:]/g, "");
      const partsTP = cleanTP.split(":");
      if (partsTP.length === 2) {
        const hTP = parseInt(partsTP[0], 10);
        const mTP = parseInt(partsTP[1], 10);
        if (!isNaN(hTP) && !isNaN(mTP)) {
          const tempoPrev = hTP * 60 + mTP;
          const tempoReal = Math.max(0, hrEntr - hrSai);
          dispTempoVal = tempoPrev - tempoReal;
        }
      }
    }
    addResult("DISP_TEMPO", dispTempoVal);
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

    // ── Step 0: Load metas from goals table, keyed by code + worker_type ──
    const metas: MetasMap = {};
    // Initialize defaults
    for (const [code, val] of Object.entries(DEFAULT_METAS)) {
      metas[code] = { default: val };
    }

    const { data: goalsData } = await supabase
      .from("goals")
      .select("valor_meta, worker_type, indicators(codigo)")
      .eq("ativo", true);

    if (goalsData) {
      for (const g of goalsData) {
        const code = (g as any).indicators?.codigo?.toUpperCase();
        if (!code || !INDICATOR_IDS[code]) continue;
        const wt = g.worker_type || "default";
        if (!metas[code]) metas[code] = { default: DEFAULT_METAS[code] ?? 0 };
        // Only set if not already set (first active goal wins)
        if (metas[code][wt] === undefined || wt !== "default") {
          metas[code][wt] = g.valor_meta;
        }
      }
      console.log("Loaded metas:", JSON.stringify(metas));
    }

    // ── Step 0b: Build user -> worker_type map ──
    const { data: allUsers } = await supabase
      .from("users")
      .select("id, matricula, worker_type")
      .neq("matricula", "")
      .eq("ativo", true);

    const userWorkerType = new Map<string, string>();
    const matriculaMap = new Map<string, string>();
    if (allUsers) {
      for (const u of allUsers) {
        if (u.matricula) matriculaMap.set(u.matricula.trim(), u.id);
        userWorkerType.set(u.id, u.worker_type || "motorista");
      }
    }

    // ── Step 1: Link user_id on mapa_historico rows ──
    if (allUsers && allUsers.length > 0) {
      const PAGE = 1000;

      const linkField = async (field: string, userIdField: string) => {
        let unlinked: any[] = [];
        let offset = 0;
        while (true) {
          const { data: chunk } = await supabase
            .from("mapa_historico")
            .select(`id, ${field}`)
            .is(userIdField, null)
            .neq(field, "")
            .neq(field, "0")
            .range(offset, offset + PAGE - 1);
          if (!chunk || chunk.length === 0) break;
          unlinked = unlinked.concat(chunk);
          if (chunk.length < PAGE) break;
          offset += PAGE;
        }
        for (const row of unlinked) {
          const userId = matriculaMap.get(row[field]?.trim());
          if (userId) {
            await supabase.from("mapa_historico").update({ [userIdField]: userId }).eq("id", row.id);
          }
        }
        return unlinked.length;
      };

      const [motCount, aju1Count, aju2Count] = await Promise.all([
        linkField("cd_mot", "mot_user_id"),
        linkField("cd_aju1", "aju1_user_id"),
        linkField("cd_aju2", "aju2_user_id"),
      ]);
      console.log(`Linked: mot=${motCount}, aju1=${aju1Count}, aju2=${aju2Count}`);
    }

    // ── Step 2: Get dates to process ──
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
        // Process each worker in this mapa row
        const workers = [
          { userId: row.mot_user_id, defaultType: "motorista" },
          { userId: row.aju1_user_id, defaultType: "ajudante" },
          { userId: row.aju2_user_id, defaultType: "ajudante" },
        ];

        for (const { userId, defaultType } of workers) {
          if (!userId) continue;
          affectedUserIds.add(userId);

          const workerType = userWorkerType.get(userId) || defaultType;
          const indicators = calculateIndicatorsForRow(row, workerType, metas);

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
      }

      if (upserts.length > 0) {
        for (const uid of affectedUserIds) {
          await supabase
            .from("user_indicator_daily")
            .delete()
            .eq("user_id", uid)
            .eq("data_referencia", date)
            .in("indicator_id", indicatorIds)
            .eq("origem_dado", "mapa_historico");
        }

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
