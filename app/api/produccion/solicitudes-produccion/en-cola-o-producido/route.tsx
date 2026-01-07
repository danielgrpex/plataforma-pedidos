//app/api/produccion/solicitudes-produccion/en-cola-o-producido/route.ts
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
        solicitudProdId: String(r.solicitudProdId ?? "").trim(),
        pedidoKey: String(r.pedidoKey ?? "").trim(),
        rowIndexPedido: r.rowIndexPedido ?? "",
        productoKey: String(r.productoKey ?? "").trim(),
        cantidadUND: r.cantidadUND ?? "",
        estado: String(r.estado ?? "").trim(),
        OPE: String(r.OPE ?? "").trim(),
        usuario: String(r.usuario ?? "").trim(),
      }))
      .filter((x) => x.solicitudProdId);

    return NextResponse.json(list, { status: 200 });
  } catch (e) {
    console.error("[GET solicitudes-produccion en-cola/producido]", e);
    return NextResponse.json({ error: "Error leyendo SolicitudesProduccion" }, { status: 500 });
  }
}
