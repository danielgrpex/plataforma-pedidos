import { NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SPREADSHEET_ID = process.env.SHEET_BASE_PRINCIPAL_ID;

const SHEET_PEDIDOS = "Pedidos";
const SHEET_DESPACHOS = "Despachos";
const SHEET_SECUENCIA = "SecuenciaDespachos";

function mustEnv(v: string | undefined, name: string) {
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

function norm(v: any) {
  return String(v ?? "").trim();
}

function lower(v: any) {
  return norm(v).toLowerCase();
}

function safeNum(v: any) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function dateOnly(value: any) {
  const raw = norm(value);
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);

  return d.toISOString().slice(0, 10);
}

function headerMap(headers: string[]) {
  const m = new Map<string, number>();
  headers.forEach((h, i) => m.set(norm(h), i));
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
    const i = low.findIndex((h) => h.includes(c.toLowerCase()));
    if (i >= 0) return i;
  }

  return -1;
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

  const headers = (values[0] || []).map((h) => norm(h));
  const rows = values.slice(1);

  return { headers, rows };
}

const COL_SEC = {
  posicion: ["Posición", "Posicion", "posicion"],
  pedidosKey: ["PedidosKey", "pedidosKey", "PedidoKey", "pedidoKey"],
  cliente: ["Cliente", "cliente"],
  direccion: ["Dirección", "Direccion", "direccion"],
  oc: ["OC", "Orden de Compra", "Orden Compra", "oc"],
  prioridadManual: ["Prioridad Manual", "prioridadManual"],
  estado: ["Estado", "estado"],
  programadoPor: ["Programado por", "Programado Por", "programadoPor"],
  fechaProgramacion: ["Fecha Programación", "Fecha Programacion", "fechaProgramacion"],
  fechaEstimadaDespacho: ["Fecha Estimada Despacho", "fechaEstimadaDespacho"],
};

const COL_DESP = {
  fecha: ["fechaDespacho", "FechaDespacho", "fechaMovimiento", "fechaMovimientoISO", "fecha", "Fecha"],
  pedidosKey: ["pedidosKey", "PedidosKey", "pedidoKey", "PedidoKey"],
  pedidoRowIndex: ["pedidoRowIndex", "PedidoRowIndex", "rowIndex", "RowIndex"],
  cantidadUnd: ["cantidadUnd", "cantidadDespachadaUnd", "CantidadUnd", "CantidadDespachadaUnd", "cantidad"],
  usuario: ["usuario", "Usuario"],
  transporte: ["transporte", "Transporte"],
  guia: ["guia", "Guia", "guía", "Guía"],
  factura: ["factura", "Factura"],
  remision: ["remision", "Remision", "remisión", "Remisión"],
};

const COL_PED = {
  pedidosKey: ["pedidosKey", "PedidosKey", "pedidoKey", "PedidoKey"],
  consecutivo: ["Consecutivo", "consecutivo"],
  cliente: ["Cliente", "cliente"],
  direccion: [
    "Dirección y ciudad de despacho",
    "Direccion y ciudad de despacho",
    "Dirección",
    "Direccion",
  ],
  oc: ["Orden de Compra", "Orden Compra", "OC", "oc"],
  estado: ["Estado", "estado"],
};

type SecItem = {
  posicion: number;
  pedidosKey: string;
  cliente: string;
  direccion: string;
  oc: string;
  prioridadManual: string;
  estado: string;
  programadoPor: string;
  fechaProgramacion: string;
  fechaEstimadaDespacho: string;
};

type PedidoMeta = {
  pedidosKey: string;
  consecutivo: string;
  cliente: string;
  direccion: string;
  oc: string;
  estado: string;
};

