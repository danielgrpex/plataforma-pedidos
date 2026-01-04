//app/api/produccion/entregas-almacen/corte/actualizar-estado/route.ts
import { NextResponse } from "next/server";
import { getSheetsClient, getBasePrincipalRange } from "@/lib/google/googleSheets";
import { env } from "@/lib/config/env";

function getHeaders(values: any[][]) {
  return (values?.[0] ?? []).map((h) => String(h ?? "").trim());
}

export async function POST(req: Request) {
  try {
    const { rowIndex } = await req.json();
    if (!rowIndex) return NextResponse.json({ error: "Falta rowIndex" }, { status: 400 });

    const headerValues = await getBasePrincipalRange("SolicitudesCorte!1:1");
    const headers = getHeaders(headerValues);
    const idxEstado = headers.indexOf("estadoitem");
    if (idxEstado < 0) return NextResponse.json({ error: "No existe columna estadoitem" }, { status: 500 });

    const colLetter = String.fromCharCode("A".charCodeAt(0) + idxEstado);

    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: `SolicitudesCorte!${colLetter}${rowIndex}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [["Empacado"]] },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[POST corte actualizar estado]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
