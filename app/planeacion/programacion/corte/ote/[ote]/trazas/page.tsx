"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

/* =========================================================
   TIPOS
   ========================================================= */

type OTEItem = {
  solicitudCorteId: string;
  sheetRowSolicitudCorte: number;

  pedidoKey: string;
  rowIndexPedido: number;
  consecutivo: string;

  cliente: string;
  direccion: string;
  oc: string;
  fechaRequerida: string;

  productoPedido: string;
  cantidadPedido: unknown;

  productoSolicitado: string;
  cantidadSolicitadaUnd: number;

  inventarioOrigenId: string;
  productoOrigen: string;
  largoOrigen: string;
  cantidadOrigenUnd: number;

  largoFinal: string;
  actividades: string;
  cantidadResultanteUnd: number;

  estadoitem: string;
  fechaCreacion: string;
  usuario: string;
  ote: string;

  referencia: string;
  color: string;
  ancho: string;
  largo: string;
  acabado: string;

  codigoSiigo: string;
};

type OTEResponse = {
  success: boolean;

  ote: string;

  resumen: {
    totalItems: number;
    totalPedidos: number;
    totalUnidades: number;
  };

  items: OTEItem[];

  message?: string;
};

type UnidadEmpaqueItem = {
  sheetRow: number;

  productoInicial: string;
  productoNormalizado: string;

  valorOriginal: string;

  cantidadPorPaquete: number | null;

  tipo:
    | "FIJO"
    | "DEPENDE_LARGO"
    | "DEPENDE_ACABADOS"
    | "SIN_CONFIGURAR"
    | "REVISAR"
    | string;

  requiereValidacion: boolean;

  motivo: string;
};

type UnidadEmpaqueResponse = {
  success: boolean;

  resumen: {
    total: number;
    fijos: number;
    dependeLargo: number;
    dependeAcabados: number;
    revisar: number;
  };

  items: UnidadEmpaqueItem[];

  message?: string;
};

type ConfigEmpaque = {
  solicitudCorteId: string;

  productoInicial: string;

  cantidadSolicitada: number;

  cantidadSugerida: number;

  cantidadPorPaquete: number;

  tipoMaestro: string;

  valorMaestro: string;

  motivo: string;

  encontradoEnMaestro: boolean;

  requiereValidacion: boolean;

  confirmado: boolean;

  modificado: boolean;
};

/* =========================================================
   HELPERS
   ========================================================= */

function normalizarProducto(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s*\|\s*/g, "|")
    .replace(/\s+/g, " ")
    .trim();
}

function construirProductoInicial(item: OTEItem) {
  return [item.referencia, item.color, item.ancho]
    .filter(Boolean)
    .join(" | ");
}

function formatCantidad(value: number) {
  return Number(value || 0).toLocaleString("es-CO", {
    maximumFractionDigits: 3,
  });
}

/*
 * Ejemplo:
 *
 * cantidadSolicitada = 350
 * cantidadPorPaquete = 80
 *
 * Resultado:
 * [80, 80, 80, 80, 30]
 */
function calcularDistribucion(
  cantidadSolicitada: number,
  cantidadPorPaquete: number
) {
  const solicitado = Math.max(
    0,
    Math.floor(Number(cantidadSolicitada || 0))
  );

  const capacidad = Math.max(
    0,
    Math.floor(Number(cantidadPorPaquete || 0))
  );

  if (solicitado <= 0 || capacidad <= 0) {
    return [];
  }

  const paquetes: number[] = [];

  let pendiente = solicitado;

  while (pendiente > 0) {
    const cantidad = Math.min(capacidad, pendiente);

    paquetes.push(cantidad);

    pendiente -= cantidad;
  }

  return paquetes;
}

