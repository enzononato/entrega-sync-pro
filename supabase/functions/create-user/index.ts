import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Verify the caller is an authenticated admin or service role
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

    // Create auth user (or find existing)
    let authUserId: string;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome },
    });

    if (authError) {
      if (authError.message?.includes("already been registered")) {
        // Try to find in users table first
        const { data: existingProfile } = await supabaseAdmin
          .from("users")
          .select("id, auth_user_id")
          .eq("email", email)
          .single();
        
        if (existingProfile) {
          authUserId = existingProfile.auth_user_id;
        } else {
          // Auth user exists but no users row — look up auth user by email and recreate the row
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1, page: 1 });
          // listUsers doesn't filter by email, so use getUserByEmail workaround
          // Actually we can get the user from auth by updating their password (which also returns the user)
          const { data: updateData, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
            '', // placeholder
            {}
          ).catch(() => ({ data: null, error: null })) as any;
          
          // Better approach: list all and find, or just create the users row by looking up via auth admin API
          // Use the admin API to find user by email
          let foundAuthId: string | null = null;
          const { data: usersListData } = await supabaseAdmin.auth.admin.listUsers();
          if (usersListData?.users) {
            const found = usersListData.users.find((u: any) => u.email === email);
            if (found) foundAuthId = found.id;
          }

          if (!foundAuthId) {
            return new Response(JSON.stringify({ error: "Não foi possível encontrar o usuário no Auth" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          authUserId = foundAuthId;

          // Insert the missing users row
          const { data: insertedUser, error: insertError } = await supabaseAdmin
            .from("users")
            .insert({
              auth_user_id: authUserId,
              email,
              nome,
              matricula: matricula || "",
              cpf: cpf || null,
              role: role || "colaborador",
              worker_type: worker_type || null,
              unidade_id: unidade_id || null,
              rota_id: rota_id || null,
            })
            .select("id")
            .single();

          if (insertError) {
            return new Response(JSON.stringify({ error: insertError.message }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Insert role
          const appRole2 = (role === "administrador") ? "admin" : "colaborador";
          await supabaseAdmin.from("user_roles").upsert(
            { user_id: authUserId, role: appRole2 },
            { onConflict: "user_id,role" }
          );

          return new Response(JSON.stringify({ success: true, user_id: insertedUser.id, auth_user_id: authUserId }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      authUserId = authData.user.id;
    }

    // Update auto-created profile and return public.users.id
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        nome,
        matricula: matricula || "",
        cpf: cpf || null,
        role: role || "colaborador",
        worker_type: worker_type || null,
        unidade_id: unidade_id || null,
        rota_id: rota_id || null,
      })
      .eq("auth_user_id", authUserId)
      .select("id")
      .single();

    if (updateError || !updatedUser) {
      return new Response(JSON.stringify({ error: updateError?.message || "Falha ao atualizar usuário." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert role into user_roles table
    const appRole = (role === "administrador") ? "admin" : "colaborador";
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: authUserId, role: appRole },
      { onConflict: "user_id,role" }
    );

    return new Response(JSON.stringify({ success: true, user_id: updatedUser.id, auth_user_id: authUserId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
