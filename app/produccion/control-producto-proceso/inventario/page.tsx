"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { allowedProduccionTabsForUser } from "@/lib/auth/permissions";

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

function formatMedida(mm: number) {
  if (!mm) return "-";

  const metros = mm / 1000;

  return `${metros.toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })} m`;
}

function formatFecha(value: string) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function InventarioProcesoPage() {
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

  async function cargarInventario() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(
        "/api/produccion/control-producto-proceso/inventario",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(
          json?.error ||
            "No fue posible consultar el inventario."
        );
      }

      setData(json);
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
    if (status === "loading") return;

    if (!canAccess) {
      setLoading(false);
      return;
    }

    cargarInventario();
  }, [status, canAccess]);

  const inventarioFiltrado = useMemo(() => {
    const inventario = data?.inventario || [];

    const q = search
      .trim()
      .toLowerCase();

    if (!q) {
      return inventario;
    }

    return inventario.filter((item) => {
      const medidaMetros = formatMedida(
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
        String(item.medida_mm),
        medidaMetros,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [data, search]);

  const grupos = useMemo(() => {
    const map = new Map<string, InventarioItem[]>();

    inventarioFiltrado.forEach((item) => {
      const actual = map.get(item.OPE) || [];

      actual.push(item);

      map.set(item.OPE, actual);
    });

    return Array.from(map.entries()).map(
      ([OPE, items]) => ({
        OPE,
        items,
        totalUnidades: items.reduce(
          (acc, item) =>
            acc + item.cantidadDisponible,
          0
        ),
      })
    );
  }, [inventarioFiltrado]);

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
            Tu usuario no tiene permisos para consultar
            el inventario de producto en proceso.
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
            Producción · Control Producto en Proceso · Inventario actual
          </div>

          <h1 className="text-2xl font-semibold">
            Inventario actual
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Existencias disponibles de producto en proceso por
            OPE, producto y medida.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={cargarInventario}
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
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Lotes con saldo
            </div>

            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {data?.totalLotes ?? 0}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Existencias
            </div>

            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {data?.totalRegistros ?? 0}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Unidades disponibles
            </div>

            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {(data?.totalUnidades ?? 0).toLocaleString(
                "es-CO"
              )}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <label className="text-sm font-medium text-slate-700">
            Buscar inventario
          </label>

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Ej. OPE260361, Enganche Central, Blanco, 2,55 m..."
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />

          <p className="mt-2 text-xs text-slate-500">
            Puedes buscar por OPE, producto, color, ancho,
            acabado o medida.
          </p>
        </div>
      </section>

      {loading ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            Consultando inventario...
          </p>
        </section>
      ) : error ? (
        <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-medium text-red-700">
            {error}
          </p>
        </section>
      ) : grupos.length === 0 ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            No se encontraron existencias disponibles con ese
            criterio.
          </p>
        </section>
      ) : (
        <section className="mt-6 space-y-4">
          {grupos.map((grupo) => (
            <div
              key={grupo.OPE}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">
                      {grupo.OPE}
                    </h2>

                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      Disponible
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    {grupo.items.length}{" "}
                    {grupo.items.length === 1
                      ? "existencia"
                      : "existencias"}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-500">
                    Total disponible lote
                  </div>

                  <div className="text-xl font-semibold text-slate-900">
                    {grupo.totalUnidades.toLocaleString(
                      "es-CO"
                    )}{" "}
                    und
                  </div>
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                <div className="divide-y divide-slate-200">
                  {grupo.items.map((item) => (
                    <div
                      key={item.inventarioKey}
                      className="grid gap-4 p-4 lg:grid-cols-[1fr_120px_140px]"
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {item.producto}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.color ? (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                              {item.color}
                            </span>
                          ) : null}

                          {item.ancho ? (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                              {item.ancho}
                            </span>
                          ) : null}

                          {item.acabado ? (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                              {item.acabado}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2 text-xs text-slate-400">
                          Último movimiento:{" "}
                          {formatFecha(
                            item.fechaUltimoMovimiento
                          )}
                        </div>
                      </div>

                      <div className="lg:text-right">
                        <div className="text-xs text-slate-500">
                          Medida
                        </div>

                        <div className="text-lg font-semibold text-slate-900">
                          {formatMedida(
                            item.medida_mm
                          )}
                        </div>
                      </div>

                      <div className="lg:text-right">
                        <div className="text-xs text-slate-500">
                          Disponible
                        </div>

                        <div className="text-2xl font-semibold text-emerald-700">
                          {item.cantidadDisponible.toLocaleString(
                            "es-CO"
                          )}{" "}
                          <span className="text-sm font-medium">
                            und
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}