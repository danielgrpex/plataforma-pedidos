// app/abastecimientologistica/despachos/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type DespachableItem = {
  pedidosKey: string;
  pedidoRowIndex: number;
  producto: string;
  cantidadSolicitadaUnd: number;
  cantidadDespachadaUnd: number;
  pendienteUnd: number;
  estado: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function safeNumber(v: string) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function DespachosPage() {
  const [items, setItems] = useState<DespachableItem[]>([]);
  const [loading, setLoading] = useState(false);

  // form
  const [usuario, setUsuario] = useState("");
  const [selectedKey, setSelectedKey] = useState(""); // `${pedidosKey}||${row}`
  const [cantidad, setCantidad] = useState("0");
  const [transporte, setTransporte] = useState("");
  const [guia, setGuia] = useState("");
  const [factura, setFactura] = useState("");
  const [remision, setRemision] = useState("");
  const [observaciones, setObservaciones] = useState("");

  async function cargarDespachables() {
    try {
      setLoading(true);
      const res = await fetch("/api/logistica/despachables", { cache: "no-store" });
      const data = await res.json();
      if (data?.success) setItems(data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarDespachables();
  }, []);

  const selected = useMemo(() => {
    if (!selectedKey) return null;
    const [pk, rowStr] = selectedKey.split("||");
    const row = Number(rowStr);
    return items.find((x) => x.pedidosKey === pk && x.pedidoRowIndex === row) || null;
  }, [selectedKey, items]);

  const disabledDespachar =
    !usuario.trim() ||
    !selected ||
    safeNumber(cantidad) <= 0 ||
    safeNumber(cantidad) > (selected?.pendienteUnd ?? 0);

  async function onDespachar() {
    if (disabledDespachar || !selected) return;

    try {
      const res = await fetch("/api/logistica/despachar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          usuario: usuario.trim(),
          pedidosKey: selected.pedidosKey,
          pedidoRowIndex: selected.pedidoRowIndex,
          cantidadDespachadaUnd: safeNumber(cantidad),
          transporte: transporte.trim(),
          guia: guia.trim(),
          factura: factura.trim(),
          remision: remision.trim(),
          observaciones: observaciones.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        alert(data?.message || "Error despachando");
        return;
      }

      alert(
        `✅ Despacho registrado.\n` +
          `Despachado: ${safeNumber(cantidad)} und\n` +
          `Pendiente: ${data.pendienteUnd} und`
      );

      // reset parcial
      setCantidad("0");
      setObservaciones("");

      // refrescar lista
      await cargarDespachables();
    } catch (e: any) {
      alert(e?.message || "Error despachando");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Despachos desde almacén</h1>
            <p className="text-sm text-slate-600">Despacho parcial o total + trazabilidad.</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={cargarDespachables}
              className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-100"
            >
              {loading ? "Cargando..." : "Refrescar"}
            </button>

            <Link
              href="/abastecimientologistica"
              className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-slate-100"
            >
              Volver
            </Link>
          </div>
        </div>

        {/* Form + Table */}
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          {/* Form */}
          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Registrar despacho</h2>
            <p className="mt-1 text-sm text-slate-600">
              Selecciona un ítem en almacén y registra la salida.
            </p>

            <div className="mt-4 grid gap-3">
              <label className="block">
                <div className="mb-1 text-xs font-medium text-slate-600">Usuario (logística)</div>
                <input
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                  placeholder="Ej: Leidy / Dalia / Logística"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-xs font-medium text-slate-600">Ítem despachable</div>
                <select
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                  className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                >
                  <option value="">Selecciona…</option>
                  {items.map((it) => (
                    <option key={`${it.pedidosKey}||${it.pedidoRowIndex}`} value={`${it.pedidosKey}||${it.pedidoRowIndex}`}>
                      {it.pedidosKey} · row {it.pedidoRowIndex} — Pend: {it.pendienteUnd}
                    </option>
                  ))}
                </select>
                <div className="mt-1 text-xs text-slate-500">
                  Fuente: <code>/api/logistica/despachables</code>
                </div>
              </label>

              {selected && (
                <div className="rounded-2xl border bg-slate-50 p-3 text-sm text-slate-700">
                  <div className="font-medium text-slate-900">{selected.producto}</div>
                  <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-xl border bg-white p-2">
                      <div className="text-slate-500">Solicitado</div>
                      <div className="font-semibold">{selected.cantidadSolicitadaUnd}</div>
                    </div>
                    <div className="rounded-xl border bg-white p-2">
                      <div className="text-slate-500">Despachado</div>
                      <div className="font-semibold">{selected.cantidadDespachadaUnd}</div>
                    </div>
                    <div className="rounded-xl border bg-white p-2">
                      <div className="text-slate-500">Pendiente</div>
                      <div className="font-semibold">{selected.pendienteUnd}</div>
                    </div>
                  </div>
                </div>
              )}

              <label className="block">
                <div className="mb-1 text-xs font-medium text-slate-600">Cantidad a despachar (und)</div>
                <input
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                  inputMode="decimal"
                />
                {selected && safeNumber(cantidad) > selected.pendienteUnd && (
                  <div className="mt-1 text-xs text-red-600">
                    No puede ser mayor al pendiente ({selected.pendienteUnd}).
                  </div>
                )}
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-xs font-medium text-slate-600">Transporte</div>
                  <input
                    value={transporte}
                    onChange={(e) => setTransporte(e.target.value)}
                    className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                    placeholder="Ej: Propio / Envia / Servientrega..."
                  />
                </label>

                <label className="block">
                  <div className="mb-1 text-xs font-medium text-slate-600">Guía</div>
                  <input
                    value={guia}
                    onChange={(e) => setGuia(e.target.value)}
                    className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                    placeholder="Ej: 123456"
                  />
                </label>

                <label className="block">
                  <div className="mb-1 text-xs font-medium text-slate-600">Factura</div>
                  <input
                    value={factura}
                    onChange={(e) => setFactura(e.target.value)}
                    className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                    placeholder="Ej: FV-001"
                  />
                </label>

                <label className="block">
                  <div className="mb-1 text-xs font-medium text-slate-600">Remisión</div>
                  <input
                    value={remision}
                    onChange={(e) => setRemision(e.target.value)}
                    className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                    placeholder="Ej: RM-001"
                  />
                </label>
              </div>

              <label className="block">
                <div className="mb-1 text-xs font-medium text-slate-600">Observaciones</div>
                <input
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-slate-300"
                  placeholder="Ej: despacho parcial, queda pendiente..."
                />
              </label>

              <button
                type="button"
                onClick={onDespachar}
                disabled={disabledDespachar}
                className={cx(
                  "mt-1 inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold",
                  disabledDespachar
                    ? "cursor-not-allowed bg-slate-100 text-slate-400"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                )}
              >
                Despachar
              </button>

              <div className="text-xs text-slate-500">
                Esto registra en <b>Despachos</b>, crea movimiento en <b>MovimientosInventario</b> y actualiza <b>Pedidos</b>.
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-3xl border bg-white shadow-sm">
            <div className="border-b px-5 py-4">
              <div className="text-sm font-semibold text-slate-900">Ítems listos para despacho</div>
              <div className="text-xs text-slate-500">
                Listado por ítem. Pendiente baja con despachos parciales.
              </div>
            </div>

            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
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
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      No hay ítems listos para despacho.
                    </td>
                  </tr>
                )}

                {items.map((it, i) => (
                  <tr key={i} className="border-t">
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

            <div className="px-5 py-3 text-xs text-slate-500">
              Fuente: <code>/api/logistica/despachables</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
