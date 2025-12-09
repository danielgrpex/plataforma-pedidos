import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { guardarPedidoNode, PedidoPayload } from "@/lib/pedidosService";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return new NextResponse("No autorizado", { status: 401 });
    }

    const body = (await req.json()) as Omit<PedidoPayload, "createdByEmail">;

    const result = await guardarPedidoNode({
      ...body,
      createdByEmail: session.user.email || "desconocido@implastgr.com",
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error en /api/comercial/pedidos", error);
    return new NextResponse(
      error?.message || "Error al guardar pedido",
      { status: 500 }
    );
  }
}
