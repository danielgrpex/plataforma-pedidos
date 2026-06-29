"use client";

import { useEffect, useState } from "react";
import { HeaderBlock } from "./ui";

type Secuencia = {
  posicion: number;
  pedidosKey: string;
  cliente: string;
  direccion: string;
  oc: string;
  prioridadManual: string;
  estado: string;
  programadoPor: string;
  fechaProgramacion: string;
  fechaEstimadaDespacho: string;
};

type Manifest = {
  id: string;
  manifest_date: string;
  carrier: string;
  file_path: string;
  file_url: string;
  uploaded_by: string;
  notes?: string;
  created_at: string;
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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fechaLabel(fecha: string) {
  const d = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(d.getTime())) return fecha;

  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function TurneroDespachosTab() {
  const [fecha, setFecha] = useState(todayISO());
  const [items, setItems] = useState<Secuencia[]>([]);
  const [represados, setRepresados] = useState<Secuencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Secuencia | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [carrier, setCarrier] = useState("");
  const [manifestFile, setManifestFile] = useState<File | null>(null);
  const [uploadingManifest, setUploadingManifest] = useState(false);

  async function cargar(fechaConsulta = fecha) {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/planeacion/secuencia-despachos?fecha=${encodeURIComponent(fechaConsulta)}`,
        { cache: "no-store" }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "No se pudo cargar el turnero");
      }

      setItems(data.secuencia || []);
      setRepresados(data.represados || []);
    } catch (err: any) {
      setMessage(err?.message || "Error cargando turnero de despachos");
    } finally {
      setLoading(false);
    }
  }

  async function cargarManifiesto(fechaConsulta = fecha) {
    try {
      const res = await fetch(
        `/api/logistica/manifiestos?fecha=${encodeURIComponent(fechaConsulta)}`,
        { cache: "no-store" }
      );

      const data = await res.json();

      if (data.success) {
        setManifests(data.manifests || []);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function refrescar(fechaConsulta = fecha) {
    await Promise.all([cargar(fechaConsulta), cargarManifiesto(fechaConsulta)]);
  }

  async function subirManifiesto() {
    if (!carrier.trim()) {
      setMessage("Debes digitar la transportadora.");
      return;
    }

    if (!manifestFile) {
      setMessage("Debes seleccionar el archivo del manifiesto.");
      return;
    }

    setUploadingManifest(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", manifestFile);
      formData.append("carrier", carrier.trim());
      formData.append("uploadedBy", "Logística");
      formData.append("manifestDate", fecha);

      const res = await fetch("/api/logistica/manifiestos", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "No se pudo subir el manifiesto.");
      }

      setCarrier("");
      setManifestFile(null);
      setMessage(`Manifiesto subido correctamente para ${fechaLabel(fecha)}.`);
      await cargarManifiesto(fecha);
    } catch (err: any) {
      setMessage(err?.message || "Error subiendo manifiesto.");
    } finally {
      setUploadingManifest(false);
    }
  }

  async function quitarManifiesto(id: string) {
    const ok = window.confirm("¿Quitar este manifiesto?");
    if (!ok) return;

    setUploadingManifest(true);
    setMessage("");

    try {
      const res = await fetch(`/api/logistica/manifiestos?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "No se pudo quitar el manifiesto.");
      }

      setMessage("Manifiesto quitado correctamente.");
      await cargarManifiesto(fecha);
    } catch (err: any) {
      setMessage(err?.message || "Error quitando manifiesto.");
    } finally {
      setUploadingManifest(false);
    }
  }

  function openModal(item: Secuencia) {
    setSelected(item);
    setForm({
      ...emptyForm,
      fechaRealDespacho: fecha,
    });
    setMessage("");
  }

  async function despacharSeleccionado() {
    if (!selected) return;

    if (!form.usuario.trim()) {
      setMessage("Debes digitar el usuario de logística.");
      return;
    }

    const ok = window.confirm(
      `¿Confirmas despachar este pedido?\n\n${selected.cliente}\nOC: ${selected.oc}`
    );

    if (!ok) return;

    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/logistica/despachar-orden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          agruparPor: "pedido",
          groupKey: selected.pedidosKey,
          ...form,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "No se pudo despachar");
      }

      const secRes = await fetch("/api/planeacion/secuencia-despachos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          pedidosKey: selected.pedidosKey,
          action: "despachado",
        }),
      });

      const secData = await secRes.json();

      if (!secRes.ok || !secData.success) {
        throw new Error(
          secData.message || "El despacho se registró, pero no se pudo cerrar en la secuencia."
        );
      }

      setSelected(null);
      setForm(emptyForm);
      setMessage(`Despacho realizado correctamente. Ítems despachados: ${data.itemsDespachados}`);
      await cargar(fecha);
    } catch (err: any) {
      setMessage(err?.message || "Error despachando turno");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    refrescar(fecha);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const actual = items[0];
  const siguientes = items.slice(1);

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <HeaderBlock
        title="Programación de despachos"
        subtitle="Secuencia oficial definida por Planeación. Logística ejecuta por fecha programada."
      />

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-neutral-700">
            Fecha de despacho
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={fecha}
              onChange={(e) => {
                const nueva = e.target.value || todayISO();
                setFecha(nueva);
                refrescar(nueva);
              }}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold"
            />

            <button
              type="button"
              onClick={() => {
                const hoy = todayISO();
                setFecha(hoy);
                refrescar(hoy);
              }}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50"
            >
              Hoy
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => refrescar(fecha)}
          disabled={loading}
          className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-neutral-50 disabled:opacity-60"
        >
          {loading ? "Cargando..." : "Refrescar"}
        </button>
      </div>

      <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-blue-700">
              Manifiestos
            </div>
            <h3 className="mt-1 text-lg font-black text-neutral-900">{fechaLabel(fecha)}</h3>
            <p className="mt-1 text-sm text-blue-800">
              Sube uno o varios manifiestos por transportadora para esta fecha.
            </p>
          </div>

          <div className="rounded-xl bg-white px-4 py-3 text-right text-sm ring-1 ring-blue-100">
            <div className="text-xs font-semibold uppercase text-blue-600">Archivos cargados</div>
            <div className="text-2xl font-black text-blue-900">{manifests.length}</div>
          </div>
        </div>

        {manifests.length > 0 && (
          <div className="mt-4 rounded-xl bg-white p-4 ring-1 ring-blue-100">
            <div className="mb-3 text-sm font-bold text-slate-700">
              Manifiestos cargados para {fechaLabel(fecha)}
            </div>

            <div className="space-y-2">
              {manifests.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                >
                  <div>
                    <div className="font-semibold text-slate-900">
                      {m.carrier || "Sin transportadora"}
                    </div>

                    <div className="text-xs text-slate-500">
                      Subido por {m.uploaded_by || "Logística"} ·{" "}
                      {m.created_at ? new Date(m.created_at).toLocaleString("es-CO") : ""}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <a
                      href={m.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Descargar
                    </a>

                    <button
                      type="button"
                      onClick={() => quitarManifiesto(m.id)}
                      disabled={uploadingManifest}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Field label="Transportadora">
            <input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="Ej: Coordinadora / Envía"
              className="w-full rounded-xl border border-blue-100 bg-white px-3 py-2"
            />
          </Field>

          <Field label="Archivo manifiesto">
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setManifestFile(e.target.files?.[0] || null)}
              className="w-full rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm"
            />
          </Field>

          <div className="flex items-end">
            <button
              type="button"
              onClick={subirManifiesto}
              disabled={uploadingManifest || !manifestFile}
              className="w-full rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {uploadingManifest ? "Subiendo..." : "Subir manifiesto"}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          {message}
        </div>
      )}
{represados.length > 0 && (
  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-amber-700">
          Pendientes represados
        </div>

        <h3 className="mt-1 text-lg font-black text-neutral-900">
          {represados.length} pedido(s) pendientes de fechas anteriores
        </h3>

        <p className="mt-1 text-sm text-amber-800">
          Estos pedidos estaban programados antes de hoy y aún no se han despachado.
        </p>
      </div>
    </div>

    <div className="mt-4 divide-y divide-amber-100 rounded-xl border border-amber-100 bg-white">
      {represados.map((r, idx) => (
        <div
          key={`${idx}-${r.pedidosKey}`}
          className="flex flex-wrap items-center justify-between gap-3 p-4"
        >
          <div>
            <div className="text-xs font-bold text-amber-700">
              Programado: {r.fechaEstimadaDespacho || "-"}
            </div>

            <div className="mt-1 font-black text-neutral-900">
              {r.cliente || r.pedidosKey}
            </div>

            <div className="text-xs text-neutral-500">
              Dirección: {r.direccion || "-"} · OC: {r.oc || "-"}
            </div>
          </div>

          <button
            type="button"
            onClick={() => openModal(r)}
            disabled={loading || saving}
            className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-bold text-white hover:bg-amber-800 disabled:opacity-60"
          >
            Despachar represado
          </button>
        </div>
      ))}
    </div>
  </div>
)}
      {!actual && (
        <div className="mt-5 rounded-2xl bg-neutral-50 p-6 text-sm text-neutral-600">
          No hay despachos programados para {fechaLabel(fecha)}.
        </div>
      )}

      {actual && (
        <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-5">
          <div className="text-xs font-bold uppercase tracking-wide text-green-700">
            Despachos programados para {fechaLabel(fecha)}
          </div>

          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-2xl font-black text-neutral-900">
                #1 {actual.cliente || actual.pedidosKey}
              </div>

              <div className="mt-1 text-sm text-neutral-700">
                Dirección: {actual.direccion || "-"}
              </div>

              <div className="text-sm text-neutral-700">OC: {actual.oc || "-"}</div>

              {actual.prioridadManual && (
                <div className="mt-2 inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700 ring-1 ring-red-100">
                  {actual.prioridadManual}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => openModal(actual)}
              disabled={loading || saving}
              className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-neutral-800 disabled:opacity-60"
            >
              Despachar
            </button>
          </div>
        </div>
      )}

      {siguientes.length > 0 && (
        <div className="mt-5 rounded-2xl border border-neutral-200">
          <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-bold text-neutral-700">
            En cola para {fechaLabel(fecha)}
          </div>

          <div className="divide-y divide-neutral-100">
            {siguientes.map((s, idx) => (
              <div key={`${idx + 2}-${s.pedidosKey}`} className="flex items-center gap-4 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-sm font-black text-neutral-700">
                  {idx + 2}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="font-bold text-neutral-900">{s.cliente || s.pedidosKey}</div>
                  <div className="text-xs text-neutral-500">
                    Dirección: {s.direccion || "-"} · OC: {s.oc || "-"}
                  </div>
                </div>

                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
                  {s.estado || "Programado"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">Despachar pedido</h3>

              <p className="mt-1 text-sm text-neutral-600">
                {selected.cliente || selected.pedidosKey}
              </p>

              <p className="mt-1 text-xs text-neutral-500">
                Dirección: {selected.direccion || "-"} · OC: {selected.oc || "-"}
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
                disabled={saving}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-60"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={despacharSeleccionado}
                disabled={saving}
                className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {saving ? "Despachando..." : "Confirmar despacho"}
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