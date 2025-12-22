// lib/supabase/admin.ts
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/config/env";

export function getSupabaseAdmin() {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Falta SUPABASE_URL en env.");
  if (!key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en env.");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createAdminSupabaseClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * Cliente admin compartido para routes
 * (evita crear múltiples instancias)
 */
export const supabaseAdmin = getSupabaseAdmin();
