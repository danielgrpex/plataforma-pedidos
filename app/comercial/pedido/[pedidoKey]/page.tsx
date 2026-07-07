// app/comercial/pedido/[pedidoKey]/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type ViewMode = "fechas" | "despacho" | "valores";

type ResumenDespacho = {
  estado: "Sin despachos" | "Parcial" | "Completo";
  solicitadoUnd: number;
  despachadoUnd: number;
  pendienteUnd: number;
  avancePorcentaje: number;
};

type HistorialDespacho = {
  fechaDespacho: string;
  cantidadUnd: number;
  registros: number;
  usuario: string;
  transporte: string;
  guia: string;
  factura: string;
  remision: string;
  observaciones: string;
};

type PedidoItem = {
  producto: string;
  cantidadUnd: string;
  cantidadM: string;
  estadoItem?: string;

  pedidoRowIndex?: number;

  solicitadoUnd?: number;
  despachadoUnd?: number;
  pendienteUnd?: number;

  fechaEstimadaEntregaAlmacen?: string;
  fechaRealEntregaAlmacen?: string;
  fechaEstimadaDespacho?: string;
  fechaRealDespacho?: string;
  fechaEntregaRealCliente?: string;

  transporte?: string;
  guia?: string;
  factura?: string;
  remision?: string;

  soporteEntregaUrl?: string;
  soporteEntregaNombre?: string;
  fechaCargueSoporteEntrega?: string;
  usuarioEntregaCliente?: string;
  observacionesEntregaCliente?: string;

  precioUnitario?: string;
};

type PedidoDetalle = {
  pedidoKey?: string;
  pedidoId?: string;

  soporteEntregaUrl?: string;
  soporteEntregaNombre?: string;
  fechaCargueSoporteEntrega?: string;
  usuarioEntregaCliente?: string;
  observacionesEntregaCliente?: string;

  resumenDespacho?: ResumenDespacho;
  historialDespachos?: HistorialDespacho[];

  consecutivo: string;
  fechaSolicitud: string;
  asesor: string;
  cliente: string;
  direccion: string;
  oc: string;
  fechaRequerida: string;
  obsComerciales: string;
  estado: string;
  pdfPath: string;
  createdBy?: string;

  items: PedidoItem[];
};

function formatFechaColombia(value?: string) {
  if (!value) return "—";

  const d = new Date(value);

  if (isNaN(d.getTime())) {
    return value;
  }

  const day = d
    .getDate()
    .toString()
    .padStart(2, "0");

  const month = d
    .toLocaleDateString("es-CO", {
      month: "short",
    })
    .replace(".", "")
    .replace(/^\w/, (c) => c.toUpperCase());

  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
}

function toNumber(value?: string) {
  if (!value) return 0;

  const s = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const n = Number(s);

  return Number.isFinite(n) ? n : 0;
}

