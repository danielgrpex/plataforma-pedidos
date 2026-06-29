import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "manifiestos-despacho";

function mustEnv(v: string | undefined, name: string) {
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function safeName(name: string) {
  return String(name || "manifiesto")
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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const fecha = url.searchParams.get("fecha") || todayISO();

    const supabase = supabaseAdmin();

    const { data, error } = await supabase
      .from("dispatch_manifests")
      .select("*")
      .eq("manifest_date", fecha)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      manifests: data || [],
      manifest: data?.[0] || null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Error consultando manifiestos" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const file = form.get("file") as File | null;
    const manifestDate = String(form.get("manifestDate") || todayISO());
    const carrier = String(form.get("carrier") || "");
    const uploadedBy = String(form.get("uploadedBy") || "");
    const notes = String(form.get("notes") || "");

    if (!file) {
      return NextResponse.json(
        { success: false, message: "Debes seleccionar un archivo." },
        { status: 400 }
      );
    }

    if (!carrier.trim()) {
      return NextResponse.json(
        { success: false, message: "Debes digitar la transportadora." },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    const extName = safeName(file.name || "manifiesto.pdf");
    const safeCarrier = safeName(carrier || "transportadora");
    const filePath = `${manifestDate}/${safeCarrier}-${Date.now()}-${extName}`;

    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, Buffer.from(arrayBuffer), {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

    const { data, error } = await supabase
      .from("dispatch_manifests")
      .insert({
        manifest_date: manifestDate,
        carrier,
        file_path: filePath,
        file_url: publicData.publicUrl,
        uploaded_by: uploadedBy,
        notes,
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, manifest: data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Error subiendo manifiesto" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Falta id del manifiesto." },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    const { error } = await supabase
      .from("dispatch_manifests")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Error quitando manifiesto" },
      { status: 500 }
    );
  }
}