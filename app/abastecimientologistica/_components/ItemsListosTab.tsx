//app/abastecimientologistica/_components/ItemsListosTab.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { HeaderBlock } from "./ui";

type DespachableItem = {
  pedidosKey: string;
  pedidoRowIndex: number;
  producto: string;
  cantidadSolicitadaUnd: number;
  cantidadDespachadaUnd: number;
  pendienteUnd: number;
  estado: string;
};

async function safeJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) return null;
    return json as T;
  } catch {
    return null;
  }
}

export function ItemsListosTab() {
  const [items, setItems] = useState<DespachableItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function cargar() {
    try {
      setLoading(true);
      const data = await safeJson<{ success: boolean; items: DespachableItem[]; message?: string }>(
        "/api/logistica/despachables"
      );

      if (!data?.success) {
        console.warn("No pude cargar despachables:", data?.message);
        setItems([]);
        return;
      }

      setItems(Array.isArray(data.items) ? data.items : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const listosAlmacen = useMemo(() => {
    return items.filter((x) => String(x.estado ?? "").trim() === "Almacén");
  }, [items]);

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <HeaderBlock
          title="Ítems listos para despacho"
          subtitle='Listado (solo estado: "Almacén"). Útil para ver el backlog sin saturar el formulario.'
        />

        <button
          type="button"
          onClick={cargar}
          className="inline-flex h-9 items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 text-sm font-medium shadow-sm hover:bg-neutral-50"
        >
          {loading ? "Cargando..." : "Refrescar"}
        </button>
      </div>

      <div className="mt-3 text-xs text-neutral-500">
        Fuente: <span className="font-mono">/api/logistica/despachables</span>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-4 py-3 text-left">Pedido</th>
              <th className="px-4 py-3 text-left">Producto</th>
              <th className="px-4 py-3 text-right">Solicitado</th>
              <th className="px-4 py-3 text-right">Despachado</th>
              <th className="px-4 py-3 text-right">Pendiente</th>
              <th className="px-4 py-3 text-left">Estado</th>
            </tr>
          </thead>

          <tbody>
            {listosAlmacen.length === 0 && (
              <tr className="border-t">
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                  No hay ítems en estado <b>Almacén</b>.
                </td>
              </tr>
            )}

            {listosAlmacen.map((it, i) => (
              <tr key={`${it.pedidosKey}-${it.pedidoRowIndex}-${i}`} className="border-t">
                <td className="px-4 py-3 font-medium">
                  {it.pedidosKey} · row {it.pedidoRowIndex}
                </td>
                <td className="px-4 py-3">{it.producto}</td>
                <td className="px-4 py-3 text-right">{it.cantidadSolicitadaUnd}</td>
                <td className="px-4 py-3 text-right">{it.cantidadDespachadaUnd}</td>
                <td className="px-4 py-3 text-right font-semibold">{it.pendienteUnd}</td>
                <td className="px-4 py-3">{it.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
