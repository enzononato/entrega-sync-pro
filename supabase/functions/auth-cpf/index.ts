import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") || null;

  const logAttempt = async (params: {
    identifier: string;
    identifier_type: string;
    success: boolean;
    failure_reason?: string | null;
    user_id?: string | null;
    user_nome?: string | null;
    user_email?: string | null;
  }) => {
    try {
      await supabaseAdmin.from("login_attempts").insert({
        identifier: params.identifier,
        identifier_type: params.identifier_type,
        success: params.success,
        failure_reason: params.failure_reason ?? null,
        user_id: params.user_id ?? null,
        user_nome: params.user_nome ?? null,
        user_email: params.user_email ?? null,
        ip_address: ip,
        user_agent: userAgent,
      });
    } catch (_e) {
      // never block login on logging
    }
  };

  try {
    const body = await req.json();
    const { matricula, password, cpf } = body;

    // Support both matricula and legacy cpf login
    const loginId = matricula || cpf;
    const idType = matricula ? "matricula" : cpf ? "cpf" : "desconhecido";

    if (!loginId || !password) {
      await logAttempt({
        identifier: String(loginId ?? ""),
        identifier_type: idType,
        success: false,
        failure_reason: "Matrícula/CPF e senha são obrigatórios",
      });
      return new Response(
        JSON.stringify({ error: "Matrícula e senha são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanLoginId = String(loginId).trim().toUpperCase();

    // Try matricula first
    let user: { email: string; id?: string; nome?: string } | null = null;
    let lookupError = null;

    if (matricula) {
      const result = await supabaseAdmin
        .from("users")
        .select("id, email, nome, ativo")
        .eq("matricula", cleanLoginId)
        .maybeSingle();
      if (result.data && result.data.ativo === false) {
        await logAttempt({
          identifier: cleanLoginId,
          identifier_type: idType,
          success: false,
          failure_reason: "Usuário inativo",
          user_id: result.data.id,
          user_nome: result.data.nome,
          user_email: result.data.email,
        });
        return new Response(
          JSON.stringify({ error: "Usuário inativo" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      user = result.data ?? null;
      lookupError = result.error;
    }

    // Fallback to CPF if matricula not provided
    if (!user && cpf) {
      const cleanCpf = cpf.replace(/\D/g, "");
      const result = await supabaseAdmin
        .from("users")
        .select("id, email, nome, ativo")
        .eq("cpf", cleanCpf)
        .maybeSingle();
      if (result.data && result.data.ativo === false) {
        await logAttempt({
          identifier: cleanLoginId,
          identifier_type: idType,
          success: false,
          failure_reason: "Usuário inativo",
          user_id: result.data.id,
          user_nome: result.data.nome,
          user_email: result.data.email,
        });
        return new Response(
          JSON.stringify({ error: "Usuário inativo" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      user = result.data ?? null;
      lookupError = result.error;
    }

    if (lookupError || !user) {
      await logAttempt({
        identifier: cleanLoginId,
        identifier_type: idType,
        success: false,
        failure_reason: "Matrícula/CPF não encontrado",
      });
      return new Response(
        JSON.stringify({ error: "Matrícula ou senha inválidos" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate with Supabase Auth using the looked-up email
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (authError) {
      await logAttempt({
        identifier: cleanLoginId,
        identifier_type: idType,
        success: false,
        failure_reason: `Senha inválida (${authError.message})`,
        user_id: user.id ?? null,
        user_nome: user.nome ?? null,
        user_email: user.email,
      });
      return new Response(
        JSON.stringify({ error: "Matrícula ou senha inválidos" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await logAttempt({
      identifier: cleanLoginId,
      identifier_type: idType,
      success: true,
      user_id: user.id ?? null,
      user_nome: user.nome ?? null,
      user_email: user.email,
    });

    return new Response(
      JSON.stringify({ session: authData.session }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    await logAttempt({
      identifier: "",
      identifier_type: "desconhecido",
      success: false,
      failure_reason: `Erro interno: ${String(err)}`,
    });
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
