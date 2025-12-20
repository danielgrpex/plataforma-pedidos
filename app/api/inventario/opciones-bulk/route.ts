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
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

type Destino = "Almacén" | "Corte" | "Producción";

type Body = {
  items: Array<{
    uid: string;
    productoTexto: string; // "Producto|Color|Ancho|Largo|Acabados"
    destino: Destino;
  }>;
};

// Parse robusto: "Producto|Color|Ancho|Largo|Acabados"
function parseProductoTexto(texto: string) {
  const parts = String(texto || "").split("|");
  const producto = toStr(parts[0] ?? "");
  const color = toStr(parts[1] ?? "");
  const ancho = toNumber(parts[2] ?? 0);
  const largo = toNumber(parts[3] ?? 0);
  const acabados = toStr(parts[4] ?? "");
  return { producto, color, ancho, largo, acabados };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const itemsReq = Array.isArray(body?.items) ? body.items : [];

    if (!itemsReq.length) {
      return NextResponse.json(
        { success: false, message: "items es requerido (array no vacío)" },
        { status: 400 }
      );
    }

    const sheets = await getSheetsClient();

    // 1) Leer Inventario (1 vez)
    const invResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "Inventario!A:AB",
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const invValues = (invResp.data.values || []) as any[][];
    const invRows = invValues.length > 1 ? invValues.slice(1) : [];

    // 2) Leer Movimientos (1 vez)
    const movResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "MovimientosInventario!A:L",
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const movValues = (movResp.data.values || []) as any[][];
    const movRows = movValues.length > 1 ? movValues.slice(1) : [];

    // 3) Sumar movimientos por inventarioId
    // Movimientos: inventarioId = col B (idx 1), cantidadUnd = col D (idx 3), cantidadM = col E (idx 4)
    const movByInvId: Record<string, { und: number; m: number }> = {};
    for (const r of movRows) {
      const invId = toStr(r?.[1]);
      if (!invId) continue;
      const und = toNumber(r?.[3]);
      const m = toNumber(r?.[4]);

      if (!movByInvId[invId]) movByInvId[invId] = { und: 0, m: 0 };
      movByInvId[invId].und += und;
      movByInvId[invId].m += m;
    }

    /**
     * Inventario (según tu estructura actual):
     * A inventarioId (0)
     * C almacen (2)
     * D productoKey (3)
     * E productoDescripcion (4)  -> a veces puede venir "Producto|Color|Ancho|Largo|Acabados"
     * G color (6)
     * H ancho (7)
     * I largo (8)
     * K cantidadInicialUnd (10)
     * L cantidadInicialM (11)
     * Q estadoInventario (16)
     *
     * Disponible = Inicial + sum(movimientos)
     */
    type InvOption = {
      inventarioId: string;
      almacen: string;
      productoTexto: string;
      producto: string;
      color: string;
      ancho: number;
      largo: number;
      acabados: string;
      disponibleUnd: number;
      disponibleM: number;
    };

    const allOptions: InvOption[] = [];

    for (const r of invRows) {
      const inventarioId = toStr(r?.[0]);
      const almacen = toStr(r?.[2]);
      const productoKey = toStr(r?.[3]);
      const productoDescripcion = toStr(r?.[4]);

      if (!inventarioId) continue;

      const estadoInv = toStr(r?.[16]).toLowerCase();
      if (estadoInv.includes("consumido")) continue;

      const inicialUnd = toNumber(r?.[10]);
      const inicialM = toNumber(r?.[11]);
      const mov = movByInvId[inventarioId] || { und: 0, m: 0 };

      const disponibleUnd = inicialUnd + mov.und;
      const disponibleM = inicialM + mov.m;

      // Si ya está en 0 o negativo, lo podemos ocultar (o dejarlo si quieres verlo)
      if (disponibleUnd <= 0 && disponibleM <= 0) continue;

      // Parse:
      // Preferimos productoDescripcion si viene con "|"
      let parsed;
      if (productoDescripcion.includes("|")) {
        parsed = parseProductoTexto(productoDescripcion);
      } else {
        // fallback: usar columnas separadas si existen
        parsed = {
          producto: productoDescripcion || productoKey,
          color: toStr(r?.[6]),
          ancho: toNumber(r?.[7]),
          largo: toNumber(r?.[8]),
          acabados: "", // si no hay en inventario, lo dejamos vacío
        };
      }

      const productoTexto = `${parsed.producto}|${parsed.color}|${parsed.ancho}|${parsed.largo}|${parsed.acabados}`;

      allOptions.push({
        inventarioId,
        almacen,
        productoTexto,
        producto: parsed.producto,
        color: parsed.color,
        ancho: parsed.ancho,
        largo: parsed.largo,
        acabados: parsed.acabados,
        disponibleUnd,
        disponibleM,
      });
    }

    // 4) Resolver opciones por UID
    const opcionesByUid: Record<string, any[]> = {};

    for (const it of itemsReq) {
      const uid = toStr(it.uid);
      const destino = toStr(it.destino) as Destino;
      const reqParsed = parseProductoTexto(it.productoTexto);

      // Por ahora Producción no usa inventario de producto terminado/proceso para cumplir (se produce),
      // pero igual te devolvemos opciones por si quieres verlo.
      const wantDestino = destino || "Almacén";

      let opciones = allOptions.filter((opt) => {
        // Coincidencia base
        const sameBase =
          opt.producto === reqParsed.producto &&
          opt.color === reqParsed.color &&
          opt.ancho === reqParsed.ancho;

        if (!sameBase) return false;

        if (wantDestino === "Almacén") {
          // Almacén: match exacto largo + acabados
          return opt.largo === reqParsed.largo && toStr(opt.acabados) === toStr(reqParsed.acabados);
        }

        if (wantDestino === "Corte") {
          // Corte: cualquier acabados, pero largo debe alcanzar
          return opt.largo >= reqParsed.largo;
        }

        // Producción: no depende de esto (igual devolvemos compatibles por base)
        return true;
      });

      // Orden pro:
      // - Corte: menor largo que sirva (menos desperdicio), luego disponible mayor
      // - Almacén: como es exacto, solo por disponible
      if (wantDestino === "Corte") {
        opciones = opciones.sort((a, b) => {
          const dl = a.largo - b.largo; // menor largo primero
          if (dl !== 0) return dl;
          return (b.disponibleUnd || 0) - (a.disponibleUnd || 0);
        });
      } else {
        opciones = opciones.sort((a, b) => (b.disponibleUnd || 0) - (a.disponibleUnd || 0));
      }

      opcionesByUid[uid] = opciones.map((o) => ({
        inventarioId: o.inventarioId,
        almacen: o.almacen,
        productoTexto: o.productoTexto,
        largo: o.largo,
        acabados: o.acabados,
        disponibleUnd: o.disponibleUnd,
        disponibleM: o.disponibleM,
      }));
    }

    return NextResponse.json({ success: true, opcionesByUid });
  } catch (error) {
    console.error("[inventario/opciones-bulk]", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error calculando opciones bulk",
      },
      { status: 500 }
    );
  }
}
