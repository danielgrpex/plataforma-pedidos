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

    // NUEVO: pedidoKey (AL)
    const pedidoKey = toStr(searchParams.get("pedidoKey"));

    if (!pedidoKey) {
      return NextResponse.json(
        { success: false, message: "pedidoKey es requerido" },
        { status: 400 }
      );
    }

    // Ahora leemos hasta AM para incluir pedidoKey (AL) y pedidoId (AM)
    const values = await getBasePrincipalRange("Pedidos!A:AM");

    if (!values || values.length === 0) {
      return NextResponse.json(
        { success: false, message: "No hay datos en la hoja Pedidos" },
        { status: 404 }
      );
    }

    // pedidoKey está en AL => índice 37 (0-based)
    const rows = values.filter((r) => toStr(r?.[37]) === pedidoKey);

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
      createdBy: toStr(first[36]), // AK (created_by)

      items: rows.map((r) => ({
        producto: toStr(r[6]),
        referencia: toStr(r[7]),
        color: toStr(r[8]),
        ancho: toStr(r[9]),
        largo: toStr(r[10]),
        cantidadUnd: toStr(r[11]),
        cantidadM: toStr(r[12]),
        acabados: toStr(r[13]),
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
