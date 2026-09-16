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

type Conteo = {
  sheetRow: number;

  conteoKey: string;
  fechaConteo: string;
  tipoConteo: string;

  inventarioKey: string;

  OPE: string;
  producto: string;

  referencia: string;
  color: string;
  ancho: string;
  acabado: string;

  medida_mm: number;

  cantidadSistema: number;
  cantidadFisica: number;
  diferencia: number;

  responsableConteo: string;
  usuarioSistema: string;

  motivoDiferencia: string;

  estado: string;

  movimientoAjusteKey: string;
  fechaAjuste: string;
};

type ConteosResponse = {
  ok: boolean;
  total: number;
  conteos: Conteo[];

  error?: string;
};

type AjusteResponse = {
  ok: boolean;

  yaAjustado?: boolean;
  recuperado?: boolean;

  conteoKey?: string;
  movimientoAjusteKey?: string;

  inventarioKey?: string;

  OPE?: string;
  producto?: string;

  cantidadSistema?: number;
  cantidadFisica?: number;
  diferencia?: number;

  saldoAnterior?: number;
  saldoFinal?: number;

  estado?: string;

  usuarioAjuste?: string;
  fechaAjuste?: string;

  code?: string;
  message?: string;

  cantidadSistemaConteo?: number;
  saldoActual?: number;
  diferenciaConteo?: number;
};

/* =========================================================
   HELPERS
   ========================================================= */

function formatMedida(mm: number) {
  if (!mm) {
    return "-";
  }

  return `${(mm / 1000).toLocaleString(
    "es-CO",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    }
  )} m`;
}

