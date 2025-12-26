// app/api/produccion/empaque/entregar/route.ts
// app/api/produccion/empaque/entregar/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";

type Turno = "A" | "B" | "C" | "N";

type EntregarBody = {
  trabajador: string; // supervisor/coordinador
  turno: Turno;
  ordenCorteItemId: string; // "OC-2025-00037 - 52"
  cantidadEntregadaUnd: number;
  observaciones?: string;
};

const SPREADSHEET_ID = process.env.SHEET_BASE_PRINCIPAL_ID;
const SHEET_MOV = "MovimientosInventario";
const SHEET_ITEMS = "ordenCorteItems";
const SHEET_OC = "ordenCorte";
const SHEET_PEDIDOS = "Pedidos";

function mustEnv(v: string | undefined, name: string) {
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

function safeNum(v: any) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

function parseOrdenCorteId(ordenCorteItemId: string) {
  // "OC-2025-00037 - 52" => "OC-2025-00037"
  const s = String(ordenCorteItemId || "").trim();
  const parts = s.split(" - ");
  return (parts[0] || "").trim();
}

async function getSheets() {
  const email = mustEnv(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, "GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const key = mustEnv(process.env.GOOGLE_PRIVATE_KEY, "GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client as any });
  return sheets;
}

async function readSheetAll(sheets: any, sheetName: string) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
  });
  const values: any[][] = res.data.values || [];
  if (values.length === 0) return { headers: [] as string[], rows: [] as any[][] };
  const headers = (values[0] || []).map((h) => String(h || "").trim());
  const rows = values.slice(1);
  return { headers, rows };
}

function headerMap(headers: string[]) {
  const m = new Map<string, number>();
  headers.forEach((h, i) => m.set(String(h || "").trim(), i));
  return m;
}

function findCol(headers: string[], candidates: string[]) {
  const hm = headerMap(headers);

  // exact
  for (const c of candidates) {
    const idx = hm.get(c);
    if (idx !== undefined) return idx;
  }

  // includes
  const low = headers.map((h) => h.toLowerCase());
  for (const c of candidates) {
    const ci = low.findIndex((h) => h.includes(String(c).toLowerCase()));
    if (ci >= 0) return ci;
  }

  return -1;
}

function buildRow(headers: string[], valuesByHeader: Record<string, any>) {
  const row = Array(headers.length).fill("");
  const hm = headerMap(headers);
  for (const [k, v] of Object.entries(valuesByHeader)) {
    const idx = hm.get(k);
    if (idx !== undefined) row[idx] = v ?? "";
  }
  return row;
}

function numToCol(n1: number) {
  let n = n1;
  let s = "";
  while (n > 0) {
    const mod = (n - 1) % 26;
    s = String.fromCharCode(65 + mod) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

async function updateCells(
  sheets: any,
  sheetName: string,
  rowNumber1Based: number,
  updates: Array<{ colIndex0Based: number; value: any }>
) {
  const requests = updates.map((u) => {
    const colLetter = numToCol(u.colIndex0Based + 1);
    const a1 = `${sheetName}!${colLetter}${rowNumber1Based}`;
    return sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: a1,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[u.value ?? ""]] },
    });
  });
  await Promise.all(requests);
}

async function writeAppend(sheets: any, sheetName: string, row: any[]) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

function pickHeader(headers: string[], candidates: string[]) {
  const hm = headerMap(headers);
  for (const c of candidates) if (hm.has(c)) return c;

  const low = headers.map((h) => h.toLowerCase());
  for (const c of candidates) {
    const i = low.findIndex((h) => h.includes(String(c).toLowerCase()));
    if (i >= 0) return headers[i];
  }
  return null;
}

