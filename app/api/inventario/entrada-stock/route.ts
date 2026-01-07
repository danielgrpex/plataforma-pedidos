//app/api/inventario/entrada-stock/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function toStr(v: unknown) {
  return String(v ?? "").trim();
}
function toNumber(v: unknown) {
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function norm(v: unknown) {
  return toStr(v).toLowerCase();
}
function buildHeaderIndex(headerRow: any[]) {
  const idx = new Map<string, number>();
  headerRow.forEach((h, i) => {
    const key = norm(h);
    if (key) idx.set(key, i);
  });
  return idx;
}
function pick(row: any[], idx: Map<string, number>, col: string) {
  const i = idx.get(col.toLowerCase());
  return i === undefined ? "" : row[i];
}
function nowIso() {
  return new Date().toISOString();
}
function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

type InvRow = {
  inventarioId: string;
  tipoInventario: string;
  almacen: string;
  productoKey: string;
  productoDescripcion: string;
  referencia: string;
  color: string;
  ancho: string;
  largo: string;
  acabados: string;
  unidadBase: string;
  estadoInventario: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const inventarioIdBase = toStr(body.inventarioIdBase);
    const almacenDestino = toStr(body.almacenDestino) || "Producto Terminado";
    const usuario = toStr(body.usuario);
    const nota = toStr(body.nota); // ej: "Sobrante OPE260001"
    const referenciaOperacion = toStr(body.referenciaOperacion); // opcional

    const cantidadUnd = toNumber(body.cantidadUnd);
    const cantidadM = toNumber(body.cantidadM);

    if (!inventarioIdBase) {
      return NextResponse.json({ error: "inventarioIdBase es requerido" }, { status: 400 });
    }
    if (!usuario) {
      return NextResponse.json({ error: "usuario es requerido" }, { status: 400 });
    }
    if (!(cantidadUnd > 0 || cantidadM > 0)) {
      return NextResponse.json({ error: "cantidadUnd o cantidadM debe ser > 0" }, { status: 400 });
    }

    const sheets = await getSheetsClient();

    // Leer Inventario
    const invResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "Inventario!A:ZZ",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const invValues = (invResp.data.values || []) as any[][];
    if (invValues.length <= 1) {
      return NextResponse.json({ error: "Inventario vacío" }, { status: 500 });
    }

    const invHeader = invValues[0];
    const invIdx = buildHeaderIndex(invHeader);
    const invRows = invValues.slice(1);

    // 1) Encontrar el registro base por inventarioId
    let base: InvRow | null = null;

    for (const r of invRows) {
      const id = toStr(pick(r, invIdx, "inventarioId"));
      if (id !== inventarioIdBase) continue;

      base = {
        inventarioId: id,
        tipoInventario: toStr(pick(r, invIdx, "tipoInventario")),
        almacen: toStr(pick(r, invIdx, "almacen")),
        productoKey: toStr(pick(r, invIdx, "productoKey")),
        productoDescripcion: toStr(pick(r, invIdx, "productoDescripcion")),
        referencia: toStr(pick(r, invIdx, "referencia")),
        color: toStr(pick(r, invIdx, "color")),
        ancho: toStr(pick(r, invIdx, "ancho")),
        largo: toStr(pick(r, invIdx, "largo")),
        acabados: toStr(pick(r, invIdx, "acabados")),
        unidadBase: toStr(pick(r, invIdx, "unidadBase")),
        estadoInventario: toStr(pick(r, invIdx, "estadoInventario")),
      };
      break;
    }

    if (!base) {
      return NextResponse.json({ error: "inventarioIdBase no existe en Inventario" }, { status: 400 });
    }

    // 2) Buscar si ya existe un lote STOCK equivalente en el almacenDestino
    // equivalente = mismo productoKey + referencia/color/ancho/largo/acabados/unidadBase
    let inventarioIdStock = "";

    for (const r of invRows) {
      const id = toStr(pick(r, invIdx, "inventarioId"));
      if (!id) continue;

      const tipoInv = toStr(pick(r, invIdx, "tipoInventario"));
      const alm = toStr(pick(r, invIdx, "almacen"));
      if (norm(tipoInv) !== "stock") continue;
      if (alm !== almacenDestino) continue;

      const estado = norm(pick(r, invIdx, "estadoInventario"));
      if (estado && !estado.includes("disponible")) continue;
      if (estado.includes("consumido") || estado.includes("no conforme")) continue;

      const same =
        toStr(pick(r, invIdx, "productoKey")) === base.productoKey &&
        toStr(pick(r, invIdx, "referencia")) === base.referencia &&
        toStr(pick(r, invIdx, "color")) === base.color &&
        toStr(pick(r, invIdx, "ancho")) === base.ancho &&
        toStr(pick(r, invIdx, "largo")) === base.largo &&
        toStr(pick(r, invIdx, "acabados")) === base.acabados &&
        toStr(pick(r, invIdx, "unidadBase")) === base.unidadBase;

      if (same) {
        inventarioIdStock = id;
        break;
      }
    }

    // 3) Si no existe, crear el lote Stock
    if (!inventarioIdStock) {
      inventarioIdStock = makeId("INV-STK");

      const fila: any[] = [];
      const set = (col: string, val: any) => {
        const i = invIdx.get(col.toLowerCase());
        if (i === undefined) return;
        fila[i] = val;
      };

      set("inventarioId", inventarioIdStock);
      set("tipoInventario", "Stock");
      set("almacen", almacenDestino);

      set("productoKey", base.productoKey);
      set("productoDescripcion", base.productoDescripcion);

      set("referencia", base.referencia);
      set("color", base.color);
      set("ancho", base.ancho);
      set("largo", base.largo);
      set("acabados", base.acabados);

      set("unidadBase", base.unidadBase);

      set("cantidadInicialUnd", 0);
      set("cantidadInicialM", 0);

      set("estadoInventario", "Disponible"); // CLAVE para que tu API lo incluya
      set("fechaIngreso", nowIso());
      set("observaciones", nota);
      set("responsable", usuario);

      const out = Array.from({ length: invHeader.length }, (_, i) => fila[i] ?? "");

      await sheets.spreadsheets.values.append({
        spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
        range: "Inventario!A:ZZ",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [out] },
      });
    }

    // 4) Registrar movimiento positivo (entrada stock) al inventarioIdStock
    const movResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "MovimientosInventario!A:ZZ",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const movValues = (movResp.data.values || []) as any[][];
    if (movValues.length <= 0) {
      return NextResponse.json({ error: "MovimientosInventario sin header" }, { status: 500 });
    }

    const movHeader = movValues[0];
    const movIdx = buildHeaderIndex(movHeader);

    const movimientoId = makeId("MOV");
    const filaMov: any[] = [];
    const setMov = (col: string, val: any) => {
      const i = movIdx.get(col.toLowerCase());
      if (i === undefined) return;
      filaMov[i] = val;
    };

    setMov("movimientoId", movimientoId);
    setMov("inventarioId", inventarioIdStock);
    setMov("tipoMovimiento", "ENTRADA_STOCK");
    setMov("cantidadUnd", cantidadUnd);
    setMov("cantidadM", cantidadM);
    setMov("almacenOrigen", "Planta");
    setMov("almacenDestino", almacenDestino);
    setMov("pedidoKey", ""); // no pedido
    setMov("referenciaOperacion", referenciaOperacion || nota);
    setMov("motivo", "Sobrante/Stock");
    setMov("fechaMovimiento", nowIso());
    setMov("usuario", usuario);

    const movOut = Array.from({ length: movHeader.length }, (_, i) => filaMov[i] ?? "");

    await sheets.spreadsheets.values.append({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "MovimientosInventario!A:ZZ",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [movOut] },
    });

    return NextResponse.json(
      { ok: true, inventarioIdStock, movimientoId },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0, s-maxage=0" } }
    );
  } catch (e) {
    console.error("[POST inventario/entrada-stock]", e);
    return NextResponse.json(
      { error: "Error registrando entrada de stock" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
