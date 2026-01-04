//app/api/produccion/entregas-almacen/entregar/route.ts
import { NextResponse } from "next/server";
import { getSheetsClient, getBasePrincipalRange } from "@/lib/google/googleSheets";
import { env } from "@/lib/config/env";

function headersFrom(values: any[][]): string[] {
  return (values?.[0] ?? []).map((h) => String(h ?? "").trim());
}

function colToLetter(n: number) {
  let s = "";
  while (n > 0) {
    const mod = (n - 1) % 26;
    s = String.fromCharCode(65 + mod) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function toNumber(x: any) {
  const n = Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function norm(s: any) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatBogotaDate_dd_mmm_yyyy() {
  const d = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).formatToParts(d);

  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  const month = parts.find((p) => p.type === "month")?.value ?? "Jan";
  const year = parts.find((p) => p.type === "year")?.value ?? "2000";
  return `${day}-${month}-${year}`;
}

function nowBogotaTimestamp() {
  const d = new Date();
  return d.toLocaleString("es-CO", { timeZone: "America/Bogota" });
}

function makeId(prefix: string) {
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}_${Date.now()}_${rnd}`;
}

async function readHeaders(sheet: string) {
  const headerValues = await getBasePrincipalRange(`${sheet}!1:1`);
  return headersFrom(headerValues);
}

async function readRow(sheet: string, rowIndex: number) {
  const values = await getBasePrincipalRange(`${sheet}!A${rowIndex}:ZZ${rowIndex}`);
  return values?.[0] ?? [];
}

async function updateCell(sheet: string, rowIndex: number, colIndex1Based: number, value: any) {
  const sheets = await getSheetsClient();
  const col = colToLetter(colIndex1Based);
  await sheets.spreadsheets.values.update({
    spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
    range: `${sheet}!${col}${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[value]] },
  });
}

