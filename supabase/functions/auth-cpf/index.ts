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

  try {
    const body = await req.json();
    const { matricula, password, cpf } = body;

    // Support both matricula and legacy cpf login
    const loginId = matricula || cpf;

    if (!loginId || !password) {
      return new Response(
        JSON.stringify({ error: "Matrícula e senha são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanLoginId = String(loginId).trim().toUpperCase();

    // Use service role to look up email by matricula (or cpf as fallback)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Try matricula first
    let user = null;
    let lookupError = null;

    if (matricula) {
      const result = await supabaseAdmin
        .from("users")
        .select("email")
        .eq("matricula", cleanLoginId)
        .eq("ativo", true)
        .single();
      user = result.data;
      lookupError = result.error;
    }

    // Fallback to CPF if matricula not provided
    if (!user && cpf) {
      const cleanCpf = cpf.replace(/\D/g, "");
      const result = await supabaseAdmin
        .from("users")
        .select("email")
        .eq("cpf", cleanCpf)
        .eq("ativo", true)
        .single();
      user = result.data;
      lookupError = result.error;
    }

    if (lookupError || !user) {
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
      return new Response(
        JSON.stringify({ error: "Matrícula ou senha inválidos" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ session: authData.session }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
