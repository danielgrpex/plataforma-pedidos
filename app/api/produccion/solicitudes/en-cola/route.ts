//app/api/produccion/solicitudes/en-cola/route.ts
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
    const values = await getBasePrincipalRange("SolicitudesProduccion!A:Z");
    const rows = rowsToObjects(values);

    const enCola = rows.filter((r) => String(r.estado ?? "").trim() === "Generada");

    return NextResponse.json(enCola, { status: 200 });
  } catch (e) {
    console.error("[GET solicitudes en cola]", e);
    return NextResponse.json({ error: "Error leyendo SolicitudesProduccion" }, { status: 500 });
  }
}
