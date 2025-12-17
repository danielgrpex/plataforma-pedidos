// app/api/comercial/pedidos/detalle/route.ts
import { NextResponse } from "next/server";
import { getBasePrincipalRange } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const pedidoKey = toStr(searchParams.get("pedidoKey"));
    if (!pedidoKey) {
      return NextResponse.json(
        { success: false, message: "pedidoKey es requerido" },
        { status: 400 }
      );
    }

    const values = await getBasePrincipalRange("Pedidos!A:AM");
    if (!values || values.length === 0) {
      return NextResponse.json(
        { success: false, message: "No hay datos en la hoja Pedidos" },
        { status: 404 }
      );
    }

    const rows = values.filter((r) => toStr(r?.[37]) === pedidoKey); // AL
    if (!rows.length) {
      return NextResponse.json(
        { success: false, message: `No se encontró el pedido con pedidoKey: ${pedidoKey}` },
        { status: 404 }
      );
    }

    const first = rows[0];

    const pedido = {
      pedidoKey: toStr(first[37]),
      pedidoId: toStr(first[38]),

      consecutivo: toStr(first[0]),
      fechaSolicitud: toStr(first[1]),
      asesor: toStr(first[2]),
      cliente: toStr(first[3]),
      direccion: toStr(first[4]),
      oc: toStr(first[5]),
      fechaRequerida: toStr(first[15]),
      obsComerciales: toStr(first[16]),
      estado: toStr(first[23]),
      pdfPath: toStr(first[35]),
      createdBy: toStr(first[36]),

      items: rows.map((r) => ({
        // Base
        producto: toStr(r[6]),
        cantidadUnd: toStr(r[11]),
        cantidadM: toStr(r[12]),
        estadoItem: toStr(r[23]),

        // Fechas
        fechaEstimadaEntregaAlmacen: toStr(r[24]),
        fechaRealEntregaAlmacen: toStr(r[25]),
        fechaEstimadaDespacho: toStr(r[26]),
        fechaRealDespacho: toStr(r[27]),
        fechaEntregaRealCliente: toStr(r[33]),

        // Despacho
        transporte: toStr(r[28]),
        guia: toStr(r[30]),
        factura: toStr(r[31]),
        remision: toStr(r[32]),

        // Valores
        precioUnitario: toStr(r[14]),
      })),
    };

    return NextResponse.json({ success: true, pedido });
  } catch (error) {
    console.error("[pedidos/detalle]", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error cargando detalle",
      },
      { status: 500 }
    );
  }
}


