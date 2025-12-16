// lib/supabase/storagePdf.ts
import { env } from "@/lib/config/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/* =========================
   HELPERS
========================= */

function sanitizeSegment(value: string) {
  return String(value || "")
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_");
}

function extractBase64(dataUrl: string) {
  const match = dataUrl.match(/^data:application\/pdf;base64,(.+)$/);
  if (!match) {
    throw new Error("PDF inválido: dataUrl no es base64 application/pdf");
  }
  return match[1];
}

/* =========================
   UPLOAD PDF
========================= */

export async function uploadPedidoPdf(input: {
  cliente: string;
  oc: string;
  dataUrl?: string;
}) {
  if (!input.dataUrl) {
    return { path: "" };
  }

  const supabase = createAdminSupabaseClient();
  const bucket = env.SUPABASE_PDF_BUCKET;

  const cliente = sanitizeSegment(input.cliente);
  const oc = sanitizeSegment(input.oc);
  const fileName = `${oc}_${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`;

  const base64 = extractBase64(input.dataUrl);
  const buffer = Buffer.from(base64, "base64");

  const path = `${cliente}/${oc}/${fileName}`;

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: "application/pdf",
    upsert: false,
  });

  if (error) throw new Error(error.message);

  return { path };
}

/* =========================
   SIGNED URL
========================= */

export async function createSignedPdfUrl(
  pdfPath: string,
  expiresInSeconds = 600
) {
  const supabase = createAdminSupabaseClient();
  const bucket = env.SUPABASE_PDF_BUCKET;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(pdfPath, expiresInSeconds);

  if (error) throw new Error(error.message);

  return data?.signedUrl || "";
}
