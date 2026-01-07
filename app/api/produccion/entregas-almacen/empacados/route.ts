//app/api/produccion/entregas-almacen/empacados/route.ts
import { NextResponse } from "next/server";
import { getBasePrincipalRange } from "@/lib/google/googleSheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function rowsWithIndex(values: any[][]) {
  if (!values?.length) return { headers: [], rows: [] as any[] };

  const headers = (values[0] ?? []).map((h) => String(h ?? "").trim());

  const rows = values.slice(1).map((row, i) => {
    const obj: Record<string, any> = { rowIndex: i + 2 };

    headers.forEach((h, idx) => {
      const v = row?.[idx] ?? "";
      obj[h] = v;
      obj[h.toLowerCase()] = v; // ✅ clave extra para acceso insensible a mayúsculas
    });

    return obj;
  });

  return { headers, rows };
}

function toNumber(x: any) {
  const n = Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function norm(s: any) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function GET() {
  try {
    const [pVals, cVals, hVals] = await Promise.all([
      getBasePrincipalRange("SolicitudesProduccion!A:ZZ"),
      getBasePrincipalRange("SolicitudesCorte!A:ZZ"),
      getBasePrincipalRange("HistorialEntregasAlmacen!A:ZZ"),
    ]);

    // historial: suma entregado por (tipo normalizado + rowIndexItem)
    const hist = rowsWithIndex(hVals).rows;
    const entregadoMap = new Map<string, number>();

    for (const r of hist) {
      const tipoNorm = norm(r.tipo); // "produccion" o "corte" (idealmente)
      const rowIndexItem = String(r.rowIndexItem ?? r.rowindexitem ?? "").trim();
      const qty = toNumber(r.cantidadEntregadaUnd ?? r.cantidadentregadaund);

      if (!tipoNorm || !rowIndexItem) continue;

      const key = `${tipoNorm}#${rowIndexItem}`;
      entregadoMap.set(key, (entregadoMap.get(key) ?? 0) + qty);
    }

    const prod = rowsWithIndex(pVals).rows
      .filter((r) => String(r.estado ?? "").trim() === "Empacado")
      .map((r) => {
        const rowIndexItem = r.rowIndex;
        const total = toNumber(r.cantidadUND ?? r.cantidadund);
        const key = `produccion#${rowIndexItem}`;
        const entregado = entregadoMap.get(key) ?? 0;
        const pendiente = Math.max(0, total - entregado);

        return {
          source: "produccion" as const,
          rowIndexItem,
          code: String(r.OPE ?? r.ope ?? ""),
          rowIndexPedido: r.rowIndexPedido ?? r.rowindexpedido ?? "",
          pedidoKey: String(r.pedidoKey ?? r.pedidokey ?? ""),
          producto: String(r.productoKey ?? r.productokey ?? ""),
          cantidadTotalUnd: total,
          entregadoUnd: entregado,
          pendienteUnd: pendiente,
        };
      })
      .filter((x) => x.pendienteUnd > 0);

    const corte = rowsWithIndex(cVals).rows
      .filter((r) => String(r.estadoitem ?? r.estadoItem ?? "").trim() === "Empacado")
      .map((r) => {
        const rowIndexItem = r.rowIndex;
        const total = toNumber(r.cantidadSolicitadaUnd ?? r.cantidadsolicitadaund);
        const key = `corte#${rowIndexItem}`;
        const entregado = entregadoMap.get(key) ?? 0;
        const pendiente = Math.max(0, total - entregado);

        return {
          source: "corte" as const,
          rowIndexItem,
          code: String(r.OTE ?? r.ote ?? ""),
          rowIndexPedido: r.rowIndexPedido ?? r.rowindexpedido ?? "",
          pedidoKey: String(r.pedidoKey ?? r.pedidokey ?? ""),
          producto: String(r.productoSolicitado ?? r.productosolicitado ?? ""),
          cantidadTotalUnd: total,
          entregadoUnd: entregado,
          pendienteUnd: pendiente,
        };
      })
      .filter((x) => x.pendienteUnd > 0);

    return NextResponse.json([...prod, ...corte], {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, max-age=0, s-maxage=0, must-revalidate",
      },
    });
  } catch (e) {
    console.error("[GET empacados con saldo]", e);
    return NextResponse.json(
      { error: "Error leyendo empacados/historial" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
