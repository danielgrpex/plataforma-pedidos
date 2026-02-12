//app/api/produccion/ordenes/detalle/route.ts
import { NextResponse } from "next/server";
import { getBasePrincipalRange } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

function toStr(v: unknown) {
  return String(v ?? "").trim();
}
function toNum(v: unknown) {
  const s = toStr(v).replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function headerIndexMap(headerRow: any[]) {
  const map = new Map<string, number>();
  (headerRow || []).forEach((h, idx) => map.set(toStr(h).toLowerCase(), idx));
  return map;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const ope = toStr(searchParams.get("ope"));
    const productoKeyQ = toStr(searchParams.get("productoKey"));

    if (!ope) {
      return NextResponse.json({ success: false, message: "ope es requerido" }, { status: 400 });
    }
    if (!productoKeyQ) {
      return NextResponse.json({ success: false, message: "productoKey es requerido" }, { status: 400 });
    }

    // 1) Buscar solicitud en SolicitudesProduccion por OPE + productoKey
    const solValues = await getBasePrincipalRange("SolicitudesProduccion!A:Z");
    if (!solValues?.length) {
      return NextResponse.json({ success: false, message: "No hay datos en SolicitudesProduccion" }, { status: 404 });
    }

    const solHeader = solValues[0];
    const solRows = solValues.slice(1);
    const solIdx = headerIndexMap(solHeader);

    // índices por header (si no existen, fallback)
    const idxPedidoKey = solIdx.get("pedidokey") ?? 1;
    const idxRowIndexPedido = solIdx.get("rowindexpedido") ?? 2;
    const idxProductoKey = solIdx.get("productokey") ?? 3;
    const idxCantidadUND = solIdx.get("cantidadund") ?? 4;
    const idxOPE = solIdx.get("ope") ?? 9;

    const solRow = solRows.find(
      (r) => toStr(r?.[idxOPE]) === ope && toStr(r?.[idxProductoKey]) === productoKeyQ
    );

    if (!solRow) {
      return NextResponse.json(
        { success: false, message: `No se encontró OPE+productoKey en SolicitudesProduccion (${ope} / ${productoKeyQ})` },
        { status: 404 }
      );
    }

    const pedidoKey = toStr(solRow[idxPedidoKey]);
    const rowIndexPedido = toStr(solRow[idxRowIndexPedido]);
    const productoKey = toStr(solRow[idxProductoKey]);
    const cantidadUND = toNum(solRow[idxCantidadUND]);

    // 2) Sumar avance acumulado en ReporteOperarioMq por OPE + productoKey
    const repValues = await getBasePrincipalRange("ReporteOperarioMq!A:AZ");
    if (!repValues?.length) {
      return NextResponse.json({
        success: true,
        orden: { ope, pedidoKey, rowIndexPedido, productoKey, cantidadUND, avanceActual: 0, faltante: cantidadUND },
      });
    }

    const repHeader = repValues[0];
    const repRows = repValues.slice(1);
    const repIdx = headerIndexMap(repHeader);

    const idxRepOPE = repIdx.get("ope");
    const idxRepProductoKey = repIdx.get("productokey");
    const idxRepAvance = repIdx.get("avance");

    if (idxRepOPE == null || idxRepProductoKey == null || idxRepAvance == null) {
      return NextResponse.json({
        success: true,
        orden: { ope, pedidoKey, rowIndexPedido, productoKey, cantidadUND, avanceActual: 0, faltante: cantidadUND },
        warning:
          "No se encontraron headers OPE/productoKey/Avance en ReporteOperarioMq. Revisa nombres de columnas.",
      });
    }

    let avanceActual = 0;
    for (const r of repRows) {
      if (toStr(r?.[idxRepOPE]) !== ope) continue;
      if (toStr(r?.[idxRepProductoKey]) !== productoKey) continue;
      avanceActual += toNum(r?.[idxRepAvance]);
    }

    const faltante = Math.max(0, cantidadUND - avanceActual);

    return NextResponse.json({
      success: true,
      orden: { ope, pedidoKey, rowIndexPedido, productoKey, cantidadUND, avanceActual, faltante },
    });
  } catch (error) {
    console.error("[produccion/ordenes/detalle]", error);
    return NextResponse.json({ success: false, message: "Error cargando detalle de orden" }, { status: 500 });
  }
}
