import { NextResponse } from "next/server";
import { getInfoSheetRange } from "@/lib/google/googleSheets";

function valuesToIdNombre(values: any[][]) {
  if (!values?.length) return [];

  // Si la primera fila parece header, la usamos
  const firstRow = values[0].map((x: any) => String(x ?? "").toLowerCase());
  const hasHeader = firstRow.some((x: string) =>
    ["id", "nombre", "name", "codigo", "código"].includes(x)
  );

  if (hasHeader) {
    const headers = values[0].map((h: any) => String(h ?? "").trim());
    const rows = values.slice(1);

    const idKey =
      headers.find((h) => ["id", "codigo", "código"].includes(h.toLowerCase())) ??
      headers[0];

    const nombreKey =
      headers.find((h) => ["nombre", "name", "descripcion", "descripción"].includes(h.toLowerCase())) ??
      headers[1] ??
      headers[0];

    return rows
      .map((row) => {
        const obj: Record<string, any> = {};
        headers.forEach((h, i) => (obj[h] = row?.[i] ?? ""));
        return {
          id: String(obj[idKey] ?? "").trim(),
          nombre: String(obj[nombreKey] ?? "").trim(),
        };
      })
      .filter((x) => x.id && x.nombre);
  }

  // Si NO hay header: asumimos 1ra col = id, 2da col = nombre
  return values
    .slice(1)
    .map((r) => ({
      id: String(r?.[0] ?? "").trim(),
      nombre: String(r?.[1] ?? "").trim(),
    }))
    .filter((x) => x.id && x.nombre);
}

export async function GET() {
  try {
    const values = await getInfoSheetRange("Trabajadores!A:Z");
    const data = valuesToIdNombre(values);
    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    console.error("[GET trabajadores]", e);
    return NextResponse.json(
      { error: "Error leyendo Trabajadores" },
      { status: 500 }
    );
  }
}
