//app/api/produccion/entregas-almacen/produccion/en-cola/route.ts
import { NextResponse } from "next/server";
import { getBasePrincipalRange } from "@/lib/google/googleSheets";

function rowsWithIndex(values: any[][]) {
  if (!values?.length) return { headers: [], rows: [] as any[] };
  const headers = (values[0] ?? []).map((h) => String(h ?? "").trim());
  const rows = values.slice(1).map((row, i) => {
    const obj: Record<string, any> = { rowIndex: i + 2 };
    headers.forEach((h, idx) => (obj[h] = row?.[idx] ?? ""));
    return obj;
  });
  return { headers, rows };
}

export async function GET() {
  try {
    const values = await getBasePrincipalRange("SolicitudesProduccion!A:Z");
    const { rows } = rowsWithIndex(values);

    const permitidos = new Set(["En cola", "Producido"]);

    const list = rows
      .filter((r) => permitidos.has(String(r.estado ?? "").trim()))
      .map((r) => ({
        rowIndex: r.rowIndex,
        solicitudProdId: String(r.solicitudProdId ?? ""),
        pedidoKey: String(r.pedidoKey ?? ""),
        rowIndexPedido: r.rowIndexPedido ?? "",
        productoKey: String(r.productoKey ?? ""),
        cantidadUND: r.cantidadUND ?? "",
        estado: String(r.estado ?? ""),
        OPE: String(r.OPE ?? ""),
      }));

    return NextResponse.json(list, { status: 200 });
  } catch (e) {
    console.error("[GET prod en cola/producido]", e);
    return NextResponse.json({ error: "Error leyendo SolicitudesProduccion" }, { status: 500 });
  }
}
