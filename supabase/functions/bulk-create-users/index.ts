import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .single();

    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { users } = await req.json();
    if (!Array.isArray(users) || users.length === 0) {
      return new Response(JSON.stringify({ error: "Array 'users' é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { matricula: string; success: boolean; error?: string }[] = [];

    for (const u of users) {
      const { nome, matricula, worker_type, unidade_id, password } = u;
      const email = `${String(matricula).toUpperCase()}@app.local`;

      try {
        // Create auth user
        let authUserId: string;
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: password || "rev123",
          email_confirm: true,
          user_metadata: { nome },
        });

        if (authError) {
          if (!authError.message?.includes("already been registered")) {
            results.push({ matricula, success: false, error: authError.message });
            continue;
          }
          // Find existing auth user
          const { data: existingProfile } = await supabaseAdmin
            .from("users")
            .select("auth_user_id")
            .eq("email", email)
            .maybeSingle();
          if (existingProfile?.auth_user_id) {
            authUserId = existingProfile.auth_user_id;
          } else {
            results.push({ matricula, success: false, error: "Email já registrado, perfil não encontrado" });
            continue;
          }
        } else {
          authUserId = authData.user.id;
        }

        // Upsert public.users
        const { data: existingUser } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("auth_user_id", authUserId)
          .maybeSingle();

        const payload = {
          auth_user_id: authUserId,
          email,
          nome: String(nome).trim(),
          matricula: String(matricula).toUpperCase(),
          role: "colaborador",
          worker_type: worker_type || null,
          unidade_id: unidade_id || null,
        };

        if (existingUser) {
          await supabaseAdmin.from("users").update(payload).eq("id", existingUser.id);
        } else {
          const { error: insertErr } = await supabaseAdmin.from("users").insert(payload);
          if (insertErr) {
            results.push({ matricula, success: false, error: insertErr.message });
            continue;
          }
        }

        // Upsert role
        await supabaseAdmin.from("user_roles").upsert(
          { user_id: authUserId, role: "colaborador" as any },
          { onConflict: "user_id,role" }
        );

        // Add user_units
        const { data: userRecord } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("auth_user_id", authUserId)
          .single();

        if (userRecord && unidade_id) {
          await supabaseAdmin.from("user_units").upsert(
            { user_id: userRecord.id, unit_id: unidade_id },
            { onConflict: "user_id,unit_id" }
          );
        }

        results.push({ matricula, success: true });
      } catch (err) {
        results.push({ matricula, success: false, error: err instanceof Error ? err.message : "Erro" });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    return new Response(JSON.stringify({ success: successCount, errors: errorCount, details: results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
