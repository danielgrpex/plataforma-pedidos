"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

type SolicitudCorte = {
  solicitudCorteId: string;
  pedidoKey: string;
  rowIndexPedido: string;

  productoSolicitado: string;
  cantidadSolicitadaUnd: string;

  inventarioOrigenId?: string;
  productoOrigen?: string;
  largoOrigen?: string;
  cantidadOrigenUnd?: string;

  largoFinal?: string;
  actividades?: string;
  cantidadResultanteUnd?: string;

  estadoitem: string;
  fechaCreacion?: string;
  usuario?: string;

  OTE?: string;
};

function toNumber(value?: string) {
  const raw = String(
    value ?? ""
  ).trim();

  if (!raw) {
    return 0;
  }

  const normalized =
    raw
      .replace(/\s/g, "")
      .replace(",", ".");

  const n = Number(normalized);

  return Number.isFinite(n)
    ? n
    : 0;
}

function formatCantidad(
  value: number
) {
  return Number(
    value || 0
  ).toLocaleString(
    "es-CO",
    {
      maximumFractionDigits: 0,
    }
  );
}

function formatFechaColombia(
  value?: string
) {
  if (!value) {
    return "—";
  }

  const fecha =
    new Date(value);

  if (
    Number.isNaN(
      fecha.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "es-CO",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone:
        "America/Bogota",
    }
  )
    .format(fecha)
    .replace(".", "");
}

function parsePedidoKey(
  pedidoKey: string
) {
  const partes =
    String(
      pedidoKey || ""
    ).split("|");

  return {
    cliente:
      partes[0]?.trim() ||
      "—",

    direccion:
      partes[1]?.trim() ||
      "",

    oc:
      partes[2]?.trim() ||
      "",
  };
}

