//app/produccion/reporte-empaque/iniciar/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type OrdenEmpaque = {
  tipo: "corte" | "produccion";
  solicitudId: string;          // solicitudCorteId o solicitudProdId
  pedidoKey: string;
  rowIndexPedido: number | string;
  producto: string;             // productoSolicitado o productoKey
  cantidadUnd: number | string; // cantidadSolicitadaUnd o cantidadUND
  estado: string;               // estadoitem o estado
  code: string;                 // OTE u OPE
};

type Trabajador = { id: string; nombre: string };

async function safeJsonFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function IniciarReporteEmpaquePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [ordenes, setOrdenes] = useState<OrdenEmpaque[]>([]);
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);

  const [ordenKey, setOrdenKey] = useState(""); // "corte:ID" | "produccion:ID"
  const [trabajadorId, setTrabajadorId] = useState("");

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState<string | null>(null);

  const ordenSeleccionada = useMemo(() => {
    if (!ordenKey) return null;
    const [tipo, id] = ordenKey.split(":");
    return ordenes.find((o) => o.tipo === (tipo as any) && o.solicitudId === id) ?? null;
  }, [ordenes, ordenKey]);

  const ordenLabel = (o: OrdenEmpaque) => {
    const tipoTxt = o.tipo === "corte" ? "OTE" : "OPE";
    const code = String(o.code ?? "").trim() || `SIN-${tipoTxt}`;
    const idx = String(o.rowIndexPedido ?? "").trim() || "-";
    const prod = String(o.producto ?? "").trim();
    const und = String(o.cantidadUnd ?? "").trim();
    return `${tipoTxt}: ${code} — ${idx} — ${prod} — ${und} UND`;
  };

  const resetForm = () => {
    setOrdenKey("");
    setTrabajadorId("");
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setLoadError(null);

      const [ordsCorte, ordsProd, trab] = await Promise.all([
        safeJsonFetch<any[]>("/api/produccion/solicitudes-corte/generadas"),
        safeJsonFetch<any[]>("/api/produccion/solicitudes-produccion/en-cola-o-producido"),
        safeJsonFetch<Trabajador[]>("/api/info/trabajadores"),
      ]);

      if (!mounted) return;

      if (!ordsCorte || !ordsProd || !trab) {
        setLoadError("No se pudieron cargar datos. Revisa endpoints/credenciales.");
        setOrdenes([]);
        setTrabajadores([]);
        setLoading(false);
        return;
      }

      // map corte -> OrdenEmpaque
      const corte: OrdenEmpaque[] = ordsCorte.map((o) => ({
        tipo: "corte",
        solicitudId: String(o.solicitudCorteId ?? ""),
        pedidoKey: String(o.pedidoKey ?? ""),
        rowIndexPedido: o.rowIndexPedido ?? "",
        producto: String(o.productoSolicitado ?? ""),
        cantidadUnd: o.cantidadSolicitadaUnd ?? "",
        estado: String(o.estadoitem ?? ""),
        code: String(o.OTE ?? ""),
      }));

      // map producción -> OrdenEmpaque
      const prod: OrdenEmpaque[] = ordsProd.map((o) => ({
        tipo: "produccion",
        solicitudId: String(o.solicitudProdId ?? ""),
        pedidoKey: String(o.pedidoKey ?? ""),
        rowIndexPedido: o.rowIndexPedido ?? "",
        producto: String(o.productoKey ?? ""),
        cantidadUnd: o.cantidadUND ?? "",
        estado: String(o.estado ?? ""),
        code: String(o.OPE ?? ""),
      }));

      const merged = [...corte, ...prod];

      setOrdenes(merged);
      setTrabajadores(trab);
      setLoading(false);
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const validate = (): string | null => {
    if (!ordenKey) return "Selecciona una orden (OTE Generada u OPE En cola/Producido).";
    if (!trabajadorId) return "Selecciona el trabajador.";
    return null;
  };

  const onIniciar = async () => {
    setSubmitError(null);
    setSubmitOk(null);

    const err = validate();
    if (err) return setSubmitError(err);

    const trabajadorNombre = trabajadores.find((t) => t.id === trabajadorId)?.nombre ?? "";

    const [tipo, solicitudId] = ordenKey.split(":");

    try {
      const res = await fetch("/api/produccion/reporte-empaque/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,          // "corte" | "produccion"
          solicitudId,   // id real
          trabajadorNombre,
        }),
      });

      const json = await res.json();
      if (!res.ok) return setSubmitError(json?.error ?? "No se pudo iniciar.");

      setSubmitOk("✅ Inicio Empaque registrado. Estado: En curso.");
      resetForm();

      // recargar órdenes
      const [ordsCorte, ordsProd] = await Promise.all([
        safeJsonFetch<any[]>("/api/produccion/solicitudes-corte/generadas"),
        safeJsonFetch<any[]>("/api/produccion/solicitudes-produccion/en-cola-o-producido"),
      ]);

      if (ordsCorte && ordsProd) {
        const corte: OrdenEmpaque[] = ordsCorte.map((o) => ({
          tipo: "corte",
          solicitudId: String(o.solicitudCorteId ?? ""),
          pedidoKey: String(o.pedidoKey ?? ""),
          rowIndexPedido: o.rowIndexPedido ?? "",
          producto: String(o.productoSolicitado ?? ""),
          cantidadUnd: o.cantidadSolicitadaUnd ?? "",
          estado: String(o.estadoitem ?? ""),
          code: String(o.OTE ?? ""),
        }));

        const prod: OrdenEmpaque[] = ordsProd.map((o) => ({
          tipo: "produccion",
          solicitudId: String(o.solicitudProdId ?? ""),
          pedidoKey: String(o.pedidoKey ?? ""),
          rowIndexPedido: o.rowIndexPedido ?? "",
          producto: String(o.productoKey ?? ""),
          cantidadUnd: o.cantidadUND ?? "",
          estado: String(o.estado ?? ""),
          code: String(o.OPE ?? ""),
        }));

        setOrdenes([...corte, ...prod]);
      }
    } catch {
      setSubmitError("Error de red al iniciar.");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Iniciar — Reporte Operario Empaque
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Selecciona una orden (OTE Generada u OPE En cola/Producido) y el trabajador para iniciar empaque.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/produccion/reporte-empaque")}
            className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 shadow-sm hover:bg-neutral-50"
          >
            Volver
          </button>
        </div>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="border-b border-neutral-200 px-4 pt-4">
            <div className="flex items-center justify-between">
              <div className="inline-flex rounded-xl bg-neutral-100 p-1">
                <div className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 shadow-sm ring-1 ring-black/5">
                  Inicio Empaque
                </div>
              </div>
              <div className="pb-3 text-xs text-neutral-500">
                {loading ? "Cargando…" : `${ordenes.length} órdenes`}
              </div>
            </div>
          </div>

          <div className="p-6">
            {loadError && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {loadError}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Orden (OTE/OPE)">
                <select
                  value={ordenKey}
                  onChange={(e) => setOrdenKey(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10"
                  disabled={loading || !!loadError}
                >
                  <option value="">Selecciona…</option>
                  {ordenes.map((o) => (
                    <option key={`${o.tipo}:${o.solicitudId}`} value={`${o.tipo}:${o.solicitudId}`}>
                      {ordenLabel(o)}
                    </option>
                  ))}
                </select>

                {ordenSeleccionada && (
                  <p className="mt-1 text-xs text-neutral-600">
                    Tipo: <span className="font-medium">{ordenSeleccionada.tipo}</span>
                    {" "}• Pedido: <span className="font-medium">{ordenSeleccionada.pedidoKey}</span>
                  </p>
                )}
              </Field>

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
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                {submitError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                    {submitError}
                  </div>
                )}
                {submitOk && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
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
              Nota: Después implementamos “Finalizar” para llenar Hora Fin, avance, PNC, observaciones, supervisor y marcar estado final.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-neutral-900">{label}</label>
      {children}
    </div>
  );
}
