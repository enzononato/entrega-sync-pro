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
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") || null;

  const logAttempt = async (params: {
    identifier: string;
    success: boolean;
    failure_reason?: string | null;
    user_id?: string | null;
    user_nome?: string | null;
    user_email?: string | null;
  }) => {
    try {
      await supabaseAdmin.from("login_attempts").insert({
        identifier: params.identifier,
        identifier_type: "email",
        success: params.success,
        failure_reason: params.failure_reason ?? null,
        user_id: params.user_id ?? null,
        user_nome: params.user_nome ?? null,
        user_email: params.user_email ?? null,
        ip_address: ip,
        user_agent: userAgent,
      });
    } catch (_e) { /* ignore */ }
  };

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      await logAttempt({
        identifier: String(email ?? ""),
        success: false,
        failure_reason: "E-mail e senha são obrigatórios",
      });
      return new Response(
        JSON.stringify({ error: "E-mail e senha são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Lookup public.users by email (best effort enrichment)
    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("id, nome, email, ativo")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (profile && profile.ativo === false) {
      await logAttempt({
        identifier: cleanEmail,
        success: false,
        failure_reason: "Usuário inativo",
        user_id: profile.id,
        user_nome: profile.nome,
        user_email: profile.email,
      });
      return new Response(
        JSON.stringify({ error: "Usuário inativo" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (authError || !authData.session) {
      await logAttempt({
        identifier: cleanEmail,
        success: false,
        failure_reason: authError?.message ?? "Credenciais inválidas",
        user_id: profile?.id ?? null,
        user_nome: profile?.nome ?? null,
        user_email: profile?.email ?? cleanEmail,
      });
      return new Response(
        JSON.stringify({ error: "E-mail ou senha inválidos" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await logAttempt({
      identifier: cleanEmail,
      success: true,
      user_id: profile?.id ?? null,
      user_nome: profile?.nome ?? null,
      user_email: profile?.email ?? cleanEmail,
    });

    return new Response(
      JSON.stringify({ session: authData.session }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    await logAttempt({
      identifier: "",
      success: false,
      failure_reason: `Erro interno: ${String(err)}`,
    });
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});