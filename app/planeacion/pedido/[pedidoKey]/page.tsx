// app/planeacion/pedido/[pedidoKey]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

/* =========================================================
   TIPOS
   ========================================================= */

type PedidoItem = {
  rowIndex1Based: number;
  productoKey: string;
  producto: string;
  cantidadUnd: string;
  cantidadM: string;
};

type Pedido = {
  pedidoKey: string;
  consecutivo: string;
  cliente: string;
  oc: string;
  direccion: string;
  fechaRequerida: string;

  clasificacionPlaneacion: string;
  observacionesPlaneacion: string;

  items: PedidoItem[];
};

/* =========================================================
   HELPERS
   ========================================================= */

function toNumber(v?: string) {
  if (!v) return 0;

  const s = String(v)
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const n = Number(s);

  return Number.isFinite(n)
    ? n
    : 0;
}

function formatESDate(value?: string) {
  if (!value) {
    return "";
  }

  /*
   * Evitamos problemas de zona horaria con YYYY-MM-DD.
   */
  const ymd =
    String(value).match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (ymd) {
    const [, y, m, d] =
      ymd;

    return `${d}/${m}/${y}`;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  const d =
    String(
      date.getDate()
    ).padStart(2, "0");

  const m =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const y =
    date.getFullYear();

  return `${d}/${m}/${y}`;
}

/*
 * El backend actual escribe estas fechas usando
 * USER_ENTERED en Google Sheets.
 */
function toSheetsDate(
  ymd?: string
) {
  if (!ymd) {
    return "";
  }

  const m =
    String(ymd).match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (!m) {
    return formatESDate(
      ymd
    );
  }

  const [, y, mo, d] =
    m;

  return `${d}/${mo}/${y}`;
}

function makeUid(
  item: PedidoItem,
  index: number
) {
  return `${item.rowIndex1Based || "X"}-${
    item.productoKey || "PK"
  }-${index}`;
}

/* =========================================================
   COMPONENTE
   ========================================================= */

export default function PlaneacionPedidoPage() {
  const router =
    useRouter();

  const params =
    useParams<{
      pedidoKey: string;
    }>();

  const pedidoKey =
    decodeURIComponent(
      params.pedidoKey || ""
    );

  /* =======================================================
     ESTADOS
     ======================================================= */

  const [
    pedido,
    setPedido,
  ] =
    useState<Pedido | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    obs,
    setObs,
  ] =
    useState("");

  /*
   * Fechas individuales.
   *
   * Aunque podamos aplicarlas masivamente,
   * se siguen conservando por ítem para permitir
   * excepciones.
   */
  const [
    fechaAlmacen,
    setFechaAlmacen,
  ] =
    useState<
      Record<string, string>
    >({});

  const [
    fechaDespacho,
    setFechaDespacho,
  ] =
    useState<
      Record<string, string>
    >({});

  /*
   * Fechas generales del pedido.
   */
  const [
    fechaGeneralAlmacen,
    setFechaGeneralAlmacen,
  ] =
    useState("");

  const [
    fechaGeneralDespacho,
    setFechaGeneralDespacho,
  ] =
    useState("");

  /* =======================================================
     CARGAR PEDIDO
     ======================================================= */

  async function load() {
    try {
      setLoading(true);

      const res =
        await fetch(
          `/api/planeacion/pedido?pedidoKey=${encodeURIComponent(
            pedidoKey
          )}`,
          {
            cache:
              "no-store",
          }
        );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json?.success
      ) {
        alert(
          json?.message ||
            "Error cargando pedido"
        );

        return;
      }

      const ped =
        json.pedido as Pedido;

      setPedido(ped);

      setObs(
        ped?.observacionesPlaneacion ||
          ""
      );

      /*
       * Inicializamos las fechas individuales.
       */
      const initFA: Record<
        string,
        string
      > = {};

      const initFD: Record<
        string,
        string
      > = {};

      (
        ped?.items || []
      ).forEach(
        (
          item,
          index
        ) => {
          const uid =
            makeUid(
              item,
              index
            );

          initFA[uid] =
            "";

          initFD[uid] =
            "";
        }
      );

      setFechaAlmacen(
        initFA
      );

      setFechaDespacho(
        initFD
      );
    } catch (error) {
      console.error(
        "[PlaneacionPedido load]",
        error
      );

      alert(
        "No fue posible cargar el pedido."
      );
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

  /* =======================================================
     ITEMS CALCULADOS
     ======================================================= */

  const computed =
    useMemo(() => {
      const items =
        pedido?.items ||
        [];

      return items.map(
        (
          item,
          index
        ) => {
          const uid =
            makeUid(
              item,
              index
            );

          return {
            ...item,

            uid,

            solicitada:
              toNumber(
                item.cantidadUnd
              ),

            /*
             * NUEVA REGLA OPERATIVA:
             * absolutamente todos los ítems van a Corte.
             */
            destino:
              "Corte" as const,

            fechaEstimadaAlmacen:
              fechaAlmacen[
                uid
              ] || "",

            fechaEstimadaDespacho:
              fechaDespacho[
                uid
              ] || "",
          };
        }
      );
    }, [
      pedido,
      fechaAlmacen,
      fechaDespacho,
    ]);

  /* =======================================================
     APLICAR FECHAS A TODOS
     ======================================================= */

  function aplicarFechasATodos() {
    if (!pedido) {
      return;
    }

    if (
      !fechaGeneralAlmacen &&
      !fechaGeneralDespacho
    ) {
      alert(
        "Selecciona al menos una fecha general."
      );

      return;
    }

    /*
     * Si una de las fechas generales está vacía,
     * NO borramos las fechas individuales ya existentes
     * de ese campo.
     */

    if (
      fechaGeneralAlmacen
    ) {
      setFechaAlmacen(
        (
          prev
        ) => {
          const next = {
            ...prev,
          };

          pedido.items.forEach(
            (
              item,
              index
            ) => {
              const uid =
                makeUid(
                  item,
                  index
                );

              next[uid] =
                fechaGeneralAlmacen;
            }
          );

          return next;
        }
      );
    }

    if (
      fechaGeneralDespacho
    ) {
      setFechaDespacho(
        (
          prev
        ) => {
          const next = {
            ...prev,
          };

          pedido.items.forEach(
            (
              item,
              index
            ) => {
              const uid =
                makeUid(
                  item,
                  index
                );

              next[uid] =
                fechaGeneralDespacho;
            }
          );

          return next;
        }
      );
    }
  }

  /* =======================================================
     RESUMEN DE FECHAS
     ======================================================= */

  const resumenFechas =
    useMemo(() => {
      const total =
        computed.length;

      const conAlmacen =
        computed.filter(
          (item) =>
            Boolean(
              item.fechaEstimadaAlmacen
            )
        ).length;

      const conDespacho =
        computed.filter(
          (item) =>
            Boolean(
              item.fechaEstimadaDespacho
            )
        ).length;

      return {
        total,
        conAlmacen,
        conDespacho,
        sinAlmacen:
          total -
          conAlmacen,

        sinDespacho:
          total -
          conDespacho,
      };
    }, [
      computed,
    ]);

  /* =======================================================
     GUARDAR
     ======================================================= */

  async function guardar() {
    if (!pedido) {
      return;
    }

    /*
     * Advertencia, no bloqueo.
     *
     * Todavía permitimos guardar aunque alguna fecha
     * esté vacía para no cambiar las reglas actuales
     * sin haberlas validado contigo.
     */
    if (
      resumenFechas.sinAlmacen >
        0 ||
      resumenFechas.sinDespacho >
        0
    ) {
      const continuar =
        window.confirm(
          [
            "Hay ítems con fechas pendientes.",
            "",
            `Sin fecha entrega a almacén: ${resumenFechas.sinAlmacen}`,
            `Sin fecha de despacho: ${resumenFechas.sinDespacho}`,
            "",
            "¿Deseas guardar de todas formas?",
          ].join(
            "\n"
          )
        );

      if (!continuar) {
        return;
      }
    }

    try {
      setSaving(true);

      const payload = {
        pedidoKey:
          pedido.pedidoKey,

        observacionesPlaneacion:
          obs || "",

        usuario:
          "planeacion",

        items:
          computed.map(
            (item) => ({
              rowIndex1Based:
                item.rowIndex1Based ||
                0,

              productoKey:
                item.productoKey,

              /*
               * NUEVA REGLA:
               * todos los ítems van a Corte.
               */
              destino:
                "Corte",

              fechas: {
                entregaAlmacen:
                  toSheetsDate(
                    fechaAlmacen[
                      item.uid
                    ] || ""
                  ),

                despacho:
                  toSheetsDate(
                    fechaDespacho[
                      item.uid
                    ] || ""
                  ),
              },

              /*
               * Por ahora NO hacemos reservas
               * de inventario desde Planeación.
               *
               * Planta controlará el producto
               * disponible mediante Producto en Proceso.
               */
              reservas: [],
            })
          ),
      };

      const res =
        await fetch(
          "/api/planeacion/pedido/guardar",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                payload
              ),
          }
        );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json?.success
      ) {
        alert(
          json?.message ||
            "Error guardando planeación"
        );

        return;
      }

      const corte =
        json
          ?.solicitudesCorte;

      alert(
        [
          "Planeación guardada ✅",
          "",
          "Todos los ítems fueron enviados a Corte.",
          "",
          `Solicitudes de Corte creadas: ${
            corte?.creadas ??
            0
          }`,
          `Solicitudes de Corte actualizadas: ${
            corte?.actualizadas ??
            0
          }`,
        ].join(
          "\n"
        )
      );

      router.push(
        "/planeacion"
      );
    } catch (error) {
      console.error(
        "[PlaneacionPedido guardar]",
        error
      );

      alert(
        "No fue posible guardar la planeación."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      {/* VOLVER */}

      <button
        className="mb-4 text-sm text-slate-500 hover:text-slate-700"
        type="button"
        onClick={() =>
          router.push(
            "/planeacion"
          )
        }
      >
        ← Volver
      </button>

      {/* CARGANDO */}

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            Cargando pedido…
          </p>
        </div>
      )}

      {/* PEDIDO */}

      {!loading &&
        pedido && (
          <>
            {/* ===============================================
                HEADER
               =============================================== */}

            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-2 text-sm text-slate-500">
                  Planeación · Pedido
                </div>

                <h1 className="text-2xl font-semibold">
                  Planear pedido
                </h1>

                <p className="mt-1 text-sm text-slate-600">
                  {pedido.consecutivo}
                  {" · "}
                  {pedido.cliente}
                  {pedido.direccion
                    ? ` · ${pedido.direccion}`
                    : ""}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  OC:{" "}
                  <b>
                    {pedido.oc ||
                      "—"}
                  </b>
                </p>
              </div>

              <button
                type="button"
                onClick={
                  guardar
                }
                disabled={
                  saving
                }
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {saving
                  ? "Guardando..."
                  : "Guardar planeación"}
              </button>
            </div>

            {/* ===============================================
                REGLA OPERATIVA
               =============================================== */}

            <section className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-indigo-900">
                    Todos los ítems se envían a Corte
                  </h2>

                  <p className="mt-1 text-sm text-indigo-700">
                    PEX generará una
                    solicitud de Corte para
                    cada ítem del pedido.
                  </p>

                  <p className="mt-1 text-xs text-indigo-600">
                    La validación de
                    producto disponible y
                    necesidades de
                    producción se realizará
                    posteriormente en
                    planta mediante Control
                    de Producto en Proceso.
                  </p>
                </div>

                <div className="rounded-xl border border-indigo-200 bg-white px-4 py-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-indigo-500">
                    Destino
                  </div>

                  <div className="mt-1 text-lg font-semibold text-indigo-700">
                    Corte
                  </div>
                </div>
              </div>
            </section>

            {/* ===============================================
                FECHAS GENERALES
               =============================================== */}

            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Fechas del pedido
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Define las fechas una sola
                  vez y aplícalas a todos los
                  ítems. Después puedes
                  modificar individualmente
                  cualquier excepción.
                </p>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {/* FECHA ALMACÉN */}

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Fecha estimada entrega a
                    almacén
                  </label>

                  <input
                    type="date"
                    value={
                      fechaGeneralAlmacen
                    }
                    onChange={(
                      e
                    ) =>
                      setFechaGeneralAlmacen(
                        e.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />

                  <div className="mt-1 text-xs text-slate-500">
                    {fechaGeneralAlmacen
                      ? formatESDate(
                          fechaGeneralAlmacen
                        )
                      : "Sin fecha seleccionada"}
                  </div>
                </div>

                {/* FECHA DESPACHO */}

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Fecha estimada despacho
                  </label>

                  <input
                    type="date"
                    value={
                      fechaGeneralDespacho
                    }
                    onChange={(
                      e
                    ) =>
                      setFechaGeneralDespacho(
                        e.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />

                  <div className="mt-1 text-xs text-slate-500">
                    {fechaGeneralDespacho
                      ? formatESDate(
                          fechaGeneralDespacho
                        )
                      : "Sin fecha seleccionada"}
                  </div>
                </div>
              </div>

              {/* APLICAR */}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
                <div>
                  <div className="text-sm font-medium text-slate-800">
                    Aplicar a todos los ítems
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    Las fechas individuales
                    existentes serán
                    reemplazadas únicamente
                    para las fechas generales
                    que hayas seleccionado.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={
                    aplicarFechasATodos
                  }
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Aplicar fechas a todos
                </button>
              </div>

              {/* RESUMEN */}

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Ítems
                  </div>

                  <div className="mt-1 text-xl font-semibold text-slate-900">
                    {
                      resumenFechas.total
                    }
                  </div>
                </div>

                <div
                  className={`rounded-xl p-4 ${
                    resumenFechas.sinAlmacen ===
                    0
                      ? "bg-emerald-50"
                      : "bg-amber-50"
                  }`}
                >
                  <div
                    className={`text-xs uppercase tracking-wide ${
                      resumenFechas.sinAlmacen ===
                      0
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }`}
                  >
                    Fecha almacén
                  </div>

                  <div
                    className={`mt-1 text-xl font-semibold ${
                      resumenFechas.sinAlmacen ===
                      0
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }`}
                  >
                    {
                      resumenFechas.conAlmacen
                    }
                    /
                    {
                      resumenFechas.total
                    }
                  </div>
                </div>

                <div
                  className={`rounded-xl p-4 ${
                    resumenFechas.sinDespacho ===
                    0
                      ? "bg-emerald-50"
                      : "bg-amber-50"
                  }`}
                >
                  <div
                    className={`text-xs uppercase tracking-wide ${
                      resumenFechas.sinDespacho ===
                      0
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }`}
                  >
                    Fecha despacho
                  </div>

                  <div
                    className={`mt-1 text-xl font-semibold ${
                      resumenFechas.sinDespacho ===
                      0
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }`}
                  >
                    {
                      resumenFechas.conDespacho
                    }
                    /
                    {
                      resumenFechas.total
                    }
                  </div>
                </div>
              </div>
            </section>

            {/* ===============================================
                OBSERVACIONES
               =============================================== */}

            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Observaciones de planeación
              </label>

              <textarea
                value={obs}
                onChange={(e) =>
                  setObs(
                    e.target.value
                  )
                }
                rows={3}
                className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                placeholder="Prioridad, aclaraciones, instrucciones especiales..."
              />
            </section>

            {/* ===============================================
                ITEMS
               =============================================== */}

            <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">
                      Ítems del pedido
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      Todos se enviarán a
                      Corte. Las fechas pueden
                      ajustarse individualmente
                      cuando exista una
                      excepción.
                    </p>
                  </div>

                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                    {
                      computed.length
                    }{" "}
                    ítem(s)
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">
                        Producto
                      </th>

                      <th className="px-4 py-3 text-left font-medium">
                        Destino
                      </th>

                      <th className="px-4 py-3 text-right font-medium">
                        Cantidad
                      </th>

                      <th className="px-4 py-3 text-left font-medium">
                        Entrega a almacén
                      </th>

                      <th className="px-4 py-3 text-left font-medium">
                        Despacho
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {computed.map(
                      (
                        item
                      ) => (
                        <tr
                          key={
                            item.uid
                          }
                          className="align-top hover:bg-slate-50"
                        >
                          {/* PRODUCTO */}

                          <td className="px-4 py-4">
                            <div className="font-medium text-slate-900">
                              {item.producto ||
                                "—"}
                            </div>

                            {item.productoKey ? (
                              <div className="mt-1 text-xs text-slate-400">
                                {
                                  item.productoKey
                                }
                              </div>
                            ) : null}
                          </td>

                          {/* DESTINO */}

                          <td className="px-4 py-4">
                            <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                              Corte
                            </span>

                            <div className="mt-2 text-[11px] text-slate-500">
                              Automático
                            </div>
                          </td>

                          {/* CANTIDAD */}

                          <td className="px-4 py-4 text-right">
                            <div className="font-semibold text-slate-900">
                              {item.solicitada.toLocaleString(
                                "es-CO"
                              )}
                            </div>

                            <div className="text-xs text-slate-500">
                              und
                            </div>
                          </td>

                          {/* FECHA ALMACÉN */}

                          <td className="min-w-[190px] px-4 py-4">
                            <input
                              type="date"
                              value={
                                fechaAlmacen[
                                  item
                                    .uid
                                ] ||
                                ""
                              }
                              onChange={(
                                e
                              ) =>
                                setFechaAlmacen(
                                  (
                                    prev
                                  ) => ({
                                    ...prev,

                                    [item.uid]:
                                      e
                                        .target
                                        .value,
                                  })
                                )
                              }
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            />

                            <div className="mt-1 text-[11px] text-slate-500">
                              {fechaAlmacen[
                                item
                                  .uid
                              ]
                                ? formatESDate(
                                    fechaAlmacen[
                                      item
                                        .uid
                                    ]
                                  )
                                : "Pendiente"}
                            </div>
                          </td>

                          {/* FECHA DESPACHO */}

                          <td className="min-w-[190px] px-4 py-4">
                            <input
                              type="date"
                              value={
                                fechaDespacho[
                                  item
                                    .uid
                                ] ||
                                ""
                              }
                              onChange={(
                                e
                              ) =>
                                setFechaDespacho(
                                  (
                                    prev
                                  ) => ({
                                    ...prev,

                                    [item.uid]:
                                      e
                                        .target
                                        .value,
                                  })
                                )
                              }
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            />

                            <div className="mt-1 text-[11px] text-slate-500">
                              {fechaDespacho[
                                item
                                  .uid
                              ]
                                ? formatESDate(
                                    fechaDespacho[
                                      item
                                        .uid
                                    ]
                                  )
                                : "Pendiente"}
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {/* PIE */}

              <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    Al guardar, PEX enviará{" "}
                    <b>
                      todos los ítems
                    </b>{" "}
                    de este pedido a{" "}
                    <b>Corte</b>.
                  </div>

                  <button
                    type="button"
                    onClick={
                      guardar
                    }
                    disabled={
                      saving
                    }
                    className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {saving
                      ? "Guardando..."
                      : "Guardar planeación"}
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
    </main>
  );
}