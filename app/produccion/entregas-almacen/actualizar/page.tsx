//app/produccion/entregas-almacen/actualizar/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ProdItem = {
  rowIndex: number;
  OPE: string;
  productoKey: string;
  cantidadUND: any;
  rowIndexPedido: any;
  estado: string;
};

type CorteItem = {
  rowIndex: number;
  OTE: string;
  productoSolicitado: string;
  cantidadSolicitadaUnd: any;
  rowIndexPedido: any;
  estadoitem: string;
};

async function safeJsonFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function ActualizarEstadoPage() {
  const router = useRouter();

  const [prod, setProd] = useState<ProdItem[]>([]);
  const [corte, setCorte] = useState<CorteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // selección producción
  const [ope, setOpe] = useState("");
  const [prodItemRow, setProdItemRow] = useState<number | "">("");
  const [nuevoEstadoProd, setNuevoEstadoProd] = useState<"Producido" | "Empacado">("Producido");

  // selección corte
  const [ote, setOte] = useState("");
  const [corteItemRow, setCorteItemRow] = useState<number | "">("");

  const opes = useMemo(() => Array.from(new Set(prod.map((x) => x.OPE))).filter(Boolean), [prod]);
  const otes = useMemo(() => Array.from(new Set(corte.map((x) => x.OTE))).filter(Boolean), [corte]);

  const prodItemsOpe = useMemo(() => prod.filter((x) => x.OPE === ope), [prod, ope]);
  const corteItemsOte = useMemo(() => corte.filter((x) => x.OTE === ote), [corte, ote]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const [p, c] = await Promise.all([
        safeJsonFetch<ProdItem[]>("/api/produccion/entregas-almacen/produccion/en-cola"),
        safeJsonFetch<CorteItem[]>("/api/produccion/entregas-almacen/corte/generadas"),
      ]);
      if (!mounted) return;
      setProd(p ?? []);
      setCorte(c ?? []);
      setLoading(false);
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const actualizarProd = async () => {
    setMsg(null); setErr(null);
    if (!prodItemRow) return setErr("Selecciona un item de producción.");
    const res = await fetch("/api/produccion/entregas-almacen/produccion/actualizar-estado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rowIndex: prodItemRow, nuevoEstado: nuevoEstadoProd }),
    });
    const j = await res.json();
    if (!res.ok) return setErr(j?.error ?? "No se pudo actualizar.");
    setMsg("✅ Estado actualizado.");
    // refrescar
    const p = await safeJsonFetch<ProdItem[]>("/api/produccion/entregas-almacen/produccion/en-cola");
    setProd(p ?? []);
    setProdItemRow("");
  };

  const actualizarCorte = async () => {
    setMsg(null); setErr(null);
    if (!corteItemRow) return setErr("Selecciona un item de corte.");
    const res = await fetch("/api/produccion/entregas-almacen/corte/actualizar-estado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rowIndex: corteItemRow }),
    });
    const j = await res.json();
    if (!res.ok) return setErr(j?.error ?? "No se pudo actualizar.");
    setMsg("✅ Corte marcado como Empacado.");
    const c = await safeJsonFetch<CorteItem[]>("/api/produccion/entregas-almacen/corte/generadas");
    setCorte(c ?? []);
    setCorteItemRow("");
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Actualizar Estado</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Producción (OPE en cola) y Corte (OTE generada) item por item.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/produccion/entregas-almacen")}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-neutral-50"
          >
            Volver
          </button>
        </div>

        <div className="space-y-4">
          {(msg || err) && (
            <div
              className={[
                "rounded-xl border px-4 py-3 text-sm",
                err ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900",
              ].join(" ")}
            >
              {err ?? msg}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {/* Producción */}
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 p-5">
              <h2 className="text-base font-semibold">Producción (OPE)</h2>
              <p className="mt-1 text-xs text-neutral-600">Estado actual: En cola</p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">OPE</label>
                  <select
                    value={ope}
                    onChange={(e) => {
                      setOpe(e.target.value);
                      setProdItemRow("");
                    }}
                    className={inputCls}
                    disabled={loading}
                  >
                    <option value="">Selecciona…</option>
                    {opes.map((x) => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Item</label>
                  <select
                    value={prodItemRow}
                    onChange={(e) => setProdItemRow(e.target.value ? Number(e.target.value) : "")}
                    className={inputCls}
                    disabled={loading || !ope}
                  >
                    <option value="">Selecciona…</option>
                    {prodItemsOpe.map((it) => (
                      <option key={it.rowIndex} value={it.rowIndex}>
                        {it.productoKey} — {it.cantidadUND} UND — rowPedido {it.rowIndexPedido}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Nuevo estado</label>
                  <select
                    value={nuevoEstadoProd}
                    onChange={(e) => setNuevoEstadoProd(e.target.value as any)}
                    className={inputCls}
                    disabled={!ope}
                  >
                    <option value="Producido">Producido</option>
                    <option value="Empacado">Empacado</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={actualizarProd}
                  className="w-full rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                  disabled={loading}
                >
                  Actualizar item
                </button>
              </div>
            </div>

            {/* Corte */}
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 p-5">
              <h2 className="text-base font-semibold">Corte (OTE)</h2>
              <p className="mt-1 text-xs text-neutral-600">Estado actual: Generada → Empacado</p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">OTE</label>
                  <select
                    value={ote}
                    onChange={(e) => {
                      setOte(e.target.value);
                      setCorteItemRow("");
                    }}
                    className={inputCls}
                    disabled={loading}
                  >
                    <option value="">Selecciona…</option>
                    {otes.map((x) => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Item</label>
                  <select
                    value={corteItemRow}
                    onChange={(e) => setCorteItemRow(e.target.value ? Number(e.target.value) : "")}
                    className={inputCls}
                    disabled={loading || !ote}
                  >
                    <option value="">Selecciona…</option>
                    {corteItemsOte.map((it) => (
                      <option key={it.rowIndex} value={it.rowIndex}>
                        {it.productoSolicitado} — {it.cantidadSolicitadaUnd} UND — rowPedido {it.rowIndexPedido}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={actualizarCorte}
                  className="w-full rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                  disabled={loading}
                >
                  Marcar Empacado
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10";
