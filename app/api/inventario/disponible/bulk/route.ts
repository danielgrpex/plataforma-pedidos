// app/api/inventario/disponible/bulk/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

function toNumber(v: unknown) {
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v)
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "") // miles
    .replace(",", "."); // decimales
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Espera body:
 * {
 *   productoKeys: string[]
 * }
 *
 * Responde:
 * {
 *  success: true,
 *  totalsByKey: {
 *    [productoKey]: { und: number, m: number }
 *  }
 * }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { productoKeys?: string[] };
    const productoKeysRaw = Array.isArray(body?.productoKeys) ? body.productoKeys : [];

    const productoKeys = Array.from(
      new Set(productoKeysRaw.map((x) => toStr(x)).filter(Boolean))
    );

    if (!productoKeys.length) {
      return NextResponse.json(
        { success: false, message: "productoKeys es requerido (array no vacío)" },
        { status: 400 }
      );
    }

    const sheets = await getSheetsClient();

    // 1) Leer Inventario una sola vez
    const invResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "Inventario!A:AB",
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const invValues = (invResp.data.values || []) as any[][];
    const invRows = invValues.length > 1 ? invValues.slice(1) : [];

    // 2) Leer Movimientos una sola vez
    const movResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "MovimientosInventario!A:L",
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const movValues = (movResp.data.values || []) as any[][];
    const movRows = movValues.length > 1 ? movValues.slice(1) : [];

    // Movimientos: inventarioId = col B (idx 1), cantidadUnd = col D (idx 3), cantidadM = col E (idx 4)
    const movByInventarioId: Record<string, { und: number; m: number }> = {};
    for (const r of movRows) {
      const inventarioId = toStr(r?.[1]);
      if (!inventarioId) continue;
      const und = toNumber(r?.[3]);
      const m = toNumber(r?.[4]);

      if (!movByInventarioId[inventarioId]) movByInventarioId[inventarioId] = { und: 0, m: 0 };
      movByInventarioId[inventarioId].und += und;
      movByInventarioId[inventarioId].m += m;
    }

    // Inventario (según lo que vienes usando):
    // inventarioId = A (0)
    // productoKey = D (3)
    // cantidadInicialUnd = K (10)
    // cantidadInicialM = L (11)
    // estadoInventario = Q (16)  -> si contiene "consumido" lo ignoramos
    //
    // Disponible = Inicial + Sum(movimientos)  (Reserva es negativa, etc.)
    const totalsByKey: Record<string, { und: number; m: number }> = {};
    for (const k of productoKeys) totalsByKey[k] = { und: 0, m: 0 };

    for (const r of invRows) {
      const inventarioId = toStr(r?.[0]);
      const productoKey = toStr(r?.[3]);

      if (!inventarioId || !productoKey) continue;
      if (!totalsByKey[productoKey]) continue; // solo los que pidieron

      const estado = toStr(r?.[16]).toLowerCase();
      if (estado.includes("consumido")) continue;

      const inicialUnd = toNumber(r?.[10]);
      const inicialM = toNumber(r?.[11]);

      const mov = movByInventarioId[inventarioId] || { und: 0, m: 0 };

      const disponibleUnd = inicialUnd + mov.und;
      const disponibleM = inicialM + mov.m;

      totalsByKey[productoKey].und += disponibleUnd;
      totalsByKey[productoKey].m += disponibleM;
    }

    return NextResponse.json({ success: true, totalsByKey });
  } catch (error) {
    console.error("[inventario/disponible/bulk]", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error calculando inventario bulk",
      },
      { status: 500 }
    );
  }
}
