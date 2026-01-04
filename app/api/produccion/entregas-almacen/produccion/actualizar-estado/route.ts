//app/api/produccion/entregas-almacen/produccion/actualizar-estado/route.ts
import { NextResponse } from "next/server";
import { getSheetsClient, getBasePrincipalRange } from "@/lib/google/googleSheets";
import { env } from "@/lib/config/env";

function getHeaders(values: any[][]) {
  return (values?.[0] ?? []).map((h) => String(h ?? "").trim());
}

export async function POST(req: Request) {
  try {
    const { rowIndex, nuevoEstado } = await req.json();

    if (!rowIndex || !nuevoEstado) {
      return NextResponse.json({ error: "Falta rowIndex/nuevoEstado" }, { status: 400 });
    }
    if (!["Producido", "Empacado"].includes(String(nuevoEstado))) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    const headerValues = await getBasePrincipalRange("SolicitudesProduccion!1:1");
    const headers = getHeaders(headerValues);
    const idxEstado = headers.indexOf("estado");
    if (idxEstado < 0) return NextResponse.json({ error: "No existe columna estado" }, { status: 500 });

    const colLetter = String.fromCharCode("A".charCodeAt(0) + idxEstado);

    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: `SolicitudesProduccion!${colLetter}${rowIndex}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[nuevoEstado]] },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[POST prod actualizar estado]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
