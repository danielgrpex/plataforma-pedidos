"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type OpeResumen = {
  ope: string;
  estado: string;
  items: number;
  totalUND: number;
};

type ProgRow = {
  progId: string;
  ope: string;
  linea: number;
  posicion: number;
  estado: string;
  fechaCreacion: string;
  fechaUltActualizacion: string;
  usuario: string;
};

type LineasMap = Record<string, ProgRow[]>;

function fmtIso(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-CO");
}

export default function PlaneacionProgramacionProduccionPage() {
  const [tab, setTab] = useState<"programar" | "ver">("programar");

  // Programar
  const [opes, setOpes] = useState<OpeResumen[]>([]);
  const [q, setQ] = useState("");
  const [selectedOpe, setSelectedOpe] = useState("");
  const [linea, setLinea] = useState<number>(1);
  const [loadingOpes, setLoadingOpes] = useState(false);
  const [msg, setMsg] = useState<string>("");

  // Ver colas
  const [colas, setColas] = useState<LineasMap>({});
  const [loadingColas, setLoadingColas] = useState(false);

  async function loadOpes() {
    setLoadingOpes(true);
    setMsg("");

    const res = await fetch(
      `/api/planeacion/programacion/produccion/opes/list?estado=Programado&q=${encodeURIComponent(q.trim())}`,
      { cache: "no-store" }
    );
    const json = await res.json();
    setOpes((json.items || []) as OpeResumen[]);
    setLoadingOpes(false);
  }

  async function loadColas() {
    setLoadingColas(true);
    const res = await fetch(`/api/planeacion/programacion/produccion/cola`, { cache: "no-store" });
    const json = await res.json();
    setColas((json.lineas || {}) as LineasMap);
    setLoadingColas(false);
  }

  useEffect(() => {
    loadOpes();
    loadColas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedOpeInfo = useMemo(
    () => opes.find((x) => x.ope === selectedOpe),
    [opes, selectedOpe]
  );

  async function programarOpe() {
    if (!selectedOpe) return setMsg("Selecciona una OPE.");
    setMsg("");

    const res = await fetch(`/api/planeacion/programacion/produccion/cola`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ope: selectedOpe, linea, usuario: "planeacion" }),
    });

    const json = await res.json();
    if (!json?.success) {
      setMsg(json?.message || "No se pudo programar la OPE.");
      return;
    }

    setMsg(`✅ OPE ${selectedOpe} agregada a Línea ${linea} (pos ${json.posicion}).`);
    setSelectedOpe("");
    await loadColas();
  }

  async function marcarProducida(progId: string) {
    const res = await fetch(`/api/planeacion/programacion/produccion/cola`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progId, estado: "Producida", usuario: "produccion" }),
    });
    const json = await res.json();
    if (!json?.success) return alert(json?.message || "No se pudo actualizar");
    await loadColas();
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Planeación · Programación · Producción</h1>
          <p className="text-sm text-slate-500">
            Asigna una <b>OPE</b> a una <b>línea</b> y consulta la cola por línea.
          </p>
        </div>

        <Link
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          href="/planeacion/programacion"
        >
          ← Volver
        </Link>
      </div>

      {/* Tabs */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex gap-2">
          <button
            className={`rounded-xl px-4 py-2 text-sm ${
              tab === "programar" ? "bg-indigo-600 text-white" : "hover:bg-slate-50"
            }`}
            onClick={() => setTab("programar")}
          >
            Programar OPE
          </button>
          <button
            className={`rounded-xl px-4 py-2 text-sm ${
              tab === "ver" ? "bg-indigo-600 text-white" : "hover:bg-slate-50"
            }`}
            onClick={() => setTab("ver")}
          >
            Ver programación
          </button>
        </div>
      </section>

      {tab === "programar" && (
        <>
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Buscar OPE…"
              />
              <button
                onClick={loadOpes}
                disabled={loadingOpes}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
              >
                {loadingOpes ? "Cargando…" : "Buscar"}
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  OPE (estado Programado)
                </label>
                <select
                  value={selectedOpe}
                  onChange={(e) => setSelectedOpe(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— Selecciona una OPE —</option>
                  {opes.map((o) => (
                    <option key={o.ope} value={o.ope}>
                      {o.ope} — {o.items} ítems — UND {o.totalUND}
                    </option>
                  ))}
                </select>

                <div className="mt-2 text-xs text-slate-500">
                  {selectedOpeInfo ? (
                    <>
                      <b>{selectedOpeInfo.ope}</b> · ítems: {selectedOpeInfo.items} · UND:{" "}
                      {selectedOpeInfo.totalUND}
                    </>
                  ) : (
                    "Selecciona una OPE para ver el resumen."
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Línea</label>
                <select
                  value={linea}
                  onChange={(e) => setLinea(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      Línea {n}
                    </option>
                  ))}
                </select>

                <button
                  onClick={programarOpe}
                  className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Agregar a cola
                </button>

                {msg && <div className="mt-2 text-sm text-slate-700">{msg}</div>}
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Colas actuales (vista rápida)</h2>
              <button
                onClick={loadColas}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                {loadingColas ? "Actualizando…" : "Actualizar"}
              </button>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((n) => {
                const list = colas[String(n)] || [];
                return (
                  <div key={n} className="rounded-2xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">Línea {n}</div>
                      <div className="text-xs text-slate-500">{list.length} en cola</div>
                    </div>
                    <div className="mt-2 space-y-2">
                      {list.slice(0, 3).map((x) => (
                        <div key={x.progId} className="rounded-xl bg-slate-50 px-3 py-2 text-xs">
                          <div className="font-medium">{x.ope}</div>
                          <div className="text-slate-500">
                            pos {x.posicion} · {x.estado}
                          </div>
                        </div>
                      ))}
                      {list.length === 0 && <div className="text-xs text-slate-500">Sin programación.</div>}
                      {list.length > 3 && <div className="text-xs text-slate-500">…</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {tab === "ver" && (
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Programación por línea (solo activas)</h2>
            <button
              onClick={loadColas}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            >
              {loadingColas ? "Actualizando…" : "Actualizar"}
            </button>
          </div>

          <div className="mt-4 grid gap-4">
            {[1, 2, 3, 4, 5, 6].map((n) => {
              const list = colas[String(n)] || [];
              return (
                <div key={n} className="rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div>
                      <div className="font-semibold">Línea {n}</div>
                      <div className="text-xs text-slate-500">{list.length} OPE(s) activas</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Pos</th>
                          <th className="px-4 py-2 text-left font-medium">OPE</th>
                          <th className="px-4 py-2 text-left font-medium">Estado</th>
                          <th className="px-4 py-2 text-left font-medium">Creación</th>
                          <th className="px-4 py-2 text-left font-medium">Últ. act</th>
                          <th className="px-4 py-2 text-left font-medium">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {list.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-3 text-slate-500">
                              Sin OPEs en cola.
                            </td>
                          </tr>
                        )}
                        {list.map((x) => (
                          <tr key={x.progId} className="hover:bg-slate-50">
                            <td className="px-4 py-3">{x.posicion}</td>
                            <td className="px-4 py-3 font-medium">{x.ope}</td>
                            <td className="px-4 py-3">{x.estado}</td>
                            <td className="px-4 py-3 text-xs text-slate-600">{fmtIso(x.fechaCreacion)}</td>
                            <td className="px-4 py-3 text-xs text-slate-600">{fmtIso(x.fechaUltActualizacion)}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => marcarProducida(x.progId)}
                                className="rounded-xl border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
                              >
                                Marcar producida
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-4 py-3 text-xs text-slate-500">
                    Nota: al marcar una OPE como <b>Producida</b>, deja de mostrarse aquí.
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
