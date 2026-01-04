//app/api/produccion/reporte-maquinas/en-curso/route.ts
import { NextResponse } from "next/server";
import { getBasePrincipalRange } from "@/lib/google/googleSheets";

function rowsWithIndex(values: any[][]) {
  if (!values?.length) return { headers: [], rows: [] as any[] };
  const headers = (values[0] ?? []).map((h) => String(h ?? "").trim());
  const rows = values.slice(1).map((row, i) => {
    const obj: Record<string, any> = { rowIndex: i + 2 }; // +2 porque 1 es header
    headers.forEach((h, idx) => (obj[h] = row?.[idx] ?? ""));
    return obj;
  });
  return { headers, rows };
}

function mapTipo(tipo: string) {
  if (tipo === "alistamiento") {
    return { actividad: "Alistamiento Herramental", estado: "En alistamiento" };
  }
  if (tipo === "cuadre") {
    return { actividad: "Cuadre de linea", estado: "En Cuadre de linea" };
  }
  // producción
  return { actividad: "Inicio de producción", estado: "En Producción" };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tipo = (url.searchParams.get("tipo") ?? "").trim();

    if (!["alistamiento", "cuadre", "produccion"].includes(tipo)) {
      return NextResponse.json(
        { error: "tipo inválido (alistamiento|cuadre|produccion)" },
        { status: 400 }
      );
    }

    const { actividad, estado } = mapTipo(tipo);

    const values = await getBasePrincipalRange("ReporteOperarioMq!A:AZ");
    const { rows } = rowsWithIndex(values);

    const filtradas = rows
      .filter((r) => String(r["Actividad"] ?? "").trim() === actividad)
      .filter((r) => String(r["Estado"] ?? "").trim() === estado)
      .map((r) => ({
        rowIndex: r.rowIndex,
        Timestamp: String(r["Timestamp"] ?? ""),
        OPE: String(r["OPE"] ?? ""),
        productoKey: String(r["productoKey"] ?? ""),
        Trabajador: String(r["Trabajador"] ?? ""),
        Actividad: String(r["Actividad"] ?? ""),
        Estado: String(r["Estado"] ?? ""),
      }));

    return NextResponse.json(filtradas, { status: 200 });
  } catch (e) {
    console.error("[GET en-curso reporte maquinas]", e);
    return NextResponse.json({ error: "Error leyendo ReporteOperarioMq" }, { status: 500 });
  }
}
