export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { createSignedPdfUrl } from "@/lib/supabase/storagePdf";

export async function GET(
  _req: NextRequest,
  { params }: { params: { pdfPath: string[] } }
) {
  try {
    const pdfPath = params.pdfPath?.join("/");

    if (!pdfPath) {
      return NextResponse.json(
        { success: false, message: "pdfPath requerido" },
        { status: 400 }
      );
    }

    const signedUrl = await createSignedPdfUrl(pdfPath, 60 * 10);

    return NextResponse.redirect(signedUrl);
  } catch (error: any) {
    console.error("[PDF redirect]", error);
    return NextResponse.json(
      { success: false, message: error.message || "Error PDF" },
      { status: 500 }
    );
  }
}
