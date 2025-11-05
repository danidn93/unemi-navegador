// supabase/functions/invite-admin/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Lee origins permitidos desde secret (CSV) o fallback a localhost
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function buildCorsHeaders(req: Request) {
  const reqOrigin = req.headers.get("origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  // Responde el preflight inmediatamente
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 204 });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
    }

    const { fullName, email, dept, tempPw, origin } = await req.json();

    if (!fullName || !email || !dept || !tempPw || !origin) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: corsHeaders });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Redirección al reset (usa el origin que llega del front)
    const originClean = String(origin).replace(/\/+$/, "");
    const redirectTo = `${originClean}/reset-temp-password?email=${encodeURIComponent(email)}`;

    // Envía INVITE (usa tu template "Invite user" y {{ .ConfirmationURL }})
    const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName,
        role: "admin",
        department: dept,
        temp_password: tempPw,
        require_password_change: true,
      },
      emailRedirectTo: redirectTo,
    });
    if (invErr) {
      return new Response(JSON.stringify({ error: invErr.message }), { status: 400, headers: corsHeaders });
    }

    // Inserta/actualiza en app_users (bypass RLS con service role)
    const { error: upErr } = await admin
      .from("app_users")
      .upsert({ usuario: email, nombre: fullName, role: "admin", direccion: dept }, { onConflict: "usuario" });

    if (upErr) {
      return new Response(
        JSON.stringify({ ok: true, warning: "Invitado OK; app_users falló", error: upErr.message }),
        { status: 207, headers: corsHeaders },
      );
    }

    return new Response(JSON.stringify({ ok: true, user: invited?.user }), { status: 200, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), { status: 500, headers: corsHeaders });
  }
});