async function appendRowByHeaders(sheet: string, data: Record<string, any>) {
  const sheets = await getSheetsClient();
  const headers = await readHeaders(sheet);
  if (!headers.length) throw new Error(`No headers for ${sheet}`);

  const row = new Array(headers.length).fill("");
  const map = new Map(headers.map((h, i) => [h, i]));
  for (const [k, v] of Object.entries(data)) {
    const idx = map.get(k);
    if (idx === undefined) continue;
    row[idx] = v ?? "";
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
    range: `${sheet}!A:ZZ`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

function rowsWithIndex(values: any[][]) {
  if (!values?.length) return { headers: [], rows: [] as any[] };
  const headers = (values[0] ?? []).map((h) => String(h ?? "").trim());
  const rows = values.slice(1).map((row, i) => {
    const obj: Record<string, any> = { rowIndex: i + 2 };
    headers.forEach((h, idx) => (obj[h] = row?.[idx] ?? ""));
    return obj;
  });
  return { headers, rows };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { source, rowIndexItem, cantidadEntregarUnd, usuario } = body ?? {};

    if (!source || !rowIndexItem || !cantidadEntregarUnd) {
      return NextResponse.json(
        { error: "Faltan datos: source, rowIndexItem, cantidadEntregarUnd" },
        { status: 400 }
      );
    }
    if (!["produccion", "corte"].includes(String(source))) {
      return NextResponse.json({ error: "source inválido" }, { status: 400 });
    }

    const user = String(usuario ?? "").trim();
    if (!user) {
      return NextResponse.json({ error: "Selecciona el usuario que entrega" }, { status: 400 });
    }

    const qty = toNumber(cantidadEntregarUnd);
    if (qty <= 0) return NextResponse.json({ error: "cantidadEntregarUnd inválida" }, { status: 400 });

    const fechaEntrega = formatBogotaDate_dd_mmm_yyyy();
    const fechaMovimiento = nowBogotaTimestamp();

    // 1) leer item
    const sheet = source === "produccion" ? "SolicitudesProduccion" : "SolicitudesCorte";
    const headers = await readHeaders(sheet);
    const row = await readRow(sheet, Number(rowIndexItem));
    if (!headers.length || !row.length) return NextResponse.json({ error: "No se pudo leer fila item" }, { status: 500 });

    const get = (name: string) => {
      const idx = headers.indexOf(name);
      return idx >= 0 ? row[idx] ?? "" : "";
    };

    const pedidoKey = String(get("pedidoKey") ?? "").trim();
    const rowIndexPedido = Number(get("rowIndexPedido") ?? "");
    const code = source === "produccion" ? String(get("OPE") ?? "").trim() : String(get("OTE") ?? "").trim();
    const producto = source === "produccion" ? String(get("productoKey") ?? "").trim() : String(get("productoSolicitado") ?? "").trim();

    const total = source === "produccion" ? toNumber(get("cantidadUND")) : toNumber(get("cantidadSolicitadaUnd"));

    const inventarioId =
      String(get("inventarioId") ?? "").trim() ||
      String(get("inventarioOrigenId") ?? "").trim() ||
      "";

    if (!pedidoKey || !rowIndexPedido || !code || total <= 0) {
      return NextResponse.json({ error: "Item sin datos clave (pedidoKey/rowIndexPedido/OPE-OTE/total)" }, { status: 400 });
    }

    // 2) calcular entregado acumulado desde historial (normalizando tipo)
    const hVals = await getBasePrincipalRange("HistorialEntregasAlmacen!A:Z");
    const hist = rowsWithIndex(hVals).rows;

    let entregado = 0;
    for (const r of hist) {
      const tipoNorm = norm(r.tipo); // "produccion" o "corte" aunque venga "Producción"
      const idx = Number(r.rowIndexItem ?? 0);
      if (tipoNorm === source && idx === Number(rowIndexItem)) {
        entregado += toNumber(r.cantidadEntregadaUnd);
      }
    }

    const pendiente = Math.max(0, total - entregado);
    if (qty > pendiente) {
      return NextResponse.json({ error: "La cantidad supera el pendiente" }, { status: 400 });
    }

    // 3) registrar historial (tipo guardado SIN tilde: "produccion"/"corte")
    await appendRowByHeaders("HistorialEntregasAlmacen", {
      entregaId: makeId("ENT"),
      timestamp: fechaMovimiento,
      tipo: source, // 👈 "produccion" | "corte" (consistente)
      referenciaOperacion: code,
      rowIndexItem: Number(rowIndexItem),
      rowIndexPedido,
      pedidoKey,
      producto,
      cantidadEntregadaUnd: qty,
      cantidadEntregadaM: "",
      almacenOrigen: source === "produccion" ? "Producción" : "Corte",
      almacenDestino: "Almacén",
      usuario: user,
      observacion: "",
    });

    // 4) registrar movimiento inventario (parcial)
    await appendRowByHeaders("MovimientosInventario", {
      movimientoId: makeId("MOV"),
      inventarioId,
      tipoMovimiento: "ENTRADA",
      cantidadUnd: qty,
      cantidadM: "",
      almacenOrigen: source === "produccion" ? "Producción" : "Corte",
      almacenDestino: "Almacén",
      pedidoKey,
      referenciaOperacion: code,
      motivo: "Entrega parcial a almacén",
      fechaMovimiento,
      usuario: user,
    });

    // 5) si completó -> actualizar estado item a Entregado Almacén
    const nuevoPendiente = Math.max(0, pendiente - qty);
    if (nuevoPendiente <= 0) {
      const estadoColName = source === "produccion" ? "estado" : "estadoitem";
      const idxEstado = headers.indexOf(estadoColName);
      if (idxEstado >= 0) {
        await updateCell(sheet, Number(rowIndexItem), idxEstado + 1, "Entregado Almacén");
      }

      // 6) Pedidos: al completar
      const pedidosHeaders = await readHeaders("Pedidos");
      const idxEstadoPedido = pedidosHeaders.indexOf("Estado");
      const idxFechaReal = pedidosHeaders.indexOf("Fecha Real Entrega Almacén");

      if (idxEstadoPedido >= 0) await updateCell("Pedidos", rowIndexPedido, idxEstadoPedido + 1, "Almacén");
      if (idxFechaReal >= 0) await updateCell("Pedidos", rowIndexPedido, idxFechaReal + 1, fechaEntrega);
    }

    return NextResponse.json({ ok: true, pendiente: nuevoPendiente }, { status: 200 });
  } catch (e) {
    console.error("[POST entregar parcial]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
