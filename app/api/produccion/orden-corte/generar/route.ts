// app/api/produccion/orden-corte/generar/route.ts
// app/api/produccion/orden-corte/generar/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  creado_por?: string;
  codigo_doc?: string; // SOLO PDF (ya no se usa para pdf-lib)
  observaciones?: string;
  items: { rowIndex1Based: number; actividades?: string }[];
};

function toStr(v: unknown) {
  return String(v ?? "").trim();
}
function norm(v: unknown) {
  return toStr(v).toLowerCase();
}
function toNumber(v: unknown) {
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function findCol(headers: any[], candidates: string[]) {
  const h = headers.map((x) => norm(x));
  for (const c of candidates) {
    const idx = h.indexOf(norm(c));
    if (idx >= 0) return idx;
  }
  return -1;
}
function pad5(n: number) {
  return String(n).padStart(5, "0");
}
function formatDateCO(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}
function serializeErr(err: any) {
  if (!err) return err;
  return {
    name: err?.name,
    message: err?.message,
    code: err?.code,
    details: err?.details,
    hint: err?.hint,
    status: err?.status,
    error: err?.error,
    stack: process.env.NODE_ENV === "production" ? undefined : err?.stack,
  };
}

/**
 * ✅ baseUrl seguro (local + vercel)
 */
function getBaseUrl(req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  if (!host) throw new Error("No se pudo determinar el host de la request");
  return `${proto}://${host}`;
}

// Intenta sacar largo desde "Producto|Color|Ancho|Largo|Acabados"
function parseLargoFromPipeText(texto: string) {
  const t = toStr(texto);
  if (!t.includes("|")) return 0;
  const parts = t.split("|");
  return toNumber(parts?.[3]);
}

/**
 * Normaliza largo para que en Sheets quede como tu fucsia:
 * - Si viene 255 -> 2.55
 * - Si viene 1 -> 1
 */
function normalizeLargoOrigen(raw: number) {
  if (!Number.isFinite(raw)) return 0;
  if (raw >= 50) return Math.round((raw / 100) * 100) / 100;
  return raw;
}

/** =========================
 *  Google Sheets helpers (OPCIÓN B)
 *  ========================= */
async function getSheetHeaders(sheets: any, spreadsheetId: string, sheetName: string): Promise<string[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return (res.data.values?.[0] || []).map((x: any) => toStr(x));
}

function buildRowByHeaders(headers: string[], valuesByColName: Record<string, any>) {
  const mapNormToValue: Record<string, any> = {};
  for (const [k, v] of Object.entries(valuesByColName)) {
    mapNormToValue[norm(k)] = v;
  }

  return headers.map((h) => {
    const key = norm(h);
    const v = mapNormToValue[key];
    if (v === null || v === undefined) return "";
    return v;
  });
}

async function appendRowToSheet(sheets: any, spreadsheetId: string, sheetName: string, row: any[]) {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:ZZ`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

async function appendRowsToSheet(sheets: any, spreadsheetId: string, sheetName: string, rows: any[][]) {
  if (!rows.length) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:ZZ`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

/** =========================
 *  Consecutivo OC en Supabase
 *  ========================= */
async function nextNumeroOrden() {
  const year = new Date().getFullYear();
  const prefix = `OC-${year}-`;

  const { data, error } = await supabaseAdmin
    .from("orden_corte")
    .select("numero_orden")
    .like("numero_orden", `${prefix}%`)
    .order("numero_orden", { ascending: false })
    .limit(1);

  if (error) throw error;

  const last = (data?.[0] as any)?.numero_orden as string | undefined;
  let next = 1;

  if (last && last.startsWith(prefix)) {
    const tail = last.replace(prefix, "");
    const n = Number(tail);
    if (Number.isFinite(n)) next = n + 1;
  }

  return `${prefix}${pad5(next)}`;
}

export async function POST(req: Request) {
  let stage = "start";

  try {
    stage = "read-body";
    const body = (await req.json()) as Body;

    // alive check
    if (!body?.items?.length) {
      return NextResponse.json({
        success: true,
        ok: "POST /api/produccion/orden-corte/generar funciona",
      });
    }

    stage = "validate-items";
    for (const it of body.items) {
      if (typeof it.rowIndex1Based !== "number" || !Number.isFinite(it.rowIndex1Based)) {
        return NextResponse.json(
          { success: false, message: "rowIndex1Based faltante o inválido", item: it },
          { status: 400 }
        );
      }
    }

    const creadoPor = toStr(body.creado_por) || "Sistema";
    const observaciones = toStr(body.observaciones) || "";

    stage = "sheets-read-pedidos";
    const sheets = await getSheetsClient();

    const pedRange = "Pedidos!A:BM";
    const pedResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: pedRange,
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const pedValues = (pedResp.data.values || []) as any[][];
    if (pedValues.length < 2) throw new Error("Hoja Pedidos vacía");

    const headers = pedValues[0] || [];
    const pedRows = pedValues.slice(1);

    const IDX_CONSEC = findCol(headers, ["Consecutivo"]);
    const IDX_CLIENTE = findCol(headers, ["Cliente"]);
    const IDX_OC = findCol(headers, ["Orden de Compra", "OC"]);
    const IDX_PRODUCTO = findCol(headers, ["Producto"]);
    const IDX_CANTUND = findCol(headers, ["Cantidad (und)", "Cant (und)"]);
    const IDX_PEDIDOKEY = findCol(headers, ["PedidoKey", "pedidoKey", "pedido_key", "Key"]); // opcional

    if (IDX_CLIENTE < 0 || IDX_OC < 0 || IDX_PRODUCTO < 0 || IDX_CANTUND < 0) {
      throw new Error("Faltan columnas base en Pedidos (Cliente/OC/Producto/Cantidad (und))");
    }

    /** =========================
     *  Enriquecer ORIGEN desde MovimientosInventario + Inventario
     *  ========================= */
    stage = "sheets-read-movimientos";
    const movResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "MovimientosInventario!A:L",
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const movValues = (movResp.data.values || []) as any[][];
    const movRows = movValues.length > 1 ? movValues.slice(1) : [];

    const M_IDX_INVID = 1; // B
    const M_IDX_TIPO = 2; // C
    const M_IDX_QTYUND = 3; // D
    const M_IDX_REF = 8; // I
    const M_IDX_FECHA = 10; // K

    const reservaByRow: Record<string, { inventarioId: string; qtyUnd: number; ts: string }> = {};
    for (const m of movRows) {
      if (toStr(m[M_IDX_TIPO]) !== "Reserva") continue;

      const invId = toStr(m[M_IDX_INVID]);
      const qty = toNumber(m[M_IDX_QTYUND]); // negativa
      const ref = toStr(m[M_IDX_REF]);
      const ts = toStr(m[M_IDX_FECHA]) || "";
      if (!invId) continue;

      const match = ref.match(/^PLN-R(\d+)$/);
      const rowFromRef = match ? Number(match[1] || 0) : 0;
      if (!rowFromRef) continue;

      const key = `ROW-${rowFromRef}`;
      const prev = reservaByRow[key];
      if (!prev) reservaByRow[key] = { inventarioId: invId, qtyUnd: qty, ts };
      else {
        if (ts && prev.ts && ts > prev.ts) reservaByRow[key] = { inventarioId: invId, qtyUnd: qty, ts };
        else if (!prev.ts && ts) reservaByRow[key] = { inventarioId: invId, qtyUnd: qty, ts };
      }
    }

    stage = "sheets-read-inventario";
    const invResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "Inventario!A:AB",
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const invValues = (invResp.data.values || []) as any[][];
    const invRows = invValues.length > 1 ? invValues.slice(1) : [];

    const invMap: Record<string, { productoOrigen: string; largoOrigen: number }> = {};
    for (const r of invRows) {
      const invId = toStr(r?.[0]);
      if (!invId) continue;

      const descripcion = toStr(r?.[4]) || toStr(r?.[3]) || "";
      const largoCol = toNumber(r?.[8]);
      const largoPipe = parseLargoFromPipeText(descripcion);
      const largoRaw = largoCol || largoPipe || 0;

      invMap[invId] = {
        productoOrigen: descripcion,
        largoOrigen: normalizeLargoOrigen(largoRaw),
      };
    }

    /** =========================
     *  Construir items desde Pedidos + Origen
     *  ========================= */
    stage = "build-items-from-pedidos";
    const items = body.items.map((it, idx) => {
      const row = it.rowIndex1Based;
      const r = pedRows[row - 2];
      if (!r) throw new Error(`Fila ${row} no existe en Pedidos`);

      const consecutivoPedido = IDX_CONSEC >= 0 ? toStr(r[IDX_CONSEC]) : "";
      const cliente = toStr(r[IDX_CLIENTE]);
      const oc = toStr(r[IDX_OC]);
      const productoSolicitado = toStr(r[IDX_PRODUCTO]);
      const cantidadSolicitadaUnd = toNumber(r[IDX_CANTUND]);

      const pedidoKeyFromSheet = IDX_PEDIDOKEY >= 0 ? toStr(r[IDX_PEDIDOKEY]) : "";
      const pedidoKey = pedidoKeyFromSheet || (consecutivoPedido ? `PED-${consecutivoPedido}` : `ROW-${row}`);

      // Origen por reserva PLN-R{row}
      const reserva = reservaByRow[`ROW-${row}`];
      const inventarioOrigenId = reserva?.inventarioId || "";
      const cantidadOrigenUnd = reserva ? Math.abs(reserva.qtyUnd || 0) : 0;

      const inv = inventarioOrigenId ? invMap[inventarioOrigenId] : null;
      const productoOrigen = inv?.productoOrigen || "";
      const largoOrigen = inv?.largoOrigen || 0;

      const productoInicial = productoOrigen || productoSolicitado;
      const cantidadInicial = cantidadOrigenUnd || cantidadSolicitadaUnd;

      return {
        consecutivo: idx + 1, // interno
        pedidoRowIndex: row,
        pedidoId: consecutivoPedido || String(row),
        pedidoKey,
        cliente,
        oc,
        ordenProduccion: "",
        productoSolicitado,
        cantidadSolicitadaUnd,
        inventarioOrigenId,
        productoOrigen,
        largoOrigen,
        cantidadOrigenUnd,
        productoInicial,
        cantidadInicial,
        actividades: toStr(it.actividades) || "Cortar",
      };
    });

    stage = "supabase-next-numero";
    const numeroOrden = await nextNumeroOrden();
    const version = 1;

    stage = "supabase-insert-orden_corte";
    const { data: orden, error: eOrden } = await supabaseAdmin
      .from("orden_corte")
      .insert({
        numero_orden: numeroOrden,
        version,
        estado: "Generada",
        creado_por: creadoPor,
        observaciones,
      })
      .select("*")
      .single();

    if (eOrden) throw eOrden;

    stage = "supabase-insert-orden_corte_items";
    const itemsDb = items.map((it) => ({
      orden_corte_id: orden.id,
      pedido_id: String(it.pedidoId),
      cliente: it.cliente,
      oc: it.oc,
      producto_inicial: it.productoInicial,
      cantidad_inicial: it.cantidadInicial,
      actividades: it.actividades,
    }));

    const { error: eItems } = await supabaseAdmin.from("orden_corte_items").insert(itemsDb);
    if (eItems) throw eItems;

    /** =========================
     *  PDF (EXPORTADO DESDE SHEETS)
     *  ========================= */
    stage = "pdf-build";
    const _fecha = formatDateCO(new Date());
    const _fechaGeneracionLabel = new Date().toLocaleString("es-CO");

    stage = "storage-upload";
    const year = new Date().getFullYear();
    const fileName = `${numeroOrden}_V${version}.pdf`;
    const pdfPath = `${year}/${numeroOrden}/${fileName}`;

    stage = "export-pdf-from-template";

    const baseUrl = getBaseUrl(req);

    const exportResp = await fetch(`${baseUrl}/api/produccion/orden-corte/exportar-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numeroOrden,
        version,
        creadoPor,
        observaciones,
        items: items.map((it) => ({
          consecutivo: it.pedidoRowIndex,
          cliente: it.cliente,
          oc: it.oc,
          ordenProduccion: it.ordenProduccion,
          productoInicial: it.productoInicial,
          cantidadInicial: it.cantidadInicial,
          actividades: it.actividades,
          codigoSiggoFinal: "",
          productoFinal: it.productoSolicitado,
          cantidadFinal: it.cantidadSolicitadaUnd,
        })),
        pdfPath,
      }),
    });

    const exportJson = await exportResp.json();
    if (!exportResp.ok || !exportJson?.success) {
      throw new Error(exportJson?.message || "Error exportando PDF desde plantilla");
    }

    const finalPdfPath = toStr(exportJson?.pdf_path) || pdfPath;

    stage = "storage-signed-url";
    const signed = await supabaseAdmin.storage.from("ordenes-corte").createSignedUrl(finalPdfPath, 60 * 60);
    if (signed.error) throw signed.error;

    stage = "supabase-update-pdf_path";
    const { error: eUpd } = await supabaseAdmin
      .from("orden_corte")
      .update({ pdf_path: finalPdfPath })
      .eq("id", orden.id);
    if (eUpd) throw eUpd;

    /** =========================
     *  ✅ Guardar en Sheets (ordenCorte / ordenCorteItems) POR HEADERS
     *  ========================= */
    stage = "sheets-write-ordenCorte";
    const headersOC = await getSheetHeaders(sheets, env.SHEET_BASE_PRINCIPAL_ID, "ordenCorte");

    const rowOC = buildRowByHeaders(headersOC, {
      ordenCorteId: numeroOrden,
      fechaCreacion: new Date().toISOString(),
      estado: "Generada",
      responsable: creadoPor,
      observaciones,
      totalItems: items.length,
      creadoPor,
      fechaCierre: "",

      pdf_path: finalPdfPath,
      pdf_signed_url: signed.data.signedUrl,
      numero_orden: numeroOrden,
      version,
    });

    await appendRowToSheet(sheets, env.SHEET_BASE_PRINCIPAL_ID, "ordenCorte", rowOC);

    stage = "sheets-write-ordenCorteItems";
    const headersOCI = await getSheetHeaders(sheets, env.SHEET_BASE_PRINCIPAL_ID, "ordenCorteItems");

    const rowsOCI = items.map((it) => {
      const ordenCorteItemId = `${numeroOrden} - ${it.pedidoRowIndex}`;

      return buildRowByHeaders(headersOCI, {
        ordenCorteItemId,
        ordenCorteId: numeroOrden,

        pedidoKey: it.pedidoKey,
        pedidoRowIndex: it.pedidoRowIndex,

        productoSolicitado: it.productoSolicitado,
        cantidadSolicitadaUnd: it.cantidadSolicitadaUnd,

        destinoFinal: "",
        estadoItem: "Pendiente",

        inventarioOrigenId: it.inventarioOrigenId,
        productoOrigen: it.productoOrigen,
        largoOrigen: it.largoOrigen,
        cantidadOrigenUnd: it.cantidadOrigenUnd,

        cantidadOrigenM: "",
        largoFinal: "",
        actividades: it.actividades,
        cantidadResultanteUnd: "",
        desperdicioM: "",
      });
    });

    await appendRowsToSheet(sheets, env.SHEET_BASE_PRINCIPAL_ID, "ordenCorteItems", rowsOCI);

    return NextResponse.json({
      success: true,
      ok: true,
      orden_corte_id: orden.id,
      numero_orden: numeroOrden,
      version,
      pdf_path: finalPdfPath,
      pdf_signed_url: signed.data.signedUrl,
    });
  } catch (error: any) {
    console.error("[produccion/orden-corte/generar] stage:", stage, error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Error creando orden",
        stage,
        raw: serializeErr(error),
      },
      { status: 500 }
    );
  }
}
