// app/api/comercial/pedidos/pdf-url/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { createSignedPdfUrl } from "@/lib/supabase/storagePdf";

/**
 * Genera una URL firmada (temporal) para ver un PDF guardado en Supabase
 * Recibe:
 * {
 *   pdfPath: "cliente/oc/archivo.pdf"
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { pdfPath } = body;

    if (!pdfPath || typeof pdfPath !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "pdfPath es requerido y debe ser string",
        },
        { status: 400 }
      );
    }

    // ⏱ URL válida por 10 minutos
    const signedUrl = await createSignedPdfUrl(pdfPath, 60 * 10);

    return NextResponse.json({
      success: true,
      url: signedUrl,
    });
  } catch (error) {
    console.error("[pdf-url]", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Error generando URL del PDF",
      },
      { status: 500 }
    );
  }
}
