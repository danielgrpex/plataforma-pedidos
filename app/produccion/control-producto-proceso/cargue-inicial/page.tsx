"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { allowedProduccionTabsForUser } from "@/lib/auth/permissions";

/* =========================================================
   TIPOS
   ========================================================= */

type RegistroCargue = {
  sheetRow: number;

  cargueKey: string;

  OPE: string;
  producto: string;

  referencia: string;
  color: string;
  ancho: string;
  acabado: string;

  medida_mm: number;
  cantidadFisica: number;

  responsableConteo: string;
  fechaConteo: string;

  observacion: string;

  procesado: string;
  fechaProcesado: string;

  yaProcesado: boolean;

  valido: boolean;
  errores: string[];
};

type CargueResponse = {
  ok: boolean;

  totalRegistros: number;

  totalPendientes: number;
  totalPendientesValidos: number;
  totalPendientesConError: number;

  totalProcesados: number;

  totalUnidadesPendientes: number;
  totalUnidadesProcesadas: number;

  pendientes: RegistroCargue[];
  procesados: RegistroCargue[];

  error?: string;
};

type ProcesarResponse = {
  success: boolean;

  sheetRow?: number;

  cargueKey?: string;

  movimientoCreado?: boolean;
  movimientoRelacionado?: string;

  inventarioKey?: string;

  OPE?: string;
  producto?: string;

  medida_mm?: number;
  cantidadFisica?: number;

  saldoFinal?: number;
  estadoInventario?: string;

  responsableConteo?: string;
  fechaConteo?: string;

  procesado?: string;
  fechaProcesado?: string;

  message?: string;
};

type ResultadoMasivo = {
  total: number;
  exitosos: number;
  fallidos: number;

  errores: Array<{
    sheetRow: number;
    OPE: string;
    producto: string;
    mensaje: string;
  }>;
};

/* =========================================================
   HELPERS
   ========================================================= */

function formatMedida(mm: number) {
  if (!mm) return "-";

  return `${(mm / 1000).toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })} m`;
}

function formatNumero(value: number) {
  return Number(value || 0).toLocaleString("es-CO");
}

