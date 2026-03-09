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
    const { cpf, password } = await req.json();

    if (!cpf || !password) {
      return new Response(
        JSON.stringify({ error: "CPF e senha são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean CPF - digits only + validate check digits
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11 || /^(\d)\1{10}$/.test(cleanCpf)) {
      return new Response(
        JSON.stringify({ error: "CPF inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate CPF check digits
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cleanCpf[i]) * (10 - i);
    let rem = (sum * 10) % 11;
    if (rem === 10) rem = 0;
    if (rem !== parseInt(cleanCpf[9])) {
      return new Response(
        JSON.stringify({ error: "CPF inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cleanCpf[i]) * (11 - i);
    rem = (sum * 10) % 11;
    if (rem === 10) rem = 0;
    if (rem !== parseInt(cleanCpf[10])) {
      return new Response(
        JSON.stringify({ error: "CPF inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to look up email by CPF
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: user, error: lookupError } = await supabaseAdmin
      .from("users")
      .select("email")
      .eq("cpf", cleanCpf)
      .single();

    if (lookupError || !user) {
      return new Response(
        JSON.stringify({ error: "CPF ou senha inválidos" }),
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
        JSON.stringify({ error: "CPF ou senha inválidos" }),
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
