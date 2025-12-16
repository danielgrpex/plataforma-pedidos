export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env } from "@/lib/config/env";

function sanitizeSegment(value: string) {
  return String(value || "")
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { cliente, oc } = body;

    if (!cliente || !oc) {
      return NextResponse.json(
        { success: false, message: "cliente y oc son requeridos" },
        { status: 400 }
      );
    }

    const bucket = env.SUPABASE_PDF_BUCKET || "pedidos-pdf";
    const supabase = createAdminSupabaseClient();

    const safeCliente = sanitizeSegment(cliente);
    const safeOc = sanitizeSegment(oc);
    const fileName = `${safeOc}_${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`;
    const path = `${safeCliente}/${safeOc}/${fileName}`;

    // 👇 Esto genera una URL firmada para subir directo (sin pasar el PDF por tu API)
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      path,
      signedUrl: data?.signedUrl,
      token: data?.token,
    });
  } catch (error) {
    console.error("[upload-url]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