// ====== Columnas conocidas / heurísticas
const COL = {
  // MovimientosInventario (según tu hoja)
  movId: ["movimientoId", "MovimientoId", "movimientoId "],
  movInvId: ["inventarioId", "InventarioId"],
  movTipo: ["tipoMovimiento", "TipoMovimiento", "tipo", "Tipo"],
  movCantidadUnd: ["cantidadUnd", "CantidadUnd", "cantidad", "Cantidad"],
  movCantidadM: ["cantidadM", "CantidadM"],
  movAlmOrigen: ["almacenOrigen", "AlmacenOrigen"],
  movAlmDestino: ["almacenDestino", "AlmacenDestino"],
  movPedidoKey: ["pedidoKey", "PedidoKey"],
  movRefOp: ["referenciaOperacion", "ReferenciaOperacion"],
  movMotivo: ["motivo", "Motivo"],
  movFecha: ["fechaMovimiento", "FechaMovimiento", "fecha", "Fecha"],
  movUsuario: ["usuario", "Usuario"],

  // ordenCorteItems
  itemId: ["ordenCorteItemId", "OrdenCorteItemId", "ordenCorteItemid"],
  itemOcId: ["ordenCorteId", "OrdenCorteId"],
  itemSolicitado: ["cantidadSolicitadaUnd", "CantidadSolicitadaUnd", "solicitado", "Solicitado"],
  itemEntregado: ["cantidadEntregadaUnd", "CantidadEntregadaUnd", "entregado", "Entregado", "entregadoAcumulado"],
  itemEstado: ["estadoItem", "EstadoItem", "estado", "Estado"],
  itemPedidoKey: ["pedidoKey", "PedidoKey", "pedidosKey", "PedidosKey"],
  itemPedidoRow: ["pedidoRowIndex", "PedidoRowIndex", "rowIndex", "RowIndex"],

  // ordenCorte
  ocId: ["ordenCorteId", "OrdenCorteId", "id", "ID"],
  ocEstado: ["estado", "Estado"],
  ocFechaCierre: ["fechaCierre", "FechaCierre"],

  // Pedidos (EXACTO según lo que me enviaste)
  pedKey: ["pedidosKey", "PedidosKey"],
  pedEstado: ["Estado"],
  pedFechaRealAlmacen: ["Fecha Real Entrega Almacén"],
};

