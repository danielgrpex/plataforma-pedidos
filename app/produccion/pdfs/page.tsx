"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Orden = {
  tipo: "OPE" | "OTE";
  codigo: string;
  cliente: string;
  producto: string;
  cantidad: number;
  estado: string;
};

export default function ProduccionPdfsPage() {
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/produccion/pdfs/list")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setOrdenes(d.items);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Generar PDF´s</h1>
          <p className="text-sm text-slate-500">
            Órdenes listas para impresión (OPE en cola / OTE programadas).
          </p>
        </div>

        <Link
          href="/produccion"
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          ← Producción
        </Link>
      </div>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Cargando órdenes…</p>
        ) : ordenes.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay órdenes listas para imprimir.
          </p>
        ) : (
          <div className="space-y-3">
            {ordenes.map((o) => (
              <div
                key={`${o.tipo}-${o.codigo}`}
                className="rounded-xl border p-4 flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-semibold">
                    {o.tipo} {o.codigo}
                  </div>
                  <div className="text-xs text-slate-500">
                    {o.cliente} · {o.producto}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5">
                    UND {o.cantidad}
                  </span>
                  <button className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                    Generar PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
