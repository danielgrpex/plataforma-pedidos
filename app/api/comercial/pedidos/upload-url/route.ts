// app/api/comercial/pedidos/upload-pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs"; // ✅ necesario para Buffer
export const dynamic = "force-dynamic"; // ✅ evita caching raro en rutas POST

function sanitizeSegment(value: string) {
  return String(value || "")
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_");
}

function isWebFile(x: unknown): x is File {
  return !!x && typeof (x as any).arrayBuffer === "function" && typeof (x as any).type === "string";
}

export async function POST(req: NextRequest) {
  try {
    // ✅ Chequeo rápido de env (si falla aquí, en Vercel casi siempre es env mal seteada)
    if (!env.SUPABASE_URL) {
      return NextResponse.json(
        { success: false, message: "Falta SUPABASE_URL en env." },
        { status: 500 }
      );
    }
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { success: false, message: "Falta SUPABASE_SERVICE_ROLE_KEY en env." },
        { status: 500 }
      );
    }

    const bucket = env.SUPABASE_PDF_BUCKET || "pedidos-pdf";
    const supabase = createAdminSupabaseClient();

    const form = await req.formData();

    const clienteRaw = String(form.get("cliente") || "");
    const ocRaw = String(form.get("oc") || "");
    const fileAny = form.get("file");

    if (!clienteRaw.trim()) {
      return NextResponse.json(
        { success: false, message: "cliente es requerido" },
        { status: 400 }
      );
    }

    if (!ocRaw.trim()) {
      return NextResponse.json(
        { success: false, message: "oc es requerido" },
        { status: 400 }
      );
    }

    if (!isWebFile(fileAny)) {
      return NextResponse.json(
        { success: false, message: "file (PDF) es requerido" },
        { status: 400 }
      );
    }

    const file = fileAny;

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { success: false, message: "El archivo debe ser application/pdf" },
        { status: 400 }
      );
    }

    // ✅ Logs útiles (para ver en Vercel Logs)
    console.log("[upload-pdf] bucket:", bucket);
    console.log("[upload-pdf] clienteRaw:", clienteRaw);
    console.log("[upload-pdf] ocRaw:", ocRaw);
    console.log("[upload-pdf] file.name:", (file as any).name);
    console.log("[upload-pdf] file.size:", (file as any).size);
    console.log("[upload-pdf] file.type:", file.type);

    const cliente = sanitizeSegment(clienteRaw);
    const oc = sanitizeSegment(ocRaw);

    const iso = new Date().toISOString().replace(/[:.]/g, "-");
    const originalName = typeof (file as any).name === "string" ? (file as any).name : "OC.pdf";
    const safeOriginal = sanitizeSegment(originalName.replace(/\.pdf$/i, ""));

    const fileName = `${oc}_${safeOriginal || "OC"}_${iso}.pdf`;
    const pdfPath = `${cliente}/${oc}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error } = await supabase.storage.from(bucket).upload(pdfPath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

    if (error) {
      // ✅ si ya existe, mejor 409 que 500
      const msg = error.message || "Error subiendo PDF";
      const lower = msg.toLowerCase();
      const status = lower.includes("already exists") || lower.includes("duplicate") ? 409 : 500;

      console.error("[upload-pdf] supabase error:", msg, "path:", pdfPath);

      return NextResponse.json(
        { success: false, message: msg, pdfPath },
        { status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        pdfPath,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[upload-pdf] catch:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error subiendo PDF",
      },
      { status: 500 }
    );
  }
}