function formatNumero(
  value: number
) {
  return Number(
    value || 0
  ).toLocaleString(
    "es-CO"
  );
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

function norm(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}

type FiltroEstado =
  | "todos"
  | "pendiente"
  | "ajustado"
  | "sin-diferencia";

/* =========================================================
   COMPONENTE
   ========================================================= */

export default function HistorialConteosInventarioProcesoPage() {
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
    useState<ConteosResponse | null>(
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

  const [
    filtroEstado,
    setFiltroEstado,
  ] =
    useState<FiltroEstado>(
      "todos"
    );

  const [
    revisandoKey,
    setRevisandoKey,
  ] =
    useState<string | null>(
      null
    );

  const [
    procesandoKey,
    setProcesandoKey,
  ] =
    useState<string | null>(
      null
    );

  const [
    errorAjuste,
    setErrorAjuste,
  ] =
    useState("");

  const [
    resultadoAjuste,
    setResultadoAjuste,
  ] =
    useState<AjusteResponse | null>(
      null
    );

  /* =======================================================
     CARGAR CONTEOS
     ======================================================= */

  async function cargarConteos() {
    try {
      setLoading(true);
      setError("");

      const res =
        await fetch(
          "/api/abastecimientologistica/inventario-producto-proceso/conteos",
          {
            cache:
              "no-store",
          }
        );

      const json =
        (await res.json()) as ConteosResponse;

      if (
        !res.ok ||
        !json?.ok
      ) {
        throw new Error(
          json?.error ||
            "No fue posible consultar los conteos."
        );
      }

      setData(
        json
      );
    } catch (e: any) {
      setError(
        e?.message ||
          "Ocurrió un error consultando el historial de conteos."
      );
    } finally {
      setLoading(false);
    }
  }

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

    cargarConteos();
  }, [
    status,
    canAccess,
  ]);

  /* =======================================================
     RESUMEN
     ======================================================= */

  const resumen =
    useMemo(() => {
      const conteos =
        data?.conteos ||
        [];

      let pendientes =
        0;

      let ajustados =
        0;

      let sinDiferencia =
        0;

      conteos.forEach(
        (conteo) => {
          const estado =
            norm(
              conteo.estado
            );

          if (
            estado ===
            "pendiente ajuste"
          ) {
            pendientes++;
          }

          if (
            estado ===
            "ajustado"
          ) {
            ajustados++;
          }

          if (
            estado ===
            "sin diferencia"
          ) {
            sinDiferencia++;
          }
        }
      );

      return {
        total:
          conteos.length,

        pendientes,

        ajustados,

        sinDiferencia,
      };
    }, [
      data,
    ]);

  /* =======================================================
     FILTRO
     ======================================================= */

  const conteosFiltrados =
    useMemo(() => {
      let conteos =
        data?.conteos ||
        [];

      if (
        filtroEstado ===
        "pendiente"
      ) {
        conteos =
          conteos.filter(
            (conteo) =>
              norm(
                conteo.estado
              ) ===
              "pendiente ajuste"
          );
      }

      if (
        filtroEstado ===
        "ajustado"
      ) {
        conteos =
          conteos.filter(
            (conteo) =>
              norm(
                conteo.estado
              ) ===
              "ajustado"
          );
      }

      if (
        filtroEstado ===
        "sin-diferencia"
      ) {
        conteos =
          conteos.filter(
            (conteo) =>
              norm(
                conteo.estado
              ) ===
              "sin diferencia"
          );
      }

      const q =
        search
          .trim()
          .toLowerCase();

      if (!q) {
        return conteos;
      }

      return conteos.filter(
        (conteo) =>
          [
            conteo.conteoKey,
            conteo.OPE,
            conteo.producto,
            conteo.referencia,
            conteo.color,
            conteo.ancho,
            conteo.acabado,
            conteo.tipoConteo,
            conteo.responsableConteo,
            conteo.usuarioSistema,
            conteo.motivoDiferencia,
            conteo.estado,
            conteo.movimientoAjusteKey,
          ].some(
            (value) =>
              String(
                value ||
                  ""
              )
                .toLowerCase()
                .includes(q)
          )
      );
    }, [
      data,
      search,
      filtroEstado,
    ]);

  /* =======================================================
     REVISAR
     ======================================================= */

  function revisarConteo(
    conteo: Conteo
  ) {
    setResultadoAjuste(
      null
    );

    setErrorAjuste("");

    setRevisandoKey(
      (actual) =>
        actual ===
        conteo.conteoKey
          ? null
          : conteo.conteoKey
    );
  }

  /* =======================================================
     APLICAR AJUSTE
     ======================================================= */

  async function aplicarAjuste(
    conteo: Conteo
  ) {
    setErrorAjuste("");
    setResultadoAjuste(
      null
    );

    if (
      norm(
        conteo.estado
      ) !==
      "pendiente ajuste"
    ) {
      setErrorAjuste(
        "Este conteo no se encuentra pendiente de ajuste."
      );

      return;
    }

    const confirmado =
      window.confirm(
        [
          "¿Confirmas este ajuste de inventario?",
          "",
          `Conteo: ${conteo.conteoKey}`,
          `OPE: ${conteo.OPE}`,
          `Producto: ${conteo.producto}`,
          `Medida: ${formatMedida(
            conteo.medida_mm
          )}`,
          "",
          `Sistema al momento del conteo: ${formatNumero(
            conteo.cantidadSistema
          )} und`,
          `Cantidad física: ${formatNumero(
            conteo.cantidadFisica
          )} und`,
          `Ajuste: ${
            conteo.diferencia >
            0
              ? "+"
              : ""
          }${formatNumero(
            conteo.diferencia
          )} und`,
          "",
          `Motivo: ${conteo.motivoDiferencia}`,
          "",
          "PEX verificará nuevamente que no hayan ocurrido movimientos después del conteo.",
        ].join("\n")
      );

    if (!confirmado) {
      return;
    }

    try {
      setProcesandoKey(
        conteo.conteoKey
      );

      const res =
        await fetch(
          "/api/abastecimientologistica/inventario-producto-proceso/conteos/ajustar",
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
                  conteoKey:
                    conteo.conteoKey,

                  usuarioAjuste:
                    email,
                }
              ),
          }
        );

      const json =
        (await res.json()) as AjusteResponse;

      if (
        !res.ok ||
        !json?.ok
      ) {
        throw new Error(
          json?.message ||
            "No fue posible aplicar el ajuste."
        );
      }

      setResultadoAjuste(
        json
      );

      setRevisandoKey(
        null
      );

      await cargarConteos();

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (e: any) {
      setErrorAjuste(
        e?.message ||
          "Ocurrió un error aplicando el ajuste."
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } finally {
      setProcesandoKey(
        null
      );
    }
  }

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

  if (!canAccess) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-semibold text-red-800">
            Acceso no autorizado
          </h1>

          <p className="mt-2 text-sm text-red-700">
            Tu usuario no tiene permisos para consultar o conciliar conteos de producto en proceso.
          </p>

          <Link
            href="/abastecimientologistica"
            className="mt-4 inline-flex rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700"
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
            Abastecimiento y Logística · Inventario producto en proceso · Historial de conteos
          </div>

          <div className="mb-3 inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-100">
            Trazabilidad de inventario
          </div>

          <h1 className="text-2xl font-semibold text-neutral-900">
            Historial de conteos
          </h1>

          <p className="mt-1 text-sm text-neutral-600">
            Consulta los conteos físicos realizados, sus diferencias y los ajustes aplicados al inventario.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={
              cargarConteos
            }
            disabled={
              loading ||
              procesandoKey !==
                null
            }
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
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
          RESULTADO AJUSTE
         =================================================== */}

      {resultadoAjuste?.ok ? (
        <section className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-5">
          <div className="text-base font-semibold text-emerald-800">
            ✓ Ajuste aplicado correctamente
          </div>

          <p className="mt-1 text-sm text-emerald-700">
            El movimiento quedó registrado en el kardex y el inventario actual fue recalculado.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-white/80 p-4">
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                OPE
              </div>

              <div className="mt-1 font-semibold">
                {
                  resultadoAjuste.OPE
                }
              </div>
            </div>

            <div className="rounded-xl bg-white/80 p-4">
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                Saldo anterior
              </div>

              <div className="mt-1 text-xl font-semibold">
                {formatNumero(
                  resultadoAjuste.saldoAnterior ??
                    resultadoAjuste.cantidadSistema ??
                    0
                )}{" "}
                und
              </div>
            </div>

            <div className="rounded-xl bg-white/80 p-4">
              <div className="text-xs uppercase tracking-wide text-orange-700">
                Ajuste
              </div>

              <div className="mt-1 text-xl font-semibold text-orange-700">
                {(resultadoAjuste.diferencia ||
                  0) > 0
                  ? "+"
                  : ""}
                {formatNumero(
                  resultadoAjuste.diferencia ||
                    0
                )}{" "}
                und
              </div>
            </div>

            <div className="rounded-xl bg-white/80 p-4">
              <div className="text-xs uppercase tracking-wide text-emerald-700">
                Nuevo saldo
              </div>

              <div className="mt-1 text-xl font-semibold text-emerald-700">
                {formatNumero(
                  resultadoAjuste.saldoFinal ||
                    0
                )}{" "}
                und
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-white/70 px-4 py-3 text-xs text-emerald-800">
            Movimiento:{" "}
            <b>
              {
                resultadoAjuste.movimientoAjusteKey
              }
            </b>
            {" · "}
            Estado:{" "}
            <b>
              {
                resultadoAjuste.estado
              }
            </b>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/abastecimientologistica/inventario-producto-proceso/inventario"
              className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
            >
              Ver inventario actual →
            </Link>

            <button
              type="button"
              onClick={() =>
                setResultadoAjuste(
                  null
                )
              }
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Continuar
            </button>
          </div>
        </section>
      ) : null}

      {/* ===================================================
          ERROR AJUSTE
         =================================================== */}

      {errorAjuste ? (
        <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="text-sm font-semibold text-red-800">
            No fue posible aplicar el ajuste
          </div>

          <p className="mt-1 text-sm text-red-700">
            {
              errorAjuste
            }
          </p>

          <p className="mt-2 text-xs text-red-600">
            Si PEX indica que el saldo cambió después del conteo, realiza un nuevo conteo físico antes de ajustar.
          </p>
        </section>
      ) : null}

      {/* ===================================================
          RESUMEN
         =================================================== */}

      <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl bg-neutral-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Total conteos
            </div>

            <div className="mt-1 text-2xl font-semibold text-neutral-900">
              {
                resumen.total
              }
            </div>
          </div>

          <div className="rounded-xl bg-amber-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-amber-700">
              Pendientes ajuste
            </div>

            <div className="mt-1 text-2xl font-semibold text-amber-700">
              {
                resumen.pendientes
              }
            </div>
          </div>

          <div className="rounded-xl bg-emerald-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">
              Ajustados
            </div>

            <div className="mt-1 text-2xl font-semibold text-emerald-700">
              {
                resumen.ajustados
              }
            </div>
          </div>

          <div className="rounded-xl bg-blue-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-blue-700">
              Sin diferencia
            </div>

            <div className="mt-1 text-2xl font-semibold text-blue-700">
              {
                resumen.sinDiferencia
              }
            </div>
          </div>
        </div>

        {/* FILTROS */}

        <div className="mt-5 grid gap-4 md:grid-cols-[220px_1fr]">
          <div>
            <label className="text-sm font-medium text-neutral-700">
              Estado
            </label>

            <select
              value={
                filtroEstado
              }
              onChange={(
                e
              ) =>
                setFiltroEstado(
                  e.target
                    .value as FiltroEstado
                )
              }
              className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            >
              <option value="todos">
                Todos
              </option>

              <option value="pendiente">
                Pendiente ajuste
              </option>

              <option value="ajustado">
                Ajustado
              </option>

              <option value="sin-diferencia">
                Sin diferencia
              </option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700">
              Buscar
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
              placeholder="OPE, producto, responsable, motivo, conteo..."
              className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </div>
        </div>
      </section>

      {/* ===================================================
          CONTENIDO
         =================================================== */}

      {loading ? (
        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-500">
            Consultando historial de conteos...
          </p>
        </section>
      ) : error ? (
        <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-medium text-red-700">
            {
              error
            }
          </p>
        </section>
      ) : conteosFiltrados.length ===
        0 ? (
        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-500">
            No se encontraron conteos con ese criterio.
          </p>
        </section>
      ) : (
        <section className="mt-6 space-y-4">
          {conteosFiltrados.map(
            (
              conteo
            ) => {
              const estadoNorm =
                norm(
                  conteo.estado
                );

              const pendiente =
                estadoNorm ===
                "pendiente ajuste";

              const ajustado =
                estadoNorm ===
                "ajustado";

              const sinDiferencia =
                estadoNorm ===
                "sin diferencia";

              const abierto =
                revisandoKey ===
                conteo.conteoKey;

              return (
                <div
                  key={
                    conteo.conteoKey
                  }
                  className={`rounded-2xl border bg-white p-5 shadow-sm ${
                    pendiente
                      ? "border-amber-200"
                      : ajustado
                        ? "border-emerald-200"
                        : "border-neutral-200"
                  }`}
                >
                  {/* CABECERA */}

                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-neutral-900">
                          {
                            conteo.OPE
                          }
                        </h2>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            pendiente
                              ? "bg-amber-50 text-amber-700"
                              : ajustado
                                ? "bg-emerald-50 text-emerald-700"
                                : sinDiferencia
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {
                            conteo.estado
                          }
                        </span>

                        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
                          {
                            conteo.tipoConteo
                          }
                        </span>
                      </div>

                      <div className="mt-2 text-sm font-medium text-neutral-900">
                        {
                          conteo.producto
                        }
                      </div>

                      <div className="mt-2 text-xs text-neutral-500">
                        Conteo:{" "}
                        <b>
                          {
                            conteo.conteoKey
                          }
                        </b>
                        {" · "}
                        {formatFecha(
                          conteo.fechaConteo
                        )}
                      </div>

                      <div className="mt-1 text-xs text-neutral-500">
                        Responsable:{" "}
                        <b>
                          {
                            conteo.responsableConteo ||
                            "-"
                          }
                        </b>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {pendiente ? (
                        <button
                          type="button"
                          onClick={() =>
                            revisarConteo(
                              conteo
                            )
                          }
                          disabled={
                            procesandoKey !==
                            null
                          }
                          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                        >
                          {abierto
                            ? "Cerrar revisión"
                            : "Revisar ajuste"}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* RESUMEN */}

                  <div className="mt-5 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-xl bg-neutral-50 p-4">
                      <div className="text-xs uppercase tracking-wide text-neutral-500">
                        Medida
                      </div>

                      <div className="mt-1 text-lg font-semibold text-neutral-900">
                        {formatMedida(
                          conteo.medida_mm
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl bg-blue-50 p-4">
                      <div className="text-xs uppercase tracking-wide text-blue-700">
                        Sistema
                      </div>

                      <div className="mt-1 text-xl font-semibold text-blue-800">
                        {formatNumero(
                          conteo.cantidadSistema
                        )}{" "}
                        und
                      </div>
                    </div>

                    <div className="rounded-xl bg-neutral-50 p-4">
                      <div className="text-xs uppercase tracking-wide text-neutral-500">
                        Físico
                      </div>

                      <div className="mt-1 text-xl font-semibold text-neutral-900">
                        {formatNumero(
                          conteo.cantidadFisica
                        )}{" "}
                        und
                      </div>
                    </div>

                    <div
                      className={`rounded-xl p-4 ${
                        conteo.diferencia ===
                        0
                          ? "bg-emerald-50"
                          : "bg-amber-50"
                      }`}
                    >
                      <div
                        className={`text-xs uppercase tracking-wide ${
                          conteo.diferencia ===
                          0
                            ? "text-emerald-700"
                            : "text-amber-700"
                        }`}
                      >
                        Diferencia
                      </div>

                      <div
                        className={`mt-1 text-xl font-semibold ${
                          conteo.diferencia ===
                          0
                            ? "text-emerald-700"
                            : "text-amber-700"
                        }`}
                      >
                        {conteo.diferencia >
                        0
                          ? "+"
                          : ""}
                        {formatNumero(
                          conteo.diferencia
                        )}{" "}
                        und
                      </div>
                    </div>
                  </div>

                  {/* DETALLE AJUSTE */}

                  {abierto &&
                  pendiente ? (
                    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5">
                      <div className="text-sm font-semibold text-amber-900">
                        Revisión del ajuste
                      </div>

                      <p className="mt-1 text-sm text-amber-700">
                        Antes de modificar el inventario, PEX volverá a validar el kardex de esta existencia.
                      </p>

                      <div className="mt-4 rounded-xl bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Motivo registrado
                        </div>

                        <div className="mt-2 text-sm text-neutral-800">
                          {
                            conteo.motivoDiferencia ||
                            "Sin motivo registrado"
                          }
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl bg-white p-4 text-sm text-neutral-700">
                        Se generará un movimiento{" "}
                        <b>
                          AJUSTE_INVENTARIO
                        </b>{" "}
                        de{" "}
                        <b>
                          {conteo.diferencia >
                          0
                            ? "+"
                            : ""}
                          {formatNumero(
                            conteo.diferencia
                          )}{" "}
                          und
                        </b>
                        .
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            aplicarAjuste(
                              conteo
                            )
                          }
                          disabled={
                            procesandoKey !==
                            null
                          }
                          className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
                        >
                          {procesandoKey ===
                          conteo.conteoKey
                            ? "Aplicando ajuste..."
                            : "Confirmar y aplicar ajuste"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* AJUSTADO */}

                  {ajustado ? (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        Ajuste aplicado
                      </div>

                      <div className="mt-2 text-sm text-emerald-800">
                        Movimiento:{" "}
                        <b>
                          {
                            conteo.movimientoAjusteKey ||
                            "-"
                          }
                        </b>
                        {" · "}
                        {formatFecha(
                          conteo.fechaAjuste
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* SIN DIFERENCIA */}

                  {sinDiferencia ? (
                    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                      El conteo coincidió con PEX. No fue necesario generar movimiento de ajuste.
                    </div>
                  ) : null}
                </div>
              );
            }
          )}
        </section>
      )}
    </main>
  );
}