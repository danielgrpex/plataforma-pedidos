import { NextResponse } from "next/server";
import { getBasePrincipalRange } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

// Columnas en "Pedidos!A:AK" (37 cols)
// 1 Consecutivo (A)
// 2 Fecha Solicitud (B)
// 3 Asesor (C)
// 4 Cliente (D)
// 5 Dirección (E)
// 6 OC (F)
// 7 Producto (G)
// 8 Referencia (H)
// 9 Color (I)
// 10 Ancho (J)
// 11 Largo (K)
// 12 Cantidad und (L)
// 13 Cantidad m (M)
// 14 Acabados (N)
// 15 Precio Unitario (O)
// 16 Fecha Requerida (P)
// 17 Obs Comerciales (Q)
// ...
// 24 Estado (X)
// 36 pdfPath (AJ)
// 37 created_by (AK)

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const consecutivo = toStr(searchParams.get("consecutivo"));

    if (!consecutivo) {
      return NextResponse.json(
        { success: false, message: "consecutivo es requerido" },
        { status: 400 }
      );
    }

    // Traemos todo y filtramos (simple y robusto). Más adelante se optimiza si quieres.
    const values = await getBasePrincipalRange("Pedidos!A:AK");

    if (!values || values.length === 0) {
      return NextResponse.json(
        { success: false, message: "No hay datos en la hoja Pedidos" },
        { status: 404 }
      );
    }

    // Si la primera fila es header, igual no pasa nada por el filtro.
    const rows = values.filter((r) => toStr(r?.[0]) === consecutivo);

    if (!rows.length) {
      return NextResponse.json(
        { success: false, message: `No se encontró el pedido ${consecutivo}` },
        { status: 404 }
      );
    }

    const first = rows[0];

    const pedido = {
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
