// app/api/planeacion/pedido/route.ts
// app/api/planeacion/pedido/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

function norm(v: unknown) {
  return toStr(v).toLowerCase();
}

/** Convierte "4 cm" -> 4, "0,992 m" -> 0.992, "1.285" -> 1.285, "9.258,50" -> 9258.5 */
function toNum(v: unknown) {
  if (v === null || v === undefined || v === "") return 0;

  let s = String(v).trim();

  // deja solo números + separadores
  s = s.replace(/\s|\u00A0/g, "");
  s = s.replace(/[^\d.,-]/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // 9.258,50 -> 9258.50
    s = s.replace(/\./g, "");
    s = s.replace(/,/g, ".");
  } else if (hasComma) {
    s = s.replace(/,/g, ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function buildHeaderIndex(headerRow: any[]) {
  const idx = new Map<string, number>();
  headerRow.forEach((h, i) => {
    const k = norm(h);
    if (k) idx.set(k, i);
  });
  return idx;
}

function pick(row: any[], idx: Map<string, number>, col: string) {
  const i = idx.get(col.toLowerCase());
  return i === undefined ? "" : row[i];
}

type DestinoItem = "Almacén" | "Corte" | "Producción";

type ParsedPedidoKey = {
  referencia: string;
  color: string;
  ancho: number;
  largo: number;
  acabados: string;
};

function parseProductoPedido(productoTexto: string): ParsedPedidoKey {
  // productoTexto viene como:
  // "Referencia | Color | 4 cm | 0,992 m | Marca, Perforaciones"
  const parts = toStr(productoTexto)
    .split("|")
    .map((p) => p.trim());

  return {
    referencia: parts[0] || "",
    color: parts[1] || "",
    ancho: toNum(parts[2] || ""),
    largo: toNum(parts[3] || ""),
    acabados: parts[4] || "",
  };
}

type InvRow = {
  inventarioId: string;
  tipoInventario: string;
  almacen: string;

  productoKey: string;
  productoDescripcion: string;

  referencia: string;
  color: string;
  ancho: number;
  largo: number;
  acabados: string;

  unidadBase: string;
  cantidadInicialUnd: number;
  cantidadInicialM: number;

  estadoInventario: string;
};

type OpcionInv = {
  inventarioId: string;
  almacen?: string;
  productoTexto?: string;
  descripcion?: string;
  disponibleUnd?: number;
  disponibleM?: number;
  largo?: number;
  acabados?: string;
  match?: "EXACTO" | "COMPATIBLE";
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pedidoKey = toStr(searchParams.get("pedidoKey"));

    if (!pedidoKey) {
      return NextResponse.json(
        { success: false, message: "pedidoKey es requerido" },
        { status: 400 }
      );
    }

    const sheets = await getSheetsClient();

    /* =========================
       1) PEDIDOS
    ========================= */
    const pedResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "Pedidos!A:AM",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const pedValues = (pedResp.data.values || []) as any[][];
    if (pedValues.length <= 1) {
      return NextResponse.json(
        { success: false, message: "No hay datos en Pedidos" },
        { status: 404 }
      );
    }

    const pedData = pedValues.slice(1);

    const matches: Array<{ rowIndex1Based: number; row: any[] }> = [];
    pedData.forEach((r, i) => {
      if (toStr(r[37]) === pedidoKey) {
        matches.push({ rowIndex1Based: i + 2, row: r });
      }
    });

    if (!matches.length) {
      return NextResponse.json(
        { success: false, message: "Pedido no encontrado" },
        { status: 404 }
      );
    }

    const first = matches[0].row;

    const itemsBase = matches.map((m) => {
      const producto = toStr(m.row[6]); // Col 7: "producto" armado con | |
      return {
        rowIndex1Based: m.rowIndex1Based,
        productoKey: producto, // para ti "productoKey" realmente es el texto producto
        producto,
        cantidadUnd: toStr(m.row[11]),
        cantidadM: toStr(m.row[12]),
      };
    });

    /* =========================
       2) INVENTARIO (por headers)
    ========================= */
    const invResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "Inventario!A:Z",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const invValues = (invResp.data.values || []) as any[][];
    const invHeader = invValues[0] || [];
    const invIdx = buildHeaderIndex(invHeader);
    const invRows = invValues.length > 1 ? invValues.slice(1) : [];

    const invParsed: InvRow[] = invRows
      .map((r) => {
        const inventarioId = toStr(pick(r, invIdx, "inventarioId"));
        return {
          inventarioId,
          tipoInventario: toStr(pick(r, invIdx, "tipoInventario")),
          almacen: toStr(pick(r, invIdx, "almacen")),
          productoKey: toStr(pick(r, invIdx, "productoKey")),
          productoDescripcion: toStr(pick(r, invIdx, "productoDescripcion")),
          referencia: toStr(pick(r, invIdx, "referencia")),
          color: toStr(pick(r, invIdx, "color")),
          ancho: toNum(pick(r, invIdx, "ancho")),
          largo: toNum(pick(r, invIdx, "largo")),
          acabados: toStr(pick(r, invIdx, "acabados")),
          unidadBase: toStr(pick(r, invIdx, "unidadBase")),
          cantidadInicialUnd: toNum(pick(r, invIdx, "cantidadInicialUnd")),
          cantidadInicialM: toNum(pick(r, invIdx, "cantidadInicialM")),
          estadoInventario: toStr(pick(r, invIdx, "estadoInventario")),
        };
      })
      .filter((x) => x.inventarioId)
      .filter((x) => {
        const st = norm(x.estadoInventario);
        if (st.includes("consumido")) return false;
        if (st.includes("no conforme")) return false;
        // si en tu hoja existe "Disponible" como estado, filtramos a eso
        if (st && st.includes("disponible") === false) return false;
        return true;
      });

    /* =========================
       3) MOVIMIENTOS (por headers)
    ========================= */
    const movResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "MovimientosInventario!A:Z",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const movValues = (movResp.data.values || []) as any[][];
    const movHeader = movValues[0] || [];
    const movIdx = buildHeaderIndex(movHeader);
    const movRows = movValues.length > 1 ? movValues.slice(1) : [];

    const movSumByInvId = new Map<string, { und: number; m: number }>();
    for (const r of movRows) {
      const invId = toStr(pick(r, movIdx, "inventarioId"));
      if (!invId) continue;

      const und = toNum(pick(r, movIdx, "cantidadUnd"));
      const m = toNum(pick(r, movIdx, "cantidadM"));

      const cur = movSumByInvId.get(invId) || { und: 0, m: 0 };
      cur.und += und;
      cur.m += m;
      movSumByInvId.set(invId, cur);
    }

    /* =========================
       4) AJUSTES (por headers)
    ========================= */
    const adjResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "AjustesInventario!A:Z",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const adjValues = (adjResp.data.values || []) as any[][];
    const adjHeader = adjValues[0] || [];
    const adjIdx = buildHeaderIndex(adjHeader);
    const adjRows = adjValues.length > 1 ? adjValues.slice(1) : [];

    const adjExtra = new Map<string, { und: number; m: number }>();
    for (const r of adjRows) {
      const invId = toStr(pick(r, adjIdx, "inventarioId"));
      if (!invId) continue;

      const movimientoId = toStr(pick(r, adjIdx, "movimientoId"));
      if (movimientoId) continue; // evita doble conteo

      const und = toNum(pick(r, adjIdx, "cantidadAjusteUnd"));
      const m = toNum(pick(r, adjIdx, "cantidadAjusteM"));

      const cur = adjExtra.get(invId) || { und: 0, m: 0 };
      cur.und += und;
      cur.m += m;
      adjExtra.set(invId, cur);
    }

    /* =========================
       5) DISPONIBLE REAL POR LOTE
    ========================= */
    const disponibleByInvId = new Map<string, { und: number; m: number }>();
    for (const inv of invParsed) {
      const mv = movSumByInvId.get(inv.inventarioId) || { und: 0, m: 0 };
      const ad = adjExtra.get(inv.inventarioId) || { und: 0, m: 0 };

      const und = inv.cantidadInicialUnd + mv.und + ad.und;
      const m = inv.cantidadInicialM + mv.m + ad.m;

      disponibleByInvId.set(inv.inventarioId, {
        und: Math.max(0, und),
        m: Math.max(0, m),
      });
    }

    /* =========================
       6) OPCIONES POR DESTINO
    ========================= */
    function isExactMatch(req: ParsedPedidoKey, inv: InvRow) {
      const acabReq = norm(req.acabados);
      const acabInv = norm(inv.acabados);

      return (
        norm(inv.referencia) === norm(req.referencia) &&
        norm(inv.color) === norm(req.color) &&
        inv.ancho === req.ancho &&
        inv.largo === req.largo &&
        // exacto exige acabados iguales (si tu pedido dice "Sin acabados", debe matchear vacío o "Sin acabados")
        (acabReq === acabInv ||
          (acabReq.includes("sin acabados") && (acabInv === "" || acabInv.includes("sin acabados"))))
      );
    }

    function isCompatibleMatch(req: ParsedPedidoKey, inv: InvRow) {
      return (
        norm(inv.referencia) === norm(req.referencia) &&
        norm(inv.color) === norm(req.color) &&
        inv.ancho === req.ancho &&
        inv.largo >= req.largo
      );
    }

    function buildOpcionesForItem(productoPedidoTexto: string, destino: DestinoItem): OpcionInv[] {
      // Producción: por ahora NO inventario
      if (destino === "Producción") return [];

      const req = parseProductoPedido(productoPedidoTexto);
      if (!req.referencia) return [];

      const out: OpcionInv[] = [];

      for (const inv of invParsed) {
        const disp = disponibleByInvId.get(inv.inventarioId) || { und: 0, m: 0 };
        if (disp.und <= 0 && disp.m <= 0) continue;

        let ok = false;
        let matchType: "EXACTO" | "COMPATIBLE" = "COMPATIBLE";

        if (destino === "Almacén") {
          ok = isExactMatch(req, inv);
          matchType = "EXACTO";
        } else if (destino === "Corte") {
          ok = isCompatibleMatch(req, inv);
          matchType = "COMPATIBLE";
        }

        if (!ok) continue;

        out.push({
          inventarioId: inv.inventarioId,
          almacen: inv.almacen,
          descripcion: inv.productoDescripcion || inv.productoKey || inv.referencia,
          productoTexto: `${inv.referencia} | ${inv.color} | ${inv.ancho} cm | ${inv.largo} m`,
          disponibleUnd: disp.und,
          disponibleM: disp.m,
          largo: inv.largo,
          acabados: inv.acabados,
          match: matchType,
        });
      }

      // 🔥 clave: ordena por largo asc (más cercano al requerido), luego disponible desc
      out.sort((a, b) => {
        const la = a.largo ?? 0;
        const lb = b.largo ?? 0;
        if (la !== lb) return la - lb;
        return (b.disponibleUnd ?? 0) - (a.disponibleUnd ?? 0);
      });

      return out;
    }

    function disponibleExacto(productoPedidoTexto: string) {
      const req = parseProductoPedido(productoPedidoTexto);
      let und = 0;
      let m = 0;

      for (const inv of invParsed) {
        if (!isExactMatch(req, inv)) continue;
        const d = disponibleByInvId.get(inv.inventarioId) || { und: 0, m: 0 };
        und += d.und;
        m += d.m;
      }
      return { und, m };
    }

    const items = itemsBase.map((it) => {
      const exact = disponibleExacto(it.producto);

      return {
        ...it,
        inventarioDisponibleUnd: exact.und,
        inventarioDisponibleM: exact.m,
        opcionesInventario: {
          Almacén: buildOpcionesForItem(it.producto, "Almacén"),
          Corte: buildOpcionesForItem(it.producto, "Corte"),
          Producción: [], // ✅ tal cual pediste
        },
      };
    });

    const pedido = {
      pedidoKey,
      consecutivo: toStr(first[0]),
      fechaSolicitud: toStr(first[1]),
      asesor: toStr(first[2]),
      cliente: toStr(first[3]),
      direccion: toStr(first[4]),
      oc: toStr(first[5]),
      fechaRequerida: toStr(first[15]),
      clasificacionPlaneacion: toStr(first[19]),
      observacionesPlaneacion: toStr(first[20]),
      revisadoPlaneacion: toStr(first[21]),
      fechaRevisionPlaneacion: toStr(first[22]),
      estadoPlaneacion: toStr(first[23]),
      items,
    };

    return NextResponse.json({ success: true, pedido });
  } catch (error) {
    console.error("[planeacion/pedido]", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Error cargando pedido planeación",
      },
      { status: 500 }
    );
  }
}
