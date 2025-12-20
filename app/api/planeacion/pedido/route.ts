// app/api/planeacion/pedido/route.ts
// app/api/planeacion/pedido/route.ts
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { getSheetsClient } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

function toNum(v: unknown) {
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

type DestinoItem = "Almacén" | "Corte" | "Producción";

type ParsedKey = {
  producto: string;
  color: string;
  ancho: number;
  largo: number;
  acabados: string;
};

function parseProductoKey(key: string): ParsedKey {
  const raw = toStr(key);
  const parts = raw.split("|").map((p) => p.trim());
  return {
    producto: parts[0] || "",
    color: parts[1] || "",
    ancho: toNum(parts[2]),
    largo: toNum(parts[3]),
    acabados: parts[4] || "",
  };
}

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

    // 1) Pedidos (una sola lectura)
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

    // Filtrar filas del pedidoKey y conservar rowIndex real
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

    // Items del pedido (productoKey = columna 6 por ahora)
    const itemsBase = matches.map((m) => {
      const productoKeyItem = toStr(m.row[6]); // productoKey (por ahora)
      return {
        rowIndex1Based: m.rowIndex1Based,
        productoKey: productoKeyItem,
        producto: productoKeyItem,
        cantidadUnd: toStr(m.row[11]),
        cantidadM: toStr(m.row[12]),
      };
    });

    // 2) Inventario (una sola lectura)
    const invResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "Inventario!A:AB",
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const invValues = (invResp.data.values || []) as any[][];
    const invRows = invValues.length > 1 ? invValues.slice(1) : [];

    // Índices según estructura definida
    // A inventarioId (0)
    // B tipoInventario (1)
    // C almacen (2)
    // D productoKey (3)
    // E productoDescripcion (4)
    // F referencia (5)
    // G color (6)
    // H ancho (7)
    // I largo (8)
    // J unidadBase (9)
    // K cantidadInicialUnd (10)
    // L cantidadInicialM (11)
    // M estadoInventario (12)

    type InvRow = {
      inventarioId: string;
      tipoInventario: string;
      almacen: string;
      productoKey: string;
      productoDescripcion: string;
      color: string;
      ancho: number;
      largo: number;
      unidadBase: string;
      cantidadInicialUnd: number;
      cantidadInicialM: number;
      estadoInventario: string;
    };

    const invParsed: InvRow[] = invRows
      .map((r) => {
        const inventarioId = toStr(r[0]);
        return {
          inventarioId,
          tipoInventario: toStr(r[1]),
          almacen: toStr(r[2]),
          productoKey: toStr(r[3]),
          productoDescripcion: toStr(r[4]),
          color: toStr(r[6]),
          ancho: toNum(r[7]),
          largo: toNum(r[8]),
          unidadBase: toStr(r[9]),
          cantidadInicialUnd: toNum(r[10]),
          cantidadInicialM: toNum(r[11]),
          estadoInventario: toStr(r[12]),
        };
      })
      .filter((x) => x.inventarioId && x.productoKey);

    // 3) MovimientosInventario (una sola lectura)
    const movResp = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SHEET_BASE_PRINCIPAL_ID,
      range: "MovimientosInventario!A:L",
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const movValues = (movResp.data.values || []) as any[][];
    const movRows = movValues.length > 1 ? movValues.slice(1) : [];

    // MovimientosInventario:
    // B inventarioId (1)
    // D cantidadUnd (3)
    // E cantidadM (4)
    const movSumByInvId = new Map<string, { und: number; m: number }>();
    for (const r of movRows) {
      const invId = toStr(r[1]);
      if (!invId) continue;
      const und = toNum(r[3]);
      const m = toNum(r[4]);
      const cur = movSumByInvId.get(invId) || { und: 0, m: 0 };
      cur.und += und;
      cur.m += m;
      movSumByInvId.set(invId, cur);
    }

    // Disponible real por inventarioId = inicial + sum(movimientos)
    const disponibleByInvId = new Map<string, { und: number; m: number }>();
    for (const inv of invParsed) {
      const mv = movSumByInvId.get(inv.inventarioId) || { und: 0, m: 0 };
      const und = inv.cantidadInicialUnd + mv.und;
      const m = inv.cantidadInicialM + mv.m;
      disponibleByInvId.set(inv.inventarioId, {
        und: Math.max(0, und),
        m: Math.max(0, m),
      });
    }

    // Helper: opciones por destino
    function buildOpcionesForItem(productoKeyPedido: string, destino: DestinoItem) {
      const req = parseProductoKey(productoKeyPedido);

      // si no se puede parsear bien, no arriesgamos
      if (!req.producto) return [];

      const res: Array<{
        inventarioId: string;
        productoKey: string;
        descripcion: string;
        almacen: string;
        disponibleUnd: number;
        largo: number;
        acabados: string;
      }> = [];

      for (const inv of invParsed) {
        const disp = disponibleByInvId.get(inv.inventarioId) || { und: 0, m: 0 };
        if (disp.und <= 0) continue;

        const invKey = parseProductoKey(inv.productoKey);

        // filtro por destino
        let ok = false;

        if (destino === "Almacén") {
          // Exacto: toda la llave igual (incl acabados)
          ok = toStr(inv.productoKey) === toStr(productoKeyPedido);
        } else if (destino === "Corte") {
          // Corte: mismo producto/color/ancho, largo inv >= largo requerido, acabados NO importan
          ok =
            invKey.producto === req.producto &&
            invKey.color === req.color &&
            invKey.ancho === req.ancho &&
            invKey.largo >= req.largo;
        } else if (destino === "Producción") {
          // Por ahora: exacto (luego lo abrimos a MP/insumos)
          ok = toStr(inv.productoKey) === toStr(productoKeyPedido);
        }

        if (!ok) continue;

        res.push({
          inventarioId: inv.inventarioId,
          productoKey: inv.productoKey,
          descripcion: inv.productoDescripcion || inv.productoKey,
          almacen: inv.almacen,
          disponibleUnd: disp.und,
          largo: invKey.largo,
          acabados: invKey.acabados,
        });
      }

      // orden: más cercano primero (largo asc), y luego por disponible desc
      res.sort((a, b) => {
        if (a.largo !== b.largo) return a.largo - b.largo;
        return b.disponibleUnd - a.disponibleUnd;
      });

      return res;
    }

    // Disponible exacto = suma disponible de inventarios cuyo productoKey es exacto
    function disponibleExacto(productoKeyPedido: string) {
      let und = 0;
      let m = 0;
      for (const inv of invParsed) {
        if (toStr(inv.productoKey) !== toStr(productoKeyPedido)) continue;
        const d = disponibleByInvId.get(inv.inventarioId) || { und: 0, m: 0 };
        und += d.und;
        m += d.m;
      }
      return { und, m };
    }

    const items = itemsBase.map((it) => {
      const exact = disponibleExacto(it.productoKey);

      // opciones iniciales por defecto pensadas para "Almacén"
      // (el front recalculará/filtrará visualmente según el destino seleccionado,
      // pero devolvemos todas las listas por destino para no pegarle al API)
      const opcionesAlmacen = buildOpcionesForItem(it.productoKey, "Almacén");
      const opcionesCorte = buildOpcionesForItem(it.productoKey, "Corte");
      const opcionesProduccion = buildOpcionesForItem(it.productoKey, "Producción");

      return {
        ...it,
        inventarioDisponibleUnd: exact.und,
        inventarioDisponibleM: exact.m,
        opcionesInventario: {
          Almacén: opcionesAlmacen,
          Corte: opcionesCorte,
          Producción: opcionesProduccion,
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
        message: error instanceof Error ? error.message : "Error cargando pedido planeación",
      },
      { status: 500 }
    );
  }
}