function formatFecha(value: string) {
  if (!value) return "-";

  const fecha = new Date(value);

  if (Number.isNaN(fecha.getTime())) {
    return value;
  }

  return fecha.toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/* =========================================================
   COMPONENTE
   ========================================================= */

export default function CargueInicialProcesoPage() {
  const { data: session, status } = useSession();

  const email =
    (session?.user as any)?.email || "";

  const role =
    (session?.user as any)?.role || "";

  const allowedTabs =
    allowedProduccionTabsForUser({
      email,
      role,
    });

  const canAccess =
    allowedTabs.includes(
      "control-producto-proceso"
    );

  /* =======================================================
     ESTADOS
     ======================================================= */

  const [data, setData] =
    useState<CargueResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [procesandoRow, setProcesandoRow] =
    useState<number | null>(null);

  const [
    resultado,
    setResultado,
  ] =
    useState<ProcesarResponse | null>(null);

  const [
    errorProcesar,
    setErrorProcesar,
  ] =
    useState("");

  const [
    mostrarProcesados,
    setMostrarProcesados,
  ] =
    useState(false);

  /* =======================================================
     NUEVO: PROCESAMIENTO MASIVO
     ======================================================= */

  const [
    procesandoTodos,
    setProcesandoTodos,
  ] =
    useState(false);

  const [
    progresoMasivo,
    setProgresoMasivo,
  ] =
    useState({
      actual: 0,
      total: 0,
    });

  const [
    resultadoMasivo,
    setResultadoMasivo,
  ] =
    useState<ResultadoMasivo | null>(null);

  /* =======================================================
     CARGAR
     ======================================================= */

  async function cargar() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(
        "/api/produccion/control-producto-proceso/cargue-inicial",
        {
          cache: "no-store",
        }
      );

      const json =
        (await res.json()) as CargueResponse;

      if (
        !res.ok ||
        !json?.ok
      ) {
        throw new Error(
          json?.error ||
            "No fue posible consultar el cargue inicial."
        );
      }

      setData(json);
    } catch (e: any) {
      setError(
        e?.message ||
          "Ocurrió un error consultando el cargue inicial."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (!canAccess) {
      setLoading(false);
      return;
    }

    cargar();
  }, [status, canAccess]);

  /* =======================================================
     FILTRO
     ======================================================= */

  const pendientesFiltrados =
    useMemo(() => {
      const registros =
        data?.pendientes || [];

      const q = search
        .trim()
        .toLowerCase();

      if (!q) {
        return registros;
      }

      return registros.filter(
        (registro) =>
          [
            registro.OPE,
            registro.producto,
            registro.referencia,
            registro.color,
            registro.ancho,
            registro.acabado,
            registro.responsableConteo,
            registro.observacion,
          ].some((value) =>
            String(value || "")
              .toLowerCase()
              .includes(q)
          )
      );
    }, [data, search]);

  /* =======================================================
     NUEVO: SOLO PENDIENTES VÁLIDOS
     ======================================================= */

  const pendientesValidos =
    useMemo(() => {
      return (
        data?.pendientes || []
      ).filter(
        (registro) =>
          registro.valido &&
          !registro.yaProcesado
      );
    }, [data]);

  /* =======================================================
     PROCESAR FILA
     ======================================================= */

  async function procesarFila(
    registro: RegistroCargue
  ) {
    setErrorProcesar("");
    setResultado(null);
    setResultadoMasivo(null);

    if (!registro.valido) {
      setErrorProcesar(
        "Esta fila tiene errores y no puede procesarse."
      );

      return;
    }

    if (registro.yaProcesado) {
      setErrorProcesar(
        "Esta fila ya fue procesada."
      );

      return;
    }

    const confirmado =
      window.confirm(
        [
          "¿Confirmas este cargue inicial?",
          "",
          `OPE: ${registro.OPE}`,
          `Producto: ${registro.producto}`,
          `Medida: ${formatMedida(
            registro.medida_mm
          )}`,
          `Cantidad física: ${formatNumero(
            registro.cantidadFisica
          )} und`,
          `Responsable conteo: ${registro.responsableConteo}`,
          `Fecha conteo: ${registro.fechaConteo}`,
          "",
          "Esta operación creará un movimiento CARGUE_INICIAL y afectará el inventario real de producto en proceso.",
        ].join("\n")
      );

    if (!confirmado) {
      return;
    }

    try {
      setProcesandoRow(
        registro.sheetRow
      );

      const res = await fetch(
        "/api/produccion/control-producto-proceso/cargue-inicial/procesar",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            sheetRow:
              registro.sheetRow,

            usuario:
              email,
          }),
        }
      );

      const json =
        (await res.json()) as ProcesarResponse;

      if (
        !res.ok ||
        !json?.success
      ) {
        throw new Error(
          json?.message ||
            "No fue posible procesar el cargue inicial."
        );
      }

      setResultado(json);

      await cargar();

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (e: any) {
      setErrorProcesar(
        e?.message ||
          "Ocurrió un error procesando el cargue inicial."
      );
    } finally {
      setProcesandoRow(null);
    }
  }

  /* =======================================================
     NUEVO: PROCESAR TODOS LOS VÁLIDOS

     IMPORTANTE:
     Se hace uno por uno, NO en paralelo.

     Si varias filas afectan el mismo inventarioKey,
     cada una encontrará el saldo actualizado de la anterior.
     ======================================================= */

  async function procesarTodosValidos() {
    setErrorProcesar("");
    setResultado(null);
    setResultadoMasivo(null);

    const registros =
      pendientesValidos;

    if (!registros.length) {
      setErrorProcesar(
        "No hay registros válidos pendientes por procesar."
      );

      return;
    }

    const totalUnidades =
      registros.reduce(
        (total, registro) =>
          total +
          Number(
            registro.cantidadFisica ||
              0
          ),
        0
      );

    const confirmacion =
      window.confirm(
        [
          "¿Confirmas el procesamiento masivo del cargue inicial?",
          "",
          `Registros válidos: ${registros.length}`,
          `Unidades físicas: ${formatNumero(
            totalUnidades
          )} und`,
          "",
          data?.totalPendientesConError
            ? `${data.totalPendientesConError} registro(s) con error NO serán procesados.`
            : "No hay registros con error.",
          "",
          "PEX procesará cada existencia una por una y actualizará el inventario real de producto en proceso.",
        ].join("\n")
      );

    if (!confirmacion) {
      return;
    }

    setProcesandoTodos(true);

    setProgresoMasivo({
      actual: 0,
      total:
        registros.length,
    });

    let exitosos = 0;

    const errores: ResultadoMasivo["errores"] =
      [];

    try {
      /*
       * Procesamiento secuencial deliberado.
       *
       * NO usar Promise.all aquí.
       *
       * Dos filas podrían compartir inventarioKey.
       */
      for (
        let index = 0;
        index <
        registros.length;
        index++
      ) {
        const registro =
          registros[index];

        setProgresoMasivo({
          actual: index + 1,
          total:
            registros.length,
        });

        try {
          const res =
            await fetch(
              "/api/produccion/control-producto-proceso/cargue-inicial/procesar",
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
                      sheetRow:
                        registro.sheetRow,

                      usuario:
                        email ||
                        "cargue-inicial",
                    }
                  ),
              }
            );

          const json =
            (await res.json()) as ProcesarResponse;

          if (
            !res.ok ||
            !json?.success
          ) {
            throw new Error(
              json?.message ||
                "No fue posible procesar el registro."
            );
          }

          exitosos++;
        } catch (e: any) {
          errores.push({
            sheetRow:
              registro.sheetRow,

            OPE:
              registro.OPE,

            producto:
              registro.producto,

            mensaje:
              e?.message ||
              "Error procesando el registro.",
          });
        }
      }

      setResultadoMasivo({
        total:
          registros.length,

        exitosos,

        fallidos:
          errores.length,

        errores,
      });

      /*
       * Una sola actualización general al terminar.
       */
      await cargar();

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (e: any) {
      setErrorProcesar(
        e?.message ||
          "Ocurrió un error durante el procesamiento masivo."
      );
    } finally {
      setProcesandoTodos(false);

      setProgresoMasivo({
        actual: 0,
        total: 0,
      });
    }
  }

  /* =======================================================
     SESIÓN
     ======================================================= */

  if (status === "loading") {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
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
            Tu usuario no tiene permisos para gestionar el cargue inicial de producto en proceso.
          </p>

          <Link
            href="/produccion"
            className="mt-4 inline-flex rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700"
          >
            ← Volver a Producción
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
          <div className="mb-2 text-sm text-slate-500">
            Producción · Control Producto en Proceso · Cargue inicial
          </div>

          <h1 className="text-2xl font-semibold">
            Cargue inicial de producto en proceso
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Incorpora al inventario PEX las existencias físicas contadas al iniciar el control.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={cargar}
            disabled={
              loading ||
              procesandoRow !== null ||
              procesandoTodos
            }
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ↻ Actualizar
          </button>

          <Link
            href="/produccion/control-producto-proceso"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
          >
            ← Control P.P.
          </Link>
        </div>
      </div>

      {/* ===================================================
          RESULTADO MASIVO
         =================================================== */}

      {resultadoMasivo ? (
        <section
          className={`mt-6 rounded-2xl border p-5 ${
            resultadoMasivo.fallidos ===
            0
              ? "border-emerald-300 bg-emerald-50"
              : "border-amber-300 bg-amber-50"
          }`}
        >
          <div
            className={`text-base font-semibold ${
              resultadoMasivo.fallidos ===
              0
                ? "text-emerald-800"
                : "text-amber-800"
            }`}
          >
            {resultadoMasivo.fallidos ===
            0
              ? "✓ Cargue masivo procesado correctamente"
              : "Cargue masivo finalizado con novedades"}
          </div>

          <p
            className={`mt-1 text-sm ${
              resultadoMasivo.fallidos ===
              0
                ? "text-emerald-700"
                : "text-amber-700"
            }`}
          >
            PEX terminó de procesar los registros válidos seleccionados para el cargue inicial.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/80 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Registros
              </div>

              <div className="mt-1 text-xl font-semibold text-slate-900">
                {
                  resultadoMasivo.total
                }
              </div>
            </div>

            <div className="rounded-xl bg-white/80 p-4">
              <div className="text-xs uppercase tracking-wide text-emerald-700">
                Procesados
              </div>

              <div className="mt-1 text-xl font-semibold text-emerald-700">
                {
                  resultadoMasivo.exitosos
                }
              </div>
            </div>

            <div className="rounded-xl bg-white/80 p-4">
              <div className="text-xs uppercase tracking-wide text-red-700">
                Fallidos
              </div>

              <div className="mt-1 text-xl font-semibold text-red-700">
                {
                  resultadoMasivo.fallidos
                }
              </div>
            </div>
          </div>

          {resultadoMasivo.errores
            .length > 0 ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-white/80 p-4">
              <div className="text-sm font-semibold text-red-800">
                Registros que requieren revisión
              </div>

              <p className="mt-1 text-xs text-red-700">
                Estos registros no fueron incorporados al inventario y permanecen pendientes para corregirlos.
              </p>

              <div className="mt-3 space-y-3">
                {resultadoMasivo.errores.map(
                  (item) => (
                    <div
                      key={
                        item.sheetRow
                      }
                      className="rounded-lg bg-red-50 p-3"
                    >
                      <div className="text-sm font-semibold text-red-800">
                        Fila{" "}
                        {
                          item.sheetRow
                        }{" "}
                        · {item.OPE}
                      </div>

                      <div className="mt-1 text-xs text-red-700">
                        {
                          item.producto
                        }
                      </div>

                      <div className="mt-1 text-xs font-medium text-red-700">
                        {
                          item.mensaje
                        }
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/produccion/control-producto-proceso/inventario"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Ver inventario actual →
            </Link>

            <Link
              href="/produccion/control-producto-proceso/historial"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Ver historial →
            </Link>

            <button
              type="button"
              onClick={() =>
                setResultadoMasivo(
                  null
                )
              }
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Cerrar
            </button>
          </div>
        </section>
      ) : null}

      {/* ===================================================
          RESULTADO DE PROCESAMIENTO INDIVIDUAL
         =================================================== */}

      {resultado?.success ? (
        <section className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-5">
          <div className="text-base font-semibold text-emerald-800">
            ✓ Cargue inicial procesado correctamente
          </div>

          <p className="mt-1 text-sm text-emerald-700">
            La existencia física ya fue incorporada al inventario de producto en proceso.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-white/80 p-4">
              <div className="text-xs uppercase tracking-wide text-emerald-700">
                OPE
              </div>

              <div className="mt-1 font-semibold text-slate-900">
                {resultado.OPE}
              </div>
            </div>

            <div className="rounded-xl bg-white/80 p-4">
              <div className="text-xs uppercase tracking-wide text-emerald-700">
                Medida
              </div>

              <div className="mt-1 font-semibold text-slate-900">
                {formatMedida(
                  resultado.medida_mm || 0
                )}
              </div>
            </div>

            <div className="rounded-xl bg-white/80 p-4">
              <div className="text-xs uppercase tracking-wide text-emerald-700">
                Cargado
              </div>

              <div className="mt-1 font-semibold text-emerald-800">
                {formatNumero(
                  resultado.cantidadFisica || 0
                )}{" "}
                und
              </div>
            </div>

            <div className="rounded-xl bg-white/80 p-4">
              <div className="text-xs uppercase tracking-wide text-emerald-700">
                Saldo actual
              </div>

              <div className="mt-1 font-semibold text-emerald-800">
                {formatNumero(
                  resultado.saldoFinal || 0
                )}{" "}
                und
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-white/70 px-4 py-3 text-xs text-emerald-800">
            Cargue:{" "}
            <b>{resultado.cargueKey}</b>
            {" · "}
            Inventario:{" "}
            <b>{resultado.inventarioKey}</b>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/produccion/control-producto-proceso/inventario"
              className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
            >
              Ver inventario actual →
            </Link>

            <Link
              href="/produccion/control-producto-proceso/historial"
              className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
            >
              Ver historial →
            </Link>

            <button
              type="button"
              onClick={() =>
                setResultado(null)
              }
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Continuar
            </button>
          </div>
        </section>
      ) : null}

      {/* ===================================================
          ERROR DE PROCESAMIENTO
         =================================================== */}

      {errorProcesar ? (
        <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {errorProcesar}
        </section>
      ) : null}

      {/* ===================================================
          RESUMEN
         =================================================== */}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Pendientes
            </div>

            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {data?.totalPendientes ?? 0}
            </div>
          </div>

          <div className="rounded-xl bg-emerald-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">
              Válidos
            </div>

            <div className="mt-1 text-2xl font-semibold text-emerald-700">
              {data?.totalPendientesValidos ?? 0}
            </div>
          </div>

          <div className="rounded-xl bg-red-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-red-700">
              Con error
            </div>

            <div className="mt-1 text-2xl font-semibold text-red-700">
              {data?.totalPendientesConError ?? 0}
            </div>
          </div>

          <div className="rounded-xl bg-blue-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-blue-700">
              Unidades pendientes
            </div>

            <div className="mt-1 text-2xl font-semibold text-blue-700">
              {formatNumero(
                data?.totalUnidadesPendientes ??
                  0
              )}
            </div>
          </div>
        </div>

        {/* =================================================
            NUEVO: PROCESAMIENTO MASIVO
           ================================================= */}

        <div className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-indigo-900">
                Procesamiento masivo
              </div>

              <p className="mt-1 text-sm text-indigo-700">
                Procesa únicamente los registros válidos pendientes. Las filas con errores permanecerán sin procesar para su corrección.
              </p>

              {data?.totalPendientesConError ? (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  Hay{" "}
                  {data.totalPendientesConError}{" "}
                  registro(s) con error que serán omitidos.
                </p>
              ) : null}

              {procesandoTodos ? (
                <div className="mt-3">
                  <div className="text-sm font-semibold text-indigo-800">
                    Procesando{" "}
                    {
                      progresoMasivo.actual
                    }{" "}
                    de{" "}
                    {
                      progresoMasivo.total
                    }
                    ...
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-indigo-100">
                    <div
                      className="h-full bg-indigo-600 transition-all"
                      style={{
                        width:
                          progresoMasivo.total >
                          0
                            ? `${Math.round(
                                (progresoMasivo.actual /
                                  progresoMasivo.total) *
                                  100
                              )}%`
                            : "0%",
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={
                procesarTodosValidos
              }
              disabled={
                loading ||
                procesandoTodos ||
                procesandoRow !==
                  null ||
                pendientesValidos.length ===
                  0
              }
              className="shrink-0 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {procesandoTodos
                ? `Procesando ${progresoMasivo.actual}/${progresoMasivo.total}`
                : `Procesar todos los válidos (${pendientesValidos.length})`}
            </button>
          </div>
        </div>

        {/* BUSCADOR */}

        <div className="mt-5">
          <label className="text-sm font-medium text-slate-700">
            Buscar existencia
          </label>

          <input
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Ej. OPE260310, Perfil Plano, Transparente..."
            disabled={
              procesandoTodos
            }
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
        </div>
      </section>

      {/* ===================================================
          PENDIENTES
         =================================================== */}

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Pendientes por procesar
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Cada fila representa una existencia física contada en planta.
            </p>
          </div>

          <div className="text-sm text-slate-500">
            {pendientesFiltrados.length} registro(s)
          </div>
        </div>

        {loading ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Consultando cargue inicial...
            </p>
          </div>
        ) : error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-sm font-medium text-red-700">
              {error}
            </p>
          </div>
        ) : pendientesFiltrados.length ===
          0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold text-slate-800">
              No hay registros pendientes
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Agrega existencias físicas en la pestaña CargueInicialProceso para incorporarlas al inventario.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {pendientesFiltrados.map(
              (registro) => (
                <div
                  key={
                    registro.sheetRow
                  }
                  className={`rounded-2xl border bg-white p-5 shadow-sm ${
                    registro.valido
                      ? "border-slate-200"
                      : "border-red-200"
                  }`}
                >
                  <div className="grid gap-5 lg:grid-cols-[1fr_150px_150px_auto] lg:items-center">
                    {/* DATOS */}

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-lg font-semibold text-slate-900">
                          {registro.OPE ||
                            "Sin OPE"}
                        </div>

                        {registro.valido ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            Válido
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                            Revisar
                          </span>
                        )}
                      </div>

                      <div className="mt-2 text-sm font-medium text-slate-900">
                        {registro.producto ||
                          "Producto sin especificar"}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {registro.color ? (
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                            {registro.color}
                          </span>
                        ) : null}

                        {registro.ancho ? (
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                            {registro.ancho}
                          </span>
                        ) : null}

                        {registro.acabado ? (
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                            {registro.acabado}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-3 text-xs text-slate-500">
                        Responsable:{" "}
                        <b>
                          {registro.responsableConteo ||
                            "-"}
                        </b>
                        {" · "}
                        Fecha conteo:{" "}
                        <b>
                          {registro.fechaConteo ||
                            "-"}
                        </b>
                      </div>

                      {registro.observacion ? (
                        <div className="mt-2 text-xs text-slate-500">
                          {registro.observacion}
                        </div>
                      ) : null}

                      {!registro.valido &&
                      registro.errores.length ? (
                        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
                          <div className="text-xs font-semibold text-red-800">
                            Errores encontrados
                          </div>

                          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-red-700">
                            {registro.errores.map(
                              (
                                mensaje,
                                index
                              ) => (
                                <li
                                  key={
                                    index
                                  }
                                >
                                  {mensaje}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      ) : null}
                    </div>

                    {/* MEDIDA */}

                    <div className="lg:text-right">
                      <div className="text-xs text-slate-500">
                        Medida
                      </div>

                      <div className="mt-1 text-xl font-semibold text-slate-900">
                        {formatMedida(
                          registro.medida_mm
                        )}
                      </div>

                      <div className="mt-1 text-xs text-slate-400">
                        {registro.medida_mm.toLocaleString(
                          "es-CO"
                        )}{" "}
                        mm
                      </div>
                    </div>

                    {/* CANTIDAD */}

                    <div className="lg:text-right">
                      <div className="text-xs text-slate-500">
                        Cantidad física
                      </div>

                      <div className="mt-1 text-2xl font-semibold text-emerald-700">
                        {formatNumero(
                          registro.cantidadFisica
                        )}{" "}
                        <span className="text-sm">
                          und
                        </span>
                      </div>
                    </div>

                    {/* ACCIÓN */}

                    <div className="lg:text-right">
                      <button
                        type="button"
                        disabled={
                          !registro.valido ||
                          procesandoRow !==
                            null ||
                          procesandoTodos
                        }
                        onClick={() =>
                          procesarFila(
                            registro
                          )
                        }
                        className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                          registro.valido
                            ? "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-300"
                            : "cursor-not-allowed bg-slate-200 text-slate-500"
                        }`}
                      >
                        {procesandoRow ===
                        registro.sheetRow
                          ? "Procesando..."
                          : "Procesar"}
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>

      {/* ===================================================
          HISTORIAL DE CARGUES PROCESADOS
         =================================================== */}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Cargues ya procesados
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Registros del conteo inicial que ya fueron incorporados al inventario.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setMostrarProcesados(
                (actual) =>
                  !actual
              )
            }
            disabled={
              procesandoTodos
            }
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mostrarProcesados
              ? "Ocultar"
              : `Ver procesados (${
                  data?.totalProcesados ??
                  0
                })`}
          </button>
        </div>

        {mostrarProcesados ? (
          <div className="mt-4">
            {!data?.procesados
              ?.length ? (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                Todavía no hay cargues procesados.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="divide-y divide-slate-200">
                  {data.procesados.map(
                    (registro) => (
                      <div
                        key={
                          registro.sheetRow
                        }
                        className="grid gap-3 p-4 md:grid-cols-[120px_1fr_130px_130px]"
                      >
                        <div>
                          <div className="text-xs text-slate-500">
                            OPE
                          </div>

                          <div className="text-sm font-semibold text-slate-900">
                            {registro.OPE}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            {registro.producto}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {registro.cargueKey ||
                              "Sin key"}
                          </div>
                        </div>

                        <div className="md:text-right">
                          <div className="text-xs text-slate-500">
                            Medida
                          </div>

                          <div className="font-semibold text-slate-900">
                            {formatMedida(
                              registro.medida_mm
                            )}
                          </div>
                        </div>

                        <div className="md:text-right">
                          <div className="text-xs text-slate-500">
                            Cargado
                          </div>

                          <div className="font-semibold text-emerald-700">
                            {formatNumero(
                              registro.cantidadFisica
                            )}{" "}
                            und
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            {formatFecha(
                              registro.fechaProcesado
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}