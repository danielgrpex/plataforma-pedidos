// app/api/comercial/pedidos/detalle/route.ts
import { NextResponse } from "next/server";
import { getBasePrincipalRange } from "@/lib/google/googleSheets";

export const runtime = "nodejs";

function toStr(v: unknown) {
  return String(v ?? "").trim();
}

function headerMap(headers: string[]) {
  const m = new Map<string, number>();
  headers.forEach((h, i) => m.set(toStr(h), i));
  return m;
}

function findCol(headers: string[], candidates: string[], fallbackIndex = -1) {
  const hm = headerMap(headers);

  for (const c of candidates) {
    const idx = hm.get(c);
    if (idx !== undefined) return idx;
  }

  const low = headers.map((h) => h.toLowerCase());

  for (const c of candidates) {
    const i = low.findIndex((h) => h.includes(c.toLowerCase()));
    if (i >= 0) return i;
  }

  return fallbackIndex;
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

    // Antes estaba en A:AM.
    // Ahora leemos más columnas porque agregamos soporte de entrega al final.
    const values = await getBasePrincipalRange("Pedidos!A:ZZ");

    if (!values || values.length === 0) {
      return NextResponse.json(
        { success: false, message: "No hay datos en la hoja Pedidos" },
        { status: 404 }
      );
    }

    const headers = (values[0] || []).map((h) => toStr(h));
    const dataRows = values.slice(1);

    const c = {
      consecutivo: findCol(headers, ["Consecutivo"], 0),
      fechaSolicitud: findCol(headers, ["Fecha de Solicitud"], 1),
      asesor: findCol(headers, ["Asesor Comercial"], 2),
      cliente: findCol(headers, ["Cliente"], 3),
      direccion: findCol(
        headers,
        ["Dirección y ciudad de despacho", "Direccion y ciudad de despacho", "Dirección", "Direccion"],
        4
      ),
      oc: findCol(headers, ["Orden de Compra", "OC"], 5),
      producto: findCol(headers, ["Producto"], 6),
      cantidadUnd: findCol(headers, ["Cantidad (und)", "Cantidad (Und)"], 11),
      cantidadM: findCol(headers, ["Cantidad (m)", "Cantidad M"], 12),
      precioUnitario: findCol(headers, ["Precio Unitario"], 14),
      fechaRequerida: findCol(headers, ["Fecha Requerida Cliente"], 15),
      obsComerciales: findCol(headers, ["Observaciones Comerciales"], 16),
      estado: findCol(headers, ["Estado"], 23),

      fechaEstimadaEntregaAlmacen: findCol(headers, ["Fecha Estimada Entrega Almacén", "Fecha Estimada Entrega Almacen"], 24),
      fechaRealEntregaAlmacen: findCol(headers, ["Fecha Real Entrega Almacén", "Fecha Real Entrega Almacen"], 25),
      fechaEstimadaDespacho: findCol(headers, ["Fecha Estimada Despacho"], 26),
      fechaRealDespacho: findCol(headers, ["Fecha Real Despacho"], 27),

      transporte: findCol(headers, ["Transporte"], 28),
      guia: findCol(headers, ["Guia", "Guía"], 30),
      factura: findCol(headers, ["Factura"], 31),
      remision: findCol(headers, ["Remision", "Remisión"], 32),
      fechaEntregaRealCliente: findCol(headers, ["Fecha Entrega Real Cliente"], 33),

      observacionesDespacho: findCol(headers, ["Observaciones de Despacho"], 34),
      pdfPath: findCol(headers, ["drive_folder_link", "pdfPath"], 35),
      createdBy: findCol(headers, ["created_by", "Creado por"], 36),
      pedidoKey: findCol(headers, ["pedidoKey", "pedidosKey", "PedidoKey", "PedidosKey"], 37),
      pedidoId: findCol(headers, ["pedidosId", "pedidoId"], 38),

      usuarioEntregaCliente: findCol(headers, ["Usuario Entrega Cliente"], 39),
      observacionesEntregaCliente: findCol(headers, ["Observaciones Entrega Cliente"], -1),
      soporteEntregaUrl: findCol(headers, ["Soporte Entrega URL"], -1),
      soporteEntregaNombre: findCol(headers, ["Soporte Entrega Nombre"], -1),
      fechaCargueSoporteEntrega: findCol(headers, ["Fecha Cargue Soporte Entrega"], -1),
    };

    if (c.pedidoKey < 0) {
      return NextResponse.json(
        { success: false, message: "No pude encontrar la columna pedidoKey en la hoja Pedidos." },
        { status: 500 }
      );
    }

    const rows = dataRows.filter((r) => toStr(r?.[c.pedidoKey]) === pedidoKey);

    if (!rows.length) {
      return NextResponse.json(
        { success: false, message: `No se encontró el pedido con pedidoKey: ${pedidoKey}` },
        { status: 404 }
      );
    }

    const first = rows[0];

    const items = rows.map((r) => {
      const observacionesEntregaCliente =
        c.observacionesEntregaCliente >= 0
          ? toStr(r[c.observacionesEntregaCliente])
          : toStr(r[c.observacionesDespacho]);

      return {
        // Base
        producto: toStr(r[c.producto]),
        cantidadUnd: toStr(r[c.cantidadUnd]),
        cantidadM: toStr(r[c.cantidadM]),
        estadoItem: toStr(r[c.estado]),

        // Fechas
        fechaEstimadaEntregaAlmacen: toStr(r[c.fechaEstimadaEntregaAlmacen]),
        fechaRealEntregaAlmacen: toStr(r[c.fechaRealEntregaAlmacen]),
        fechaEstimadaDespacho: toStr(r[c.fechaEstimadaDespacho]),
        fechaRealDespacho: toStr(r[c.fechaRealDespacho]),
        fechaEntregaRealCliente: toStr(r[c.fechaEntregaRealCliente]),

        // Despacho
        transporte: toStr(r[c.transporte]),
        guia: toStr(r[c.guia]),
        factura: toStr(r[c.factura]),
        remision: toStr(r[c.remision]),

        // Soporte entrega cliente
        soporteEntregaUrl: c.soporteEntregaUrl >= 0 ? toStr(r[c.soporteEntregaUrl]) : "",
        soporteEntregaNombre: c.soporteEntregaNombre >= 0 ? toStr(r[c.soporteEntregaNombre]) : "",
        fechaCargueSoporteEntrega:
          c.fechaCargueSoporteEntrega >= 0 ? toStr(r[c.fechaCargueSoporteEntrega]) : "",
        usuarioEntregaCliente:
          c.usuarioEntregaCliente >= 0 ? toStr(r[c.usuarioEntregaCliente]) : "",
        observacionesEntregaCliente,

        // Valores
        precioUnitario: toStr(r[c.precioUnitario]),
      };
    });

    const itemConSoporte = items.find((it) => it.soporteEntregaUrl);

    const pedido = {
      pedidoKey: toStr(first[c.pedidoKey]),
      pedidoId: c.pedidoId >= 0 ? toStr(first[c.pedidoId]) : "",

      consecutivo: toStr(first[c.consecutivo]),
      fechaSolicitud: toStr(first[c.fechaSolicitud]),
      asesor: toStr(first[c.asesor]),
      cliente: toStr(first[c.cliente]),
      direccion: toStr(first[c.direccion]),
      oc: toStr(first[c.oc]),
      fechaRequerida: toStr(first[c.fechaRequerida]),
      obsComerciales: toStr(first[c.obsComerciales]),
      estado: toStr(first[c.estado]),
      pdfPath: toStr(first[c.pdfPath]),
      createdBy: toStr(first[c.createdBy]),

      // Soporte a nivel pedido.
      // Si el pedido completo fue confirmado, normalmente todas las filas tendrán el mismo soporte.
      soporteEntregaUrl: itemConSoporte?.soporteEntregaUrl || "",
      soporteEntregaNombre: itemConSoporte?.soporteEntregaNombre || "",
      fechaCargueSoporteEntrega: itemConSoporte?.fechaCargueSoporteEntrega || "",
      usuarioEntregaCliente: itemConSoporte?.usuarioEntregaCliente || "",
      observacionesEntregaCliente: itemConSoporte?.observacionesEntregaCliente || "",

      items,
    };

    return NextResponse.json({ success: true, pedido });
  } catch (error) {
    console.error("[pedidos/detalle]", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error cargando detalle",
      },
      { status: 500 }
    );
  }
}