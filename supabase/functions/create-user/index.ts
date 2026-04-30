import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function findAuthUserIdByEmail(supabaseAdmin: any, email: string) {
  const perPage = 200;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw error;
    }

    const foundUser = data.users.find((user: any) => user.email?.trim().toLowerCase() === email);
    if (foundUser) {
      return foundUser.id as string;
    }

    if (data.users.length < perPage) {
      break;
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Configuração do Supabase ausente na função." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === serviceRoleKey;

    if (!isServiceRole) {
      const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

      if (userError || !userData.user) {
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const callerAuthId = userData.user.id;
      const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
        .from("users")
        .select("role")
        .eq("auth_user_id", callerAuthId)
        .single();

      if (callerProfileError || callerProfile?.role !== "administrador") {
        return new Response(JSON.stringify({ error: "Acesso negado" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const { email, password, nome, matricula, role, worker_type, unidade_id, rota_id, cpf } = body;

    if (!email || !password || !nome) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: email, password, nome" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedMatricula = (matricula || "").toString().trim().toUpperCase();
    let authUserId: string;

    // 1) Se já existir usuário com a mesma matrícula, atualizar dados existentes
    if (normalizedMatricula) {
      const { data: existingByMatricula } = await supabaseAdmin
        .from("users")
        .select("id, auth_user_id, email")
        .eq("matricula", normalizedMatricula)
        .maybeSingle();

      if (existingByMatricula?.id) {
        const updatePayload: Record<string, unknown> = {
          nome,
          cpf: cpf || null,
          worker_type: worker_type || null,
          unidade_id: unidade_id || null,
          rota_id: rota_id || null,
          role: role || "colaborador",
        };

        const { error: updErr } = await supabaseAdmin
          .from("users")
          .update(updatePayload)
          .eq("id", existingByMatricula.id);

        if (updErr) {
          return new Response(JSON.stringify({ error: updErr.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Garante user_units sem duplicar
        if (unidade_id) {
          const { data: existingLink } = await supabaseAdmin
            .from("user_units")
            .select("id")
            .eq("user_id", existingByMatricula.id)
            .eq("unit_id", unidade_id)
            .maybeSingle();
          if (!existingLink) {
            await supabaseAdmin.from("user_units").insert({
              user_id: existingByMatricula.id,
              unit_id: unidade_id,
            });
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            updated: true,
            user_id: existingByMatricula.id,
            auth_user_id: existingByMatricula.auth_user_id,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { nome },
    });

    if (authError) {
      if (!authError.message?.includes("already been registered")) {
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existingProfileByEmail } = await supabaseAdmin
        .from("users")
        .select("id, auth_user_id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (existingProfileByEmail?.auth_user_id) {
        authUserId = existingProfileByEmail.auth_user_id;
      } else {
        const foundAuthUserId = await findAuthUserIdByEmail(supabaseAdmin, normalizedEmail);

        if (!foundAuthUserId) {
          return new Response(JSON.stringify({ error: "Usuário existe no Auth, mas não foi possível localizar sua conta para recriar o cadastro." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        authUserId = foundAuthUserId;
      }
    } else {
      authUserId = authData.user.id;
    }

    const userPayload = {
      auth_user_id: authUserId,
      email: normalizedEmail,
      nome,
      matricula: matricula || "",
      cpf: cpf || null,
      role: role || "colaborador",
      worker_type: worker_type || null,
      unidade_id: unidade_id || null,
      rota_id: rota_id || null,
    };

    const { data: existingUserByAuth } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    const { data: existingUserByEmail } = existingUserByAuth
      ? { data: null }
      : await supabaseAdmin
          .from("users")
          .select("id")
          .eq("email", normalizedEmail)
          .maybeSingle();

    const existingUserId = existingUserByAuth?.id ?? existingUserByEmail?.id ?? null;

    const { data: savedUser, error: saveError } = existingUserId
      ? await supabaseAdmin
          .from("users")
          .update(userPayload)
          .eq("id", existingUserId)
          .select("id")
          .single()
      : await supabaseAdmin
          .from("users")
          .insert(userPayload)
          .select("id")
          .single();

    if (saveError || !savedUser) {
      console.error("create-user save error", saveError);
      return new Response(JSON.stringify({ error: saveError?.message || "Falha ao salvar usuário." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appRole = role === "administrador" ? "admin" : "colaborador";
    const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
      { user_id: authUserId, role: appRole },
      { onConflict: "user_id,role" },
    );

    if (roleError) {
      console.error("create-user role error", roleError);
      return new Response(JSON.stringify({ error: roleError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, user_id: savedUser.id, auth_user_id: authUserId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("create-user unexpected error", error);

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});