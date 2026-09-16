"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import {
  allowedAbastecimientoLogisticaTabsForUser,
} from "@/lib/auth/permissions";

/* =========================================================
   TIPOS
   ========================================================= */

type InventarioItem = {
  sheetRow: number;

  inventarioKey: string;

  OPE: string;
  producto: string;

  referencia: string;
  color: string;
  ancho: string;
  acabado: string;

  medida_mm: number;
  cantidadDisponible: number;

  fechaUltimoMovimiento: string;
  estado: string;
};

type ApiResponse = {
  ok: boolean;

  totalRegistros: number;
  totalLotes: number;
  totalUnidades: number;

  inventario: InventarioItem[];

  error?: string;
};

/* =========================================================
   HELPERS
   ========================================================= */

function formatMedida(mm: number) {
  if (!mm) {
    return "-";
  }

  const metros =
    mm / 1000;

  return `${metros.toLocaleString(
    "es-CO",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    }
  )} m`;
}

function formatFecha(
  value: string
) {
  if (!value) {
    return "-";
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

  return date.toLocaleString(
    "es-CO",
    {
      dateStyle: "short",
      timeStyle: "short",
    }
  );
}

/* =========================================================
   COMPONENTE
   ========================================================= */

export default function InventarioProductoProcesoLogisticaPage() {
  const {
    data: session,
    status,
  } = useSession();

  const email =
    (session?.user as any)?.email ||
    "";

  const role =
    (session?.user as any)?.role ||
    "";

  /* =======================================================
     PERMISOS

     Logística y Admin pueden entrar.
     Comercial no puede consultar Inventario P.P.
     ======================================================= */

  const allowedTabs =
    allowedAbastecimientoLogisticaTabsForUser(
      {
        email,
        role,
      }
    );

  const canAccess =
    allowedTabs.includes(
      "inventarioProductoProceso"
    );

  /* =======================================================
     ESTADOS
     ======================================================= */

  const [
    data,
    setData,
  ] =
    useState<ApiResponse | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    search,
    setSearch,
  ] =
    useState("");

  /* =======================================================
     CARGAR INVENTARIO
     ======================================================= */

  async function cargarInventario() {
    try {
      setLoading(true);
      setError("");

      /*
       * IMPORTANTE:
       *
       * Consultamos exactamente el mismo endpoint
       * que utiliza Producción.
       *
       * Por tanto:
       *
       * Producción
       *      ↓
       * InventarioProceso
       *
       * Logística
       *      ↓
       * InventarioProceso
       *
       * No existe un inventario paralelo.
       */
      const res =
        await fetch(
          "/api/produccion/control-producto-proceso/inventario",
          {
            cache:
              "no-store",
          }
        );

      const json =
        (await res.json()) as ApiResponse;

      if (
        !res.ok ||
        !json?.ok
      ) {
        throw new Error(
          json?.error ||
            "No fue posible consultar el inventario."
        );
      }

      setData(
        json
      );
    } catch (e: any) {
      setError(
        e?.message ||
          "Ocurrió un error consultando el inventario."
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     CARGA INICIAL
     ======================================================= */

  useEffect(() => {
    if (
      status ===
      "loading"
    ) {
      return;
    }

    if (!canAccess) {
      setLoading(false);
      return;
    }

    cargarInventario();
  }, [
    status,
    canAccess,
  ]);

  /* =======================================================
     FILTRO
     ======================================================= */

  const inventarioFiltrado =
    useMemo(() => {
      const inventario =
        data?.inventario ||
        [];

      const q =
        search
          .trim()
          .toLowerCase();

      if (!q) {
        return inventario;
      }

      return inventario.filter(
        (item) => {
          const medidaMetros =
            formatMedida(
              item.medida_mm
            ).toLowerCase();

          return [
            item.OPE,
            item.producto,
            item.referencia,
            item.color,
            item.ancho,
            item.acabado,
            item.estado,
            String(
              item.medida_mm
            ),
            medidaMetros,
          ].some(
            (value) =>
              String(
                value ||
                  ""
              )
                .toLowerCase()
                .includes(q)
          );
        }
      );
    }, [
      data,
      search,
    ]);

  /* =======================================================
     AGRUPACIÓN POR OPE
     ======================================================= */

  const grupos =
    useMemo(() => {
      const map =
        new Map<
          string,
          InventarioItem[]
        >();

      inventarioFiltrado.forEach(
        (item) => {
          const actual =
            map.get(
              item.OPE
            ) || [];

          actual.push(
            item
          );

          map.set(
            item.OPE,
            actual
          );
        }
      );

      return Array.from(
        map.entries()
      ).map(
        ([
          OPE,
          items,
        ]) => ({
          OPE,

          items,

          totalUnidades:
            items.reduce(
              (
                acc,
                item
              ) =>
                acc +
                item.cantidadDisponible,
              0
            ),
        })
      );
    }, [
      inventarioFiltrado,
    ]);

  /* =======================================================
     SESIÓN
     ======================================================= */

  if (
    status ===
    "loading"
  ) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-500">
            Cargando...
          </p>
        </div>
      </main>
    );
  }

  /* =======================================================
     SIN PERMISO
     ======================================================= */

  if (!canAccess) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-semibold text-red-800">
            Acceso no autorizado
          </h1>

          <p className="mt-2 text-sm text-red-700">
            Tu usuario no tiene permisos para consultar el inventario de producto en proceso.
          </p>

          <Link
            href="/abastecimientologistica"
            className="mt-4 inline-flex rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            ← Volver a Abastecimiento y Logística
          </Link>
        </div>
      </main>
    );
  }

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      {/* ===================================================
          CABECERA
         =================================================== */}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 text-sm text-neutral-500">
            Abastecimiento y Logística · Inventario producto en proceso · Inventario actual
          </div>

          <div className="mb-3 inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-100">
            Producto en proceso
          </div>

          <h1 className="text-2xl font-semibold text-neutral-900">
            Inventario actual
          </h1>

          <p className="mt-1 text-sm text-neutral-600">
            Existencias oficiales disponibles de producto en proceso por OPE, producto y medida.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={
              cargarInventario
            }
            disabled={
              loading
            }
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ↻ Actualizar
          </button>

          <Link
            href="/abastecimientologistica?tab=inventarioProductoProceso"
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            ← Inventario P.P.
          </Link>
        </div>
      </div>

      {/* ===================================================
          AVISO FUENTE OFICIAL
         =================================================== */}

      <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-blue-900">
              Inventario oficial PEX
            </div>

            <p className="mt-1 text-sm text-blue-700">
              Esta consulta muestra exactamente el mismo inventario utilizado por Producción.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-white px-4 py-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Fuente
            </div>

            <div className="mt-0.5 text-sm font-semibold text-emerald-900">
              InventarioProceso
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================
          RESUMEN
         =================================================== */}

      <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-3">
          {/* LOTES */}

          <div className="rounded-xl bg-neutral-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Lotes con saldo
            </div>

            <div className="mt-1 text-2xl font-semibold text-neutral-900">
              {data?.totalLotes ??
                0}
            </div>
          </div>

          {/* EXISTENCIAS */}

          <div className="rounded-xl bg-neutral-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Existencias
            </div>

            <div className="mt-1 text-2xl font-semibold text-neutral-900">
              {data?.totalRegistros ??
                0}
            </div>
          </div>

          {/* UNIDADES */}

          <div className="rounded-xl bg-orange-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-orange-700">
              Unidades disponibles
            </div>

            <div className="mt-1 text-2xl font-semibold text-orange-800">
              {(
                data?.totalUnidades ??
                0
              ).toLocaleString(
                "es-CO"
              )}
            </div>
          </div>
        </div>

        {/* BUSCADOR */}

        <div className="mt-5">
          <label className="text-sm font-medium text-neutral-700">
            Buscar inventario
          </label>

          <input
            value={
              search
            }
            onChange={(
              e
            ) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Ej. OPE260361, Enganche Central, Blanco, 2,55 m..."
            className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />

          <p className="mt-2 text-xs text-neutral-500">
            Puedes buscar por OPE, producto, referencia, color, ancho, acabado o medida.
          </p>
        </div>
      </section>

      {/* ===================================================
          CONTENIDO
         =================================================== */}

      {loading ? (
        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-500">
            Consultando inventario...
          </p>
        </section>
      ) : error ? (
        <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-medium text-red-700">
            {error}
          </p>
        </section>
      ) : grupos.length ===
        0 ? (
        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-500">
            No se encontraron existencias disponibles con ese criterio.
          </p>
        </section>
      ) : (
        <section className="mt-6 space-y-4">
          {grupos.map(
            (
              grupo
            ) => (
              <div
                key={
                  grupo.OPE
                }
                className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
              >
                {/* =========================================
                    CABECERA DEL LOTE
                   ========================================= */}

                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-neutral-900">
                        {
                          grupo.OPE
                        }
                      </h2>

                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        Disponible
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-neutral-500">
                      {
                        grupo.items.length
                      }{" "}
                      {grupo
                        .items
                        .length ===
                      1
                        ? "existencia"
                        : "existencias"}
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-neutral-500">
                      Total disponible lote
                    </div>

                    <div className="text-xl font-semibold text-neutral-900">
                      {grupo.totalUnidades.toLocaleString(
                        "es-CO"
                      )}{" "}
                      und
                    </div>
                  </div>
                </div>

                {/* =========================================
                    EXISTENCIAS DEL LOTE
                   ========================================= */}

                <div className="mt-5 overflow-hidden rounded-xl border border-neutral-200">
                  <div className="divide-y divide-neutral-200">
                    {grupo.items.map(
                      (
                        item
                      ) => (
                        <div
                          key={
                            item.inventarioKey
                          }
                          className="grid gap-4 p-4 lg:grid-cols-[1fr_130px_150px]"
                        >
                          {/* PRODUCTO */}

                          <div>
                            <div className="text-sm font-medium text-neutral-900">
                              {
                                item.producto
                              }
                            </div>

                            {item.referencia ? (
                              <div className="mt-1 text-xs text-neutral-500">
                                Ref:{" "}
                                {
                                  item.referencia
                                }
                              </div>
                            ) : null}

                            <div className="mt-2 flex flex-wrap gap-2">
                              {item.color ? (
                                <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-600">
                                  {
                                    item.color
                                  }
                                </span>
                              ) : null}

                              {item.ancho ? (
                                <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-600">
                                  {
                                    item.ancho
                                  }
                                </span>
                              ) : null}

                              {item.acabado ? (
                                <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-600">
                                  {
                                    item.acabado
                                  }
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-2 text-xs text-neutral-400">
                              Último movimiento:{" "}
                              {formatFecha(
                                item.fechaUltimoMovimiento
                              )}
                            </div>
                          </div>

                          {/* MEDIDA */}

                          <div className="lg:text-right">
                            <div className="text-xs text-neutral-500">
                              Medida
                            </div>

                            <div className="mt-1 text-lg font-semibold text-neutral-900">
                              {formatMedida(
                                item.medida_mm
                              )}
                            </div>

                            <div className="mt-1 text-xs text-neutral-400">
                              {item.medida_mm.toLocaleString(
                                "es-CO"
                              )}{" "}
                              mm
                            </div>
                          </div>

                          {/* SALDO */}

                          <div className="lg:text-right">
                            <div className="text-xs text-neutral-500">
                              Disponible
                            </div>

                            <div className="mt-1 text-2xl font-semibold text-emerald-700">
                              {item.cantidadDisponible.toLocaleString(
                                "es-CO"
                              )}{" "}
                              <span className="text-sm font-medium">
                                und
                              </span>
                            </div>

                            <div className="mt-1 text-xs font-medium text-emerald-600">
                              {
                                item.estado
                              }
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )
          )}
        </section>
      )}
    </main>
  );
}