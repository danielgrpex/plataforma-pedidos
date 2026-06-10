//app/abastecimientologistica/_components/DespachosOrdenTab.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { HeaderBlock } from "./ui";

type AgruparPor = "pedido" | "clienteDireccion";

type GrupoDespacho = {
  groupKey: string;
  label: string;
  oc?: string;
  consecutivo?: string;
  cliente?: string;
  direccionDespacho?: string;
  itemsTotales: number;
  itemsListos: number;
  cantidadTotalUnd: number;
  estado: "Listo" | "Incompleto";
};

type FormState = {
  usuario: string;
  fechaRealDespacho: string;
  transporte: string;
  guia: string;
  factura: string;
  remision: string;
  observaciones: string;
};

const emptyForm: FormState = {
  usuario: "",
  fechaRealDespacho: "",
  transporte: "",
  guia: "",
  factura: "",
  remision: "",
  observaciones: "",
};

export function DespachosOrdenTab() {
  const [agruparPor, setAgruparPor] = useState<AgruparPor>("pedido");
  const [items, setItems] = useState<GrupoDespacho[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState("");
  const [selected, setSelected] = useState<GrupoDespacho | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState("");

  async function cargar() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(`/api/logistica/despachos-orden?agruparPor=${agruparPor}`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "No se pudo cargar la información");
      }

      setItems(data.items || []);
    } catch (err: any) {
      setMessage(err?.message || "Error cargando despachos por orden");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, [agruparPor]);

  const filtered = useMemo(() => items, [items]);

  function openModal(g: GrupoDespacho) {
    setSelected(g);
    setForm(emptyForm);
    setMessage("");
  }

  async function despachar() {
    if (!selected) return;

    if (!form.usuario.trim()) {
      setMessage("Debes digitar el usuario de logística.");
      return;
    }

    const ok = window.confirm(
      `¿Confirmas despachar todos los ítems de:\n\n${selected.label}\n\nÍtems: ${selected.itemsTotales}`
    );

    if (!ok) return;

    setSavingKey(selected.groupKey);
    setMessage("");

    try {
      const res = await fetch("/api/logistica/despachar-orden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          agruparPor,
          groupKey: selected.groupKey,
          ...form,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "No se pudo despachar la orden");
      }

      setSelected(null);
      setForm(emptyForm);
      setMessage(`Despacho realizado correctamente. Ítems despachados: ${data.itemsDespachados}`);
      await cargar();
    } catch (err: any) {
      setMessage(err?.message || "Error despachando orden completa");
    } finally {
      setSavingKey("");
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <HeaderBlock
        title="Despachos por orden completa"
        subtitle="Despacha todos los ítems de un pedido o de una tienda usando Cliente - Dirección."
      />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <label className="text-sm font-semibold text-neutral-700">Agrupar por</label>
          <select
            value={agruparPor}
            onChange={(e) => setAgruparPor(e.target.value as AgruparPor)}
            className="mt-1 block rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
          >
            <option value="pedido">Pedido</option>
            <option value="clienteDireccion">Cliente - Dirección</option>
          </select>
        </div>

        <button
          type="button"
          onClick={cargar}
          disabled={loading}
          className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-neutral-50 disabled:opacity-60"
        >
          {loading ? "Cargando..." : "Refrescar"}
        </button>
      </div>

      {message && (
        <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          {message}
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-2xl border border-neutral-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-4 py-3">Grupo</th>
              <th className="px-4 py-3">OC</th>
              <th className="px-4 py-3">Ítems</th>
              <th className="px-4 py-3">Unidades</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acción</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  {loading ? "Cargando..." : "No hay grupos disponibles para despacho completo."}
                </td>
              </tr>
            )}

            {filtered.map((g) => {
              const listo = g.estado === "Listo";

              return (
                <tr key={g.groupKey} className="bg-white">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-neutral-900">{g.label}</div>
                    {g.consecutivo && (
                      <div className="text-xs text-neutral-500">Pedido #{g.consecutivo}</div>
                    )}
                  </td>

                  <td className="px-4 py-3 text-neutral-700">{g.oc || "-"}</td>

                  <td className="px-4 py-3">
                    {g.itemsListos}/{g.itemsTotales}
                  </td>

                  <td className="px-4 py-3">{g.cantidadTotalUnd}</td>

                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        listo
                          ? "bg-green-50 text-green-700 ring-1 ring-green-100"
                          : "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-100"
                      }`}
                    >
                      {listo ? "Listo para despacho" : "Incompleto"}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={!listo || savingKey === g.groupKey}
                      onClick={() => openModal(g)}
                      className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
                    >
                      Despachar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">Despachar orden completa</h3>
              <p className="mt-1 text-sm text-neutral-600">{selected.label}</p>
              <p className="mt-1 text-xs text-neutral-500">
                Ítems: {selected.itemsTotales} · Unidades: {selected.cantidadTotalUnd}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Usuario logística">
                <input
                  value={form.usuario}
                  onChange={(e) => setForm({ ...form, usuario: e.target.value })}
                  placeholder="Ej: Leidy / Dalia / Logística"
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2"
                />
              </Field>

              <Field label="Fecha real de despacho">
                <input
                  type="date"
                  value={form.fechaRealDespacho}
                  onChange={(e) => setForm({ ...form, fechaRealDespacho: e.target.value })}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2"
                />
              </Field>

              <Field label="Transporte">
                <input
                  value={form.transporte}
                  onChange={(e) => setForm({ ...form, transporte: e.target.value })}
                  placeholder="Ej: Propio / Envía / Servientrega"
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2"
                />
              </Field>

              <Field label="Guía">
                <input
                  value={form.guia}
                  onChange={(e) => setForm({ ...form, guia: e.target.value })}
                  placeholder="Ej: 123456"
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2"
                />
              </Field>

              <Field label="Factura">
                <input
                  value={form.factura}
                  onChange={(e) => setForm({ ...form, factura: e.target.value })}
                  placeholder="Ej: FV-001"
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2"
                />
              </Field>

              <Field label="Remisión">
                <input
                  value={form.remision}
                  onChange={(e) => setForm({ ...form, remision: e.target.value })}
                  placeholder="Ej: RM-001"
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2"
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="Observaciones">
                  <textarea
                    value={form.observaciones}
                    onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                    placeholder="Observaciones del despacho..."
                    className="min-h-24 w-full rounded-xl border border-neutral-200 px-3 py-2"
                  />
                </Field>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={despachar}
                disabled={savingKey === selected.groupKey}
                className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {savingKey === selected.groupKey ? "Despachando..." : "Confirmar despacho"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-neutral-700">{label}</span>
      {children}
    </label>
  );
}