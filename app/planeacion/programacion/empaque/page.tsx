//app/planeacion/programacion/empaque/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PoolItem = {
  tipo: "OPE" | "OTE";
  codigo: string;
  items: number;
  totalUND: number;
};

type ColaItem = {
  empaqueItemId: string;
  tipo: "OPE" | "OTE";
  codigo: string;
  pos: number;
  estado: string;
  totalUND: number;
  items: number;
  fechaCreacion?: string;
  usuario?: string;
};

function toNum(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function badgeTipo(tipo: "OPE" | "OTE") {
  return tipo === "OPE"
    ? "bg-indigo-50 text-indigo-700"
    : "bg-emerald-50 text-emerald-700";
}

export default function PlaneacionProgramacionEmpaquePage() {
  const router = useRouter();

  const [tab, setTab] = useState<"pool" | "cola">("pool");

  // Pool (entrada)
  const [q, setQ] = useState("");
  const [pool, setPool] = useState<PoolItem[]>([]);
  const [loadingPool, setLoadingPool] = useState(true);
  const [errPool, setErrPool] = useState("");

  // Cola
  const [cola, setCola] = useState<ColaItem[]>([]);
  const [loadingCola, setLoadingCola] = useState(true);
  const [errCola, setErrCola] = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function loadPool() {
    setLoadingPool(true);
    setErrPool("");
    try {
      const res = await fetch(`/api/planeacion/programacion/empaque/pool?q=${encodeURIComponent(q.trim())}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "No se pudo cargar pool.");
      setPool((json.items || []) as PoolItem[]);
    } catch (e) {
      setErrPool(e instanceof Error ? e.message : "Error cargando pool.");
      setPool([]);
    } finally {
      setLoadingPool(false);
    }
  }

  async function loadCola() {
    setLoadingCola(true);
    setErrCola("");
    try {
      const res = await fetch(`/api/planeacion/programacion/empaque/cola`, { cache: "no-store" });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "No se pudo cargar cola.");
      setCola((json.items || []) as ColaItem[]);
    } catch (e) {
      setErrCola(e instanceof Error ? e.message : "Error cargando cola.");
      setCola([]);
    } finally {
      setLoadingCola(false);
    }
  }

  useEffect(() => {
    loadPool();
    loadCola();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enEmpaque = useMemo(() => cola.find((x) => x.estado === "En empaque"), [cola]);

  async function addToCola(x: PoolItem) {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/planeacion/programacion/empaque/cola/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: x.tipo,
          codigo: x.codigo,
          totalUND: x.totalUND,
          items: x.items,
          usuario: "planeacion",
        }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "No se pudo agregar a empaque.");

      setMsg(`✅ ${x.tipo} ${x.codigo} agregada a Empaque.`);
      await Promise.all([loadCola(), loadPool()]);
      setTimeout(() => setMsg(""), 4000);
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : "Error agregando."}`);
    } finally {
      setSaving(false);
    }
  }

  async function move(codigo: string, tipo: "OPE" | "OTE", dir: "up" | "down") {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/planeacion/programacion/empaque/cola/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, tipo, dir }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "No se pudo mover.");
      await loadCola();
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : "Error moviendo."}`);
    } finally {
      setSaving(false);
    }
  }

  async function setEstado(codigo: string, tipo: "OPE" | "OTE", estado: "En cola" | "En empaque" | "Empacado") {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/planeacion/programacion/empaque/estado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, tipo, estado }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "No se pudo cambiar estado.");
      await loadCola();
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : "Error cambiando estado."}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Planeación · Programación · Empaque</h1>
          <p className="text-sm text-slate-500">
            Embudo único de <b>OPE Producida</b> + <b>OTE Generada</b>. Se trabaja <b>uno a la vez</b>.
          </p>
        </div>

        <button
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          onClick={() => router.push("/planeacion/programacion")}
          type="button"
        >
          ← Volver
        </button>
      </div>

      {/* Tabs */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex gap-2">
          <button
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              tab === "pool" ? "bg-indigo-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
            onClick={() => setTab("pool")}
            type="button"
          >
            Agregar a Empaque
          </button>
          <button
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              tab === "cola" ? "bg-indigo-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
            onClick={() => setTab("cola")}
            type="button"
          >
            Ver programación
          </button>
        </div>
      </section>

      {msg && <div className="mt-3 text-sm">{msg}</div>}

      {/* TAB: POOL */}
      {tab === "pool" && (
        <>
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full md:w-[520px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Buscar OPE/OTE…"
              />
              <button
                onClick={loadPool}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                disabled={loadingPool}
                type="button"
              >
                {loadingPool ? "Cargando…" : "Buscar"}
              </button>

              <div className="flex-1" />

              <button
                onClick={loadCola}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                disabled={loadingCola}
                type="button"
              >
                {loadingCola ? "Actualizando…" : "Actualizar cola"}
              </button>
            </div>

            {errPool && <p className="mt-2 text-sm text-rose-600">{errPool}</p>}
            {enEmpaque && (
              <p className="mt-2 text-xs text-slate-600">
                En empaque ahora:{" "}
                <b>
                  {enEmpaque.tipo} {enEmpaque.codigo}
                </b>
              </p>
            )}
          </section>

          <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium">Código</th>
                    <th className="px-4 py-3 text-right font-medium">Ítems</th>
                    <th className="px-4 py-3 text-right font-medium">UND</th>
                    <th className="px-4 py-3 text-left font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingPool && (
                    <tr>
                      <td className="px-4 py-4 text-slate-500" colSpan={5}>
                        Cargando…
                      </td>
                    </tr>
                  )}

                  {!loadingPool && pool.length === 0 && (
                    <tr>
                      <td className="px-4 py-4 text-slate-500" colSpan={5}>
                        No hay OPE <b>Producida</b> ni OTE <b>Generada</b> para empaque.
                      </td>
                    </tr>
                  )}

                  {!loadingPool &&
                    pool.map((x) => (
                      <tr key={`${x.tipo}-${x.codigo}`} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeTipo(x.tipo)}`}>
                            {x.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold">{x.codigo}</td>
                        <td className="px-4 py-3 text-right">{x.items}</td>
                        <td className="px-4 py-3 text-right font-semibold">{toNum(x.totalUND).toLocaleString("es-CO")}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => addToCola(x)}
                            disabled={saving}
                            className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {saving ? "Guardando…" : "Agregar a empaque"}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
              Pool = OPE con estado <b>Producida</b> + OTE con estado <b>Generada</b>.
              Al agregar, se inserta en <b>ProgramacionEmpaque</b> como <b>En cola</b>.
            </div>
          </section>
        </>
      )}

      {/* TAB: COLA */}
      {tab === "cola" && (
        <>
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-semibold text-slate-800">Cola de empaque</div>
                <div className="mt-1 text-xs text-slate-500">Orden = prioridad. Solo 1 puede estar “En empaque”.</div>
              </div>
              <button
                type="button"
                onClick={loadCola}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                disabled={loadingCola}
              >
                {loadingCola ? "Actualizando…" : "Actualizar"}
              </button>
            </div>
            {errCola && <p className="mt-2 text-sm text-rose-600">{errCola}</p>}
          </section>

          <section className="mt-4 space-y-3">
            {loadingCola ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                Cargando…
              </div>
            ) : cola.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                No hay nada en cola de empaque.
              </div>
            ) : (
              cola.map((x, idx) => (
                <div key={x.empaqueItemId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">pos {x.pos}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeTipo(x.tipo)}`}>
                          {x.tipo}
                        </span>
                        <div className="text-base font-semibold">{x.codigo}</div>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                          {x.estado || "En cola"}
                        </span>
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                          UND {toNum(x.totalUND).toLocaleString("es-CO")}
                        </span>
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                          {x.items} ítems
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {x.usuario ? `usuario: ${x.usuario}` : ""} {x.fechaCreacion ? ` · ${x.fechaCreacion}` : ""}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => move(x.codigo, x.tipo, "up")}
                        disabled={saving || idx === 0}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40"
                      >
                        ↑ Subir
                      </button>
                      <button
                        type="button"
                        onClick={() => move(x.codigo, x.tipo, "down")}
                        disabled={saving || idx === cola.length - 1}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40"
                      >
                        ↓ Bajar
                      </button>

                      <button
                        type="button"
                        onClick={() => setEstado(x.codigo, x.tipo, "En empaque")}
                        disabled={saving}
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        ▶ Iniciar
                      </button>

                      <button
                        type="button"
                        onClick={() => setEstado(x.codigo, x.tipo, "Empacado")}
                        disabled={saving}
                        className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                      >
                        ✔ Finalizar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>
        </>
      )}
    </main>
  );
}
