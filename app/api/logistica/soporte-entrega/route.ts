import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Usamos el mismo bucket que ya tienes funcionando para manifiestos.
// Guardamos en una carpeta separada: soportes-entrega/
const BUCKET = "manifiestos-despacho";

function mustEnv(v: string | undefined, name: string) {
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

function safeName(name: string) {
  return String(name || "soporte-entrega")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function supabaseAdmin() {
  return createClient(
    mustEnv(SUPABASE_URL, "SUPABASE_URL"),
    mustEnv(SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const file = form.get("file") as File | null;
    const pedidosKey = String(form.get("pedidosKey") || "");
    const pedidoRowIndex = String(form.get("pedidoRowIndex") || "");
    const uploadedBy = String(form.get("uploadedBy") || "");

    if (!file) {
      return NextResponse.json(
        { success: false, message: "Debes seleccionar un archivo soporte." },
        { status: 400 }
      );
    }

    if (!pedidosKey.trim()) {
      return NextResponse.json(
        { success: false, message: "Falta pedidosKey." },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    const originalName = file.name || "soporte-entrega.pdf";
    const safeOriginalName = safeName(originalName);
    const safePedido = safeName(pedidosKey).slice(0, 80);
    const safeRow = safeName(pedidoRowIndex || "pedido-completo");

    const today = new Date().toISOString().slice(0, 10);

    const filePath = `soportes-entrega/${today}/${safePedido}/${safeRow}-${Date.now()}-${safeOriginalName}`;

    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, Buffer.from(arrayBuffer), {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      soporte: {
        file_path: filePath,
        file_url: publicData.publicUrl,
        file_name: originalName,
        uploaded_by: uploadedBy,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Error subiendo soporte de entrega" },
      { status: 500 }
    );
  }
}