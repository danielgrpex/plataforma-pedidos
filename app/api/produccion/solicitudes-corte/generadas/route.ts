//app/api/produccion/solicitudes-corte/generadas/route.ts
import { NextResponse } from "next/server";
import { getBasePrincipalRange } from "@/lib/google/googleSheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function rowsToObjects(values: any[][]) {
  if (!values?.length) return [];
  const headers = (values[0] ?? []).map((h) => String(h ?? "").trim());
  return values.slice(1).map((row) => {
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => (obj[h] = row?.[i] ?? ""));
    return obj;
  });
}

export async function GET() {
  try {
    const values = await getBasePrincipalRange("SolicitudesCorte!A:Z");
    const rows = rowsToObjects(values);

    const generadas = rows
      .filter((r) => String(r.estadoitem ?? "").trim() === "Generada")
      .map((r) => ({
        solicitudCorteId: String(r.solicitudCorteId ?? "").trim(),
        pedidoKey: String(r.pedidoKey ?? "").trim(),
        rowIndexPedido: r.rowIndexPedido ?? "",
        productoSolicitado: String(r.productoSolicitado ?? "").trim(),
        cantidadSolicitadaUnd: r.cantidadSolicitadaUnd ?? "",
        estadoitem: String(r.estadoitem ?? "").trim(),
        OTE: String(r.OTE ?? "").trim(),
        usuario: String(r.usuario ?? "").trim(),
      }))
      .filter((r) => r.solicitudCorteId);

    return NextResponse.json(generadas, { status: 200 });
  } catch (e) {
    console.error("[GET SolicitudesCorte Generadas]", e);
    return NextResponse.json({ error: "Error leyendo SolicitudesCorte" }, { status: 500 });
  }
}
