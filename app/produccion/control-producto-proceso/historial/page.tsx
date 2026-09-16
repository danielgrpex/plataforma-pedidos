"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { allowedProduccionTabsForUser } from "@/lib/auth/permissions";

type Movimiento = {
  sheetRow: number;
  movimientoKey: string;
  timestamp: string;
  tipoMovimiento: string;
  OPE: string;
  OTE: string;
  consecutivoCorte: string;
  producto: string;
  referencia: string;
  color: string;
  ancho: string;
  acabado: string;
  medida_mm: number;
  cantidadMovimiento: number;
  inventarioKey: string;
  transformacionKey: string;
  usuario: string;
  turno: string;
  observacion: string;
  movimientoRelacionado: string;
  estado: string;
  supervisor: string;
};

type ApiResponse = {
  ok: boolean;
  totalMovimientos: number;
  movimientosActivos: number;
  totalEntradasUnd: number;
  totalSalidasUnd: number;
  movimientos: Movimiento[];
  error?: string;
};

function formatMedida(mm: number) {
  if (!mm) return "-";

  return `${(mm / 1000).toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })} m`;
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

function nombreTipo(tipo: string) {
  const mapa: Record<string, string> = {
    ENTRADA_PRODUCCION: "Entrada producción",
    CONSUMO_EMPAQUE: "Consumo empaque",
    ENTRADA_REMANENTE: "Entrada remanente",
    MERMA: "Merma",
    AJUSTE_POSITIVO: "Ajuste positivo",
    AJUSTE_NEGATIVO: "Ajuste negativo",
    DEVOLUCION_EMPAQUE: "Devolución empaque",
    SALDO_INICIAL: "Saldo inicial",
    REVERSIÓN: "Reversión",
    REVERSION: "Reversión",
  };

  return mapa[tipo] || tipo.replaceAll("_", " ");
}

export default function HistorialProcesoPage() {
  const { data: session, status } = useSession();

  const email = (session?.user as any)?.email || "";
  const role = (session?.user as any)?.role || "";

  const allowedTabs = allowedProduccionTabsForUser({
    email,
    role,
  });

  const canAccess = allowedTabs.includes(
    "control-producto-proceso"
  );

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("TODOS");

  async function cargarHistorial() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(
        "/api/produccion/control-producto-proceso/historial",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(
          json?.error ||
            "No fue posible consultar el historial."
        );
      }

      setData(json);
    } catch (e: any) {
      setError(
        e?.message ||
          "Ocurrió un error consultando el historial."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === "loading") return;

    if (!canAccess) {
      setLoading(false);
      return;
    }

    cargarHistorial();
  }, [status, canAccess]);

  const tiposDisponibles = useMemo(() => {
    const tipos = new Set(
      (data?.movimientos || [])
        .map((m) => m.tipoMovimiento)
        .filter(Boolean)
    );

    return Array.from(tipos).sort();
  }, [data]);

  const movimientosFiltrados = useMemo(() => {
    const movimientos = data?.movimientos || [];
    const q = search.trim().toLowerCase();

    return movimientos.filter((mov) => {
      if (
        tipoFiltro !== "TODOS" &&
        mov.tipoMovimiento !== tipoFiltro
      ) {
        return false;
      }

      if (!q) return true;

      const medida = formatMedida(
        mov.medida_mm
      ).toLowerCase();

      return [
        mov.OPE,
        mov.OTE,
        mov.consecutivoCorte,
        mov.producto,
        mov.referencia,
        mov.color,
        mov.ancho,
        mov.acabado,
        mov.tipoMovimiento,
        nombreTipo(mov.tipoMovimiento),
        mov.supervisor,
        mov.turno,
        mov.usuario,
        mov.observacion,
        mov.estado,
        medida,
        String(mov.medida_mm || ""),
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [data, search, tipoFiltro]);

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
            Tu usuario no tiene permisos para consultar el
            historial de producto en proceso.
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

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 text-sm text-slate-500">
            Producción · Control Producto en Proceso · Historial
          </div>

          <h1 className="text-2xl font-semibold">
            Historial de movimientos
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Trazabilidad de entradas, salidas, transformaciones,
            remanentes y ajustes de producto en proceso.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={cargarHistorial}
            disabled={loading}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            ↻ Actualizar
          </button>

          <Link
            href="/produccion/control-producto-proceso"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            ← Control P.P.
          </Link>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Movimientos
            </div>

            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {data?.totalMovimientos ?? 0}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Activos
            </div>

            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {data?.movimientosActivos ?? 0}
            </div>
          </div>

          <div className="rounded-xl bg-emerald-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">
              Entradas
            </div>

            <div className="mt-1 text-2xl font-semibold text-emerald-700">
              {(data?.totalEntradasUnd ?? 0).toLocaleString(
                "es-CO"
              )}{" "}
              <span className="text-sm">und</span>
            </div>
          </div>

          <div className="rounded-xl bg-red-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-red-700">
              Salidas
            </div>

            <div className="mt-1 text-2xl font-semibold text-red-700">
              {(data?.totalSalidasUnd ?? 0).toLocaleString(
                "es-CO"
              )}{" "}
              <span className="text-sm">und</span>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_260px]">
          <div>
            <label className="text-sm font-medium text-slate-700">
              Buscar movimiento
            </label>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="OPE, OTE, producto, supervisor, medida..."
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Tipo de movimiento
            </label>

            <select
              value={tipoFiltro}
              onChange={(e) =>
                setTipoFiltro(e.target.value)
              }
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="TODOS">
                Todos
              </option>

              {tiposDisponibles.map((tipo) => (
                <option
                  key={tipo}
                  value={tipo}
                >
                  {nombreTipo(tipo)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            Consultando movimientos...
          </p>
        </section>
      ) : error ? (
        <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-medium text-red-700">
            {error}
          </p>
        </section>
      ) : movimientosFiltrados.length === 0 ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            No se encontraron movimientos con ese criterio.
          </p>
        </section>
      ) : (
        <section className="mt-6 space-y-3">
          {movimientosFiltrados.map((mov) => {
            const esEntrada =
              mov.cantidadMovimiento > 0;

            const esSalida =
              mov.cantidadMovimiento < 0;

            const cantidadAbsoluta = Math.abs(
              mov.cantidadMovimiento
            );

            return (
              <div
                key={mov.movimientoKey}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          esEntrada
                            ? "bg-emerald-50 text-emerald-700"
                            : esSalida
                              ? "bg-red-50 text-red-700"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {nombreTipo(
                          mov.tipoMovimiento
                        )}
                      </span>

                      {mov.estado ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            mov.estado.toLowerCase() ===
                            "anulado"
                              ? "bg-red-50 text-red-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {mov.estado}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {mov.OPE ? (
                        <span className="text-base font-semibold text-slate-900">
                          {mov.OPE}
                        </span>
                      ) : null}

                      {mov.OTE ? (
                        <span className="text-sm font-medium text-slate-700">
                          {mov.OTE}
                        </span>
                      ) : null}

                      {mov.consecutivoCorte ? (
                        <span className="text-sm text-slate-500">
                          Consecutivo{" "}
                          {mov.consecutivoCorte}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 text-sm font-medium text-slate-900">
                      {mov.producto}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                      <span>
                        Medida:{" "}
                        <b className="text-slate-700">
                          {formatMedida(
                            mov.medida_mm
                          )}
                        </b>
                      </span>

                      {mov.supervisor ? (
                        <span>
                          Supervisor:{" "}
                          <b className="text-slate-700">
                            {mov.supervisor}
                          </b>
                        </span>
                      ) : null}

                      {mov.turno ? (
                        <span>
                          Turno:{" "}
                          <b className="text-slate-700">
                            {mov.turno}
                          </b>
                        </span>
                      ) : null}

                      <span>
                        Fecha:{" "}
                        <b className="text-slate-700">
                          {formatFecha(
                            mov.timestamp
                          )}
                        </b>
                      </span>
                    </div>

                    {mov.observacion ? (
                      <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        {mov.observacion}
                      </div>
                    ) : null}

                    {mov.usuario ? (
                      <div className="mt-2 text-xs text-slate-400">
                        Usuario sistema:{" "}
                        {mov.usuario}
                      </div>
                    ) : null}
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-500">
                      Movimiento
                    </div>

                    <div
                      className={`mt-1 text-2xl font-semibold ${
                        esEntrada
                          ? "text-emerald-700"
                          : esSalida
                            ? "text-red-700"
                            : "text-slate-700"
                      }`}
                    >
                      {esEntrada
                        ? "+"
                        : esSalida
                          ? "-"
                          : ""}
                      {cantidadAbsoluta.toLocaleString(
                        "es-CO"
                      )}{" "}
                      <span className="text-sm font-medium">
                        und
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}