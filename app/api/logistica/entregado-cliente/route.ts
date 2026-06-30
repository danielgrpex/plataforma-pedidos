// app/api/logistica/entregado-cliente/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";

const SPREADSHEET_ID = process.env.SHEET_BASE_PRINCIPAL_ID;
const SHEET_PEDIDOS = "Pedidos";

function mustEnv(v: string | undefined, name: string) {
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

function safeNum(v: any) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function norm(v: any) {
  return String(v ?? "").trim();
}

function lower(v: any) {
  return norm(v).toLowerCase();
}

async function getSheets() {
  const email = mustEnv(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    "GOOGLE_SERVICE_ACCOUNT_EMAIL"
  );
  const key = mustEnv(
    process.env.GOOGLE_PRIVATE_KEY,
    "GOOGLE_PRIVATE_KEY"
  ).replace(/\\n/g, "\n");

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client as any });
}

async function readSheetAll(sheets: any, sheetName: string) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:ZZ`,
  });

  const values: any[][] = res.data.values || [];
  if (values.length === 0) {
    return { headers: [] as string[], rows: [] as any[][] };
  }

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

  for (const c of candidates) {
    const idx = hm.get(c);
    if (idx !== undefined) return idx;
  }

  const low = headers.map((h) => h.toLowerCase());
  for (const c of candidates) {
    const i = low.findIndex((h) => h.includes(String(c).toLowerCase()));
    if (i >= 0) return i;
  }

  return -1;
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
  const data = updates
    .filter((u) => u.colIndex0Based >= 0)
    .map((u) => {
      const colLetter = numToCol(u.colIndex0Based + 1);
      return {
        range: `${sheetName}!${colLetter}${rowNumber1Based}`,
        values: [[u.value ?? ""]],
      };
    });

  if (data.length === 0) return;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data,
    },
  });
}

const COL_PED = {
  pedidosKey: ["pedidosKey", "PedidosKey", "pedidoKey", "PedidoKey"],
  estado: ["Estado", "estado"],
  fechaEntregaRealCliente: [
    "Fecha Entrega Real Cliente",
    "fecha entrega real cliente",
    "Fecha entrega real cliente",
  ],
  cliente: ["Cliente", "cliente"],
  direccion: ["Dirección y ciudad de despacho", "Direccion y ciudad de despacho", "Dirección", "Direccion"],
  ordenCompra: ["Orden de Compra", "OC", "Orden Compra"],
  producto: ["Producto", "producto"],
  referencia: ["Referencia", "referencia"],
  color: ["Color", "color"],
  ancho: ["Ancho", "ancho"],
  largo: ["Largo", "largo"],
  cantidadUnd: ["Cantidad (und)", "Cantidad (Und)", "cantidadUnd", "cantidad (und)"],
  cantidadM: ["Cantidad (m)", "Cantidad M", "cantidadM", "cantidad (m)"],

  usuarioEntregaCliente: ["Usuario Entrega Cliente"],
  observacionesEntregaCliente: [
    "Observaciones Entrega Cliente",
    "Observaciones de Despacho",
  ],
  soporteEntregaUrl: ["Soporte Entrega URL"],
  soporteEntregaNombre: ["Soporte Entrega Nombre"],
  fechaCargueSoporteEntrega: ["Fecha Cargue Soporte Entrega"],
};

type ConfirmableItem = {
  pedidosKey: string;
  pedidoRowIndex: number;
  cliente?: string;
  ordenCompra?: string;
  producto?: string;
  referencia?: string;
  color?: string;
  ancho?: string;
  largo?: string;
  cantidadUnd?: number;
  cantidadM?: number;
  estado?: string;
};

type ConfirmablePedido = {
  pedidosKey: string;
  cliente?: string;
  ordenCompra?: string;
  direccion?: string;
  itemCount: number;
  rows: number[];
  totalUnd: number;
  totalM: number;
};

export async function GET() {
  try {
    mustEnv(SPREADSHEET_ID, "SHEET_BASE_PRINCIPAL_ID");
    const sheets = await getSheets();

    const { headers, rows } = await readSheetAll(sheets, SHEET_PEDIDOS);

    if (headers.length === 0) {
      return NextResponse.json(
        { success: false, message: `La hoja ${SHEET_PEDIDOS} no tiene headers` },
        { status: 500 }
      );
    }

    const iKey = findCol(headers, COL_PED.pedidosKey);
    const iEst = findCol(headers, COL_PED.estado);
    const iFechaCli = findCol(headers, COL_PED.fechaEntregaRealCliente);

    if (iKey < 0 || iEst < 0 || iFechaCli < 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No pude mapear columnas mínimas en Pedidos: pedidosKey, Estado, Fecha Entrega Real Cliente.",
        },
        { status: 500 }
      );
    }

    const iCli = findCol(headers, COL_PED.cliente);
    const iDir = findCol(headers, COL_PED.direccion);
    const iOc = findCol(headers, COL_PED.ordenCompra);
    const iProd = findCol(headers, COL_PED.producto);
    const iRef = findCol(headers, COL_PED.referencia);
    const iCol = findCol(headers, COL_PED.color);
    const iAnc = findCol(headers, COL_PED.ancho);
    const iLar = findCol(headers, COL_PED.largo);
    const iUnd = findCol(headers, COL_PED.cantidadUnd);
    const iM = findCol(headers, COL_PED.cantidadM);

    const items: ConfirmableItem[] = [];

    const grupos = new Map<
      string,
      {
        pedidosKey: string;
        cliente?: string;
        ordenCompra?: string;
        direccion?: string;
        rows: number[];
        estados: string[];
        fechasCliente: string[];
        totalUnd: number;
        totalM: number;
      }
    >();

    for (let idx0 = 0; idx0 < rows.length; idx0++) {
      const r = rows[idx0];
      const pedidosKey = norm(r[iKey]);
      if (!pedidosKey) continue;

      const rowNumber = idx0 + 2;
      const estado = norm(r[iEst]);
      const fechaCli = norm(r[iFechaCli]);

      const cantidadUnd = iUnd >= 0 ? safeNum(r[iUnd]) : 0;
      const cantidadM = iM >= 0 ? safeNum(r[iM]) : 0;

      if (!grupos.has(pedidosKey)) {
        grupos.set(pedidosKey, {
          pedidosKey,
          cliente: iCli >= 0 ? norm(r[iCli]) || undefined : undefined,
          ordenCompra: iOc >= 0 ? norm(r[iOc]) || undefined : undefined,
          direccion: iDir >= 0 ? norm(r[iDir]) || undefined : undefined,
          rows: [],
          estados: [],
          fechasCliente: [],
          totalUnd: 0,
          totalM: 0,
        });
      }

      const g = grupos.get(pedidosKey)!;
      g.rows.push(rowNumber);
      g.estados.push(estado);
      g.fechasCliente.push(fechaCli);
      g.totalUnd += cantidadUnd;
      g.totalM += cantidadM;

      const esDespachado = lower(estado) === "despachado";

      if (esDespachado && !fechaCli) {
        items.push({
          pedidosKey,
          pedidoRowIndex: rowNumber,
          cliente: iCli >= 0 ? norm(r[iCli]) || undefined : undefined,
          ordenCompra: iOc >= 0 ? norm(r[iOc]) || undefined : undefined,
          producto: iProd >= 0 ? norm(r[iProd]) || undefined : undefined,
          referencia: iRef >= 0 ? norm(r[iRef]) || undefined : undefined,
          color: iCol >= 0 ? norm(r[iCol]) || undefined : undefined,
          ancho: iAnc >= 0 ? norm(r[iAnc]) || undefined : undefined,
          largo: iLar >= 0 ? norm(r[iLar]) || undefined : undefined,
          cantidadUnd,
          cantidadM,
          estado: estado || undefined,
        });
      }
    }

    const pedidosCompletos: ConfirmablePedido[] = [];

    for (const g of grupos.values()) {
      const todosDespachados =
        g.estados.length > 0 && g.estados.every((e) => lower(e) === "despachado");

      const ningunoTieneFechaEntrega =
        g.fechasCliente.every((f) => !norm(f));

      if (todosDespachados && ningunoTieneFechaEntrega) {
        pedidosCompletos.push({
          pedidosKey: g.pedidosKey,
          cliente: g.cliente,
          ordenCompra: g.ordenCompra,
          direccion: g.direccion,
          itemCount: g.rows.length,
          rows: g.rows,
          totalUnd: g.totalUnd,
          totalM: g.totalM,
        });
      }
    }

    items.sort((a, b) => a.pedidoRowIndex - b.pedidoRowIndex);
    pedidosCompletos.sort((a, b) => a.rows[0] - b.rows[0]);

    return NextResponse.json({
      success: true,
      count: items.length,
      items,
      pedidosCompletosCount: pedidosCompletos.length,
      pedidosCompletos,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Error en GET /logistica/entregado-cliente",
      },
      { status: 500 }
    );
  }
}

type Body = {
  modo?: "item" | "pedidoCompleto";
  usuario: string;
  pedidosKey: string;
  pedidoRowIndex?: number;
  fechaConfirmadaCliente: string;
  observaciones?: string;
  soporteEntregaUrl?: string;
  soporteEntregaNombre?: string;
};

function normalizarFecha(fechaRaw: string) {
  let fechaGuardar = fechaRaw;

  const d = new Date(fechaRaw);
  if (!Number.isNaN(d.getTime()) && fechaRaw.includes("T")) {
    fechaGuardar = d.toISOString();
  }

  return fechaGuardar;
}

export async function POST(req: Request) {
  try {
    mustEnv(SPREADSHEET_ID, "SHEET_BASE_PRINCIPAL_ID");
    const sheets = await getSheets();

    const body = (await req.json()) as Partial<Body>;

    const modo = body.modo || "item";
    const usuario = norm(body.usuario);
    const pedidosKey = norm(body.pedidosKey);
    const pedidoRowIndex = Math.floor(safeNum(body.pedidoRowIndex));
    const fechaConfirmadaClienteRaw = norm(body.fechaConfirmadaCliente);
    const observaciones = norm(body.observaciones);
    const soporteEntregaUrl = norm(body.soporteEntregaUrl);
    const soporteEntregaNombre = norm(body.soporteEntregaNombre);

    if (!usuario) {
      return NextResponse.json(
        { success: false, message: "Falta usuario" },
        { status: 400 }
      );
    }

    if (!pedidosKey) {
      return NextResponse.json(
        { success: false, message: "Falta pedidosKey" },
        { status: 400 }
      );
    }

    if (!fechaConfirmadaClienteRaw) {
      return NextResponse.json(
        { success: false, message: "Falta fechaConfirmadaCliente" },
        { status: 400 }
      );
    }

    const fechaGuardar = normalizarFecha(fechaConfirmadaClienteRaw);

    const { headers, rows } = await readSheetAll(sheets, SHEET_PEDIDOS);

    if (headers.length === 0) {
      return NextResponse.json(
        { success: false, message: `La hoja ${SHEET_PEDIDOS} no tiene headers` },
        { status: 500 }
      );
    }

    const iKey = findCol(headers, COL_PED.pedidosKey);
    const iEst = findCol(headers, COL_PED.estado);
    const iFechaCli = findCol(headers, COL_PED.fechaEntregaRealCliente);

    const iUsuarioEntrega = findCol(headers, COL_PED.usuarioEntregaCliente);
    const iObsEntrega = findCol(headers, COL_PED.observacionesEntregaCliente);
    const iSoporteUrl = findCol(headers, COL_PED.soporteEntregaUrl);
    const iSoporteNombre = findCol(headers, COL_PED.soporteEntregaNombre);
    const iFechaCargueSoporte = findCol(headers, COL_PED.fechaCargueSoporteEntrega);

    if (iKey < 0 || iEst < 0 || iFechaCli < 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No pude mapear columnas mínimas en Pedidos: pedidosKey, Estado, Fecha Entrega Real Cliente.",
        },
        { status: 500 }
      );
    }

    const fechaCargueSoporte = soporteEntregaUrl ? new Date().toISOString() : "";

    const baseUpdates = [
      { colIndex0Based: iEst, value: "Entregado" },
      { colIndex0Based: iFechaCli, value: fechaGuardar },
      { colIndex0Based: iUsuarioEntrega, value: usuario },
      { colIndex0Based: iObsEntrega, value: observaciones },
      { colIndex0Based: iSoporteUrl, value: soporteEntregaUrl },
      { colIndex0Based: iSoporteNombre, value: soporteEntregaNombre },
      { colIndex0Based: iFechaCargueSoporte, value: fechaCargueSoporte },
    ];

    if (modo === "pedidoCompleto") {
      const rowsDelPedido: number[] = [];

      for (let idx0 = 0; idx0 < rows.length; idx0++) {
        const r = rows[idx0];
        const pk = norm(r[iKey]);

        if (pk === pedidosKey) {
          rowsDelPedido.push(idx0 + 2);
        }
      }

      if (rowsDelPedido.length === 0) {
        return NextResponse.json(
          { success: false, message: "No encontré filas para ese pedido." },
          { status: 404 }
        );
      }

      const filasNoDespachadas: number[] = [];

      for (const rowNumber of rowsDelPedido) {
        const idx0 = rowNumber - 2;
        const estado = norm(rows[idx0][iEst]);

        if (lower(estado) !== "despachado") {
          filasNoDespachadas.push(rowNumber);
        }
      }

      if (filasNoDespachadas.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message:
              "No se puede confirmar el pedido completo porque hay ítems que todavía no están en estado Despachado.",
            filasNoDespachadas,
          },
          { status: 400 }
        );
      }

      for (const rowNumber of rowsDelPedido) {
        await updateCells(sheets, SHEET_PEDIDOS, rowNumber, baseUpdates);
      }

      return NextResponse.json({
        success: true,
        modo: "pedidoCompleto",
        pedidosKey,
        filasActualizadas: rowsDelPedido.length,
        rows: rowsDelPedido,
        estadoNuevo: "Entregado",
        fechaEntregaRealCliente: fechaGuardar,
        soporteEntregaUrl: soporteEntregaUrl || undefined,
      });
    }

    if (!pedidoRowIndex || pedidoRowIndex <= 1) {
      return NextResponse.json(
        {
          success: false,
          message: "pedidoRowIndex inválido. Debe ser la fila real en Pedidos.",
        },
        { status: 400 }
      );
    }

    const idx0 = pedidoRowIndex - 2;

    if (idx0 < 0 || idx0 >= rows.length) {
      return NextResponse.json(
        {
          success: false,
          message: `pedidoRowIndex fuera de rango. Recibí ${pedidoRowIndex}`,
        },
        { status: 400 }
      );
    }

    const pkEnFila = norm(rows[idx0][iKey]);

    if (pkEnFila !== pedidosKey) {
      return NextResponse.json(
        {
          success: false,
          message: `La fila ${pedidoRowIndex} no coincide con pedidosKey. En la fila encontré: ${pkEnFila}`,
        },
        { status: 400 }
      );
    }

    const estadoActual = norm(rows[idx0][iEst]);

    if (lower(estadoActual) !== "despachado") {
      return NextResponse.json(
        {
          success: false,
          message: `Este ítem no está en estado Despachado. Estado actual: ${estadoActual}`,
        },
        { status: 400 }
      );
    }

    await updateCells(sheets, SHEET_PEDIDOS, pedidoRowIndex, baseUpdates);

    return NextResponse.json({
      success: true,
      modo: "item",
      pedidosKey,
      pedidoRowIndex,
      estadoNuevo: "Entregado",
      fechaEntregaRealCliente: fechaGuardar,
      soporteEntregaUrl: soporteEntregaUrl || undefined,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Error en POST /logistica/entregado-cliente",
      },
      { status: 500 }
    );
  }
}