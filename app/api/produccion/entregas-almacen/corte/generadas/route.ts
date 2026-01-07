//app/api/produccion/entregas-almacen/corte/generadas/route.ts
import { NextResponse } from "next/server";
import { getBasePrincipalRange } from "@/lib/google/googleSheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    // ✅ NO uses A:Z si tu hoja crece. Usa A:ZZ
    const values = await getBasePrincipalRange("SolicitudesCorte!A:ZZ");
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

    return NextResponse.json(generadas, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, max-age=0, s-maxage=0, must-revalidate",
      },
    });
  } catch (e) {
    console.error("[GET corte generadas]", e);
    return NextResponse.json(
      { error: "Error leyendo SolicitudesCorte" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