function formatNumber(
  n: number,
  decimals = 0
) {
  return n.toLocaleString("es-CO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatMoneyCOP(n: number) {
  return `$ ${formatNumber(n, 0)}`;
}

function despachoEstadoClass(
  value?: string
) {
  const estado = String(
    value || ""
  ).toLowerCase();

  if (estado.includes("completo")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (estado.includes("parcial")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function formatDespachoCantidad(
  value?: number
) {
  return formatNumber(
    Number(value || 0),
    0
  );
}

function EstadoBadge({
  value,
}: {
  value?: string;
}) {
  const v = (
    value || "—"
  ).trim();

  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border";

  const lower =
    v.toLowerCase();

  let cls =
    "border-slate-200 bg-slate-50 text-slate-700";

  if (
    lower.includes("verific")
  ) {
    cls =
      "border-amber-200 bg-amber-50 text-amber-800";
  } else if (
    lower.includes("produ") ||
    lower.includes("corte")
  ) {
    cls =
      "border-indigo-200 bg-indigo-50 text-indigo-800";
  } else if (
    lower.includes("almac")
  ) {
    cls =
      "border-sky-200 bg-sky-50 text-sky-800";
  } else if (
    lower.includes("desp")
  ) {
    cls =
      "border-emerald-200 bg-emerald-50 text-emerald-800";
  } else if (
    lower.includes("entreg")
  ) {
    cls =
      "border-green-200 bg-green-50 text-green-800";
  } else if (
    lower.includes("cancel")
  ) {
    cls =
      "border-red-200 bg-red-50 text-red-800";
  }

  return (
    <span
      className={`${base} ${cls}`}
    >
      {v || "—"}
    </span>
  );
}

export default function VerPedidoPage() {
  const router = useRouter();

  const params =
    useParams<{
      pedidoKey: string;
    }>();

  const pedidoKey =
    decodeURIComponent(
      params.pedidoKey || ""
    );

  const [pedido, setPedido] =
    useState<PedidoDetalle | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [err, setErr] =
    useState("");

  const [view, setView] =
    useState<ViewMode>("fechas");

  async function load() {
    setLoading(true);
    setErr("");

    try {
      const url =
        `/api/comercial/pedidos/detalle?pedidoKey=${encodeURIComponent(
          pedidoKey
        )}`;

      const res = await fetch(
        url,
        {
          cache: "no-store",
        }
      );

      const json =
        await res.json();

      if (!json?.success) {
        throw new Error(
          json?.message ||
            "Error cargando pedido"
        );
      }

      setPedido(
        json.pedido as PedidoDetalle
      );
    } catch (e: any) {
      console.error(e);

      setErr(
        e?.message ||
          "Error cargando pedido"
      );

      setPedido(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (pedidoKey) {
      load();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoKey]);

  async function verPdf(
    pdfPath: string
  ) {
    if (!pdfPath) {
      return alert(
        "Este pedido no tiene pdfPath guardado."
      );
    }

    const res = await fetch(
      "/api/comercial/pedidos/pdf-url",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          pdfPath,
        }),
      }
    );

    const json =
      await res.json();

    if (!json?.success) {
      return alert(
        json?.message ||
          "No se pudo abrir el PDF"
      );
    }

    window.open(
      json.url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  const totals = useMemo(() => {
    const items =
      pedido?.items || [];

    let totalUnd = 0;
    let totalM = 0;
    let totalCOP = 0;

    for (const it of items) {
      const und =
        toNumber(it.cantidadUnd);

      const m =
        toNumber(it.cantidadM);

      const pu =
        toNumber(
          it.precioUnitario
        );

      totalUnd += und;
      totalM += m;
      totalCOP += und * pu;
    }

    return {
      totalUnd,
      totalM,
      totalCOP,
    };
  }, [pedido]);

  const totalItems =
    useMemo(
      () =>
        pedido?.items?.length ??
        0,
      [pedido]
    );

  const soporteEntrega =
    useMemo(() => {
      if (!pedido) {
        return null;
      }

      if (
        pedido.soporteEntregaUrl
      ) {
        return {
          url:
            pedido.soporteEntregaUrl,

          nombre:
            pedido
              .soporteEntregaNombre ||
            "Documento soporte de entrega",

          fechaCargue:
            pedido
              .fechaCargueSoporteEntrega,

          usuario:
            pedido
              .usuarioEntregaCliente,

          observaciones:
            pedido
              .observacionesEntregaCliente,
        };
      }

      const itemConSoporte =
        pedido.items.find(
          (it) =>
            it.soporteEntregaUrl
        );

      if (
        !itemConSoporte
          ?.soporteEntregaUrl
      ) {
        return null;
      }

      return {
        url:
          itemConSoporte
            .soporteEntregaUrl,

        nombre:
          itemConSoporte
            .soporteEntregaNombre ||
          "Documento soporte de entrega",

        fechaCargue:
          itemConSoporte
            .fechaCargueSoporteEntrega,

        usuario:
          itemConSoporte
            .usuarioEntregaCliente,

        observaciones:
          itemConSoporte
            .observacionesEntregaCliente,
      };
    }, [pedido]);

  const tabBtn = (
    active: boolean
  ) =>
    `rounded-2xl px-4 py-3 text-sm font-medium shadow-sm border transition ${
      active
        ? "bg-indigo-500 text-white border-indigo-500"
        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
    }`;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <button
        className="mb-4 text-sm text-slate-500 hover:text-slate-700"
        type="button"
        onClick={() =>
          router.push(
            "/comercial"
          )
        }
      >
        ← Volver al listado
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Ver pedido
          </h1>

          <p className="text-sm text-slate-500">
            Consecutivo:{" "}
            <span className="font-medium text-slate-700">
              {pedido?.consecutivo ||
                "—"}
            </span>
          </p>

          <p className="break-all text-xs text-slate-400">
            pedidoKey:{" "}
            {pedidoKey || "—"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            className={tabBtn(
              view === "fechas"
            )}
            onClick={() =>
              setView("fechas")
            }
          >
            Fechas
          </button>

          <button
            className={tabBtn(
              view === "despacho"
            )}
            onClick={() =>
              setView("despacho")
            }
          >
            Despacho
          </button>

          <button
            className={tabBtn(
              view === "valores"
            )}
            onClick={() =>
              setView("valores")
            }
          >
            Valores
          </button>

          {pedido?.pdfPath ? (
            <button
              onClick={() =>
                verPdf(
                  pedido.pdfPath
                )
              }
              className="ml-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Ver PDF
            </button>
          ) : (
            <button
              disabled
              className="ml-2 rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-500"
            >
              Sin PDF
            </button>
          )}
        </div>
      </div>

      {/* =====================================================
          INFORMACIÓN GENERAL
      ===================================================== */}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {loading && (
          <p className="text-sm text-slate-500">
            Cargando…
          </p>
        )}

        {!loading && err && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {err}
          </div>
        )}

        {!loading &&
          pedido && (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-500">
                      Cliente
                    </p>

                    <p className="text-sm font-medium">
                      {pedido.cliente ||
                        "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      OC
                    </p>

                    <p className="text-sm font-medium">
                      {pedido.oc ||
                        "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Asesor
                    </p>

                    <p className="text-sm font-medium">
                      {pedido.asesor ||
                        "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Estado (pedido)
                    </p>

                    <div className="mt-1">
                      <EstadoBadge
                        value={
                          pedido.estado
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Fecha solicitud
                    </p>

                    <p className="text-sm font-medium">
                      {formatFechaColombia(
                        pedido.fechaSolicitud
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Fecha requerida
                    </p>

                    <p className="text-sm font-medium">
                      {formatFechaColombia(
                        pedido.fechaRequerida
                      )}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Dirección
                  </p>

                  <p className="text-sm">
                    {pedido.direccion ||
                      "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Observaciones comerciales
                  </p>

                  <p className="whitespace-pre-wrap text-sm">
                    {pedido
                      .obsComerciales ||
                      "—"}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  Resumen
                </p>

                <p className="mt-1 text-3xl font-semibold">
                  {totalItems}
                </p>

                <p className="text-sm text-slate-600">
                  items
                </p>

                <div className="mt-4 grid gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      Total und
                    </span>

                    <span className="font-medium">
                      {formatNumber(
                        totals.totalUnd
                      )}{" "}
                      und
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      Total m
                    </span>

                    <span className="font-medium">
                      {formatNumber(
                        totals.totalM,
                        1
                      )}{" "}
                      m
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      Total COP
                    </span>

                    <span className="font-semibold">
                      {formatMoneyCOP(
                        totals.totalCOP
                      )}
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs text-slate-500">
                    Creado por
                  </p>

                  <p className="text-sm">
                    {pedido.createdBy ||
                      "—"}
                  </p>
                </div>

                <div className="mt-3">
                  <p className="text-xs text-slate-500">
                    pdfPath
                  </p>

                  <p className="break-all text-xs text-slate-600">
                    {pedido.pdfPath ||
                      "—"}
                  </p>
                </div>
              </div>
            </div>
          )}
      </section>

      {/* =====================================================
          PRODUCTOS / PESTAÑAS
      ===================================================== */}

      {!loading &&
        pedido && (
          <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-base font-semibold">
                Productos —{" "}
                {view === "fechas"
                  ? "Fechas"
                  : view ===
                      "despacho"
                    ? "Despacho"
                    : "Valores"}
              </h2>
            </div>

            {/* =====================================================
                PANEL ESPECIAL DE DESPACHO
            ===================================================== */}

            {view ===
              "despacho" && (
              <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-4">
                <div className="space-y-4">
                  {/* RESUMEN DESPACHO */}

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Resumen de despacho
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          Estado acumulado del pedido según los despachos registrados.
                        </p>
                      </div>

                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${despachoEstadoClass(
                          pedido
                            .resumenDespacho
                            ?.estado
                        )}`}
                      >
                        {pedido
                          .resumenDespacho
                          ?.estado ||
                          "Sin despachos"}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs font-medium uppercase text-slate-500">
                          Solicitado
                        </div>

                        <div className="mt-2 text-2xl font-semibold text-slate-900">
                          {formatDespachoCantidad(
                            pedido
                              .resumenDespacho
                              ?.solicitadoUnd
                          )}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          unidades
                        </div>
                      </div>

                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="text-xs font-medium uppercase text-emerald-700">
                          Despachado acumulado
                        </div>

                        <div className="mt-2 text-2xl font-semibold text-emerald-800">
                          {formatDespachoCantidad(
                            pedido
                              .resumenDespacho
                              ?.despachadoUnd
                          )}
                        </div>

                        <div className="mt-1 text-xs text-emerald-700">
                          unidades
                        </div>
                      </div>

                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <div className="text-xs font-medium uppercase text-amber-700">
                          Pendiente
                        </div>

                        <div className="mt-2 text-2xl font-semibold text-amber-800">
                          {formatDespachoCantidad(
                            pedido
                              .resumenDespacho
                              ?.pendienteUnd
                          )}
                        </div>

                        <div className="mt-1 text-xs text-amber-700">
                          unidades
                        </div>
                      </div>

                      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                        <div className="text-xs font-medium uppercase text-blue-700">
                          Avance
                        </div>

                        <div className="mt-2 text-2xl font-semibold text-blue-800">
                          {pedido
                            .resumenDespacho
                            ?.avancePorcentaje ??
                            0}
                          %
                        </div>

                        <div className="mt-1 text-xs text-blue-700">
                          del pedido
                        </div>
                      </div>
                    </div>

                    {/* BARRA */}

                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                        <span>
                          Avance del despacho
                        </span>

                        <span className="font-medium text-slate-700">
                          {pedido
                            .resumenDespacho
                            ?.avancePorcentaje ??
                            0}
                          %
                        </span>
                      </div>

                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={
                            pedido
                              .resumenDespacho
                              ?.estado ===
                            "Completo"
                              ? "h-full rounded-full bg-emerald-500 transition-all"
                              : "h-full rounded-full bg-amber-500 transition-all"
                          }
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(
                                0,
                                pedido
                                  .resumenDespacho
                                  ?.avancePorcentaje ||
                                  0
                              )
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* HISTORIAL */}

                  <div className="rounded-2xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-100 px-5 py-4">
                      <p className="text-sm font-semibold text-slate-900">
                        Historial de despachos
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Cada salida registrada para este pedido.
                      </p>
                    </div>

                    {!pedido
                      .historialDespachos
                      ?.length ? (
                      <div className="px-5 py-6 text-sm text-slate-500">
                        Aún no hay despachos registrados para este pedido.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50 text-slate-600">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium">
                                #
                              </th>

                              <th className="px-4 py-3 text-left font-medium">
                                Fecha
                              </th>

                              <th className="px-4 py-3 text-right font-medium">
                                Cantidad
                              </th>

                              <th className="px-4 py-3 text-left font-medium">
                                Transporte
                              </th>

                              <th className="px-4 py-3 text-left font-medium">
                                Guía
                              </th>

                              <th className="px-4 py-3 text-left font-medium">
                                Factura
                              </th>

                              <th className="px-4 py-3 text-left font-medium">
                                Remisión
                              </th>

                              <th className="px-4 py-3 text-left font-medium">
                                Usuario
                              </th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-slate-100">
                            {pedido.historialDespachos.map(
                              (
                                h,
                                idx
                              ) => (
                                <tr
                                  key={`${h.fechaDespacho}-${h.guia}-${idx}`}
                                  className="align-top hover:bg-slate-50"
                                >
                                  <td className="px-4 py-3 text-slate-500">
                                    {idx +
                                      1}
                                  </td>

                                  <td className="px-4 py-3 font-medium text-slate-900">
                                    {formatFechaColombia(
                                      h.fechaDespacho
                                    )}
                                  </td>

                                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                                    {formatDespachoCantidad(
                                      h.cantidadUnd
                                    )}{" "}
                                    und
                                  </td>

                                  <td className="px-4 py-3">
                                    {h.transporte ||
                                      "—"}
                                  </td>

                                  <td className="px-4 py-3">
                                    {h.guia ||
                                      "—"}
                                  </td>

                                  <td className="px-4 py-3">
                                    {h.factura ||
                                      "—"}
                                  </td>

                                  <td className="px-4 py-3">
                                    {h.remision ||
                                      "—"}
                                  </td>

                                  <td className="px-4 py-3">
                                    {h.usuario ||
                                      "—"}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {pedido.historialDespachos?.some(
                      (h) =>
                        h.observaciones
                    ) && (
                      <div className="border-t border-slate-100 px-5 py-4">
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          Observaciones de despacho
                        </p>

                        <div className="mt-2 space-y-2">
                          {pedido.historialDespachos
                            .filter(
                              (h) =>
                                h.observaciones
                            )
                            .map(
                              (
                                h,
                                idx
                              ) => (
                                <div
                                  key={`${h.fechaDespacho}-obs-${idx}`}
                                  className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600"
                                >
                                  <span className="font-medium text-slate-800">
                                    {formatFechaColombia(
                                      h.fechaDespacho
                                    )}
                                    :
                                  </span>{" "}
                                  {
                                    h.observaciones
                                  }
                                </div>
                              )
                            )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SALDO POR PRODUCTO */}

                  <div className="rounded-2xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-100 px-5 py-4">
                      <p className="text-sm font-semibold text-slate-900">
                        Saldo por producto
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Cantidad solicitada, despachada y pendiente por ítem.
                      </p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium">
                              Producto
                            </th>

                            <th className="px-4 py-3 text-right font-medium">
                              Solicitado
                            </th>

                            <th className="px-4 py-3 text-right font-medium">
                              Despachado
                            </th>

                            <th className="px-4 py-3 text-right font-medium">
                              Pendiente
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {pedido.items.map(
                            (
                              it,
                              idx
                            ) => (
                              <tr
                                key={`saldo-${it.pedidoRowIndex || idx}`}
                                className="hover:bg-slate-50"
                              >
                                <td className="px-4 py-3 text-slate-900">
                                  {it.producto ||
                                    "—"}
                                </td>

                                <td className="px-4 py-3 text-right">
                                  {formatDespachoCantidad(
                                    it.solicitadoUnd
                                  )}
                                </td>

                                <td className="px-4 py-3 text-right font-medium text-emerald-700">
                                  {formatDespachoCantidad(
                                    it.despachadoUnd
                                  )}
                                </td>

                                <td className="px-4 py-3 text-right font-medium text-amber-700">
                                  {formatDespachoCantidad(
                                    it.pendienteUnd
                                  )}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* SOPORTE ENTREGA */}

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Documento soporte de entrega
                        </p>

                        {soporteEntrega ? (
                          <div className="mt-2 space-y-1 text-sm text-slate-600">
                            <p>
                              <span className="font-medium text-slate-800">
                                Archivo:
                              </span>{" "}
                              {
                                soporteEntrega.nombre
                              }
                            </p>

                            {soporteEntrega.fechaCargue ? (
                              <p>
                                <span className="font-medium text-slate-800">
                                  Fecha cargue:
                                </span>{" "}
                                {formatFechaColombia(
                                  soporteEntrega.fechaCargue
                                )}
                              </p>
                            ) : null}

                            {soporteEntrega.usuario ? (
                              <p>
                                <span className="font-medium text-slate-800">
                                  Cargado por:
                                </span>{" "}
                                {
                                  soporteEntrega.usuario
                                }
                              </p>
                            ) : null}

                            {soporteEntrega.observaciones ? (
                              <p className="whitespace-pre-wrap">
                                <span className="font-medium text-slate-800">
                                  Observaciones:
                                </span>{" "}
                                {
                                  soporteEntrega.observaciones
                                }
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-slate-500">
                            Aún no se ha cargado soporte de entrega para este pedido.
                          </p>
                        )}
                      </div>

                      {soporteEntrega?.url ? (
                        <a
                          href={
                            soporteEntrega.url
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
                        >
                          Ver / Descargar soporte
                        </a>
                      ) : (
                        <span className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500">
                          Sin soporte
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =====================================================
                TABLA GENERAL DE PRODUCTOS
            ===================================================== */}

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">
                      Producto
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Cant (und)
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Cant (m)
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Estado
                    </th>

                    {view ===
                      "fechas" && (
                      <>
                        <th className="px-4 py-3 text-left font-medium">
                          Est. Entrega almacén
                        </th>

                        <th className="px-4 py-3 text-left font-medium">
                          Real Entrega almacén
                        </th>

                        <th className="px-4 py-3 text-left font-medium">
                          Est. Despacho
                        </th>

                        <th className="px-4 py-3 text-left font-medium">
                          Real Despacho
                        </th>

                        <th className="px-4 py-3 text-left font-medium">
                          Entrega real cliente
                        </th>
                      </>
                    )}

                    {view ===
                      "despacho" && (
                      <>
                        <th className="px-4 py-3 text-left font-medium">
                          Transporte
                        </th>

                        <th className="px-4 py-3 text-left font-medium">
                          Guía
                        </th>

                        <th className="px-4 py-3 text-left font-medium">
                          Factura
                        </th>

                        <th className="px-4 py-3 text-left font-medium">
                          Remisión
                        </th>
                      </>
                    )}

                    {view ===
                      "valores" && (
                      <>
                        <th className="px-4 py-3 text-right font-medium">
                          Precio unit
                        </th>

                        <th className="px-4 py-3 text-right font-medium">
                          Total
                        </th>
                      </>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {pedido.items.map(
                    (
                      it,
                      idx
                    ) => {
                      const und =
                        toNumber(
                          it.cantidadUnd
                        );

                      const m =
                        toNumber(
                          it.cantidadM
                        );

                      const pu =
                        toNumber(
                          it.precioUnitario
                        );

                      const total =
                        und * pu;

                      return (
                        <tr
                          key={idx}
                          className="align-top hover:bg-slate-50"
                        >
                          <td className="whitespace-pre-wrap px-4 py-3">
                            {it.producto ||
                              "—"}
                          </td>

                          <td className="px-4 py-3 text-right">
                            {und
                              ? formatNumber(
                                  und
                                )
                              : "—"}
                          </td>

                          <td className="px-4 py-3 text-right">
                            {m
                              ? formatNumber(
                                  m,
                                  1
                                )
                              : "—"}
                          </td>

                          <td className="px-4 py-3">
                            <EstadoBadge
                              value={
                                it.estadoItem ||
                                pedido.estado
                              }
                            />
                          </td>

                          {view ===
                            "fechas" && (
                            <>
                              <td className="px-4 py-3">
                                {formatFechaColombia(
                                  it.fechaEstimadaEntregaAlmacen
                                )}
                              </td>

                              <td className="px-4 py-3">
                                {formatFechaColombia(
                                  it.fechaRealEntregaAlmacen
                                )}
                              </td>

                              <td className="px-4 py-3">
                                {formatFechaColombia(
                                  it.fechaEstimadaDespacho
                                )}
                              </td>

                              <td className="px-4 py-3">
                                {formatFechaColombia(
                                  it.fechaRealDespacho
                                )}
                              </td>

                              <td className="px-4 py-3">
                                {formatFechaColombia(
                                  it.fechaEntregaRealCliente
                                )}
                              </td>
                            </>
                          )}

                          {view ===
                            "despacho" && (
                            <>
                              <td className="px-4 py-3">
                                {it.transporte ||
                                  "—"}
                              </td>

                              <td className="px-4 py-3">
                                {it.guia ||
                                  "—"}
                              </td>

                              <td className="px-4 py-3">
                                {it.factura ||
                                  "—"}
                              </td>

                              <td className="px-4 py-3">
                                {it.remision ||
                                  "—"}
                              </td>
                            </>
                          )}

                          {view ===
                            "valores" && (
                            <>
                              <td className="px-4 py-3 text-right">
                                {pu
                                  ? formatMoneyCOP(
                                      pu
                                    )
                                  : "—"}
                              </td>

                              <td className="px-4 py-3 text-right font-medium">
                                {formatMoneyCOP(
                                  total
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    }
                  )}

                  <tr className="bg-slate-50">
                    <td className="px-4 py-3 font-semibold">
                      Totales
                    </td>

                    <td className="px-4 py-3 text-right font-semibold">
                      {formatNumber(
                        totals.totalUnd
                      )}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold">
                      {formatNumber(
                        totals.totalM,
                        1
                      )}
                    </td>

                    <td className="px-4 py-3" />

                    {view ===
                      "fechas" && (
                      <td
                        className="px-4 py-3"
                        colSpan={5}
                      />
                    )}

                    {view ===
                      "despacho" && (
                      <td
                        className="px-4 py-3"
                        colSpan={4}
                      />
                    )}

                    {view ===
                      "valores" && (
                      <>
                        <td className="px-4 py-3" />

                        <td className="px-4 py-3 text-right font-semibold">
                          {formatMoneyCOP(
                            totals.totalCOP
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}
    </main>
  );
}