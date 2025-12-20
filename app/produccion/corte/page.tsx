// app/produccion/corte/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type ItemPendiente = {
  rowIndex1Based: number;
  pedidoKey: string;
  consecutivo: string;
  cliente: string;
  oc: string;
  productoSolicitado: string;
  cantidadSolicitadaUnd: number;

  inventarioOrigenId: string;
  cantidadOrigenUnd: number;
  productoOrigen: string;
  largoOrigen: number;
};

const ACTIVIDADES = ["Cortar", "Limpiar", "Encintar", "Imantar", "Rebordear"] as const;
type Actividad = (typeof ACTIVIDADES)[number];

function joinActs(list: Actividad[]) {
  return list.join("|");
}

export default function ProduccionCortePage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ItemPendiente[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [actsByKey, setActsByKey] = useState<Record<string, Actividad[]>>({});

  const selectedItems = useMemo(() => {
    return items.filter((it) => selected[`${it.pedidoKey}|${it.rowIndex1Based}`]);
  }, [items, selected]);

  const totalUnd = useMemo(() => {
    return selectedItems.reduce((acc, it) => acc + (it.cantidadSolicitadaUnd || 0), 0);
  }, [selectedItems]);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/produccion/corte/pendientes", { cache: "no-store" });
    const json = await res.json();

    if (!json?.success) {
      alert(json?.message || "Error cargando pendientes");
      setLoading(false);
      return;
    }

    const list = (json.items || []) as ItemPendiente[];
    setItems(list);

    // defaults
    const sel: Record<string, boolean> = {};
    const acts: Record<string, Actividad[]> = {};
    list.forEach((it) => {
      const k = `${it.pedidoKey}|${it.rowIndex1Based}`;
      sel[k] = false;
      acts[k] = ["Cortar"]; // default
    });

    setSelected(sel);
    setActsByKey(acts);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function toggleAct(k: string, act: Actividad, value: boolean) {
    setActsByKey((prev) => {
      const curr = prev[k] || [];
      const next = value ? Array.from(new Set([...curr, act])) : curr.filter((a) => a !== act);
      // siempre mínimo "Cortar"
      if (!next.length) return { ...prev, [k]: ["Cortar"] };
      return { ...prev, [k]: next };
    });
  }

  async function generarOrden() {
    const picked = selectedItems;
    if (!picked.length) return alert("Selecciona al menos 1 item");

    // ✅ payload EXACTO que espera el backend:
    // { items: [{ rowIndex1Based, actividades }] }
    const payload = {
      items: picked.map((it) => {
        const k = `${it.pedidoKey}|${it.rowIndex1Based}`;
        return {
          rowIndex1Based: it.rowIndex1Based,
          actividades: joinActs(actsByKey[k] || ["Cortar"]),
        };
      }),
    };

    const res = await fetch("/api/produccion/corte/generar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!json?.success) return alert(json?.message || "Error generando orden");

    alert(`Orden generada ✅ ${json.ordenCorteId || ""}`);
    await load();
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Producción — Corte</h1>
          <p className="mt-1 text-sm text-slate-600">
            Items pendientes por corte (Planeación deja Estado = Corte).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Refrescar
          </button>
          <button
            type="button"
            onClick={generarOrden}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Generar orden de corte
          </button>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-medium text-slate-800">
          Seleccionados: {selectedItems.length} items — Total und: {totalUnd}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Antes de generar, define las actividades por item. Se guardan como:{" "}
          <b>Cortar|Limpiar|Encintar</b>
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Sel</th>
                <th className="px-4 py-3 text-left font-medium">Pedido</th>
                <th className="px-4 py-3 text-left font-medium">Cliente</th>
                <th className="px-4 py-3 text-left font-medium">OC</th>
                <th className="px-4 py-3 text-left font-medium">Producto</th>
                <th className="px-4 py-3 text-right font-medium">Cant (und)</th>
                <th className="px-4 py-3 text-left font-medium">Actividades</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={8}>
                    Cargando…
                  </td>
                </tr>
              )}

              {!loading && items.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={8}>
                    No hay items en Corte ✅
                  </td>
                </tr>
              )}

              {!loading &&
                items.map((it) => {
                  const k = `${it.pedidoKey}|${it.rowIndex1Based}`;
                  const acts = actsByKey[k] || ["Cortar"];

                  return (
                    <tr key={k} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={!!selected[k]}
                          onChange={(e) =>
                            setSelected((prev) => ({ ...prev, [k]: e.target.checked }))
                          }
                          className="h-4 w-4"
                        />
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-semibold">{it.consecutivo || "—"}</div>
                        <div className="text-xs text-slate-400">fila: {it.rowIndex1Based}</div>
                      </td>

                      <td className="px-4 py-4 font-medium">{it.cliente || "—"}</td>
                      <td className="px-4 py-4">{it.oc || "—"}</td>

                      <td className="px-4 py-4">
                        <div className="font-medium">{it.productoSolicitado || "—"}</div>

                        {it.inventarioOrigenId ? (
                          <div className="mt-1 text-xs text-slate-600">
                            <span className="font-semibold">Origen:</span>{" "}
                            {it.productoOrigen || it.inventarioOrigenId}
                            {it.largoOrigen ? ` (largo: ${it.largoOrigen})` : ""}
                            {it.cantidadOrigenUnd
                              ? ` — reservado: ${it.cantidadOrigenUnd}`
                              : ""}
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-amber-700">
                            <span className="font-semibold">Origen:</span> Sin reserva / sin origen
                            (revisar planeación)
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-4 text-right font-semibold">
                        {Number(it.cantidadSolicitadaUnd || 0).toLocaleString("es-CO")}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          {ACTIVIDADES.map((a) => {
                            const checked = acts.includes(a);
                            return (
                              <label
                                key={a}
                                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1 text-xs ${
                                  checked
                                    ? "border-emerald-200 bg-emerald-50"
                                    : "border-slate-200 bg-white"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => toggleAct(k, a, e.target.checked)}
                                />
                                {a}
                              </label>
                            );
                          })}
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          Guardará: <b>{joinActs(acts)}</b>
                        </div>
                      </td>

                      <td className="px-4 py-4">Corte</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
