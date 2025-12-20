"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Orden = {
  ordenCorteId: string;
  fechaCreacion: string;
  estado: string;
  responsable: string;
  observaciones: string;
  totalItems: number;
  creadoPor: string;
  fechaCierre: string;
  items: Array<{
    ordenCorteItemId: string;
    pedidoKey: string;
    pedidoRowIndex: number;
    productoSolicitado: string;
    cantidadSolicitadaUnd: string;
    destinoFinal: string;
    estadoItem: string;
  }>;
};

export default function OrdenCorteDetallePage() {
  const router = useRouter();
  const params = useParams<{ ordenCorteId: string }>();
  const ordenCorteId = decodeURIComponent(params.ordenCorteId || "");

  const [orden, setOrden] = useState<Orden | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/produccion/corte/orden?ordenCorteId=${encodeURIComponent(ordenCorteId)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "Error cargando orden");
      setOrden(json.orden as Orden);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Error cargando orden");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (ordenCorteId) load();
  }, [ordenCorteId]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <button
        className="mb-4 text-sm text-slate-500 hover:text-slate-700"
        type="button"
        onClick={() => router.push("/produccion/corte")}
      >
        ← Volver a Corte
      </button>

      {loading && <p className="text-sm text-slate-500">Cargando…</p>}

      {!loading && orden && (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Orden de corte</h1>
              <p className="text-sm text-slate-500">
                <span className="font-medium text-slate-900">{orden.ordenCorteId}</span> —{" "}
                {orden.estado} — Responsable: {orden.responsable}
              </p>
            </div>
          </div>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">Fecha creación</p>
                <p className="text-sm font-medium">{orden.fechaCreacion || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total items</p>
                <p className="text-sm font-medium">{orden.totalItems ?? orden.items.length}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Creado por</p>
                <p className="text-sm font-medium">{orden.creadoPor || "—"}</p>
              </div>
            </div>
          </section>

          <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="text-base font-semibold">Items</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Item</th>
                    <th className="px-4 py-3 text-left font-medium">Producto solicitado</th>
                    <th className="px-4 py-3 text-right font-medium">Cant (und)</th>
                    <th className="px-4 py-3 text-left font-medium">Estado</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {orden.items.map((it) => (
                    <tr key={it.ordenCorteItemId} className="hover:bg-slate-50 align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium">{it.ordenCorteItemId}</div>
                        <div className="text-xs text-slate-400 break-all">{it.pedidoKey}</div>
                        <div className="text-[11px] text-slate-400">fila: {it.pedidoRowIndex}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-pre-wrap">{it.productoSolicitado || "—"}</td>
                      <td className="px-4 py-3 text-right">{it.cantidadSolicitadaUnd || "—"}</td>
                      <td className="px-4 py-3">{it.estadoItem || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
