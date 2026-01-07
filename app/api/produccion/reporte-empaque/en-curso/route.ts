//app/api/produccion/reporte-empaque/en-curso/route.ts
import { NextResponse } from "next/server";
import { getBasePrincipalRange } from "@/lib/google/googleSheets";

export const runtime = "nodejs";
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
    const values = await getBasePrincipalRange("ReporteOperarioEq!A:Z");
    const { rows } = rowsWithIndex(values);

    const enCurso = rows
      .filter((r) => String(r["Estado"] ?? "").trim() === "En curso")
      .map((r) => ({
        rowIndex: r.rowIndex,
        Timestamp: String(r["Timestamp"] ?? ""),
        OTE: String(r["OTE"] ?? ""),
        OPE: String(r["OPE"] ?? ""), // ✅ por si también estás usando OPE ahora
        rowIndexPedido: String(r["rowIndexPedido"] ?? ""),
        productoSolicitado: String(r["productoSolicitado"] ?? ""),
        Trabajador: String(r["Trabajador"] ?? ""),
        Estado: String(r["Estado"] ?? ""),
      }));

    return NextResponse.json(enCurso, {
      status: 200,
      headers: { "Cache-Control": "no-store, max-age=0, s-maxage=0, must-revalidate" },
    });
  } catch (e) {
    console.error("[GET empaque en-curso]", e);
    return NextResponse.json(
      { error: "Error leyendo ReporteOperarioEq" },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0, s-maxage=0, must-revalidate" } }
    );
  }
}
