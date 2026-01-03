//app/planeacion/page.tsx
// app/planeacion/page.tsx
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
  fechaRequerida: string; // ISO o YYYY-MM-DD
  clasificacionPlaneacion: string;
  estadoPlaneacion: string;
  revisadoPlaneacion: boolean;
};

function formatFechaColombia(value?: string) {
  if (!value) return "—";

  // YYYY-MM-DD (sin zona)
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const date = new Date(y, mo - 1, d);
    const day = String(date.getDate()).padStart(2, "0");
    const month = date
      .toLocaleDateString("es-CO", { month: "short" })
      .replace(".", "")
      .replace(/^\w/, (c) => c.toUpperCase());
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  // fallback ISO
  const d2 = new Date(value);
  if (!Number.isNaN(d2.getTime())) {
    const day = String(d2.getDate()).padStart(2, "0");
    const month = d2
      .toLocaleDateString("es-CO", { month: "short" })
      .replace(".", "")
      .replace(/^\w/, (c) => c.toUpperCase());
    const year = d2.getFullYear();
    return `${day}-${month}-${year}`;
  }

  return value;
}

function badgeEstado(estado?: string) {
  const s = (estado || "").toLowerCase();

  if (!estado) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
        Pendiente
      </span>
    );
  }

  if (s.includes("rechaz")) {
    return (
      <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700">
        {estado}
      </span>
    );
  }

  if (s.includes("corte") || s.includes("producci") || s.includes("almac") || s.includes("desp")) {
    return (
      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
        {estado}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
      {estado}
    </span>
  );
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
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Planeación</h1>
          <p className="text-sm text-slate-500">
            Clasifica pedidos, reserva inventario y programa Producción / Corte / Despachos.
          </p>
        </div>

        {/* Accesos rápidos */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/planeacion/programacion"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Programación
          </Link>

          <Link
            href="/planeacion/ajustes-inventario"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
          >
            Ajustes de inventario
          </Link>
        </div>
      </div>

      {/* Buscador */}
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

      {/* Tabla */}
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
                    <td className="px-4 py-3">{badgeEstado(p.estadoPlaneacion || "Pendiente")}</td>
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

      {/* Nota */}
      <div className="mt-4 text-xs text-slate-500">
        Tip: <b>Programación</b> es donde Planeación arma el plan por líneas (Producción), cortes y despachos.
      </div>
    </main>
  );
}