function textoTipo(tipo: string) {
  if (tipo === "FIJO") {
    return "Maestro fijo";
  }

  if (tipo === "DEPENDE_LARGO") {
    return "Depende del largo";
  }

  if (tipo === "DEPENDE_ACABADOS") {
    return "Depende de acabados";
  }

  if (tipo === "SIN_CONFIGURAR") {
    return "Sin configurar";
  }

  return "Requiere revisión";
}

/* =========================================================
   PAGE
   ========================================================= */

export default function ValidacionTrazasPage() {
  const params = useParams();

  const router = useRouter();

  const ote = decodeURIComponent(String(params?.ote || ""));

  const [data, setData] = useState<OTEResponse | null>(null);

  const [configs, setConfigs] = useState<
    Record<string, ConfigEmpaque>
  >({});

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [mensaje, setMensaje] = useState("");

  /* =======================================================
     CARGAR OTE + MAESTRO
     ======================================================= */

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");
      setMensaje("");

      try {
        const [detalleRes, unidadesRes] = await Promise.all([
          fetch(
            `/api/planeacion/programacion/corte/ote/detalle?ote=${encodeURIComponent(
              ote
            )}`,
            {
              cache: "no-store",
            }
          ),

          fetch(
            "/api/planeacion/programacion/corte/ote/unidad-empaque",
            {
              cache: "no-store",
            }
          ),
        ]);

        const detalleJson = (await detalleRes
          .json()
          .catch(() => null)) as OTEResponse | null;

        const unidadesJson = (await unidadesRes
          .json()
          .catch(() => null)) as UnidadEmpaqueResponse | null;

        if (!detalleRes.ok || !detalleJson?.success) {
          throw new Error(
            detalleJson?.message || "No fue posible cargar la OTE."
          );
        }

        if (!unidadesRes.ok || !unidadesJson?.success) {
          throw new Error(
            unidadesJson?.message ||
              "No fue posible cargar UnidadEmpaqueTrazas."
          );
        }

        if (!mounted) {
          return;
        }

        /* ===============================================
           MAPA MAESTRO
           =============================================== */

        const maestroMap = new Map<string, UnidadEmpaqueItem>();

        for (const maestro of unidadesJson.items) {
          maestroMap.set(maestro.productoNormalizado, maestro);
        }

        /* ===============================================
           CONFIGURACIÓN INICIAL POR ÍTEM
           =============================================== */

        const nextConfigs: Record<string, ConfigEmpaque> = {};

        for (const item of detalleJson.items) {
          const productoInicial = construirProductoInicial(item);

          const key = normalizarProducto(productoInicial);

          const maestro = maestroMap.get(key);

          /*
           * Si el maestro tiene cantidad fija:
           * usamos esa cantidad.
           *
           * Si depende de largo/acabados:
           * sugerimos 100, pero NO queda confirmado.
           *
           * Si no existe:
           * también sugerimos 100 y exige validar.
           */
          const cantidadSugerida =
            maestro?.cantidadPorPaquete &&
            maestro.cantidadPorPaquete > 0
              ? maestro.cantidadPorPaquete
              : 100;

          const requiereValidacion =
            !maestro || maestro.requiereValidacion;

          nextConfigs[item.solicitudCorteId] = {
            solicitudCorteId: item.solicitudCorteId,

            productoInicial,

            cantidadSolicitada: Number(
              item.cantidadSolicitadaUnd || 0
            ),

            cantidadSugerida,

            cantidadPorPaquete: cantidadSugerida,

            tipoMaestro: maestro?.tipo || "SIN_CONFIGURAR",

            valorMaestro: maestro?.valorOriginal || "",

            motivo:
              maestro?.motivo ||
              "Producto no encontrado en UnidadEmpaqueTrazas.",

            encontradoEnMaestro: Boolean(maestro),

            requiereValidacion,

            /*
             * Los fijos quedan confirmados
             * automáticamente.
             *
             * Los dependientes o faltantes
             * requieren confirmación manual.
             */
            confirmado: !requiereValidacion,

            modificado: false,
          };
        }

        setData(detalleJson);

        setConfigs(nextConfigs);
      } catch (e) {
        console.error(e);

        if (!mounted) {
          return;
        }

        setError(
          e instanceof Error
            ? e.message
            : "Error cargando validación de empaque."
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    if (ote) {
      load();
    }

    return () => {
      mounted = false;
    };
  }, [ote]);

  /* =======================================================
     ITEMS ENRIQUECIDOS
     ======================================================= */

  const filas = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.items.map((item) => {
      const config = configs[item.solicitudCorteId];

      const distribucion = config
        ? calcularDistribucion(
            item.cantidadSolicitadaUnd,
            config.cantidadPorPaquete
          )
        : [];

      return {
        item,
        config,
        distribucion,
      };
    });
  }, [data, configs]);

  /* =======================================================
     RESUMEN
     ======================================================= */

  const totalTrazas = useMemo(() => {
    return filas.reduce(
      (total, fila) => total + fila.distribucion.length,
      0
    );
  }, [filas]);

  const paginasEstimadas = Math.ceil(totalTrazas / 10);

  const pendientes = useMemo(() => {
    return filas.filter(
      ({ config }) =>
        !config ||
        !config.confirmado ||
        config.cantidadPorPaquete <= 0
    ).length;
  }, [filas]);

  const modificados = useMemo(() => {
    return filas.filter(({ config }) =>
      Boolean(config?.modificado)
    ).length;
  }, [filas]);

  const todoValidado = pendientes === 0 && filas.length > 0;

  /* =======================================================
     CAMBIAR CANTIDAD
     ======================================================= */

  function cambiarCantidad(
    solicitudCorteId: string,
    value: string
  ) {
    const n = Math.max(
      0,
      Math.floor(Number(value || 0))
    );

    setConfigs((prev) => {
      const actual = prev[solicitudCorteId];

      if (!actual) {
        return prev;
      }

      return {
        ...prev,

        [solicitudCorteId]: {
          ...actual,

          cantidadPorPaquete: n,

          modificado:
            n !== actual.cantidadSugerida,

          /*
           * Si era un caso que requería
           * validación, cambiar el número
           * NO lo confirma automáticamente.
           *
           * El usuario debe pulsar Confirmar.
           */
          confirmado: actual.requiereValidacion
            ? false
            : true,
        },
      };
    });

    setMensaje("");
  }

  /* =======================================================
     CONFIRMAR ÍTEM
     ======================================================= */

  function confirmarItem(
    solicitudCorteId: string
  ) {
    setConfigs((prev) => {
      const actual = prev[solicitudCorteId];

      if (!actual) {
        return prev;
      }

      if (actual.cantidadPorPaquete <= 0) {
        return prev;
      }

      return {
        ...prev,

        [solicitudCorteId]: {
          ...actual,

          confirmado: true,
        },
      };
    });
  }

  /* =======================================================
     RESTABLECER
     ======================================================= */

  function restablecerItem(
    solicitudCorteId: string
  ) {
    setConfigs((prev) => {
      const actual = prev[solicitudCorteId];

      if (!actual) {
        return prev;
      }

      return {
        ...prev,

        [solicitudCorteId]: {
          ...actual,

          cantidadPorPaquete:
            actual.cantidadSugerida,

          modificado: false,

          confirmado:
            !actual.requiereValidacion,
        },
      };
    });

    setMensaje("");
  }

  /* =======================================================
     CONFIRMAR VALIDACIÓN COMPLETA
     ======================================================= */

  function validarConfiguracion() {
    if (!todoValidado) {
      setError(
        "Todavía existen ítems pendientes de validación."
      );

      return;
    }

    setError("");

    /*
     * Conservamos temporalmente la configuración
     * validada en sessionStorage.
     *
     * La siguiente pantalla utilizará este payload
     * para generar todas las trazas PEX-FO-02.
     */
    const payload = {
      ote,

      generadoEn:
        new Date().toISOString(),

      items: filas.map(
        ({
          item,
          config,
          distribucion,
        }) => ({
          solicitudCorteId:
            item.solicitudCorteId,
          
          ote,
          
          consecutivo:
            item.consecutivo,

          productoInicial:
            config.productoInicial,

          productoSolicitado:
            item.productoSolicitado,

          referencia:
            item.referencia,

          color:
            item.color,

          ancho:
            item.ancho,

          largo:
            item.largo,

          acabado:
            item.acabado,

          cliente:
            item.cliente,

          direccion:
            item.direccion,

          oc:
            item.oc,

          codigoSiigo:
            item.codigoSiigo,

          /*
           * IMPORTANTE:
           * Guardamos la fecha original de creación
           * de la solicitud de corte para mostrar
           * la misma fecha en las trazas.
           */
          fechaCreacion:
            item.fechaCreacion,

          cantidadSolicitada:
            item.cantidadSolicitadaUnd,

          cantidadPorPaquete:
            config.cantidadPorPaquete,

          distribucion,

          totalPaquetes:
            distribucion.length,
        })
      ),
    };

    sessionStorage.setItem(
      `pex-trazas-${ote}`,
      JSON.stringify(payload)
    );

    /*
     * Al confirmar, vamos directamente
     * a la vista previa imprimible.
     */
    router.push(
      `/planeacion/programacion/corte/ote/${encodeURIComponent(
        ote
      )}/trazas/imprimir`
    );
  }

  /* =======================================================
     ESTADOS
     ======================================================= */

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Cargando validación de empaque de{" "}
          <b>{ote}</b>...
        </div>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          {error}
        </div>
      </main>
    );
  }

  if (!data) {
    return null;
  }

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      {/* =================================================
          CABECERA
         ================================================= */}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 text-sm text-slate-500">
            Planeación · Programación · Corte · Trazas
          </div>

          <h1 className="text-2xl font-semibold">
            Validación de empaque · {ote}
          </h1>

          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            PEX toma la cantidad por paquete del maestro
            UnidadEmpaqueTrazas. Puedes ajustar cualquier ítem
            antes de generar las etiquetas.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              router.push(
                `/planeacion/programacion/corte/ote/${encodeURIComponent(
                  ote
                )}`
              )
            }
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
          >
            Ver Orden de Trabajo
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/planeacion/programacion/corte"
              )
            }
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
          >
            ← Volver
          </button>
        </div>
      </div>

      {/* =================================================
          RESUMEN
         ================================================= */}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">
            Ítems
          </div>

          <div className="mt-1 text-2xl font-semibold">
            {filas.length}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">
            Trazas calculadas
          </div>

          <div className="mt-1 text-2xl font-semibold">
            {totalTrazas}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">
            Páginas estimadas
          </div>

          <div className="mt-1 text-2xl font-semibold">
            {paginasEstimadas}
          </div>

          <div className="mt-1 text-xs text-slate-400">
            10 trazas por página
          </div>
        </div>

        <div
          className={[
            "rounded-2xl border p-4 shadow-sm",

            pendientes > 0
              ? "border-amber-200 bg-amber-50"
              : "border-emerald-200 bg-emerald-50",
          ].join(" ")}
        >
          <div
            className={[
              "text-xs",

              pendientes > 0
                ? "text-amber-700"
                : "text-emerald-700",
            ].join(" ")}
          >
            Pendientes
          </div>

          <div
            className={[
              "mt-1 text-2xl font-semibold",

              pendientes > 0
                ? "text-amber-800"
                : "text-emerald-800",
            ].join(" ")}
          >
            {pendientes}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">
            Ajustados manualmente
          </div>

          <div className="mt-1 text-2xl font-semibold">
            {modificados}
          </div>
        </div>
      </section>

      {/* =================================================
          MENSAJES
         ================================================= */}

      {(error || mensaje) && (
        <section className="mt-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {mensaje && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {mensaje}
            </div>
          )}
        </section>
      )}

      {/* =================================================
          AYUDA
         ================================================= */}

      <section className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
        <div className="text-sm font-semibold text-indigo-900">
          ¿Cómo funciona?
        </div>

        <div className="mt-2 grid gap-2 text-xs text-indigo-800 md:grid-cols-3">
          <div>
            <b>Maestro fijo:</b> PEX carga la cantidad automáticamente.
            Puedes cambiarla si este pedido es una excepción.
          </div>

          <div>
            <b>Depende del largo/acabados:</b> PEX propone 100,
            pero debes revisar el ítem y confirmarlo.
          </div>

          <div>
            <b>Saldo:</b> si la última caja o paquete no completa
            la capacidad, la última traza muestra únicamente el saldo.
          </div>
        </div>
      </section>

      {/* =================================================
          TABLA
         ================================================= */}

      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1250px] w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">
                  Consecutivo
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Producto
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Largo / acabado
                </th>

                <th className="px-4 py-3 text-right font-medium">
                  Pedido
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Maestro
                </th>

                <th className="px-4 py-3 text-center font-medium">
                  Cantidad por paquete
                </th>

                <th className="px-4 py-3 text-center font-medium">
                  Paquetes
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Distribución
                </th>

                <th className="px-4 py-3 text-center font-medium">
                  Validación
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filas.map(
                ({
                  item,
                  config,
                  distribucion,
                }) => {
                  if (!config) {
                    return null;
                  }

                  const pendiente =
                    !config.confirmado;

                  return (
                    <tr
                      key={
                        item.solicitudCorteId
                      }
                      className={
                        pendiente
                          ? "bg-amber-50/50"
                          : "hover:bg-slate-50"
                      }
                    >
                      {/* CONSECUTIVO */}

                      <td className="px-4 py-4 align-top">
                        <div className="font-semibold">
                          {Number(
                            item.consecutivo
                          ).toLocaleString(
                            "es-CO"
                          )}
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          {item.oc}
                        </div>
                      </td>

                      {/* PRODUCTO */}

                      <td className="px-4 py-4 align-top">
                        <div className="max-w-[280px] font-medium">
                          {
                            config.productoInicial
                          }
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {item.cliente}
                        </div>
                      </td>

                      {/* LARGO / ACABADO */}

                      <td className="px-4 py-4 align-top">
                        <div>
                          <span className="text-xs text-slate-400">
                            Largo:
                          </span>{" "}
                          <b>
                            {item.largo ||
                              "—"}
                          </b>
                        </div>

                        <div className="mt-1 max-w-[250px]">
                          <span className="text-xs text-slate-400">
                            Acabado:
                          </span>{" "}
                          {
                            item.acabado ||
                            "—"
                          }
                        </div>
                      </td>

                      {/* CANTIDAD PEDIDO */}

                      <td className="px-4 py-4 text-right align-top">
                        <div className="font-semibold">
                          {formatCantidad(
                            item.cantidadSolicitadaUnd
                          )}
                        </div>

                        <div className="text-xs text-slate-400">
                          und
                        </div>
                      </td>

                      {/* MAESTRO */}

                      <td className="px-4 py-4 align-top">
                        <div
                          className={[
                            "inline-flex rounded-full px-2 py-1 text-xs font-semibold",

                            config.tipoMaestro ===
                            "FIJO"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-100 text-amber-800",
                          ].join(
                            " "
                          )}
                        >
                          {textoTipo(
                            config.tipoMaestro
                          )}
                        </div>

                        {config.valorMaestro && (
                          <div className="mt-2 text-xs text-slate-500">
                            Maestro:{" "}
                            <b>
                              {
                                config.valorMaestro
                              }
                            </b>
                          </div>
                        )}

                        {config.motivo &&
                          config.requiereValidacion && (
                            <div className="mt-1 max-w-[200px] text-xs text-amber-700">
                              {
                                config.motivo
                              }
                            </div>
                          )}
                      </td>

                      {/* CANTIDAD POR PAQUETE */}

                      <td className="px-4 py-4 align-top">
                        <div className="flex min-w-[150px] flex-col items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={
                              config.cantidadPorPaquete ||
                              ""
                            }
                            onChange={(
                              e
                            ) =>
                              cambiarCantidad(
                                item.solicitudCorteId,
                                e.target
                                  .value
                              )
                            }
                            className={[
                              "w-[110px] rounded-xl border px-3 py-2 text-center font-semibold outline-none",

                              pendiente
                                ? "border-amber-300 bg-white focus:border-amber-500"
                                : "border-slate-300 focus:border-indigo-500",
                            ].join(
                              " "
                            )}
                          />

                          {config.modificado && (
                            <button
                              type="button"
                              onClick={() =>
                                restablecerItem(
                                  item.solicitudCorteId
                                )
                              }
                              className="text-xs text-indigo-600 hover:underline"
                            >
                              Restablecer{" "}
                              {
                                config.cantidadSugerida
                              }
                            </button>
                          )}
                        </div>
                      </td>

                      {/* PAQUETES */}

                      <td className="px-4 py-4 text-center align-top">
                        <div className="text-lg font-semibold">
                          {
                            distribucion.length
                          }
                        </div>

                        <div className="text-xs text-slate-400">
                          trazas
                        </div>
                      </td>

                      {/* DISTRIBUCIÓN */}

                      <td className="px-4 py-4 align-top">
                        <div className="flex max-w-[280px] flex-wrap gap-1">
                          {distribucion.length ===
                          0 ? (
                            <span className="text-xs text-red-500">
                              Cantidad
                              inválida
                            </span>
                          ) : (
                            distribucion.map(
                              (
                                cantidad,
                                index
                              ) => (
                                <span
                                  key={
                                    index
                                  }
                                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                                >
                                  {index +
                                    1}
                                  /
                                  {
                                    distribucion.length
                                  }
                                  :{" "}
                                  <b>
                                    {
                                      cantidad
                                    }
                                  </b>
                                </span>
                              )
                            )
                          )}
                        </div>
                      </td>

                      {/* VALIDACIÓN */}

                      <td className="px-4 py-4 text-center align-top">
                        {config.confirmado ? (
                          <div>
                            <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                              ✓ Validado
                            </span>

                            {config.requiereValidacion && (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfigs(
                                    (
                                      prev
                                    ) => ({
                                      ...prev,

                                      [item.solicitudCorteId]:
                                        {
                                          ...prev[
                                            item
                                              .solicitudCorteId
                                          ],

                                          confirmado:
                                            false,
                                        },
                                    })
                                  )
                                }
                                className="mt-2 block w-full text-xs text-slate-500 hover:underline"
                              >
                                Revisar otra vez
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={
                              config.cantidadPorPaquete <=
                              0
                            }
                            onClick={() =>
                              confirmarItem(
                                item.solicitudCorteId
                              )
                            }
                            className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                          >
                            Confirmar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* =================================================
          ACCIÓN FINAL
         ================================================= */}

      <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <div className="font-semibold">
            {todoValidado
              ? "Empaque listo para generar trazas"
              : "Validación pendiente"}
          </div>

          <div className="mt-1 text-sm text-slate-500">
            {todoValidado
              ? `${totalTrazas} trazas · ${paginasEstimadas} página(s) estimadas.`
              : `Faltan ${pendientes} ítem(s) por confirmar.`}
          </div>
        </div>

        <button
          type="button"
          disabled={
            !todoValidado
          }
          onClick={
            validarConfiguracion
          }
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Confirmar empaque
        </button>
      </section>
    </main>
  );
}