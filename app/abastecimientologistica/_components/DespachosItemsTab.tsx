// app/abastecimientologistica/_components/DespachosItemsTab.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { HeaderBlock, Field } from "./ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

export function DespachosItemsTab() {
  const [items, setItems] = useState<DespachableItem[]>([]);
  const [loading, setLoading] = useState(false);

  // form
  const [usuario, setUsuario] = useState("");
  const [selectedKey, setSelectedKey] = useState(""); // `${pedidosKey}||${row}`
  const [cantidad, setCantidad] = useState("0");

  // ✅ NUEVO: fecha real despacho (YYYY-MM-DD)
  const [fechaRealDespacho, setFechaRealDespacho] = useState("");

  const [transporte, setTransporte] = useState("");
  const [guia, setGuia] = useState("");
  const [factura, setFactura] = useState("");
  const [remision, setRemision] = useState("");
  const [observaciones, setObservaciones] = useState("");

  async function cargarDespachables() {
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

          // ✅ NUEVO: fecha real (opcional)
          fechaRealDespacho: fechaRealDespacho || undefined,

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
          `Pendiente: ${data.pendienteUnd ?? "?"} und`
      );

      // reset parcial
      setCantidad("0");
      setObservaciones("");
      setFechaRealDespacho("");

      // refrescar
      await cargarDespachables();
    } catch (e: any) {
      alert(e?.message || "Error despachando");
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <HeaderBlock
        title="Despachos por items"
        subtitle="Despachar parcial o total por ítem (trazabilidad por pedido + fila)."
      />

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs text-neutral-500">
          Fuente: <span className="font-mono">/api/logistica/despachables</span>
        </div>

        <button
          type="button"
          onClick={cargarDespachables}
          className="inline-flex h-9 items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 text-sm font-medium shadow-sm hover:bg-neutral-50"
        >
          {loading ? "Cargando..." : "Refrescar"}
        </button>
      </div>

      <div className="mt-5 grid gap-3">
        <Field label="Usuario (logística)">
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-600/10"
            placeholder="Ej: Leidy / Dalia / Logística"
          />
        </Field>

        <Field label="Ítem despachable">
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-600/10"
          >
            <option value="">Selecciona…</option>
            {items.map((it) => (
              <option
                key={`${it.pedidosKey}||${it.pedidoRowIndex}`}
                value={`${it.pedidosKey}||${it.pedidoRowIndex}`}
              >
                {it.pedidosKey} · row {it.pedidoRowIndex} — Pend: {it.pendienteUnd}
              </option>
            ))}
          </select>
        </Field>

        {/* ✅ NUEVO: Fecha real de despacho */}
        <Field label="Fecha real de despacho (opcional)">
          <input
            type="date"
            value={fechaRealDespacho}
            onChange={(e) => setFechaRealDespacho(e.target.value)}
            className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-600/10"
          />
          <div className="mt-1 text-xs text-neutral-500">
            Si el despacho ocurrió días atrás, selecciona la fecha real.
          </div>
        </Field>

        {selected && (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-800">
            <div className="font-medium text-neutral-900">{selected.producto}</div>

            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl border border-neutral-200 bg-white p-2">
                <div className="text-neutral-500">Solicitado</div>
                <div className="font-semibold">{selected.cantidadSolicitadaUnd}</div>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-white p-2">
                <div className="text-neutral-500">Despachado</div>
                <div className="font-semibold">{selected.cantidadDespachadaUnd}</div>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-white p-2">
                <div className="text-neutral-500">Pendiente</div>
                <div className="font-semibold">{selected.pendienteUnd}</div>
              </div>
            </div>
          </div>
        )}

        <Field label="Cantidad a despachar (und)">
          <input
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-600/10"
            inputMode="decimal"
          />
          {selected && safeNumber(cantidad) > selected.pendienteUnd && (
            <div className="mt-1 text-xs text-red-600">
              No puede ser mayor al pendiente ({selected.pendienteUnd}).
            </div>
          )}
        </Field>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Transporte">
            <input
              value={transporte}
              onChange={(e) => setTransporte(e.target.value)}
              className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-600/10"
              placeholder="Ej: Propio / Envia / Servientrega..."
            />
          </Field>

          <Field label="Guía">
            <input
              value={guia}
              onChange={(e) => setGuia(e.target.value)}
              className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-600/10"
              placeholder="Ej: 123456"
            />
          </Field>

          <Field label="Factura">
            <input
              value={factura}
              onChange={(e) => setFactura(e.target.value)}
              className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-600/10"
              placeholder="Ej: FV-001"
            />
          </Field>

          <Field label="Remisión">
            <input
              value={remision}
              onChange={(e) => setRemision(e.target.value)}
              className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-600/10"
              placeholder="Ej: RM-001"
            />
          </Field>
        </div>

        <Field label="Observaciones">
          <input
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-600/10"
            placeholder="Ej: despacho parcial, queda pendiente..."
          />
        </Field>

        <button
          type="button"
          onClick={onDespachar}
          disabled={disabledDespachar}
          className={cx(
            "mt-1 inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold shadow-sm",
            disabledDespachar
              ? "cursor-not-allowed bg-neutral-100 text-neutral-400"
              : "bg-neutral-900 text-white hover:bg-neutral-800"
          )}
        >
          Despachar
        </button>

        <div className="text-xs text-neutral-500">
          Esto registra en <b>Despachos</b>, crea movimiento en <b>MovimientosInventario</b> y actualiza <b>Pedidos</b>.
        </div>
      </div>
    </section>
  );
}
