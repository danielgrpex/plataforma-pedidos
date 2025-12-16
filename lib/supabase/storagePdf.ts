// lib/supabase/storagePdf.ts
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/config/env";

function supabaseAdmin() {
  if (!env.SUPABASE_URL) throw new Error("Falta SUPABASE_URL en env.");
  if (!env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en env.");

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

function sanitizeSegment(s: string) {
  return (s || "")
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function parseDataUrlOrThrow(dataUrl?: string) {
  if (!dataUrl) {
    throw new Error("No se recibió el PDF (dataUrl vacío).");
  }

  const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!m) {
    throw new Error(
      "El PDF no viene en formato data URL válido. Debe ser: data:application/pdf;base64,...."
    );
  }

  const mime = m[1];
  const base64 = m[2];

  if (!mime.includes("pdf")) {
    throw new Error(`El archivo no es PDF. MIME recibido: ${mime}`);
  }

  return { mime, base64 };
}

export async function uploadPedidoPdf(params: {
  cliente: string;
  oc: string;
  dataUrl?: string; // puede ser undefined
  fileName?: string;
}) {
  const { cliente, oc, dataUrl } = params;

  // ✅ Si NO hay PDF, no intentamos subir y devolvemos vacío
  if (!dataUrl) {
    return { uploaded: false as const, path: "", publicUrl: "" };
  }

  const { base64, mime } = parseDataUrlOrThrow(dataUrl);

  const bucket = env.SUPABASE_PDF_BUCKET || "pedidos-pdf";

  const safeCliente = sanitizeSegment(cliente);
  const safeOc = sanitizeSegment(oc);

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const finalName = params.fileName?.trim()
    ? params.fileName.trim()
    : `${safeOc}_${ts}.pdf`;

  const path = `${safeCliente}/${safeOc}/${finalName}`;

  const buffer = Buffer.from(base64, "base64");

  const supa = supabaseAdmin();
  const { error } = await supa.storage.from(bucket).upload(path, buffer, {
    contentType: mime,
    upsert: true,
  });

  if (error) throw new Error(`Supabase upload error: ${error.message}`);

  // URL firmada (segura)
  const { data: signed, error: signErr } = await supa.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 días

  if (signErr) throw new Error(`Supabase signedUrl error: ${signErr.message}`);

  return {
    uploaded: true as const,
    path,
    publicUrl: signed?.signedUrl || "",
  };
}