export async function GET(req: Request) {
  try {
    mustEnv(SPREADSHEET_ID, "SHEET_BASE_PRINCIPAL_ID");

    const url = new URL(req.url);
    const fecha = norm(url.searchParams.get("fecha")) || todayISO();

    const sheets = await getSheets();

    const [
      { headers: secH, rows: secR },
      { headers: desH, rows: desR },
      { headers: pedH, rows: pedR },
    ] = await Promise.all([
      readSheetAll(sheets, SHEET_SECUENCIA),
      readSheetAll(sheets, SHEET_DESPACHOS),
      readSheetAll(sheets, SHEET_PEDIDOS),
    ]);

    if (!secH.length) {
      return NextResponse.json(
        { success: false, message: "La hoja SecuenciaDespachos no tiene encabezados." },
        { status: 500 }
      );
    }

    if (!desH.length) {
      return NextResponse.json(
        { success: false, message: "La hoja Despachos no tiene encabezados." },
        { status: 500 }
      );
    }

    if (!pedH.length) {
      return NextResponse.json(
        { success: false, message: "La hoja Pedidos no tiene encabezados." },
        { status: 500 }
      );
    }

    const sPos = findCol(secH, COL_SEC.posicion);
    const sKey = findCol(secH, COL_SEC.pedidosKey);
    const sCli = findCol(secH, COL_SEC.cliente);
    const sDir = findCol(secH, COL_SEC.direccion);
    const sOc = findCol(secH, COL_SEC.oc);
    const sPri = findCol(secH, COL_SEC.prioridadManual);
    const sEst = findCol(secH, COL_SEC.estado);
    const sProg = findCol(secH, COL_SEC.programadoPor);
    const sFechaProg = findCol(secH, COL_SEC.fechaProgramacion);
    const sFechaEst = findCol(secH, COL_SEC.fechaEstimadaDespacho);

    const dFecha = findCol(desH, COL_DESP.fecha);
    const dKey = findCol(desH, COL_DESP.pedidosKey);
    const dCant = findCol(desH, COL_DESP.cantidadUnd);
    const dUser = findCol(desH, COL_DESP.usuario);
    const dTrans = findCol(desH, COL_DESP.transporte);
    const dGuia = findCol(desH, COL_DESP.guia);
    const dFact = findCol(desH, COL_DESP.factura);
    const dRem = findCol(desH, COL_DESP.remision);

    const pKey = findCol(pedH, COL_PED.pedidosKey);
    const pCon = findCol(pedH, COL_PED.consecutivo);
    const pCli = findCol(pedH, COL_PED.cliente);
    const pDir = findCol(pedH, COL_PED.direccion);
    const pOc = findCol(pedH, COL_PED.oc);
    const pEst = findCol(pedH, COL_PED.estado);

    if (sPos < 0 || sKey < 0 || sEst < 0 || sFechaEst < 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Faltan columnas mínimas en SecuenciaDespachos: Posición, PedidosKey, Estado, Fecha Estimada Despacho.",
        },
        { status: 500 }
      );
    }

    if (dFecha < 0 || dKey < 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Faltan columnas mínimas en Despachos: fecha y pedidosKey.",
        },
        { status: 500 }
      );
    }

    if (pKey < 0) {
      return NextResponse.json(
        { success: false, message: "No pude encontrar pedidoKey en Pedidos." },
        { status: 500 }
      );
    }

    const pedidosMeta = new Map<string, PedidoMeta>();

    for (const r of pedR) {
      const key = norm(r[pKey]);
      if (!key || pedidosMeta.has(key)) continue;

      pedidosMeta.set(key, {
        pedidosKey: key,
        consecutivo: pCon >= 0 ? norm(r[pCon]) : "",
        cliente: pCli >= 0 ? norm(r[pCli]) : "",
        direccion: pDir >= 0 ? norm(r[pDir]) : "",
        oc: pOc >= 0 ? norm(r[pOc]) : "",
        estado: pEst >= 0 ? norm(r[pEst]) : "",
      });
    }

    const secuenciaCompleta: SecItem[] = secR
      .map((r) => ({
        posicion: safeNum(r[sPos]),
        pedidosKey: norm(r[sKey]),
        cliente: sCli >= 0 ? norm(r[sCli]) : "",
        direccion: sDir >= 0 ? norm(r[sDir]) : "",
        oc: sOc >= 0 ? norm(r[sOc]) : "",
        prioridadManual: sPri >= 0 ? norm(r[sPri]) : "",
        estado: sEst >= 0 ? norm(r[sEst]) : "",
        programadoPor: sProg >= 0 ? norm(r[sProg]) : "",
        fechaProgramacion: sFechaProg >= 0 ? norm(r[sFechaProg]) : "",
        fechaEstimadaDespacho: sFechaEst >= 0 ? dateOnly(r[sFechaEst]) : "",
      }))
      .filter((x) => {
        if (!x.pedidosKey) return false;

        // Retirado no cuenta como programación activa del día.
        return !lower(x.estado).includes("retirado");
      });

    const secuenciaPorKey = new Map<string, SecItem[]>();

    for (const s of secuenciaCompleta) {
      const list = secuenciaPorKey.get(s.pedidosKey) || [];
      list.push(s);
      secuenciaPorKey.set(s.pedidosKey, list);
    }

    for (const list of secuenciaPorKey.values()) {
      list.sort((a, b) => {
        if (a.fechaEstimadaDespacho !== b.fechaEstimadaDespacho) {
          return a.fechaEstimadaDespacho.localeCompare(b.fechaEstimadaDespacho);
        }

        return a.posicion - b.posicion;
      });
    }

    const despachosPorPedidoFecha = new Map<
      string,
      {
        pedidosKey: string;
        fechaRealDespacho: string;
        unidadesDespachadas: number;
        registros: number;
        usuario: string;
        transporte: string;
        guia: string;
        factura: string;
        remision: string;
      }
    >();

    const fechasDespachoPorPedido = new Map<string, Set<string>>();

    for (const r of desR) {
      const key = norm(r[dKey]);
      const fechaRealDespacho = dateOnly(r[dFecha]);

      if (!key || !fechaRealDespacho) continue;

      const mapKey = `${key}__${fechaRealDespacho}`;
      const current =
        despachosPorPedidoFecha.get(mapKey) || {
          pedidosKey: key,
          fechaRealDespacho,
          unidadesDespachadas: 0,
          registros: 0,
          usuario: "",
          transporte: "",
          guia: "",
          factura: "",
          remision: "",
        };

      current.unidadesDespachadas += dCant >= 0 ? safeNum(r[dCant]) : 0;
      current.registros += 1;

      if (dUser >= 0 && norm(r[dUser])) current.usuario = norm(r[dUser]);
      if (dTrans >= 0 && norm(r[dTrans])) current.transporte = norm(r[dTrans]);
      if (dGuia >= 0 && norm(r[dGuia])) current.guia = norm(r[dGuia]);
      if (dFact >= 0 && norm(r[dFact])) current.factura = norm(r[dFact]);
      if (dRem >= 0 && norm(r[dRem])) current.remision = norm(r[dRem]);

      despachosPorPedidoFecha.set(mapKey, current);

      const set = fechasDespachoPorPedido.get(key) || new Set<string>();
      set.add(fechaRealDespacho);
      fechasDespachoPorPedido.set(key, set);
    }

    function buscarProgramacionParaDespacho(pedidosKey: string) {
      const list = secuenciaPorKey.get(pedidosKey) || [];

      return (
        list.find((x) => x.fechaEstimadaDespacho === fecha) ||
        [...list]
          .filter((x) => x.fechaEstimadaDespacho && x.fechaEstimadaDespacho < fecha)
          .sort((a, b) => b.fechaEstimadaDespacho.localeCompare(a.fechaEstimadaDespacho))[0] ||
        list[0] ||
        null
      );
    }

    const programadosBase = secuenciaCompleta
      .filter((x) => x.fechaEstimadaDespacho === fecha)
      .sort((a, b) => a.posicion - b.posicion);

    const programados = programadosBase.map((s, idx) => {
      const fechasDespacho = Array.from(
        fechasDespachoPorPedido.get(s.pedidosKey) || new Set<string>()
      ).sort();

      const despachoMismoDia = fechasDespacho.includes(fecha);
      const despachoDespues = fechasDespacho.find((f) => f > fecha) || "";
      const despachoAntes =
        [...fechasDespacho].reverse().find((f) => f < fecha) || "";

      let estadoCumplimiento:
        | "despachado_dia"
        | "despachado_despues"
        | "despachado_antes"
        | "pendiente"
        | "despachado_sin_fecha";

      let fechaRealDespacho = "";

      if (despachoMismoDia) {
        estadoCumplimiento = "despachado_dia";
        fechaRealDespacho = fecha;
      } else if (despachoDespues) {
        estadoCumplimiento = "despachado_despues";
        fechaRealDespacho = despachoDespues;
      } else if (despachoAntes) {
        estadoCumplimiento = "despachado_antes";
        fechaRealDespacho = despachoAntes;
      } else if (lower(s.estado).includes("despachado")) {
        estadoCumplimiento = "despachado_sin_fecha";
      } else {
        estadoCumplimiento = "pendiente";
      }

      return {
        posicion: s.posicion || idx + 1,
        pedidosKey: s.pedidosKey,
        cliente: s.cliente,
        direccion: s.direccion,
        oc: s.oc,
        estadoSecuencia: s.estado,
        fechaEstimadaDespacho: s.fechaEstimadaDespacho,
        fechaRealDespacho,
        estadoCumplimiento,
      };
    });

    const despachadosReales = Array.from(despachosPorPedidoFecha.values())
      .filter((x) => x.fechaRealDespacho === fecha)
      .map((d) => {
        const meta = pedidosMeta.get(d.pedidosKey);
        const sec = buscarProgramacionParaDespacho(d.pedidosKey);

        const fechaProgramada = sec?.fechaEstimadaDespacho || "";

        let tipo: "programado_dia" | "represado" | "adelantado" | "sin_programacion";

        if (!fechaProgramada) tipo = "sin_programacion";
        else if (fechaProgramada === fecha) tipo = "programado_dia";
        else if (fechaProgramada < fecha) tipo = "represado";
        else tipo = "adelantado";

        return {
          pedidosKey: d.pedidosKey,
          cliente: meta?.cliente || sec?.cliente || d.pedidosKey,
          direccion: meta?.direccion || sec?.direccion || "",
          oc: meta?.oc || sec?.oc || "",
          estadoPedido: meta?.estado || "",
          fechaProgramada,
          fechaRealDespacho: d.fechaRealDespacho,
          unidadesDespachadas: d.unidadesDespachadas,
          registros: d.registros,
          usuario: d.usuario,
          transporte: d.transporte,
          guia: d.guia,
          factura: d.factura,
          remision: d.remision,
          tipo,
        };
      })
      .sort((a, b) => {
        if (a.tipo !== b.tipo) return a.tipo.localeCompare(b.tipo);
        return a.cliente.localeCompare(b.cliente);
      });

    const pendientesProgramacionDia = programados.filter(
      (p) => p.estadoCumplimiento !== "despachado_dia"
    );

    const despachadosProgramadosDia = despachadosReales.filter(
      (x) => x.tipo === "programado_dia"
    ).length;

    const despachadosRepresados = despachadosReales.filter(
      (x) => x.tipo === "represado"
    ).length;

    const despachadosAdelantados = despachadosReales.filter(
      (x) => x.tipo === "adelantado"
    ).length;

    const despachadosSinProgramacion = despachadosReales.filter(
      (x) => x.tipo === "sin_programacion"
    ).length;

    const cumplimiento =
      programados.length > 0
        ? Math.round((despachadosProgramadosDia / programados.length) * 100)
        : 0;

    return NextResponse.json({
      success: true,
      fecha,
      resumen: {
        programadosDia: programados.length,
        despachadosRealesDia: despachadosReales.length,
        despachadosProgramadosDia,
        despachadosRepresados,
        despachadosAdelantados,
        despachadosSinProgramacion,
        noDespachadosDelPlanDia: pendientesProgramacionDia.length,
        cumplimiento,
      },
      programados,
      despachadosReales,
      pendientesProgramacionDia,
    });
  } catch (err: any) {
    console.error("[comercial/despachos-diarios]", err);

    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Error cargando resumen diario de despachos",
      },
      { status: 500 }
    );
  }
}