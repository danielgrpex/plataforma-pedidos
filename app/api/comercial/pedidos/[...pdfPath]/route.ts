import { NextRequest, NextResponse } from "next/server";
import { createSignedPdfUrl } from "@/lib/supabase/storagePdf";

export const runtime = "nodejs";

// GET /api/comercial/pedidos/<pdfPath...>
// Ej: /api/comercial/pedidos/Oasis_Group/555/555_2025-12-16T04-37-21-589Z.pdf
export async function GET(
  _req: NextRequest,
  { params }: { params: { pdfPath: string[] } }
) {
  try {
    const pdfPath = (params.pdfPath || []).join("/");

    if (!pdfPath) {
      return NextResponse.json(
        { success: false, message: "pdfPath es requerido" },
        { status: 400 }
      );
    }

    // URL firmada (10 min)
    const url = await createSignedPdfUrl(pdfPath, 60 * 10);

    if (!url) {
      return NextResponse.json(
        { success: false, message: "No se pudo generar URL firmada" },
        { status: 404 }
      );
    }

    return NextResponse.redirect(url);
  } catch (e: any) {
    console.error("[GET pdf redirect]", e);
    return NextResponse.json(
      { success: false, message: e?.message || "Error generando PDF URL" },
      { status: 500 }
    );
  }
}
