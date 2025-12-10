// app/api/comercial/pedidos/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { guardarPedidoNode } from "@/lib/comercial/pedidosService";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const result = await guardarPedidoNode(body);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error en /api/comercial/pedidos:", error);
    return NextResponse.json(
      { success: false, message: "Error al procesar el pedido" },
      { status: 500 }
    );
  }
}
