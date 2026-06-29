"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Disponible = {
  pedidosKey: string;
  consecutivo: string;
  cliente: string;
  direccion: string;
  oc: string;
  fechaRequerida: string;
  itemsTotales: number;
  itemsAlmacen: number;
  cantidadTotalUnd: number;
};

type Secuencia = {
  posicion: number;
  pedidosKey: string;
  cliente: string;
  direccion: string;
  oc: string;
  prioridadManual: string;
  estado: string;
  programadoPor: string;
  fechaProgramacion: string;
  fechaEstimadaDespacho: string;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatFecha(value?: string) {
  if (!value) return "Sin fecha";

  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function SecuenciaDespachosPage() {
  const [fecha, setFecha] = useState(todayISO());
  const [disponibles, setDisponibles] = useState<Disponible[]>([]);
  const [secuencia, setSecuencia] = useState<Secuencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function cargar(fechaConsulta = fecha) {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/planeacion/secuencia-despachos?fecha=${encodeURIComponent(fechaConsulta)}`,
        { cache: "no-store" }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "No se pudo cargar la secuencia");
      }

      setDisponibles(data.disponibles || []);
      setSecuencia(data.secuencia || []);
    } catch (err: any) {
      setMessage(err?.message || "Error cargando secuencia de despachos");
    } finally {
      setLoading(false);
    }
  }

  async function agregar(item: Disponible, prioridadManual = "") {
    setMessage("");

    try {
      const res = await fetch("/api/planeacion/secuencia-despachos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          pedidosKey: item.pedidosKey,
          cliente: item.cliente,
          direccion: item.direccion,
          oc: item.oc,
          prioridadManual,
          programadoPor: "Planeación",
          fechaEstimadaDespacho: fecha,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "No se pudo agregar a la secuencia");
      }

      setMessage(`Pedido agregado a ${formatFecha(fecha)} en la posición ${data.posicion}.`);
      await cargar(fecha);
    } catch (err: any) {
      setMessage(err?.message || "Error agregando pedido");
    }
  }

  async function actualizarSecuencia(pedidosKey: string, action: "up" | "down" | "remove") {
    setMessage("");

    try {
      const res = await fetch("/api/planeacion/secuencia-despachos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ pedidosKey, action }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "No se pudo actualizar la secuencia");
      }

      await cargar(fecha);
    } catch (err: any) {
      setMessage(err?.message || "Error actualizando secuencia");
    }
  }

  async function moverAFecha(pedidosKey: string) {
    const nuevaFecha = window.prompt("Nueva fecha estimada de despacho (YYYY-MM-DD):", fecha);

    if (!nuevaFecha) return;

    setMessage("");

    try {
      const res = await fetch("/api/planeacion/secuencia-despachos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          pedidosKey,
          action: "changeDate",
          fechaEstimadaDespacho: nuevaFecha,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "No se pudo mover el pedido de fecha");
      }

      setMessage(`Pedido movido a ${formatFecha(nuevaFecha)}.`);
      await cargar(fecha);
    } catch (err: any) {
      setMessage(err?.message || "Error moviendo pedido de fecha");
    }
  }

  useEffect(() => {
    cargar(fecha);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Secuencia de despacho</h1>
          <p className="mt-1 text-sm text-slate-500">
            Planeación define el orden oficial por fecha. Logística ejecuta y Comercial consulta.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => cargar(fecha)}
            disabled={loading}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "Cargando..." : "Refrescar"}
          </button>

          <Link
            href="/planeacion"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
          >
            ← Planeación
          </Link>
        </div>
      </div>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Fecha de programación</h2>
            <p className="mt-1 text-sm text-slate-500">
              Selecciona el día para programar y ordenar los despachos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={fecha}
              onChange={(e) => {
                const nueva = e.target.value || todayISO();
                setFecha(nueva);
                cargar(nueva);
              }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
            />

            <button
              type="button"
              onClick={() => {
                const hoy = todayISO();
                setFecha(hoy);
                cargar(hoy);
              }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Hoy
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800 ring-1 ring-indigo-100">
          Programando despachos para: {formatFecha(fecha)}
        </div>
      </section>

      {message && (
        <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          {message}
        </div>
      )}

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-900">
              Pedidos disponibles para programar
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Al agregar, el pedido queda programado para {formatFecha(fecha)}.
            </p>
          </div>

          <div className="space-y-3">
            {disponibles.length === 0 && (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                {loading ? "Cargando..." : "No hay pedidos disponibles para programar."}
              </div>
            )}

            {disponibles.map((p) => (
              <div key={p.pedidosKey} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-black text-slate-900">
                      Pedido #{p.consecutivo || p.pedidosKey}
                    </div>

                    <div className="mt-1 text-sm font-semibold text-slate-600">
                      {p.cliente || "-"}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      Dirección: {p.direccion || "-"}
                    </div>

                    <div className="text-xs text-slate-500">OC: {p.oc || "-"}</div>
                  </div>

                  <div className="text-right text-xs text-slate-500">
                    <div>
                      Ítems: <b>{p.itemsAlmacen}/{p.itemsTotales}</b>
                    </div>
                    <div>
                      Und: <b>{p.cantidadTotalUnd}</b>
                    </div>
                    <div>
                      Req: <b>{p.fechaRequerida || "-"}</b>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    onClick={() => agregar(p)}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Agregar a {formatFecha(fecha)}
                  </button>

                  <button
                    onClick={() => agregar(p, "Prioridad especial")}
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                  >
                    Prioridad especial
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-900">
              Secuencia publicada — {formatFecha(fecha)}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Este es el orden oficial que verán logística y comercial para esta fecha.
            </p>
          </div>

          <div className="space-y-3">
            {secuencia.length === 0 && (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                {loading ? "Cargando..." : "No hay pedidos programados para esta fecha."}
              </div>
            )}

            {secuencia.map((s, idx) => (
              <div
                key={`${idx + 1}-${s.pedidosKey}`}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-lg font-black text-indigo-700 ring-1 ring-indigo-100">
                    {idx + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-black text-slate-900">{s.cliente || s.pedidosKey}</div>

                    <div className="mt-1 text-xs text-slate-500">
                      Dirección: {s.direccion || "-"}
                    </div>

                    <div className="text-xs text-slate-500">OC: {s.oc || "-"}</div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {s.estado || "Programado"}
                      </span>

                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
                        {s.fechaEstimadaDespacho || fecha}
                      </span>

                      {s.prioridadManual && (
                        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-100">
                          {s.prioridadManual}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => actualizarSecuencia(s.pedidosKey, "up")}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold hover:bg-slate-50"
                      >
                        Subir
                      </button>

                      <button
                        onClick={() => actualizarSecuencia(s.pedidosKey, "down")}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold hover:bg-slate-50"
                      >
                        Bajar
                      </button>

                      <button
                        onClick={() => moverAFecha(s.pedidosKey)}
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        Mover fecha
                      </button>

                      <button
                        onClick={() => {
                          if (confirm("¿Quitar este pedido de la secuencia?")) {
                            actualizarSecuencia(s.pedidosKey, "remove");
                          }
                        }}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}