import { NextResponse } from "next/server";
import { getInfoSheetRange } from "@/lib/google/googleSheets";

function toIdNombreFromSingleOrHeader(values: any[][]) {
  if (!values?.length) return [];

  // Quitamos filas vacías
  const clean = values.filter((r) =>
    (r ?? []).some((c: any) => String(c ?? "").trim() !== "")
  );
  if (clean.length <= 1) return [];

  const headerRow = (clean[0] ?? []).map((x: any) => String(x ?? "").trim());
  const dataRows = clean.slice(1);

  const colCount = Math.max(...clean.map((r) => (r ? r.length : 0)));

  // ✅ Caso REAL tuyo: 1 sola columna => id = nombre = valor
  if (colCount <= 1) {
    return dataRows
      .map((r) => String(r?.[0] ?? "").trim())
      .filter(Boolean)
      .map((v) => ({ id: v, nombre: v }));
  }

  // Caso con headers tipo ID/NOMBRE
  const headersLower = headerRow.map((h) => h.toLowerCase());
  const hasHeader = headersLower.some((x) =>
    ["id", "nombre", "name", "codigo", "código", "descripcion", "descripción"].includes(x)
  );

  if (hasHeader) {
    const headers = headerRow;
    const idKey =
      headers.find((h) => ["id", "codigo", "código"].includes(h.toLowerCase())) ?? headers[0];
    const nombreKey =
      headers.find((h) => ["nombre", "name", "descripcion", "descripción"].includes(h.toLowerCase())) ??
      headers[1] ??
      headers[0];

    return dataRows
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

  // Caso sin header pero con 2 columnas
  return dataRows
    .map((r) => ({
      id: String(r?.[0] ?? "").trim(),
      nombre: String(r?.[1] ?? "").trim(),
    }))
    .filter((x) => x.id && x.nombre);
}

export async function GET() {
  try {
    // ✅ OJO: tu pestaña se llama "Herramentales"
    const values = await getInfoSheetRange("Herramentales!A:Z");
    const data = toIdNombreFromSingleOrHeader(values);
    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    console.error("[GET herramentales]", e);
    return NextResponse.json(
      { error: "Error leyendo Herramentales" },
      { status: 500 }
    );
  }
}

