"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type PedidoListItem = {
  consecutivo: string;
  fechaSolicitud: string;
  asesor: string;
  cliente: string;
  oc: string;
  estado: string;
  pdfPath: string;
  createdBy: string;
};

const ESTADOS = [
  "",
  "En verificación",
  "Cancelado",
  "Producción o corte",
  "Almacén",
  "Despachado",
  "Entregado",
];

const PAGE_SIZE = 200;

// ✅ Formato: "12-Dic-2025"
function formatFechaColombia(value: string) {
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

export default function ComercialListadoPage() {
  const [items, setItems] = useState<PedidoListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");

  // ✅ paginación
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  async function load(pageToLoad = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String((pageToLoad - 1) * PAGE_SIZE));

      if (q.trim()) params.set("q", q.trim());
      if (estado.trim()) params.set("estado", estado.trim());

      const res = await fetch(
        `/api/comercial/pedidos/list?${params.toString()}`,
        { cache: "no-store" }
      );
      const json = await res.json();

      if (!json?.success) throw new Error(json?.message || "Error cargando pedidos");

      const loadedItems = (json.items || []) as PedidoListItem[];

      setItems(loadedItems);
      setHasMore(loadedItems.length === PAGE_SIZE);
      setPage(pageToLoad);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Error cargando pedidos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // “Ver PDF” usando url firmada (tu endpoint existente)
  async function verPdf(pdfPath: string) {
    if (!pdfPath) return alert("Este pedido no tiene pdfPath guardado.");

    const res = await fetch("/api/comercial/pedidos/pdf-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfPath }),
    });

    const json = await res.json();
    if (!json?.success) {
      return alert(json?.message || "No se pudo generar la URL del PDF");
    }

    window.open(json.url, "_blank", "noopener,noreferrer");
  }

  const empty = useMemo(() => !loading && items.length === 0, [loading, items.length]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Pedidos comerciales</h1>
          <p className="text-sm text-slate-500">
            Lista de pedidos guardados + enlace al PDF.
          </p>
        </div>

        <Link
          href="/comercial/nuevo"
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          + Nuevo pedido
        </Link>
      </div>

      {/* Filtros */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1 text-slate-600">
              Buscar (cliente, OC, asesor, consecutivo)
            </label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Ej: Alkosto, OC-123, Juan…"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-slate-600">
              Estado
            </label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e ? e : "Todos"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => load(1)} // ✅ al aplicar filtros vuelve a la página 1
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            disabled={loading}
          >
            {loading ? "Cargando…" : "Aplicar"}
          </button>

          <button
            onClick={() => {
              setQ("");
              setEstado("");
              setTimeout(() => load(1), 0); // ✅ vuelve a página 1
            }}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            disabled={loading}
          >
            Limpiar
          </button>
        </div>
      </section>

      {/* Tabla */}
      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">#</th>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                <th className="px-4 py-3 text-left font-medium">Cliente</th>
                <th className="px-4 py-3 text-left font-medium">OC</th>
                <th className="px-4 py-3 text-left font-medium">Asesor</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="px-4 py-3 text-left font-medium">PDF</th>
                <th className="px-4 py-3 text-left font-medium">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={8}>
                    Cargando…
                  </td>
                </tr>
              )}

              {empty && (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={8}>
                    No hay pedidos para mostrar.
                  </td>
                </tr>
              )}

              {!loading &&
                items.map((p, idx) => (
                  <tr key={`${p.consecutivo}-${idx}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{p.consecutivo || "—"}</td>
                    <td className="px-4 py-3">
                      {formatFechaColombia(p.fechaSolicitud)}
                    </td>
                    <td className="px-4 py-3">{p.cliente || "—"}</td>
                    <td className="px-4 py-3">{p.oc || "—"}</td>
                    <td className="px-4 py-3">{p.asesor || "—"}</td>
                    <td className="px-4 py-3">{p.estado || "—"}</td>
                    <td className="px-4 py-3">
                      {p.pdfPath ? (
                        <button
                          onClick={() => verPdf(p.pdfPath)}
                          className="text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
                        >
                          Ver PDF
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="text-slate-700 underline underline-offset-2 hover:text-slate-900"
                        onClick={() => alert("Siguiente paso: pantalla Ver Pedido 😉")}
                      >
                        Ver pedido
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* ✅ Paginación */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-slate-500">Página {page}</span>

          <div className="flex gap-2">
            <button
              disabled={page === 1 || loading}
              onClick={() => load(page - 1)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:opacity-40 hover:bg-slate-50"
            >
              ← Anterior
            </button>

            <button
              disabled={!hasMore || loading}
              onClick={() => load(page + 1)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:opacity-40 hover:bg-slate-50"
            >
              Siguiente →
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