export default function PlaneacionProgramacionCortePage() {
  const router =
    useRouter();

  const [
    items,
    setItems,
  ] =
    useState<
      SolicitudCorte[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    q,
    setQ,
  ] =
    useState("");

  const [
    selected,
    setSelected,
  ] =
    useState<
      Record<
        string,
        boolean
      >
    >({});

  const [
    msg,
    setMsg,
  ] =
    useState("");

  const [
    err,
    setErr,
  ] =
    useState("");

  const [
    creating,
    setCreating,
  ] =
    useState(false);

  /* =======================================================
     CARGAR PENDIENTES
     ======================================================= */

  async function loadCortePendiente() {
    setErr("");
    setMsg("");
    setLoading(true);

    try {
      const url =
        `/api/planeacion/programacion/corte/solicitudes?estado=Pendiente&q=${encodeURIComponent(
          q.trim()
        )}`;

      const res =
        await fetch(
          url,
          {
            cache:
              "no-store",
          }
        );

      const json =
        await res
          .json()
          .catch(
            () => null
          );

      if (
        !res.ok ||
        !json?.success
      ) {
        throw new Error(
          json?.message ||
            "No se pudieron cargar las solicitudes de corte."
        );
      }

      /*
       * Regla defensiva:
       *
       * Esta pantalla solamente puede
       * mostrar solicitudes:
       *
       * - estado Pendiente
       * - sin OTE asignada
       */
      const list =
        (
          json.items ||
          []
        )
          .filter(
            (
              item: SolicitudCorte
            ) =>
              String(
                item.estadoitem ||
                  ""
              )
                .trim()
                .toLowerCase() ===
                "pendiente"
          )
          .filter(
            (
              item: SolicitudCorte
            ) =>
              !String(
                item.OTE ||
                  ""
              ).trim()
          ) as SolicitudCorte[];

      setItems(list);

      /*
       * Conservamos únicamente
       * selecciones que todavía
       * existan como pendientes.
       */
      setSelected(
        (prev) => {
          const allow =
            new Set(
              list.map(
                (item) =>
                  item.solicitudCorteId
              )
            );

          const next: Record<
            string,
            boolean
          > = {};

          Object.entries(
            prev
          ).forEach(
            ([
              id,
              value,
            ]) => {
              if (
                value &&
                allow.has(
                  id
                )
              ) {
                next[id] =
                  true;
              }
            }
          );

          return next;
        }
      );
    } catch (e) {
      console.error(e);

      setErr(
        e instanceof Error
          ? e.message
          : "Error cargando solicitudes."
      );

      setItems([]);
      setSelected({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCortePendiente();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =======================================================
     FILTRO VISUAL
     ======================================================= */

  const itemsFiltrados =
    useMemo(() => {
      const buscar =
        q
          .trim()
          .toLowerCase();

      if (!buscar) {
        return items;
      }

      return items.filter(
        (item) => {
          const haystack =
            [
              item.solicitudCorteId,
              item.pedidoKey,
              item.rowIndexPedido,
              item.productoSolicitado,
              item.fechaCreacion,
              item.usuario,
            ]
              .join(" ")
              .toLowerCase();

          return haystack.includes(
            buscar
          );
        }
      );
    }, [items, q]);

  /* =======================================================
     RESUMEN DEL LOTE PENDIENTE
     ======================================================= */

  const totalPendienteUnd =
    useMemo(
      () =>
        items.reduce(
          (
            total,
            item
          ) =>
            total +
            toNumber(
              item.cantidadSolicitadaUnd
            ),
          0
        ),
      [items]
    );

  const pedidosPendientes =
    useMemo(() => {
      return new Set(
        items.map(
          (item) =>
            item.pedidoKey
        )
      ).size;
    }, [items]);

  const productosPendientes =
    useMemo(() => {
      return new Set(
        items.map(
          (item) =>
            item.productoSolicitado
        )
      ).size;
    }, [items]);

  /* =======================================================
     SELECCIÓN
     ======================================================= */

  const selectedIds =
    useMemo(
      () =>
        Object.entries(
          selected
        )
          .filter(
            ([, value]) =>
              value
          )
          .map(
            ([id]) => id
          ),
      [selected]
    );

  const selectedRows =
    useMemo(() => {
      const map =
        new Map(
          items.map(
            (item) => [
              item.solicitudCorteId,
              item,
            ]
          )
        );

      return selectedIds
        .map(
          (id) =>
            map.get(id)
        )
        .filter(
          Boolean
        ) as SolicitudCorte[];
    }, [
      items,
      selectedIds,
    ]);

  const totalSelectedUND =
    useMemo(
      () =>
        selectedRows.reduce(
          (
            total,
            item
          ) =>
            total +
            toNumber(
              item.cantidadSolicitadaUnd
            ),
          0
        ),
      [selectedRows]
    );

  const pedidosSeleccionados =
    useMemo(
      () =>
        new Set(
          selectedRows.map(
            (item) =>
              item.pedidoKey
          )
        ).size,
      [selectedRows]
    );

  const agrupadoPorProducto =
    useMemo(() => {
      const map =
        new Map<
          string,
          {
            producto: string;
            und: number;
            count: number;
          }
        >();

      for (
        const item of
        selectedRows
      ) {
        const key =
          (
            item.productoSolicitado ||
            "—"
          ).trim();

        const actual =
          map.get(key) || {
            producto: key,
            und: 0,
            count: 0,
          };

        actual.und +=
          toNumber(
            item.cantidadSolicitadaUnd
          );

        actual.count +=
          1;

        map.set(
          key,
          actual
        );
      }

      return Array.from(
        map.values()
      ).sort(
        (a, b) =>
          b.und -
          a.und
      );
    }, [selectedRows]);

  const loteCompletoSeleccionado =
    useMemo(() => {
      if (!items.length) {
        return false;
      }

      return items.every(
        (item) =>
          selected[
            item.solicitudCorteId
          ]
      );
    }, [
      items,
      selected,
    ]);

  function seleccionarLoteCompleto() {
    const next: Record<
      string,
      boolean
    > = {};

    for (
      const item of
      items
    ) {
      next[
        item.solicitudCorteId
      ] = true;
    }

    setSelected(next);
    setErr("");
    setMsg("");
  }

  function limpiarSeleccion() {
    setSelected({});
    setErr("");
    setMsg("");
  }

  function toggleItem(
    solicitudCorteId: string
  ) {
    setSelected(
      (prev) => ({
        ...prev,

        [solicitudCorteId]:
          !prev[
            solicitudCorteId
          ],
      })
    );

    setErr("");
    setMsg("");
  }

  /* =======================================================
     CREAR OTE
     ======================================================= */

  async function crearOTE() {
    setErr("");
    setMsg("");

    if (
      !selectedIds.length
    ) {
      setErr(
        "Selecciona los ítems que harán parte del lote antes de generar la OTE."
      );

      return;
    }

    try {
      setCreating(true);

      setMsg(
        "Generando Orden de Trabajo…"
      );

      const res =
        await fetch(
          "/api/planeacion/programacion/corte/ote/crear",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  solicitudCorteIds:
                    selectedIds,

                  usuario:
                    "planeacion",
                }
              ),
          }
        );

      const json =
        await res
          .json()
          .catch(
            () => null
          );

      if (
        !res.ok ||
        !json?.success
      ) {
        throw new Error(
          json?.message ||
            "No se pudo crear la OTE."
        );
      }

      const ote =
        String(
          json.ote ||
            ""
        ).trim();

      if (!ote) {
        throw new Error(
          "La OTE fue creada, pero el servidor no devolvió el número generado."
        );
      }

      /*
       * El flujo deja de terminar
       * en esta pantalla.
       *
       * Abrimos directamente la
       * Orden de Trabajo recién creada.
       */
      router.push(
        `/planeacion/programacion/corte/ote/${encodeURIComponent(
          ote
        )}`
      );
    } catch (e) {
      console.error(e);

      setErr(
        e instanceof Error
          ? e.message
          : "Error creando OTE."
      );

      setMsg("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      {/* =================================================
          CABECERA
         ================================================= */}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-slate-500">
            Planeación · Programación · Corte
          </div>

          <h1 className="mt-1 text-2xl font-semibold">
            Generar Orden de Trabajo
          </h1>

          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Selecciona el lote pendiente que quieres convertir en una OTE.
            PEX solo muestra solicitudes en estado{" "}
            <b>Pendiente</b> y sin Orden de Trabajo asignada.
          </p>
        </div>

        <Link
          href="/planeacion/programacion"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
        >
          ← Volver
        </Link>
      </div>

      {/* =================================================
          PASO 1 · LOTE PENDIENTE
         ================================================= */}

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                Paso 1
              </div>

              <h2 className="mt-1 text-lg font-semibold">
                ¿Cuál lote quieres generar?
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                El lote pendiente actual contiene todos los ítems que todavía no tienen OTE.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={
                  seleccionarLoteCompleto
                }
                disabled={
                  loading ||
                  !items.length ||
                  loteCompletoSeleccionado
                }
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Seleccionar lote completo
              </button>

              <button
                type="button"
                onClick={
                  limpiarSeleccion
                }
                disabled={
                  !selectedIds.length
                }
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Limpiar selección
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs text-slate-500">
              Ítems pendientes
            </div>

            <div className="mt-1 text-2xl font-semibold">
              {items.length}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs text-slate-500">
              Pedidos
            </div>

            <div className="mt-1 text-2xl font-semibold">
              {pedidosPendientes}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs text-slate-500">
              Productos distintos
            </div>

            <div className="mt-1 text-2xl font-semibold">
              {productosPendientes}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs text-slate-500">
              Unidades pendientes
            </div>

            <div className="mt-1 text-2xl font-semibold">
              {formatCantidad(
                totalPendienteUnd
              )}
            </div>
          </div>
        </div>
      </section>

      {/* =================================================
          PASO 2 · REVISAR ÍTEMS
         ================================================= */}

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                Paso 2
              </div>

              <h2 className="mt-1 text-lg font-semibold">
                Revisar ítems del lote
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Puedes dejar el lote completo o quitar únicamente los ítems que no quieras incluir en esta OTE.
              </p>
            </div>

            <div className="flex w-full gap-2 md:w-auto">
              <input
                value={q}
                onChange={(
                  e
                ) =>
                  setQ(
                    e.target.value
                  )
                }
                onKeyDown={(
                  e
                ) => {
                  if (
                    e.key ===
                    "Enter"
                  ) {
                    loadCortePendiente();
                  }
                }}
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm md:w-[360px]"
                placeholder="Buscar cliente, OC, producto, consecutivo…"
              />

              <button
                type="button"
                onClick={
                  loadCortePendiente
                }
                disabled={
                  loading
                }
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                {loading
                  ? "Cargando…"
                  : "Buscar"}
              </button>
            </div>
          </div>
        </div>

        {err && (
          <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
            {err}
          </div>
        )}

        {msg && (
          <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-3 text-sm text-emerald-700">
            {msg}
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Cargando solicitudes pendientes…
          </div>
        ) : !itemsFiltrados.length ? (
          <div className="p-8 text-center">
            <div className="font-medium">
              No hay solicitudes pendientes para mostrar.
            </div>

            <div className="mt-1 text-sm text-slate-500">
              Cuando Planeación genere nuevas solicitudes de Corte, aparecerán aquí automáticamente.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="w-[58px] px-4 py-3 text-center font-medium">
                    Sel.
                  </th>

                  <th className="px-4 py-3 text-left font-medium">
                    Consecutivo
                  </th>

                  <th className="px-4 py-3 text-left font-medium">
                    Cliente / OC
                  </th>

                  <th className="px-4 py-3 text-left font-medium">
                    Producto
                  </th>

                  <th className="px-4 py-3 text-right font-medium">
                    Cantidad
                  </th>

                  <th className="px-4 py-3 text-left font-medium">
                    Creación
                  </th>

                  <th className="px-4 py-3 text-center font-medium">
                    Estado
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {itemsFiltrados.map(
                  (item) => {
                    const pedido =
                      parsePedidoKey(
                        item.pedidoKey
                      );

                    const checked =
                      Boolean(
                        selected[
                          item.solicitudCorteId
                        ]
                      );

                    return (
                      <tr
                        key={
                          item.solicitudCorteId
                        }
                        onClick={() =>
                          toggleItem(
                            item.solicitudCorteId
                          )
                        }
                        className={[
                          "cursor-pointer transition",
                          checked
                            ? "bg-indigo-50/60"
                            : "hover:bg-slate-50",
                        ].join(
                          " "
                        )}
                      >
                        <td className="px-4 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={
                              checked
                            }
                            onChange={() =>
                              toggleItem(
                                item.solicitudCorteId
                              )
                            }
                            onClick={(
                              e
                            ) =>
                              e.stopPropagation()
                            }
                            className="h-4 w-4 rounded border-slate-300"
                          />
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="font-semibold">
                            {Number(
                              item.rowIndexPedido
                            ).toLocaleString(
                              "es-CO"
                            )}
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            {
                              item.solicitudCorteId
                            }
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="max-w-[280px] font-medium">
                            {
                              pedido.cliente
                            }
                          </div>

                          {pedido.oc && (
                            <div className="mt-1 text-xs text-slate-500">
                              OC:{" "}
                              {
                                pedido.oc
                              }
                            </div>
                          )}

                          {pedido.direccion && (
                            <div className="mt-1 max-w-[300px] text-xs text-slate-400">
                              {
                                pedido.direccion
                              }
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="max-w-[420px]">
                            {
                              item.productoSolicitado
                            }
                          </div>
                        </td>

                        <td className="px-4 py-4 text-right align-top">
                          <div className="font-semibold">
                            {formatCantidad(
                              toNumber(
                                item.cantidadSolicitadaUnd
                              )
                            )}
                          </div>

                          <div className="text-xs text-slate-400">
                            und
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top text-xs text-slate-500">
                          {formatFechaColombia(
                            item.fechaCreacion
                          )}
                        </td>

                        <td className="px-4 py-4 text-center align-top">
                          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                            Pendiente
                          </span>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* =================================================
          PASO 3 · RESUMEN Y GENERAR
         ================================================= */}

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Paso 3
            </div>

            <h2 className="mt-1 text-lg font-semibold">
              Confirmar lote y generar OTE
            </h2>

            {!selectedIds.length ? (
              <p className="mt-2 text-sm text-slate-500">
                Selecciona el lote completo o marca manualmente los ítems que deseas incluir.
              </p>
            ) : (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">
                      Ítems seleccionados
                    </div>

                    <div className="mt-1 text-xl font-semibold">
                      {
                        selectedIds.length
                      }
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">
                      Pedidos
                    </div>

                    <div className="mt-1 text-xl font-semibold">
                      {
                        pedidosSeleccionados
                      }
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">
                      Unidades
                    </div>

                    <div className="mt-1 text-xl font-semibold">
                      {formatCantidad(
                        totalSelectedUND
                      )}
                    </div>
                  </div>
                </div>

                {agrupadoPorProducto.length >
                  0 && (
                  <div className="mt-4">
                    <div className="text-xs font-semibold text-slate-500">
                      RESUMEN POR PRODUCTO
                    </div>

                    <div className="mt-2 max-h-[220px] overflow-auto rounded-xl border border-slate-200">
                      {agrupadoPorProducto.map(
                        (
                          grupo
                        ) => (
                          <div
                            key={
                              grupo.producto
                            }
                            className="flex items-start justify-between gap-4 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {
                                  grupo.producto
                                }
                              </div>

                              <div className="text-xs text-slate-400">
                                {
                                  grupo.count
                                }{" "}
                                ítem(s)
                              </div>
                            </div>

                            <div className="shrink-0 font-semibold">
                              {formatCantidad(
                                grupo.und
                              )}{" "}
                              und
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="w-full shrink-0 md:w-[290px]">
            <button
              type="button"
              onClick={
                crearOTE
              }
              disabled={
                creating ||
                !selectedIds.length
              }
              className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {creating
                ? "Generando OTE…"
                : "Generar Orden de Trabajo"}
            </button>

            <p className="mt-2 text-center text-xs text-slate-400">
              Al generar, PEX abrirá automáticamente la nueva Orden de Trabajo.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
