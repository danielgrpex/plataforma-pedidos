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

type InventarioResponse = {
  ok: boolean;

  totalRegistros: number;
  totalLotes: number;
  totalUnidades: number;

  inventario: InventarioItem[];

  error?: string;
};

type ConteoResponse = {
  ok: boolean;

  conteoKey?: string;
  fechaConteo?: string;

  tipoConteo?: string;

  inventarioKey?: string;

  OPE?: string;
  producto?: string;

  medida_mm?: number;

  cantidadSistema?: number;
  cantidadFisica?: number;
  diferencia?: number;

  responsableConteo?: string;
  usuarioSistema?: string;

  motivoDiferencia?: string;

  estado?: string;

  requiereAjuste?: boolean;
  inventarioModificado?: boolean;

  message?: string;
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

/* =========================================================
   COMPONENTE
   ========================================================= */

export default function NuevoConteoFisicoPage() {
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
    useState<InventarioResponse | null>(
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
    inventarioSeleccionado,
    setInventarioSeleccionado,
  ] =
    useState<InventarioItem | null>(
      null
    );

  const [
    tipoConteo,
    setTipoConteo,
  ] =
    useState<
      | "Semanal"
      | "Mensual"
      | "Extraordinario"
    >("Semanal");

  const [
    cantidadFisica,
    setCantidadFisica,
  ] =
    useState("");

  const [
    responsableConteo,
    setResponsableConteo,
  ] =
    useState("");

  const [
    motivoDiferencia,
    setMotivoDiferencia,
  ] =
    useState("");

  const [
    guardando,
    setGuardando,
  ] =
    useState(false);

  const [
    errorGuardar,
    setErrorGuardar,
  ] =
    useState("");

  const [
    resultado,
    setResultado,
  ] =
    useState<ConteoResponse | null>(
      null
    );

  /* =======================================================
     CARGAR INVENTARIO
     ======================================================= */

  async function cargarInventario() {
    try {
      setLoading(true);
      setError("");

      const res =
        await fetch(
          "/api/produccion/control-producto-proceso/inventario",
          {
            cache:
              "no-store",
          }
        );

      const json =
        (await res.json()) as InventarioResponse;

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
     INVENTARIO FILTRADO
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
          const medida =
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
            String(
              item.medida_mm
            ),
            medida,
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
     DIFERENCIA PRELIMINAR
     ======================================================= */

  const cantidadFisicaNumero =
    cantidadFisica.trim() ===
    ""
      ? null
      : Number(
          cantidadFisica
        );

  const diferenciaPreliminar =
    inventarioSeleccionado &&
    cantidadFisicaNumero !==
      null &&
    Number.isFinite(
      cantidadFisicaNumero
    )
      ? cantidadFisicaNumero -
        inventarioSeleccionado.cantidadDisponible
      : null;

  const requiereMotivo =
    diferenciaPreliminar !==
      null &&
    diferenciaPreliminar !==
      0;

  /* =======================================================
     SELECCIONAR EXISTENCIA
     ======================================================= */

  function seleccionarInventario(
    item: InventarioItem
  ) {
    setInventarioSeleccionado(
      item
    );

    setCantidadFisica("");
    setMotivoDiferencia("");
    setErrorGuardar("");
    setResultado(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  /* =======================================================
     CANCELAR SELECCIÓN
     ======================================================= */

  function cancelarSeleccion() {
    setInventarioSeleccionado(
      null
    );

    setCantidadFisica("");
    setMotivoDiferencia("");
    setErrorGuardar("");
    setResultado(null);
  }

  /* =======================================================
     GUARDAR CONTEO
     ======================================================= */

  async function guardarConteo() {
    setErrorGuardar("");
    setResultado(null);

    if (
      !inventarioSeleccionado
    ) {
      setErrorGuardar(
        "Selecciona una existencia para realizar el conteo."
      );

      return;
    }

    if (
      cantidadFisica.trim() ===
      ""
    ) {
      setErrorGuardar(
        "Ingresa la cantidad encontrada físicamente."
      );

      return;
    }

    const cantidad =
      Number(
        cantidadFisica
      );

    if (
      !Number.isFinite(
        cantidad
      ) ||
      cantidad < 0
    ) {
      setErrorGuardar(
        "La cantidad física debe ser 0 o mayor."
      );

      return;
    }

    if (
      !Number.isInteger(
        cantidad
      )
    ) {
      setErrorGuardar(
        "La cantidad física debe registrarse en unidades enteras."
      );

      return;
    }

    if (
      !responsableConteo.trim()
    ) {
      setErrorGuardar(
        "Ingresa el nombre del responsable del conteo."
      );

      return;
    }

    if (
      requiereMotivo &&
      !motivoDiferencia.trim()
    ) {
      setErrorGuardar(
        "Debes indicar el motivo de la diferencia."
      );

      return;
    }

    const diferencia =
      cantidad -
      inventarioSeleccionado.cantidadDisponible;

    const confirmado =
      window.confirm(
        [
          "¿Confirmas este conteo físico?",
          "",
          `OPE: ${inventarioSeleccionado.OPE}`,
          `Producto: ${inventarioSeleccionado.producto}`,
          `Medida: ${formatMedida(
            inventarioSeleccionado.medida_mm
          )}`,
          "",
          `Cantidad mostrada por PEX: ${formatNumero(
            inventarioSeleccionado.cantidadDisponible
          )} und`,
          `Cantidad física: ${formatNumero(
            cantidad
          )} und`,
          `Diferencia preliminar: ${
            diferencia > 0
              ? "+"
              : ""
          }${formatNumero(
            diferencia
          )} und`,
          "",
          diferencia === 0
            ? "El conteo quedará registrado sin diferencia."
            : "El conteo quedará Pendiente ajuste. Todavía NO se modificará el inventario.",
        ].join("\n")
      );

    if (!confirmado) {
      return;
    }

    try {
      setGuardando(
        true
      );

      /*
       * IMPORTANTE:
       *
       * Solo enviamos la existencia y el conteo físico.
       *
       * El backend vuelve a calcular cantidadSistema
       * desde MovimientosProceso.
       */
      const res =
        await fetch(
          "/api/abastecimientologistica/inventario-producto-proceso/conteos",
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
                  inventarioKey:
                    inventarioSeleccionado.inventarioKey,

                  tipoConteo,

                  cantidadFisica:
                    cantidad,

                  responsableConteo:
                    responsableConteo.trim(),

                  motivoDiferencia:
                    motivoDiferencia.trim(),

                  usuarioSistema:
                    email,
                }
              ),
          }
        );

      const json =
        (await res.json()) as ConteoResponse;

      if (
        !res.ok ||
        !json?.ok
      ) {
        throw new Error(
          json?.message ||
            "No fue posible registrar el conteo."
        );
      }

      setResultado(
        json
      );

      /*
       * No recargamos ni alteramos inventario porque
       * guardar el conteo NO modifica el saldo.
       */
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (e: any) {
      setErrorGuardar(
        e?.message ||
          "Ocurrió un error registrando el conteo."
      );
    } finally {
      setGuardando(
        false
      );
    }
  }

  /* =======================================================
     NUEVO CONTEO
     ======================================================= */

  function nuevoConteo() {
    setResultado(null);
    setInventarioSeleccionado(
      null
    );
    setCantidadFisica("");
    setMotivoDiferencia("");
    setErrorGuardar("");
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
            Tu usuario no tiene permisos para realizar conteos de producto en proceso.
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
            Abastecimiento y Logística · Inventario producto en proceso · Nuevo conteo físico
          </div>

          <div className="mb-3 inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-100">
            Conciliación de inventario
          </div>

          <h1 className="text-2xl font-semibold text-neutral-900">
            Nuevo conteo físico
          </h1>

          <p className="mt-1 text-sm text-neutral-600">
            Compara la existencia física encontrada contra el saldo registrado en PEX.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={
              cargarInventario
            }
            disabled={
              loading ||
              guardando
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
          RESULTADO
         =================================================== */}

      {resultado?.ok ? (
        <section
          className={`mt-6 rounded-2xl border p-5 ${
            resultado.requiereAjuste
              ? "border-amber-300 bg-amber-50"
              : "border-emerald-300 bg-emerald-50"
          }`}
        >
          <div
            className={`text-base font-semibold ${
              resultado.requiereAjuste
                ? "text-amber-900"
                : "text-emerald-800"
            }`}
          >
            {resultado.requiereAjuste
              ? "Conteo registrado · Pendiente de ajuste"
              : "✓ Conteo registrado sin diferencias"}
          </div>

          <p
            className={`mt-1 text-sm ${
              resultado.requiereAjuste
                ? "text-amber-700"
                : "text-emerald-700"
            }`}
          >
            {resultado.requiereAjuste
              ? "La diferencia quedó registrada, pero el inventario todavía no ha sido modificado."
              : "La cantidad física coincide con el saldo oficial de PEX."}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-white/80 p-4">
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                OPE
              </div>

              <div className="mt-1 font-semibold">
                {resultado.OPE}
              </div>
            </div>

            <div className="rounded-xl bg-white/80 p-4">
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                Sistema
              </div>

              <div className="mt-1 text-xl font-semibold">
                {formatNumero(
                  resultado.cantidadSistema ||
                    0
                )}{" "}
                und
              </div>
            </div>

            <div className="rounded-xl bg-white/80 p-4">
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                Físico
              </div>

              <div className="mt-1 text-xl font-semibold">
                {formatNumero(
                  resultado.cantidadFisica ||
                    0
                )}{" "}
                und
              </div>
            </div>

            <div className="rounded-xl bg-white/80 p-4">
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                Diferencia
              </div>

              <div
                className={`mt-1 text-xl font-semibold ${
                  (resultado.diferencia ||
                    0) === 0
                    ? "text-emerald-700"
                    : "text-amber-700"
                }`}
              >
                {(resultado.diferencia ||
                  0) > 0
                  ? "+"
                  : ""}
                {formatNumero(
                  resultado.diferencia ||
                    0
                )}{" "}
                und
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-white/70 px-4 py-3 text-xs text-neutral-700">
            Conteo:{" "}
            <b>
              {
                resultado.conteoKey
              }
            </b>
            {" · "}
            Estado:{" "}
            <b>
              {
                resultado.estado
              }
            </b>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={
                nuevoConteo
              }
              className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Nuevo conteo
            </button>

            <Link
              href="/abastecimientologistica/inventario-producto-proceso/inventario"
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
            >
              Ver inventario actual →
            </Link>
          </div>
        </section>
      ) : null}

      {/* ===================================================
          ERROR DE GUARDADO
         =================================================== */}

      {errorGuardar ? (
        <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {errorGuardar}
        </section>
      ) : null}

      {/* ===================================================
          FORMULARIO DE EXISTENCIA SELECCIONADA
         =================================================== */}

      {inventarioSeleccionado &&
      !resultado ? (
        <section className="mt-6 rounded-2xl border border-orange-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                Existencia seleccionada
              </div>

              <h2 className="mt-1 text-xl font-semibold text-neutral-900">
                {
                  inventarioSeleccionado.OPE
                }
              </h2>

              <div className="mt-1 text-sm font-medium text-neutral-800">
                {
                  inventarioSeleccionado.producto
                }
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {inventarioSeleccionado.color ? (
                  <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-600">
                    {
                      inventarioSeleccionado.color
                    }
                  </span>
                ) : null}

                {inventarioSeleccionado.ancho ? (
                  <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-600">
                    {
                      inventarioSeleccionado.ancho
                    }
                  </span>
                ) : null}

                {inventarioSeleccionado.acabado ? (
                  <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-600">
                    {
                      inventarioSeleccionado.acabado
                    }
                  </span>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={
                cancelarSeleccion
              }
              disabled={
                guardando
              }
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
            >
              Cambiar existencia
            </button>
          </div>

          {/* RESUMEN SISTEMA */}

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-neutral-50 p-4">
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                Medida
              </div>

              <div className="mt-1 text-xl font-semibold text-neutral-900">
                {formatMedida(
                  inventarioSeleccionado.medida_mm
                )}
              </div>
            </div>

            <div className="rounded-xl bg-blue-50 p-4">
              <div className="text-xs uppercase tracking-wide text-blue-700">
                Cantidad PEX
              </div>

              <div className="mt-1 text-2xl font-semibold text-blue-800">
                {formatNumero(
                  inventarioSeleccionado.cantidadDisponible
                )}{" "}
                und
              </div>
            </div>

            <div className="rounded-xl bg-neutral-50 p-4">
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                Último movimiento
              </div>

              <div className="mt-1 text-sm font-semibold text-neutral-900">
                {formatFecha(
                  inventarioSeleccionado.fechaUltimoMovimiento
                )}
              </div>
            </div>
          </div>

          {/* FORMULARIO */}

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {/* TIPO */}

            <div>
              <label className="text-sm font-medium text-neutral-700">
                Tipo de conteo
              </label>

              <select
                value={
                  tipoConteo
                }
                onChange={(
                  e
                ) =>
                  setTipoConteo(
                    e.target
                      .value as
                      | "Semanal"
                      | "Mensual"
                      | "Extraordinario"
                  )
                }
                disabled={
                  guardando
                }
                className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              >
                <option value="Semanal">
                  Semanal
                </option>

                <option value="Mensual">
                  Mensual
                </option>

                <option value="Extraordinario">
                  Extraordinario
                </option>
              </select>
            </div>

            {/* RESPONSABLE */}

            <div>
              <label className="text-sm font-medium text-neutral-700">
                Responsable del conteo
              </label>

              <input
                value={
                  responsableConteo
                }
                onChange={(
                  e
                ) =>
                  setResponsableConteo(
                    e.target.value
                  )
                }
                disabled={
                  guardando
                }
                placeholder="Nombre de quien realizó el conteo"
                className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            {/* CANTIDAD FÍSICA */}

            <div>
              <label className="text-sm font-medium text-neutral-700">
                Cantidad encontrada físicamente
              </label>

              <input
                type="number"
                min="0"
                step="1"
                value={
                  cantidadFisica
                }
                onChange={(
                  e
                ) =>
                  setCantidadFisica(
                    e.target.value
                  )
                }
                disabled={
                  guardando
                }
                placeholder="Ej. 212"
                className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            {/* DIFERENCIA */}

            <div>
              <div className="text-sm font-medium text-neutral-700">
                Diferencia preliminar
              </div>

              <div
                className={`mt-2 rounded-xl border p-4 ${
                  diferenciaPreliminar ===
                  null
                    ? "border-neutral-200 bg-neutral-50"
                    : diferenciaPreliminar ===
                        0
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-amber-200 bg-amber-50"
                }`}
              >
                {diferenciaPreliminar ===
                null ? (
                  <div className="text-sm text-neutral-500">
                    Ingresa la cantidad física.
                  </div>
                ) : (
                  <>
                    <div
                      className={`text-2xl font-semibold ${
                        diferenciaPreliminar ===
                        0
                          ? "text-emerald-700"
                          : "text-amber-700"
                      }`}
                    >
                      {diferenciaPreliminar >
                      0
                        ? "+"
                        : ""}
                      {formatNumero(
                        diferenciaPreliminar
                      )}{" "}
                      und
                    </div>

                    <div className="mt-1 text-xs text-neutral-600">
                      Físico - PEX
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* MOTIVO */}

          {requiereMotivo ? (
            <div className="mt-5">
              <label className="text-sm font-medium text-neutral-700">
                Motivo de la diferencia{" "}
                <span className="text-red-600">
                  *
                </span>
              </label>

              <textarea
                value={
                  motivoDiferencia
                }
                onChange={(
                  e
                ) =>
                  setMotivoDiferencia(
                    e.target.value
                  )
                }
                disabled={
                  guardando
                }
                placeholder="Ej. 5 unidades deterioradas encontradas durante el conteo."
                rows={3}
                className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />

              <p className="mt-2 text-xs text-amber-700">
                El motivo es obligatorio porque existe una diferencia contra el saldo de PEX.
              </p>
            </div>
          ) : null}

          {/* AVISO */}

          <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-sm font-semibold text-blue-900">
              Registrar conteo no modifica el inventario
            </div>

            <p className="mt-1 text-sm text-blue-700">
              Si existe una diferencia, el conteo quedará como Pendiente ajuste para revisión y conciliación posterior.
            </p>
          </div>

          {/* BOTÓN */}

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={
                guardarConteo
              }
              disabled={
                guardando
              }
              className="rounded-xl bg-orange-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {guardando
                ? "Registrando..."
                : "Registrar conteo físico"}
            </button>
          </div>
        </section>
      ) : null}

      {/* ===================================================
          BUSCADOR DE EXISTENCIAS
         =================================================== */}

      {!inventarioSeleccionado &&
      !resultado ? (
        <>
          <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-base font-semibold text-neutral-900">
                Selecciona la existencia a contar
              </h2>

              <p className="mt-1 text-sm text-neutral-600">
                Busca por OPE, producto, color, ancho o medida.
              </p>
            </div>

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
              placeholder="Ej. OPE260310, Perfil Plano, Transparente, 2,55 m..."
              className="mt-4 w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </section>

          {loading ? (
            <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-neutral-500">
                Consultando inventario...
              </p>
            </section>
          ) : error ? (
            <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
              <p className="text-sm text-red-700">
                {error}
              </p>
            </section>
          ) : inventarioFiltrado.length ===
            0 ? (
            <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-neutral-500">
                No se encontraron existencias disponibles con ese criterio.
              </p>
            </section>
          ) : (
            <section className="mt-6 space-y-3">
              {inventarioFiltrado.map(
                (
                  item
                ) => (
                  <div
                    key={
                      item.inventarioKey
                    }
                    className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
                  >
                    <div className="grid gap-5 lg:grid-cols-[1fr_130px_150px_auto] lg:items-center">
                      {/* PRODUCTO */}

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-lg font-semibold text-neutral-900">
                            {
                              item.OPE
                            }
                          </div>

                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            {
                              item.estado
                            }
                          </span>
                        </div>

                        <div className="mt-2 text-sm font-medium text-neutral-900">
                          {
                            item.producto
                          }
                        </div>

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
                      </div>

                      {/* SISTEMA */}

                      <div className="lg:text-right">
                        <div className="text-xs text-neutral-500">
                          Saldo PEX
                        </div>

                        <div className="mt-1 text-2xl font-semibold text-emerald-700">
                          {formatNumero(
                            item.cantidadDisponible
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
                          onClick={() =>
                            seleccionarInventario(
                              item
                            )
                          }
                          className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
                        >
                          Contar
                        </button>
                      </div>
                    </div>
                  </div>
                )
              )}
            </section>
          )}
        </>
      ) : null}
    </main>
  );
}