export async function POST(req: Request) {
  try {
    mustEnv(SPREADSHEET_ID, "SHEET_BASE_PRINCIPAL_ID");

    const body = (await req.json()) as Partial<EntregarBody>;
    const trabajador = String(body.trabajador || "").trim();
    const turno = body.turno as Turno;
    const ordenCorteItemId = String(body.ordenCorteItemId || "").trim();
    const cantidadEntregadaUnd = safeNum(body.cantidadEntregadaUnd);
    const observaciones = String(body.observaciones || "").trim();

    if (!trabajador) return NextResponse.json({ success: false, message: "Falta trabajador" }, { status: 400 });
    if (!turno) return NextResponse.json({ success: false, message: "Falta turno" }, { status: 400 });
    if (!ordenCorteItemId) return NextResponse.json({ success: false, message: "Falta ordenCorteItemId" }, { status: 400 });
    if (cantidadEntregadaUnd <= 0) return NextResponse.json({ success: false, message: "cantidadEntregadaUnd debe ser > 0" }, { status: 400 });

    const ordenCorteId = parseOrdenCorteId(ordenCorteItemId);
    if (!ordenCorteId) {
      return NextResponse.json(
        { success: false, message: "No pude derivar ordenCorteId desde ordenCorteItemId" },
        { status: 400 }
      );
    }

    const sheets = await getSheets();

    // =========================
    // 1) Leer ordenCorteItems (encontrar fila + calcular entregado)
    // =========================
    const { headers: itemHeaders, rows: itemRows } = await readSheetAll(sheets, SHEET_ITEMS);
    if (itemHeaders.length === 0) {
      return NextResponse.json({ success: false, message: `La hoja ${SHEET_ITEMS} no tiene headers` }, { status: 500 });
    }

    const idxItemId = findCol(itemHeaders, COL.itemId);
    const idxSolicitado = findCol(itemHeaders, COL.itemSolicitado);
    const idxEntregado = findCol(itemHeaders, COL.itemEntregado);
    const idxEstadoItem = findCol(itemHeaders, COL.itemEstado);
    const idxItemOc = findCol(itemHeaders, COL.itemOcId);
    const idxPedidoKey = findCol(itemHeaders, COL.itemPedidoKey);
    const idxPedidoRow = findCol(itemHeaders, COL.itemPedidoRow);

    if (idxItemId < 0 || idxSolicitado < 0) {
      return NextResponse.json(
        { success: false, message: `No encontré columnas mínimas en ${SHEET_ITEMS} (ordenCorteItemId, cantidadSolicitadaUnd)` },
        { status: 500 }
      );
    }

    const rowIndex0 = itemRows.findIndex((r) => String(r[idxItemId] || "").trim() === ordenCorteItemId);
    if (rowIndex0 < 0) {
      return NextResponse.json({ success: false, message: `No encontré ${ordenCorteItemId} en ${SHEET_ITEMS}` }, { status: 404 });
    }

    const sheetRowNumber1Based = rowIndex0 + 2; // header + 1
    const solicitado = safeNum(itemRows[rowIndex0][idxSolicitado]);
    const entregadoPrev = idxEntregado >= 0 ? safeNum(itemRows[rowIndex0][idxEntregado]) : 0;
    const entregadoNuevo = entregadoPrev + cantidadEntregadaUnd;

    if (entregadoNuevo > solicitado) {
      return NextResponse.json(
        {
          success: false,
          message: `Entrega supera lo solicitado. Solicitado=${solicitado}, EntregadoPrev=${entregadoPrev}, Intento=${cantidadEntregadaUnd}`,
        },
        { status: 400 }
      );
    }

    const completo = entregadoNuevo >= solicitado;
    const estadoPrev = idxEstadoItem >= 0 ? String(itemRows[rowIndex0][idxEstadoItem] || "").trim() : "";
    const estadoItemNuevo = completo ? "Almacén" : (estadoPrev || "Pendiente");

    const pedidosKey = idxPedidoKey >= 0 ? String(itemRows[rowIndex0][idxPedidoKey] || "").trim() : "";
    const pedidoRowIndex = idxPedidoRow >= 0 ? safeNum(itemRows[rowIndex0][idxPedidoRow]) : 0;

    const fechaISO = new Date().toISOString();

    // =========================
    // 2) Append MovimientosInventario (lo que ya te funciona)
    // =========================
    const { headers: movHeaders } = await readSheetAll(sheets, SHEET_MOV);
    if (movHeaders.length === 0) {
      return NextResponse.json({ success: false, message: `La hoja ${SHEET_MOV} no tiene headers` }, { status: 500 });
    }

    const movimientoId = uid("MOV");

    const movValues: Record<string, any> = {};

    const hMovId = pickHeader(movHeaders, COL.movId);
    const hInvId = pickHeader(movHeaders, COL.movInvId);
    const hTipo = pickHeader(movHeaders, COL.movTipo);
    const hCantUnd = pickHeader(movHeaders, COL.movCantidadUnd);
    const hCantM = pickHeader(movHeaders, COL.movCantidadM);
    const hOri = pickHeader(movHeaders, COL.movAlmOrigen);
    const hDes = pickHeader(movHeaders, COL.movAlmDestino);
    const hPedido = pickHeader(movHeaders, COL.movPedidoKey);
    const hRef = pickHeader(movHeaders, COL.movRefOp);
    const hMotivo = pickHeader(movHeaders, COL.movMotivo);
    const hFecha = pickHeader(movHeaders, COL.movFecha);
    const hUsuario = pickHeader(movHeaders, COL.movUsuario);

    if (hMovId) movValues[hMovId] = movimientoId;
    if (hInvId) movValues[hInvId] = ""; // (si ya lo estás llenando por productoKey, ponlo aquí)
    if (hTipo) movValues[hTipo] = "Entrega a almacén";
    if (hCantUnd) movValues[hCantUnd] = cantidadEntregadaUnd;
    if (hCantM) movValues[hCantM] = 0;
    if (hOri) movValues[hOri] = "Producción";
    if (hDes) movValues[hDes] = "Almacén";
    if (hPedido) movValues[hPedido] = pedidosKey || "";
    if (hRef) movValues[hRef] = ordenCorteItemId;
    if (hMotivo) movValues[hMotivo] = `Entrega OC ${ordenCorteId}` + (observaciones ? ` | ${observaciones}` : "");
    if (hFecha) movValues[hFecha] = fechaISO;
    if (hUsuario) movValues[hUsuario] = trabajador;

    const movRow = buildRow(movHeaders, movValues);
    await writeAppend(sheets, SHEET_MOV, movRow);

    // =========================
    // 3) Update ordenCorteItems (entregado + estadoItem)
    // =========================
    const updatesItems: Array<{ colIndex0Based: number; value: any }> = [];
    if (idxEntregado >= 0) updatesItems.push({ colIndex0Based: idxEntregado, value: entregadoNuevo });
    if (idxEstadoItem >= 0) updatesItems.push({ colIndex0Based: idxEstadoItem, value: estadoItemNuevo });

    if (updatesItems.length > 0) {
      await updateCells(sheets, SHEET_ITEMS, sheetRowNumber1Based, updatesItems);
    }

    // =========================
    // 4) Si el ítem quedó completo → actualizar Pedidos EXACTO:
    //    "Estado" y "Fecha Real Entrega Almacén"
    // =========================
    let pedidosActualizado = false;
    let pedidosWarning: string | null = null;

    if (completo && pedidosKey && pedidoRowIndex > 1) {
      // pedidoRowIndex = fila REAL en la sheet (ej: 52)
      const { headers: pHeaders, rows: pRows } = await readSheetAll(sheets, SHEET_PEDIDOS);

      if (pHeaders.length === 0) {
        pedidosWarning = `La hoja ${SHEET_PEDIDOS} no tiene headers`;
      } else {
        const idxKey = findCol(pHeaders, COL.pedKey);
        const idxEstado = findCol(pHeaders, COL.pedEstado);
        const idxFechaReal = findCol(pHeaders, COL.pedFechaRealAlmacen);

        if (idxEstado < 0 || idxFechaReal < 0) {
          pedidosWarning = `No encontré columnas exactas en Pedidos: "Estado" y/o "Fecha Real Entrega Almacén"`;
        } else {
          // Validación opcional: confirmar que en esa fila está el pedidosKey
          if (idxKey >= 0) {
            const fila0 = pedidoRowIndex - 2; // porque rows ya viene sin header (row 2 => rows[0])
            if (fila0 >= 0 && fila0 < pRows.length) {
              const keyEnFila = String(pRows[fila0][idxKey] || "").trim();
              if (keyEnFila && keyEnFila !== pedidosKey) {
                pedidosWarning = `PedidosKey no coincide en fila ${pedidoRowIndex}. Esperado=${pedidosKey} Encontrado=${keyEnFila}. Igual actualicé Estado/FechaReal.`;
              }
            }
          }

          await updateCells(sheets, SHEET_PEDIDOS, pedidoRowIndex, [
            { colIndex0Based: idxEstado, value: "Almacén" },
            { colIndex0Based: idxFechaReal, value: fechaISO },
          ]);

          pedidosActualizado = true;
        }
      }
    }

    // =========================
    // 5) Update ordenCorte si aplica (todos items en almacén)
    // =========================
    let ordenCorteActualizada = false;

    // Releer items ya actualizados
    const { rows: itemRows2 } = await readSheetAll(sheets, SHEET_ITEMS);

    if (idxItemOc >= 0 && idxEstadoItem >= 0) {
      const itemsDeOC = itemRows2.filter((r) => String(r[idxItemOc] || "").trim() === ordenCorteId);

      const todosAlmacen =
        itemsDeOC.length > 0 &&
        itemsDeOC.every((r) => {
          const st = String(r[idxEstadoItem] || "").trim().toLowerCase();
          return st === "almacén" || st === "almacen";
        });

      if (todosAlmacen) {
        const { headers: ocHeaders, rows: ocRows } = await readSheetAll(sheets, SHEET_OC);

        if (ocHeaders.length > 0) {
          const idxOcId = findCol(ocHeaders, COL.ocId);
          const idxOcEstado = findCol(ocHeaders, COL.ocEstado);
          const idxOcCierre = findCol(ocHeaders, COL.ocFechaCierre);

          if (idxOcId >= 0 && idxOcEstado >= 0) {
            const ocRowIndex0 = ocRows.findIndex((r) => String(r[idxOcId] || "").trim() === ordenCorteId);
            if (ocRowIndex0 >= 0) {
              const ocRowNumber1Based = ocRowIndex0 + 2;

              const updatesOc: Array<{ colIndex0Based: number; value: any }> = [
                { colIndex0Based: idxOcEstado, value: "Almacén" },
              ];
              if (idxOcCierre >= 0) updatesOc.push({ colIndex0Based: idxOcCierre, value: fechaISO });

              await updateCells(sheets, SHEET_OC, ocRowNumber1Based, updatesOc);
              ordenCorteActualizada = true;
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      movimientoId,
      ordenCorteId,
      ordenCorteItemId,
      cantidadEntregadaUnd,
      solicitado,
      entregadoPrev,
      entregadoNuevo,
      restante: Math.max(0, solicitado - entregadoNuevo),
      completo,
      estadoItemNuevo,
      pedidosActualizado,
      pedidosWarning,
      ordenCorteActualizada,
      fechaISO,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, message: err?.message || "Error en /entregar" }, { status: 500 });
  }
}
