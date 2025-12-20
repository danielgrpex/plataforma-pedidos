"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type PedidoRow = {
  pedidoKey: string;
  consecutivo: string;
  fechaSolicitud: string;
  cliente: string;
  direccion: string;
  oc: string;
  fechaRequerida: string;
  clasificacionPlaneacion: string;
  estadoPlaneacion: string;
  revisadoPlaneacion: boolean;
};

function formatFechaColombia(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const day = d.getDate().toString().padStart(2, "0");
  const month = d
    .toLocaleDateString("es-CO", { month: "short" })
    .replace(".", "")
    .replace(/^\w/, (c) => c.toUpperCase());
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export default function PlaneacionListadoPage() {
  const [items, setItems] = useState<PedidoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    const url = `/api/planeacion/pedidos/list?q=${encodeURIComponent(q.trim())}`;
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    setItems((json.items || []) as PedidoRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const empty = useMemo(() => !loading && items.length === 0, [loading, items.length]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Planeación</h1>
          <p className="text-sm text-slate-500">Pedidos pendientes por clasificar y reservar inventario.</p>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Buscar por cliente, OC, consecutivo o pedidoKey…"
          />
          <button
            onClick={load}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            disabled={loading}
          >
            {loading ? "Cargando…" : "Buscar"}
          </button>
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Consec</th>
                <th className="px-4 py-3 text-left font-medium">Cliente</th>
                <th className="px-4 py-3 text-left font-medium">OC</th>
                <th className="px-4 py-3 text-left font-medium">Req</th>
                <th className="px-4 py-3 text-left font-medium">Estado planeación</th>
                <th className="px-4 py-3 text-left font-medium">Acción</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={6}>
                    Cargando…
                  </td>
                </tr>
              )}

              {empty && (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={6}>
                    No hay pedidos pendientes.
                  </td>
                </tr>
              )}

              {!loading &&
                items.map((p) => (
                  <tr key={p.pedidoKey} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{p.consecutivo || "—"}</td>
                    <td className="px-4 py-3">{p.cliente || "—"}</td>
                    <td className="px-4 py-3">{p.oc || "—"}</td>
                    <td className="px-4 py-3">{formatFechaColombia(p.fechaRequerida)}</td>
                    <td className="px-4 py-3">{p.estadoPlaneacion || "Pendiente"}</td>
                    <td className="px-4 py-3">
                      <Link
                        className="text-indigo-600 underline underline-offset-2 hover:text-indigo-700"
                        href={`/planeacion/pedido/${encodeURIComponent(p.pedidoKey)}`}
                      >
                        Clasificar
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
