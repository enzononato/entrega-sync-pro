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
  REFUGO: "f5ded347-5b60-4b87-a2bb-d4d79d4f8e2a",
};

const DEFAULT_METAS: Record<string, number> = {
  TML: 30, TR: 560, TI: 30, JL: 620, TX_DEVOLUCAO: 5, DISP_TEMPO: 15, TX_REPOSICAO: 49.8, REFUGO: 0.5,
};

// Indicadores que se aplicam exclusivamente a um perfil. DISP_TEMPO e
// TX_DEVOLUCAO valem para AMBOS os perfis (motorista e ajudante), portanto
// não entram aqui. Mantido vazio por enquanto, pode ser usado no futuro.
const MOTORISTA_ONLY = new Set<string>([]);

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
  desafio: number;
  percentual_atingimento: number;
  status: string;
  status_desafio: string;
  code: string;
}

type MetasMap = Record<string, Record<string, { meta: number; desafio: number }>>;

function getMetaForWorker(metas: MetasMap, code: string, workerType: string): { meta: number; desafio: number } {
  const byCode = metas[code];
  if (!byCode) return { meta: DEFAULT_METAS[code] ?? 0, desafio: 0 };
  return byCode[workerType] ?? byCode["default"] ?? { meta: DEFAULT_METAS[code] ?? 0, desafio: 0 };
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
  if (hrSai !== null) tmlVal = Math.max(0, hrSai - REF_TIME);

  let trVal: number | null = null;
  if (hrEntr !== null && hrSai !== null) trVal = Math.max(0, hrEntr - hrSai);

  const addResult = (code: string, valor: number | null) => {
    if (valor === null) return;
    if (isAjudante && MOTORISTA_ONLY.has(code)) return;
    const { meta, desafio } = getMetaForWorker(metas, code, workerType);
    let withinTarget: boolean;
    if (code === "TML") {
      withinTarget = hrSai !== null && hrSai <= LIMIT_TIME;
    } else {
      withinTarget = valor <= meta;
    }
    const withinDesafio = desafio > 0 && withinTarget && valor <= desafio;
    results.push({
      indicator_id: INDICATOR_IDS[code], valor, meta, desafio,
      percentual_atingimento: withinTarget ? 100 : 0,
      status: withinTarget ? "dentro_meta" : "abaixo_meta",
      status_desafio: desafio > 0 ? (withinDesafio ? "atingiu" : "nao_atingiu") : "sem_desafio",
      code,
    });
  };

  addResult("TML", tmlVal);
  addResult("TR", trVal);
  addResult("TI", tiVal);
  if (tmlVal !== null && trVal !== null && tiVal !== null) addResult("JL", tmlVal + trVal + tiVal);

  let txDevVal: number | null = null;
  const cxCarreg = Number(row.cx_carreg);
  const cxEntreg = Number(row.cx_entreg);
  if (cxCarreg > 0 && !isNaN(cxCarreg) && !isNaN(cxEntreg)) {
    txDevVal = Math.round(((1 - cxEntreg / cxCarreg) * 100) * 100) / 100;
    if (txDevVal < 0) txDevVal = 0;
  }
  addResult("TX_DEVOLUCAO", txDevVal);

  // DISP_TEMPO: vale para motoristas E ajudantes (mesma equipe → mesmo desvio
  // de tempo previsto). Calcula sempre que houver dados.
  let dispTempoVal: number | null = null;
  if (row.tempo_prev && hrEntr !== null && hrSai !== null) {
    const cleanTP = row.tempo_prev.replace(/[^\d:]/g, "");
    const partsTP = cleanTP.split(":");
    if (partsTP.length >= 2) {
      const hTP = parseInt(partsTP[0], 10);
      const mTP = parseInt(partsTP[1], 10);
      if (!isNaN(hTP) && !isNaN(mTP)) {
        const tempoPrev = hTP * 60 + mTP;
        const tempoReal = Math.max(0, hrEntr - hrSai);
        if (tempoPrev > 0) {
          dispTempoVal = Math.round(Math.max(0, ((tempoReal - tempoPrev) / tempoPrev) * 100) * 100) / 100;
        }
      }
    }
  }
  addResult("DISP_TEMPO", dispTempoVal);

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

    // ── Load metas ──
    const metas: MetasMap = {};
    for (const [code, val] of Object.entries(DEFAULT_METAS)) {
      metas[code] = { default: { meta: val, desafio: 0 } };
    }
    const { data: goalsData } = await supabase
      .from("goals").select("valor_meta, valor_desafio, worker_type, indicators(codigo)").eq("ativo", true);
    if (goalsData) {
      for (const g of goalsData) {
        const code = (g as any).indicators?.codigo?.toUpperCase();
        if (!code || !INDICATOR_IDS[code]) continue;
        const wt = g.worker_type || "default";
        if (!metas[code]) metas[code] = { default: { meta: DEFAULT_METAS[code] ?? 0, desafio: 0 } };
        if (metas[code][wt] === undefined || wt !== "default") {
          metas[code][wt] = { meta: g.valor_meta, desafio: Number((g as any).valor_desafio) || 0 };
        }
      }
    }

    // ── Load users ──
    const { data: allUsers } = await supabase
      .from("users").select("id, matricula, worker_type").neq("matricula", "").eq("ativo", true);
    const userWorkerType = new Map<string, string>();
    const matriculaMap = new Map<string, string>();
    if (allUsers) {
      for (const u of allUsers) {
        if (u.matricula) matriculaMap.set(u.matricula.trim(), u.id);
        userWorkerType.set(u.id, u.worker_type || "motorista");
      }
    }

    // ── Determine dates to process ──
    let dates: string[] = [];
    if (data_referencia) {
      dates = Array.isArray(data_referencia) ? data_referencia : [data_referencia];
    } else {
      const now = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split("T")[0]);
      }
    }

    console.log(`Processing ${dates.length} dates: ${dates.join(", ")}`);

    const indicatorIds = Object.values(INDICATOR_IDS);
    const PAGE = 1000;
    let totalInserted = 0;

    for (const date of dates) {
      let allMapas: any[] = [];
      let offset = 0;
      while (true) {
        const { data: chunk, error: fetchErr } = await supabase
          .from("mapa_historico").select("*").eq("data_operacao", date)
          .range(offset, offset + PAGE - 1);
        if (fetchErr) throw fetchErr;
        if (!chunk || chunk.length === 0) break;
        allMapas = allMapas.concat(chunk);
        if (chunk.length < PAGE) break;
        offset += PAGE;
      }
      if (allMapas.length === 0) continue;

      const updates: { id: string; field: string; userId: string }[] = [];
      for (const row of allMapas) {
        const tryLink = (code: string, field: string) => {
          if (!row[field] && code && code !== "0") {
            const uid = matriculaMap.get(code.trim());
            if (uid) { row[field] = uid; updates.push({ id: row.id, field, userId: uid }); }
          }
        };
        tryLink(row.cd_mot, "mot_user_id");
        tryLink(row.cd_aju1, "aju1_user_id");
        tryLink(row.cd_aju2, "aju2_user_id");
      }
      for (const field of ["mot_user_id", "aju1_user_id", "aju2_user_id"]) {
        const fieldUpdates = updates.filter(u => u.field === field);
        for (const u of fieldUpdates) {
          await supabase.from("mapa_historico").update({ [field]: u.userId }).eq("id", u.id);
        }
      }

      const upserts: any[] = [];
      const affectedUserIds = new Set<string>();

      for (const row of allMapas) {
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
              user_id: userId, indicator_id: ind.indicator_id, data_referencia: date,
              valor: ind.valor, meta: ind.meta, desafio: ind.desafio || null,
              percentual_atingimento: ind.percentual_atingimento, status: ind.status,
              status_desafio: ind.status_desafio !== "sem_desafio" ? ind.status_desafio : null,
              origem_dado: "mapa_historico", mapa_numero: row.mapa,
            });
          }
        }
      }

      if (upserts.length > 0) {
        const userArr = Array.from(affectedUserIds);
        for (let i = 0; i < userArr.length; i += 50) {
          const batch = userArr.slice(i, i + 50);
          await supabase.from("user_indicator_daily").delete()
            .in("user_id", batch).eq("data_referencia", date)
            .in("indicator_id", indicatorIds).eq("origem_dado", "mapa_historico");
        }
        for (let i = 0; i < upserts.length; i += 500) {
          const batch = upserts.slice(i, i + 500);
          const { error: insertErr } = await supabase.from("user_indicator_daily").insert(batch);
          if (insertErr) throw insertErr;
        }
        totalInserted += upserts.length;
      }
    }

    // ── TX_REPOSICAO from reposicao_031805 ──
    const TX_REPOSICAO_ID = INDICATOR_IDS["TX_REPOSICAO"];
    const repoMeta = getMetaForWorker(metas, "TX_REPOSICAO", "motorista");

    // FIX Problema 4: Only fetch mapa_historico rows for mapas present in reposição data
    // First, fetch all reposição rows
    let allRepoRows: { mot_user_id: string; data_solicitacao: string; valor: number; mapa_origem: string | null; motorista_codigo: string | null }[] = [];
    {
      let offset = 0;
      while (true) {
        const { data: chunk, error: rErr } = await supabase.from("reposicao_031805")
          .select("mot_user_id, data_solicitacao, valor, mapa_origem, motorista_codigo")
          .not("data_solicitacao", "is", null)
          .range(offset, offset + PAGE - 1);
        if (rErr) throw rErr;
        if (!chunk || chunk.length === 0) break;
        for (const r of chunk) {
          let userId = r.mot_user_id;
          if (!userId && r.motorista_codigo) {
            userId = matriculaMap.get(r.motorista_codigo.trim()) ?? null;
          }
          if (userId && r.data_solicitacao && r.valor != null) {
            allRepoRows.push({
              mot_user_id: userId,
              data_solicitacao: r.data_solicitacao,
              valor: Number(r.valor) || 0,
              mapa_origem: r.mapa_origem && r.mapa_origem !== "0" ? r.mapa_origem : null,
              motorista_codigo: r.motorista_codigo,
            });
          }
        }
        if (chunk.length < PAGE) break;
        offset += PAGE;
      }
    }

    // FIX Problema 4: Build mapa lookup only for relevant mapas
    const mapaDateLookup = new Map<string, string>();
    {
      const relevantMapas = [...new Set(allRepoRows.map(r => r.mapa_origem).filter(Boolean))] as string[];
      if (relevantMapas.length > 0) {
        for (let i = 0; i < relevantMapas.length; i += 200) {
          const batch = relevantMapas.slice(i, i + 200);
          const { data: chunk } = await supabase
            .from("mapa_historico").select("mapa, data_operacao")
            .in("mapa", batch);
          if (chunk) {
            for (const r of chunk) mapaDateLookup.set(r.mapa, r.data_operacao);
          }
        }
      }
    }

    // Filter by dates if specific dates were requested
    if (dates.length > 0) {
      const dateSet = new Set(dates);
      allRepoRows = allRepoRows.filter(r => {
        if (r.mapa_origem) {
          const mapaDate = mapaDateLookup.get(r.mapa_origem);
          if (mapaDate && dateSet.has(mapaDate)) return true;
        }
        return dateSet.has(r.data_solicitacao);
      });
    }

    // Aggregate by user + mapa
    const repoAggregated = new Map<string, { valor: number; dataRef: string }>();
    for (const row of allRepoRows) {
      const mapa = row.mapa_origem ?? "";
      const key = `${row.mot_user_id}|${mapa}`;
      const mapaDate = mapa ? mapaDateLookup.get(mapa) : null;
      const dateForRecord = mapaDate ?? row.data_solicitacao;

      const existing = repoAggregated.get(key);
      if (existing) {
        existing.valor += row.valor;
        if (dateForRecord < existing.dataRef) existing.dataRef = dateForRecord;
      } else {
        repoAggregated.set(key, { valor: row.valor, dataRef: dateForRecord });
      }
    }

    // Monthly totals for status
    const monthlyTotals = new Map<string, number>();
    for (const row of allRepoRows) {
      const monthKey = row.data_solicitacao.substring(0, 7);
      const key = `${row.mot_user_id}|${monthKey}`;
      monthlyTotals.set(key, (monthlyTotals.get(key) || 0) + row.valor);
    }

    const repoUpserts: any[] = [];
    const repoAffectedUsers = new Set<string>();
    // FIX Problema 1: Collect affected dates for date-filtered delete
    const repoAffectedDates = new Set<string>();

    for (const [key, agg] of repoAggregated) {
      const [userId, mapaStr] = key.split("|");
      const rounded = Math.round(agg.valor * 100) / 100;
      const monthKey = agg.dataRef.substring(0, 7);
      const monthTotal = monthlyTotals.get(`${userId}|${monthKey}`) || 0;
      const withinTarget = Math.round(monthTotal * 100) / 100 <= repoMeta.meta;
      repoAffectedUsers.add(userId);
      repoAffectedDates.add(agg.dataRef);
      repoUpserts.push({
        user_id: userId, indicator_id: TX_REPOSICAO_ID, data_referencia: agg.dataRef,
        valor: rounded, meta: repoMeta.meta,
        desafio: repoMeta.desafio > 0 ? repoMeta.desafio : null,
        percentual_atingimento: withinTarget ? 100 : 0,
        status: withinTarget ? "dentro_meta" : "abaixo_meta",
        status_desafio: repoMeta.desafio > 0 ? (rounded <= repoMeta.desafio ? "atingiu" : "nao_atingiu") : null,
        origem_dado: "reposicao_031805", mapa_numero: mapaStr || null,
      });
    }

    // FIX Problema 1: Delete only for affected users AND affected dates (not all history)
    const repoUserArr = Array.from(repoAffectedUsers);
    const repoDatesArr = Array.from(repoAffectedDates);
    for (let i = 0; i < repoUserArr.length; i += 50) {
      const batch = repoUserArr.slice(i, i + 50);
      await supabase.from("user_indicator_daily").delete()
        .in("user_id", batch).eq("indicator_id", TX_REPOSICAO_ID)
        .eq("origem_dado", "reposicao_031805")
        .in("data_referencia", repoDatesArr);
    }
    for (let i = 0; i < repoUpserts.length; i += 500) {
      const batch = repoUpserts.slice(i, i + 500);
      const { error: insertErr } = await supabase.from("user_indicator_daily").insert(batch);
      if (insertErr) throw insertErr;
    }
    totalInserted += repoUpserts.length;
    console.log(`Done: ${totalInserted} records, ${dates.length} dates`);

    // ── REFUGO from refugo_031134 (apenas ajudantes) ──
    const REFUGO_ID = INDICATOR_IDS["REFUGO"];
    const refugoMeta = getMetaForWorker(metas, "REFUGO", "ajudante");

    let allRefugoRows: { mapa: string; data_operacao: string; pct_refugo: number }[] = [];
    {
      let offset = 0;
      while (true) {
        const { data: chunk, error: rErr } = await supabase.from("refugo_031134")
          .select("mapa, data_operacao, pct_refugo")
          .range(offset, offset + PAGE - 1);
        if (rErr) throw rErr;
        if (!chunk || chunk.length === 0) break;
        for (const r of chunk) {
          if (r.mapa && r.data_operacao) {
            allRefugoRows.push({
              mapa: r.mapa,
              data_operacao: r.data_operacao,
              pct_refugo: Number(r.pct_refugo) || 0,
            });
          }
        }
        if (chunk.length < PAGE) break;
        offset += PAGE;
      }
    }

    // Filter by requested dates
    if (dates.length > 0) {
      const dateSet = new Set(dates);
      allRefugoRows = allRefugoRows.filter(r => dateSet.has(r.data_operacao));
    }

    // Lookup ajudantes do mapa em mapa_historico
    const refugoMapas = [...new Set(allRefugoRows.map(r => r.mapa))];
    const mapaAjudantes = new Map<string, { aju1: string | null; aju2: string | null }>();
    if (refugoMapas.length > 0) {
      for (let i = 0; i < refugoMapas.length; i += 200) {
        const batch = refugoMapas.slice(i, i + 200);
        const { data: chunk } = await supabase
          .from("mapa_historico").select("mapa, aju1_user_id, aju2_user_id")
          .in("mapa", batch);
        if (chunk) {
          for (const r of chunk) {
            mapaAjudantes.set(r.mapa, { aju1: r.aju1_user_id, aju2: r.aju2_user_id });
          }
        }
      }
    }

    const refugoUpserts: any[] = [];
    const refugoAffectedUsers = new Set<string>();
    const refugoAffectedDates = new Set<string>();

    for (const row of allRefugoRows) {
      const ajudantes = mapaAjudantes.get(row.mapa);
      if (!ajudantes) continue;
      const userIds = [ajudantes.aju1, ajudantes.aju2].filter((u): u is string => !!u);
      const valor = Math.round(row.pct_refugo * 100) / 100;
      const withinTarget = valor <= refugoMeta.meta;
      for (const userId of userIds) {
        refugoAffectedUsers.add(userId);
        refugoAffectedDates.add(row.data_operacao);
        refugoUpserts.push({
          user_id: userId, indicator_id: REFUGO_ID, data_referencia: row.data_operacao,
          valor, meta: refugoMeta.meta, desafio: null,
          percentual_atingimento: withinTarget ? 100 : 0,
          status: withinTarget ? "dentro_meta" : "abaixo_meta",
          status_desafio: null,
          origem_dado: "refugo_031134", mapa_numero: row.mapa,
        });
      }
    }

    const refugoUserArr = Array.from(refugoAffectedUsers);
    const refugoDatesArr = Array.from(refugoAffectedDates);
    if (refugoUserArr.length > 0 && refugoDatesArr.length > 0) {
      for (let i = 0; i < refugoUserArr.length; i += 50) {
        const batch = refugoUserArr.slice(i, i + 50);
        await supabase.from("user_indicator_daily").delete()
          .in("user_id", batch).eq("indicator_id", REFUGO_ID)
          .eq("origem_dado", "refugo_031134")
          .in("data_referencia", refugoDatesArr);
      }
      for (let i = 0; i < refugoUpserts.length; i += 500) {
        const batch = refugoUpserts.slice(i, i + 500);
        const { error: insertErr } = await supabase.from("user_indicator_daily").insert(batch);
        if (insertErr) throw insertErr;
      }
      totalInserted += refugoUpserts.length;
    }
    console.log(`REFUGO: ${refugoUpserts.length} records`);

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
