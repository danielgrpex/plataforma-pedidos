//app/produccion/reporte-maquinas/iniciar/page.tsx
//app/produccion/reporte-maquinas/iniciar/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TabKey = "alistamiento" | "cuadre" | "inicio";

type SolicitudProduccion = {
  solicitudProdId: string;
  pedidoKey: string;
  rowIndexPedido: number | string;
  productoKey: string;
  cantidadUND: number;
  estado: string;
  fechaCreacion?: string;
  fechaUltActualizacion?: string;
  usuario?: string;
  OPE?: string;
};

type Trabajador = { id: string; nombre: string };
type Herramental = { id: string; nombre: string };
type Maquina = { id: string; nombre: string };

async function safeJsonFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function IniciarReporteMaquinasPage() {
  const router = useRouter();

  const [tab, setTab] = useState<TabKey>("alistamiento");

  // Data
  const [loading, setLoading] = useState(true);
  const [solicitudes, setSolicitudes] = useState<SolicitudProduccion[]>([]);
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [herramentales, setHerramentales] = useState<Herramental[]>([]);
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Selections
  const [solicitudId, setSolicitudId] = useState("");
  const [trabajadorId, setTrabajadorId] = useState("");

  // Alistamiento
  const [herramentalId, setHerramentalId] = useState("");

  // Cuadre
  const [maquina1Id, setMaquina1Id] = useState("");
  const [maquina2Id, setMaquina2Id] = useState("");
  const [maquina3Id, setMaquina3Id] = useState("");
  const [haladorId, setHaladorId] = useState("");

  // UX
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<string | null>(null);

  // Load initial data (REAL)
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setLoadError(null);

      const [sol, trab, her, maq] = await Promise.all([
        safeJsonFetch<SolicitudProduccion[]>("/api/produccion/solicitudes/en-cola"),
        safeJsonFetch<Trabajador[]>("/api/info/trabajadores"),
        safeJsonFetch<Herramental[]>("/api/info/herramentales"),
        safeJsonFetch<Maquina[]>("/api/info/maquinas"),
      ]);

      if (!mounted) return;

      // ✅ Sin mocks: si algo falla, mostramos error y dejamos la pantalla lista
      if (!sol || !trab || !her || !maq) {
        setLoadError(
          "No se pudieron cargar algunos datos. Revisa los endpoints y credenciales de Google Sheets."
        );
        setSolicitudes([]);
        setTrabajadores([]);
        setHerramentales([]);
        setMaquinas([]);
        setLoading(false);
        return;
      }

      const finalSolicitudes = sol.filter(
        (s) => String(s.estado ?? "").trim() === "Generada"
      );

      setSolicitudes(finalSolicitudes);
      setTrabajadores(trab);
      setHerramentales(her);
      setMaquinas(maq);

      setLoading(false);
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const solicitudSeleccionada = useMemo(
    () => solicitudes.find((s) => s.solicitudProdId === solicitudId) ?? null,
    [solicitudes, solicitudId]
  );

  const ordenLabel = (s: SolicitudProduccion) => {
    const ope = (s.OPE ?? "").trim() || "SIN-OPE";
    const und = Number(s.cantidadUND ?? 0);
    return `${ope} — ${s.productoKey} — ${und} UND`;
  };

  // Reset mensajes al cambiar tab
  useEffect(() => {
    setSubmitError(null);
    setSubmitOk(null);
  }, [tab]);

  const validate = (): string | null => {
    if (!solicitudId) return "Selecciona una orden (estado: Generada).";
    if (!trabajadorId) return "Selecciona el trabajador.";

    if (tab === "alistamiento") {
      if (!herramentalId) return "Selecciona el herramental.";
    }

    if (tab === "cuadre") {
      if (!maquina1Id) return "Selecciona Máquina 1.";
      if (!maquina2Id) return "Selecciona Máquina 2.";
      if (!maquina3Id) return "Selecciona Máquina 3.";
      if (!haladorId) return "Selecciona Halador.";
    }

    return null;
  };

  const resetForm = () => {
  setSolicitudId("");
  setTrabajadorId("");

  setHerramentalId("");

  setMaquina1Id("");
  setMaquina2Id("");
  setMaquina3Id("");
  setHaladorId("");
};

const onIniciar = async () => {
  setSubmitError(null);
  setSubmitOk(null);

  const err = validate();
  if (err) {
    setSubmitError(err);
    return;
  }

  const trabajadorNombre =
    trabajadores.find((t) => t.id === trabajadorId)?.nombre ?? "";

  const herramentalNombre =
    herramentales.find((h) => h.id === herramentalId)?.nombre ?? "";

  const maquina1Nombre = maquinas.find((m) => m.id === maquina1Id)?.nombre ?? "";
  const maquina2Nombre = maquinas.find((m) => m.id === maquina2Id)?.nombre ?? "";
  const maquina3Nombre = maquinas.find((m) => m.id === maquina3Id)?.nombre ?? "";
  const haladorNombre = maquinas.find((m) => m.id === haladorId)?.nombre ?? "";

  try {
    const payload: any = {
      tipo: tab,
      solicitudProdId: solicitudId,
      trabajadorNombre,
    };

    if (tab === "alistamiento") payload.herramentalNombre = herramentalNombre;

    if (tab === "cuadre") {
      payload.maquina1Nombre = maquina1Nombre;
      payload.maquina2Nombre = maquina2Nombre;
      payload.maquina3Nombre = maquina3Nombre;
      payload.haladorNombre = haladorNombre;
    }

    const res = await fetch("/api/produccion/reporte-maquinas/iniciar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      setSubmitError(data?.error ?? "Error al iniciar");
      return;
    }

    setSubmitOk(`✅ Registro creado en ReporteOperarioMq. Estado: ${data.escrito?.estado}`);
    resetForm();
  } catch (e) {
    setSubmitError("Error de red al iniciar.");
  }
};


  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Iniciar — Registro Operativo Máquinas
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Selecciona una orden generada, el trabajador y completa los campos
              según el tipo de inicio.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/produccion/reporte-maquinas")}
            className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 shadow-sm hover:bg-neutral-50"
          >
            Volver
          </button>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          {/* Tabs */}
          <div className="border-b border-neutral-200 px-4 pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex rounded-xl bg-neutral-100 p-1">
                <TabButton
                  active={tab === "alistamiento"}
                  onClick={() => setTab("alistamiento")}
                >
                  Alistamiento Herramental
                </TabButton>
                <TabButton
                  active={tab === "cuadre"}
                  onClick={() => setTab("cuadre")}
                >
                  Cuadre de Linea
                </TabButton>
                <TabButton
                  active={tab === "inicio"}
                  onClick={() => setTab("inicio")}
                >
                  Inicio de producción
                </TabButton>
              </div>

              <div className="pb-3 text-xs text-neutral-500 sm:pb-0">
                {loading ? "Cargando…" : `${solicitudes.length} órdenes en cola`}
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Info / error banner */}
            {loadError && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {loadError}
              </div>
            )}

            {/* Form grid */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Orden */}
              <Field label="Orden (En cola)">
                <select
                  value={solicitudId}
                  onChange={(e) => setSolicitudId(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10"
                  disabled={loading || !!loadError}
                >
                  <option value="">Selecciona…</option>
                  {solicitudes.map((s) => (
                    <option key={s.solicitudProdId} value={s.solicitudProdId}>
                      {ordenLabel(s)}
                    </option>
                  ))}
                </select>

                {solicitudSeleccionada && (
                  <p className="mt-1 text-xs text-neutral-600">
                    ID:{" "}
                    <span className="font-medium">
                      {solicitudSeleccionada.solicitudProdId}
                    </span>{" "}
                    • Pedido:{" "}
                    <span className="font-medium">
                      {solicitudSeleccionada.pedidoKey}
                    </span>
                  </p>
                )}
              </Field>

              {/* Trabajador */}
              <Field label="Trabajador">
                <select
                  value={trabajadorId}
                  onChange={(e) => setTrabajadorId(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10"
                  disabled={loading || !!loadError}
                >
                  <option value="">Selecciona…</option>
                  {trabajadores.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Condicionales */}
              {tab === "alistamiento" && (
                <Field label="Herramental">
                  <select
                    value={herramentalId}
                    onChange={(e) => setHerramentalId(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10"
                    disabled={loading || !!loadError}
                  >
                    <option value="">Selecciona…</option>
                    {herramentales.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.nombre}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              {tab === "cuadre" && (
                <>
                  <Field label="Máquina 1">
                    <select
                      value={maquina1Id}
                      onChange={(e) => setMaquina1Id(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10"
                      disabled={loading || !!loadError}
                    >
                      <option value="">Selecciona…</option>
                      {maquinas.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nombre}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Máquina 2">
                    <select
                      value={maquina2Id}
                      onChange={(e) => setMaquina2Id(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10"
                      disabled={loading || !!loadError}
                    >
                      <option value="">Selecciona…</option>
                      {maquinas.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nombre}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Máquina 3">
                    <select
                      value={maquina3Id}
                      onChange={(e) => setMaquina3Id(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10"
                      disabled={loading || !!loadError}
                    >
                      <option value="">Selecciona…</option>
                      {maquinas.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nombre}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Halador">
                    <select
                      value={haladorId}
                      onChange={(e) => setHaladorId(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10"
                      disabled={loading || !!loadError}
                    >
                      <option value="">Selecciona…</option>
                      {maquinas.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nombre}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                {submitError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                    {submitError}
                  </div>
                )}
                {submitOk && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 break-words">
                    {submitOk}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={onIniciar}
                className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 active:bg-neutral-900"
                disabled={loading || !!loadError}
              >
                Iniciar
              </button>
            </div>

            <p className="mt-4 text-xs text-neutral-500">
              Nota: En el siguiente paso conectamos el botón “Iniciar” para que
              actualice estados y cree registros según la pestaña seleccionada.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-lg px-4 py-2 text-sm font-medium transition whitespace-nowrap",
        active
          ? "bg-white text-neutral-900 shadow-sm ring-1 ring-black/5"
          : "text-neutral-600 hover:text-neutral-900",
      ].join(" ")}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-neutral-900">
        {label}
      </label>
      {children}
    </div>
  );
}
