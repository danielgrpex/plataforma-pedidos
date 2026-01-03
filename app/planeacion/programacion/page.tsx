// app/planeacion/programacion/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Tab = "Producción" | "Corte" | "Despachos" | "Programar Empaque";

type OpeEmpaqueItem = {
  ope: string; // OPE260001
  items?: number;
  totalUND?: number;
  estado?: string; // Producida
};

type OteEmpaqueItem = {
  ote: string; // OTE260001
  items?: number;
  totalUND?: number;
  estado?: string; // Generada
};

function toNum(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export default function PlaneacionProgramacionHomePage() {
  const [tab, setTab] = useState<Tab>("Producción");

  // =========================
  // TAB: EMPAQUE
  // =========================
  const [qEmpaque, setQEmpaque] = useState("");
  const [loadingEmpaque, setLoadingEmpaque] = useState(false);
  const [errEmpaque, setErrEmpaque] = useState("");
  const [msgEmpaque, setMsgEmpaque] = useState("");

  const [opesEmpaque, setOpesEmpaque] = useState<OpeEmpaqueItem[]>([]);
  const [otesEmpaque, setOtesEmpaque] = useState<OteEmpaqueItem[]>([]);

  async function loadEmpaque() {
    setErrEmpaque("");
    setMsgEmpaque("");
    setLoadingEmpaque(true);

    try {
      const q = encodeURIComponent(qEmpaque.trim());

      const [resOpes, resOtes] = await Promise.all([
        fetch(`/api/planeacion/programacion/produccion/opes/list?estado=Producida&q=${q}`, {
          cache: "no-store",
        }),
        fetch(`/api/planeacion/programacion/corte/otes/list?estado=Generada&q=${q}`, {
          cache: "no-store",
        }),
      ]);

      const jsonOpes = await resOpes.json().catch(() => null);
      const jsonOtes = await resOtes.json().catch(() => null);

      if (!resOpes.ok || !jsonOpes?.success) {
        throw new Error(jsonOpes?.message || "No se pudieron cargar OPEs (Producida).");
      }
      if (!resOtes.ok || !jsonOtes?.success) {
        throw new Error(jsonOtes?.message || "No se pudieron cargar OTEs (Generada).");
      }

      setOpesEmpaque((jsonOpes.items || []) as OpeEmpaqueItem[]);
      setOtesEmpaque((jsonOtes.items || []) as OteEmpaqueItem[]);

      setMsgEmpaque("✅ Listado actualizado.");
      setTimeout(() => setMsgEmpaque(""), 2500);
    } catch (e: any) {
      console.error(e);
      setErrEmpaque(e?.message || "Error cargando empaque.");
      setOpesEmpaque([]);
      setOtesEmpaque([]);
    } finally {
      setLoadingEmpaque(false);
    }
  }

  useEffect(() => {
    if (tab === "Programar Empaque") loadEmpaque();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const totalOpes = useMemo(() => opesEmpaque.length, [opesEmpaque]);
  const totalOtes = useMemo(() => otesEmpaque.length, [otesEmpaque]);

  const undOpes = useMemo(() => opesEmpaque.reduce((acc, x) => acc + toNum(x.totalUND), 0), [opesEmpaque]);
  const undOtes = useMemo(() => otesEmpaque.reduce((acc, x) => acc + toNum(x.totalUND), 0), [otesEmpaque]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Planeación · Programación</h1>
          <p className="text-sm text-slate-500">
            Desde aquí planeación programa <b>Producción</b>, <b>Corte</b>, <b>Empaque</b> y <b>Despachos</b>.
          </p>
        </div>

        <Link
          href="/planeacion"
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          ← Volver
        </Link>
      </div>

      {/* Tabs */}
      <section className="mt-6 grid gap-3 md:grid-cols-4">
        <button
          type="button"
          onClick={() => setTab("Producción")}
          className={`rounded-2xl border p-4 text-left shadow-sm transition ${
            tab === "Producción"
              ? "border-indigo-300 bg-indigo-50"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <div className="text-sm font-semibold">Producción</div>
          <div className="text-xs text-slate-500">Solicitudes pendientes → crear OPE.</div>
        </button>

        <button
          type="button"
          onClick={() => setTab("Corte")}
          className={`rounded-2xl border p-4 text-left shadow-sm transition ${
            tab === "Corte" ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <div className="text-sm font-semibold">Corte</div>
          <div className="text-xs text-slate-500">SolicitudesCorte pendientes → crear OTE.</div>
        </button>

        <button
          type="button"
          onClick={() => setTab("Programar Empaque")}
          className={`rounded-2xl border p-4 text-left shadow-sm transition ${
            tab === "Programar Empaque"
              ? "border-indigo-300 bg-indigo-50"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <div className="text-sm font-semibold">Programar Empaque</div>
          <div className="text-xs text-slate-500">OPE (Producida) + OTE (Generada) → priorizar.</div>
        </button>

        <button
          type="button"
          onClick={() => setTab("Despachos")}
          className={`rounded-2xl border p-4 text-left shadow-sm transition ${
            tab === "Despachos"
              ? "border-indigo-300 bg-indigo-50"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <div className="text-sm font-semibold">Despachos</div>
          <div className="text-xs text-slate-500">Programación de despachos (pendiente).</div>
        </button>
      </section>

      {/* PRODUCCIÓN */}
      {tab === "Producción" && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold">Programación · Producción</h2>
          <p className="mt-1 text-sm text-slate-500">
            Aquí vas a generar OPE desde solicitudes pendientes y luego programarlas en líneas.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/planeacion/programacion/produccion"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Ir a Producción →
            </Link>
          </div>
        </section>
      )}

      {/* CORTE */}
      {tab === "Corte" && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold">Programación · Corte</h2>
          <p className="mt-1 text-sm text-slate-500">
            Aquí listamos SolicitudesCorte (Pendiente) y creamos OTE.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/planeacion/programacion/corte"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Ir a Corte →
            </Link>
          </div>
        </section>
      )}

      {/* EMPAQUE */}
{tab === "Programar Empaque" && (
  <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="text-base font-semibold">Programación · Empaque</h2>
    <p className="mt-1 text-sm text-slate-500">
      Aquí se programan los procesos de <b>Empaque</b> a partir de:
    </p>

    <ul className="mt-3 list-disc pl-6 text-sm text-slate-600 space-y-1">
      <li>OPE en estado <b>Producida</b></li>
      <li>OTE en estado <b>Generada</b></li>
    </ul>

    <div className="mt-4 flex flex-wrap gap-2">
      <Link
        href="/planeacion/programacion/empaque"
        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Ir a Empaque →
      </Link>
    </div>
  </section>
)}


      {/* DESPACHOS */}
      {tab === "Despachos" && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold">Programación · Despachos</h2>
          <p className="mt-1 text-sm text-slate-500">
            Aquí listaremos lo que está listo para despacho y asignaremos programación logística.
          </p>
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Pendiente: definir origen (Pedidos/Almacén) y flujo.
          </div>
        </section>
      )}
    </main>
  );
}
