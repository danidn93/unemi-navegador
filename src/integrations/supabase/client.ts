// src/integrations/supabase/client.ts
import { createClient } from "@supabase/supabase-js";

const url  = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// URL de Functions configurable; fallback automático a <url>/functions/v1
const functionsUrl =
  (import.meta as any).env?.VITE_SUPABASE_FUNCTIONS_URL ||
  (url ? `${url.replace(/\/+$/, "")}/functions/v1` : undefined);

if (!url || !anon) {
  console.error("[Supabase] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY");
}
if (!functionsUrl) {
  console.warn("[Supabase] No se pudo resolver functions URL; usando fallback si es posible");
}

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      "x-client-info": "unemi-admin",
    },
  },
  functions: {
    url: functionsUrl,
  },
});
