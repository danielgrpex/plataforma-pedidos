//app/api/produccion/entregas-almacen/produccion/actualizar-estado/route.ts
import { NextResponse } from "next/server";
import { getSheetsClient, getBasePrincipalRange } from "@/lib/google/googleSheets";
import { env } from "@/lib/config/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getHeaders(values: any[][]) {
  return (values?.[0] ?? []).map((h) => String(h ?? "").trim());
}

// 0 -> A, 25 -> Z, 26 -> AA ...
function columnToLetter(colIndex0: number) {
  let n = colIndex0;
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rowIndex = Number(body.rowIndex);
    const nuevoEstado = String(body.nuevoEstado ?? "").trim();

    if (!Number.isInteger(rowIndex) || rowIndex < 2 || !nuevoEstado) {
      return NextResponse.json({ error: "Falta/invalid rowIndex/nuevoEstado" }, { status: 400 });
    }
    if (!["Producido", "Empacado"].includes(nuevoEstado)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    const headerValues = await getBasePrincipalRange("SolicitudesProduccion!1:1");
    const headers = getHeaders(headerValues);
    const headersLower = headers.map((h) => h.toLowerCase());

    const idxEstado = headersLower.indexOf("estado");
    if (idxEstado < 0) {
      return NextResponse.json({ error: "No existe columna 'estado'" }, { status: 500 });
    }

    const colLetter = columnToLetter(idxEstado);

    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: `SolicitudesProduccion!${colLetter}${rowIndex}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[nuevoEstado]] },
    });

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0, s-maxage=0" } }
    );
  } catch (e) {
    console.error("[POST prod actualizar estado]", e);
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
