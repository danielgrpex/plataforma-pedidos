// app/api/comercial/pedidos/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { guardarPedidoNode } from "@/lib/comercial/pedidosService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ✅ OPCIONAL (pero recomendado): si estás en el flujo nuevo, exigir pdfPath
    // Si aún quieres permitir pedidos sin PDF, quita este bloque.
    if (body?.cabecera && typeof body?.pdfPath !== "string") {
      return NextResponse.json(
        { success: false, message: "Falta pdfPath (primero sube el PDF)." },
        { status: 400 }
      );
    }
    if (body?.cabecera && body?.pdfPath?.trim?.() === "") {
      return NextResponse.json(
        { success: false, message: "pdfPath viene vacío (falló la subida del PDF)." },
        { status: 400 }
      );
    }

    const result = await guardarPedidoNode(body);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error en /api/comercial/pedidos:", error);
    return NextResponse.json(
      { success: false, message: "Error al procesar el pedido" },
      { status: 500 }
    );
  }
}
