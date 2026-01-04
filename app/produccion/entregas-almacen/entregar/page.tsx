// app/produccion/entregas-almacen/entregar/page.tsx
// app/produccion/entregas-almacen/entregar/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type EmpacadoItem = {
  source: "produccion" | "corte";
  rowIndexItem: number; // fila en SolicitudesProduccion / SolicitudesCorte
  code: string; // OPE u OTE
  rowIndexPedido: any;
  pedidoKey: string;
  producto: string;

  cantidadTotalUnd: number;
  entregadoUnd: number;
  pendienteUnd: number;
};

const USUARIOS_ENTREGA = [
  "Eduin Galindo",
  "Paola Suarez",
  "Leidy Moreno",
  "Dalia Rodriguez",
  "Johana Begambre",
  "Daniel Alfonso",
];

async function safeJsonFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function EntregarAlmacenPage() {
  const router = useRouter();

  const [items, setItems] = useState<EmpacadoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // usuario que entrega
  const [usuarioEntrega, setUsuarioEntrega] = useState<string>("");

  // cantidad a entregar por fila
  const [qtyByKey, setQtyByKey] = useState<Record<string, string>>({});

  const reload = async () => {
    setLoading(true);
    const data = await safeJsonFetch<EmpacadoItem[]>("/api/produccion/entregas-almacen/empacados");
    if (!data) {
      setErr("No se pudo cargar el listado de empacados.");
      setItems([]);
    } else {
      setErr(null);
      setItems(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await reload();
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parseQty = (v: string) => {
    const n = Number((v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Entregar a almacén</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Aquí solo aparecen items con estado <span className="font-medium">Empacado</span> y con{" "}
              <span className="font-medium">pendiente</span>.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/produccion/entregas-almacen")}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-neutral-50"
          >
            Volver
          </button>
        </div>

        {/* Selector usuario */}
        <div className="mb-4 rounded-2xl bg-white shadow-sm ring-1 ring-black/5 p-4">
          <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-900">Quién entrega</label>
              <select
                value={usuarioEntrega}
                onChange={(e) => setUsuarioEntrega(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10"
              >
                <option value="">Selecciona…</option>
                {USUARIOS_ENTREGA.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-neutral-500">
                Este nombre quedará registrado en HistorialEntregasAlmacen y MovimientosInventario.
              </p>
            </div>

            <div className="sm:text-right">
              <button
                type="button"
                onClick={reload}
                className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-neutral-50"
              >
                Recargar
              </button>
            </div>
          </div>
        </div>

        {err && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {err}
          </div>
        )}

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Pendientes por entregar</h2>
            <div className="text-xs text-neutral-500">{loading ? "Cargando…" : `${items.length} items`}</div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-neutral-600">
                <tr className="border-b">
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">OPE / OTE</th>
                  <th className="py-2 pr-3">rowIndexPedido</th>
                  <th className="py-2 pr-3">Producto</th>
                  <th className="py-2 pr-3">Total (UND)</th>
                  <th className="py-2 pr-3">Entregado</th>
                  <th className="py-2 pr-3">Pendiente</th>
                  <th className="py-2 pr-3">Entregar ahora</th>
                  <th className="py-2 pr-3">Acción</th>
                </tr>
              </thead>

              <tbody>
                {items.map((it) => {
                  const key = `${it.source}-${it.rowIndexItem}`;
                  const qtyStr = qtyByKey[key] ?? "";

                  return (
                    <tr key={key} className="border-b">
                      <td className="py-2 pr-3">{it.source === "produccion" ? "Producción" : "Corte"}</td>
                      <td className="py-2 pr-3 font-medium">{it.code}</td>
                      <td className="py-2 pr-3">{String(it.rowIndexPedido)}</td>
                      <td className="py-2 pr-3">{it.producto}</td>
                      <td className="py-2 pr-3">{String(it.cantidadTotalUnd)}</td>
                      <td className="py-2 pr-3">{String(it.entregadoUnd)}</td>
                      <td className="py-2 pr-3 font-semibold">{String(it.pendienteUnd)}</td>

                      <td className="py-2 pr-3">
                        <input
                          className="w-28 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10"
                          placeholder="UND"
                          value={qtyStr}
                          onChange={(e) => setQtyByKey((p) => ({ ...p, [key]: e.target.value }))}
                        />
                      </td>

                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          className="rounded-xl bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                          disabled={!usuarioEntrega}
                          onClick={async () => {
                            if (!usuarioEntrega) {
                              alert("Selecciona quién entrega.");
                              return;
                            }

                            const qty = parseQty(qtyStr);
                            if (!Number.isFinite(qty) || qty <= 0) {
                              alert("Ingresa una cantidad válida a entregar.");
                              return;
                            }
                            if (qty > it.pendienteUnd) {
                              alert("La cantidad no puede superar el pendiente.");
                              return;
                            }

                            const res = await fetch("/api/produccion/entregas-almacen/entregar", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                source: it.source,
                                rowIndexItem: it.rowIndexItem,
                                cantidadEntregarUnd: qty,
                                usuario: usuarioEntrega,
                              }),
                            });

                            const json = await res.json();
                            if (!res.ok) {
                              alert(json?.error ?? "No se pudo entregar.");
                              return;
                            }

                            setQtyByKey((p) => ({ ...p, [key]: "" }));
                            await reload();
                          }}
                        >
                          Entregar
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {!loading && items.length === 0 && (
                  <tr>
                    <td className="py-6 text-neutral-500" colSpan={9}>
                      No hay items empacados pendientes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-neutral-500">
            Esta pantalla soporta <span className="font-medium">entregas parciales</span>: cada entrega queda registrada en{" "}
            <span className="font-medium">HistorialEntregasAlmacen</span> y el item solo desaparece cuando el pendiente llega a 0.
          </p>
        </div>
      </main>
    </div>
  );
}
