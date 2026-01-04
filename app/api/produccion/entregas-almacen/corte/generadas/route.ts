//app/api/produccion/entregas-almacen/corte/generadas/route.ts
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
    const values = await getBasePrincipalRange("SolicitudesCorte!A:Z");
    const { rows } = rowsWithIndex(values);

    const generadas = rows
      .filter((r) => String(r.estadoitem ?? "").trim() === "Generada")
      .map((r) => ({
        rowIndex: r.rowIndex,
        solicitudCorteId: String(r.solicitudCorteId ?? ""),
        pedidoKey: String(r.pedidoKey ?? ""),
        rowIndexPedido: r.rowIndexPedido ?? "",
        productoSolicitado: String(r.productoSolicitado ?? ""),
        cantidadSolicitadaUnd: r.cantidadSolicitadaUnd ?? "",
        estadoitem: String(r.estadoitem ?? ""),
        OTE: String(r.OTE ?? ""),
      }));

    return NextResponse.json(generadas, { status: 200 });
  } catch (e) {
    console.error("[GET corte generadas]", e);
    return NextResponse.json({ error: "Error leyendo SolicitudesCorte" }, { status: 500 });
  }
}
