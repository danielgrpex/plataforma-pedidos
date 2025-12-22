// app/api/produccion/corte/generar/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  creado_por?: string;
  codigo_doc?: string;
  observaciones?: string;
  items: { rowIndex1Based: number; actividades?: string }[];
};

function toStr(v: unknown) {
  return String(v ?? "").trim();
}
function norm(v: unknown) {
  return toStr(v).toLowerCase();
}
function findCol(headers: any[], candidates: string[]) {
  const h = headers.map((x) => norm(x));
  for (const c of candidates) {
    const idx = h.indexOf(norm(c));
    if (idx >= 0) return idx;
  }
  return -1;
}
function colToA1(idx: number) {
  let n = idx + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
function getBaseUrl(req: Request) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    // endpoint “alive check”
    if (!body?.items?.length) {
      return NextResponse.json({ success: true, ok: "POST /api/produccion/corte/generar funciona" });
    }

    // Validación fuerte
    for (const it of body.items) {
      if (typeof it.rowIndex1Based !== "number" || !Number.isFinite(it.rowIndex1Based)) {
        return NextResponse.json(
          { success: false, message: "rowIndex1Based faltante o inválido", item: it },
          { status: 400 }
        );
      }
    }

    const baseUrl = getBaseUrl(req);

    // 1) Llamar al generador real (Supabase + PDF)
    const genRes = await fetch(`${baseUrl}/api/produccion/orden-corte/generar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creado_por: toStr(body.creado_por) || "Sistema",
        codigo_doc: toStr(body.codigo_doc) || "PEX-0F-16",
        observaciones: toStr(body.observaciones) || "",
        items: body.items.map((x) => ({
          rowIndex1Based: x.rowIndex1Based,
          actividades: toStr(x.actividades) || "Cortar",
        })),
      }),
    });

    const genJson = await genRes.json();
    if (!genRes.ok || !genJson?.success) {
  console.error("[corte/generar] genJson raw =>", genJson);
  return NextResponse.json(
    { success: false, message: genJson?.message || "Error creando orden en Supabase/PDF", raw: genJson },
    { status: 500 }
  );
}


    // 2) Actualizar Pedidos: sacar de “Corte”
    const sheets = await getSheetsClient();

    const pedResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "Pedidos!A:BM",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const pedValues = (pedResp.data.values || []) as any[][];
    if (pedValues.length < 2) {
      return NextResponse.json(
        { success: false, message: "No pude leer Pedidos para actualizar estados" },
        { status: 500 }
      );
    }

    const headers = pedValues[0] || [];

    const IDX_ESTADO_PLANEACION = findCol(headers, ["Estado Planeación", "Estado Planeacion"]);
    const IDX_ESTADO = findCol(headers, ["Estado"]);

    if (IDX_ESTADO_PLANEACION < 0) {
      return NextResponse.json(
        { success: false, message: "No encuentro la columna 'Estado Planeación' en Pedidos" },
        { status: 400 }
      );
    }

    // ✅ Estado nuevo (elige el que te convenga; con esto deja de aparecer en pendientes “Corte”)
    const NUEVO_ESTADO = "Corte Generado";

    const updates: { range: string; values: any[][] }[] = [];

    for (const it of body.items) {
      const row = it.rowIndex1Based;

      updates.push({
        range: `Pedidos!${colToA1(IDX_ESTADO_PLANEACION)}${row}`,
        values: [[NUEVO_ESTADO]],
      });

      if (IDX_ESTADO >= 0) {
        updates.push({
          range: `Pedidos!${colToA1(IDX_ESTADO)}${row}`,
          values: [[NUEVO_ESTADO]],
        });
      }
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      requestBody: { valueInputOption: "RAW", data: updates },
    });

    // 3) Append a hojas “ordenCorte” y “ordenCorteItems” (si existen)
    // Si no existen, NO tumba el proceso (catch silencioso)

    return NextResponse.json({
      success: true,
      ...genJson,
      updated_pedidos_rows: body.items.map((x) => x.rowIndex1Based),
      nuevo_estado: NUEVO_ESTADO,
    });
  } catch (error) {
    console.error("[produccion/corte/generar]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Error generando corte" },
      { status: 500 }
    );
  }
}
