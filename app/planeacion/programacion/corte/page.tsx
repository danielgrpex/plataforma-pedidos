// app/planeacion/programacion/corte/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type SolicitudCorte = {
  solicitudCorteId: string;
  pedidoKey: string;
  rowIndexPedido: string; // viene como texto desde Sheets
  productoSolicitado: string;
  cantidadSolicitadaUnd: string;

  inventarioOrigenId?: string;
  productoOrigen?: string;
  largoOrigen?: string;
  cantidadOrigenUnd?: string;
  largoFinal?: string;

  actividades?: string;
  cantidadResultanteUnd?: string;

  estadoitem: string; // Pendiente | Programado | ...
  fechaCreacion?: string;
  usuario?: string;
  OTE?: string;
};

function toNumber(v?: string) {
  if (!v) return 0;
  const s = String(v)
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatFechaColombia(value?: string) {
  if (!value) return "—";

  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const date = new Date(y, mo - 1, d);
    const day = String(date.getDate()).padStart(2, "0");
    const month = date
      .toLocaleDateString("es-CO", { month: "short" })
      .replace(".", "")
      .replace(/^\w/, (c) => c.toUpperCase());
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  const d2 = new Date(value);
  if (!Number.isNaN(d2.getTime())) {
    const day = String(d2.getDate()).padStart(2, "0");
    const month = d2
      .toLocaleDateString("es-CO", { month: "short" })
      .replace(".", "")
      .replace(/^\w/, (c) => c.toUpperCase());
    const year = d2.getFullYear();
    return `${day}-${month}-${year}`;
  }

  return value;
}

export default function PlaneacionProgramacionCortePage() {
  const [items, setItems] = useState<SolicitudCorte[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadCorte() {
    setErr("");
    setMsg("");
    setLoading(true);

    try {
      const url = `/api/planeacion/programacion/corte/solicitudes?estado=Pendiente&q=${encodeURIComponent(
        q.trim()
      )}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "No se pudieron cargar las solicitudes de corte.");
      }

      const list = (json.items || []) as SolicitudCorte[];
      setItems(list);

      // mantener selección solo para ids existentes
      setSelected((prev) => {
        const next: Record<string, boolean> = {};
        const allow = new Set(list.map((x) => x.solicitudCorteId));
        Object.entries(prev).forEach(([id, v]) => {
          if (allow.has(id) && v) next[id] = true;
        });
        return next;
      });
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Error cargando solicitudes de corte.");
      setItems([]);
      setSelected({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCorte();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  const selectedRows = useMemo(() => {
    const map = new Map(items.map((x) => [x.solicitudCorteId, x]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean) as SolicitudCorte[];
  }, [items, selectedIds]);

  const totalSelectedUND = useMemo(() => {
    return selectedRows.reduce((acc, x) => acc + toNumber(x.cantidadSolicitadaUnd), 0);
  }, [selectedRows]);

  const agrupadoPorProducto = useMemo(() => {
    const m = new Map<string, { productoSolicitado: string; und: number; count: number }>();
    for (const s of selectedRows) {
      const key = (s.productoSolicitado || "—").trim();
      const cur = m.get(key) || { productoSolicitado: key, und: 0, count: 0 };
      cur.und += toNumber(s.cantidadSolicitadaUnd);
      cur.count += 1;
      m.set(key, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.und - a.und);
  }, [selectedRows]);

  const allChecked = useMemo(() => {
    if (!items.length) return false;
    return items.every((x) => selected[x.solicitudCorteId]);
  }, [items, selected]);

  function toggleAll() {
    if (!items.length) return;
    setSelected((prev) => {
      const next: Record<string, boolean> = { ...prev };
      if (allChecked) {
        items.forEach((x) => delete next[x.solicitudCorteId]);
      } else {
        items.forEach((x) => (next[x.solicitudCorteId] = true));
      }
      return next;
    });
  }

  async function crearOTE() {
    setErr("");
    setMsg("");

    if (!selectedIds.length) {
      setErr("Selecciona al menos 1 solicitud.");
      return;
    }

    try {
      setCreating(true);
      setMsg("Creando OTE…");

      const res = await fetch("/api/planeacion/programacion/corte/ote/crear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudCorteIds: selectedIds,
          usuario: "planeacion",
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "No se pudo crear la OTE.");
      }

      const ote = String(json.ote || "").trim();
      setMsg(ote ? `✅ OTE creada: ${ote}` : "✅ OTE creada.");

      await loadCorte();
      setSelected({});
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Error creando OTE.");
    } finally {
      setCreating(false);
      setTimeout(() => setMsg(""), 5000);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Planeación · Programación · Corte</h1>
          <p className="text-sm text-slate-500">
            Aquí listamos <b>SolicitudesCorte</b> en estado <b>Pendiente</b> y creamos <b>OTE</b>.
          </p>
        </div>

        <Link
          href="/planeacion/programacion"
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          ← Volver
        </Link>
      </div>

      {/* Buscador + acción */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full md:w-[520px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Buscar por pedidoKey, productoSolicitado, inventarioOrigenId, OTE, estado…"
          />
          <button
            onClick={loadCorte}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            disabled={loading}
            type="button"
          >
            {loading ? "Cargando…" : "Buscar"}
          </button>

          <div className="flex-1" />

          <button
            onClick={crearOTE}
            disabled={creating || !selectedIds.length}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            title="Crear OTE para las solicitudes seleccionadas"
            type="button"
          >
            {creating ? "Creando…" : `Crear OTE (${selectedIds.length})`}
          </button>
        </div>

        {(msg || err) && (
          <div className="mt-3">
            {msg && <p className="text-xs text-emerald-600">{msg}</p>}
            {err && <p className="text-xs text-red-500">{err}</p>}
          </div>
        )}
      </section>

      {/* Resumen selección */}
      <section className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold">Selección actual</div>
          <div className="mt-2 text-sm text-slate-600">
            Ítems: <b>{selectedIds.length}</b>
          </div>
          <div className="text-sm text-slate-600">
            Total UND: <b>{totalSelectedUND.toLocaleString("es-CO")}</b>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Nota: al crear OTE, todos los ítems seleccionados quedan con el mismo consecutivo (ej:{" "}
            <b>OTE260001</b>).
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold">Agrupado por productoSolicitado</div>
          {selectedIds.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Selecciona ítems para ver el resumen.</p>
          ) : (
            <div className="mt-2 max-h-[160px] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-1 text-left font-medium">Producto</th>
                    <th className="py-1 text-right font-medium">UND</th>
                    <th className="py-1 text-right font-medium">Ítems</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agrupadoPorProducto.map((x) => (
                    <tr key={x.productoSolicitado}>
                      <td className="py-1 pr-3">
                        <span className="font-mono text-[12px]">{x.productoSolicitado}</span>
                      </td>
                      <td className="py-1 text-right font-semibold">
                        {x.und.toLocaleString("es-CO")}
                      </td>
                      <td className="py-1 text-right">{x.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Tabla */}
      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      disabled={!items.length}
                    />
                    <span>Sel</span>
                  </div>
                </th>
                <th className="px-4 py-3 text-left font-medium">Solicitud</th>
                <th className="px-4 py-3 text-left font-medium">Pedido</th>
                <th className="px-4 py-3 text-left font-medium">Producto (solicitado)</th>
                <th className="px-4 py-3 text-right font-medium">UND</th>
                <th className="px-4 py-3 text-left font-medium">Origen</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="px-4 py-3 text-left font-medium">OTE</th>
                <th className="px-4 py-3 text-left font-medium">Actualización</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-4 text-slate-500">
                    Cargando…
                  </td>
                </tr>
              )}

              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-4 text-slate-500">
                    No hay solicitudes de corte en estado <b>Pendiente</b>.
                  </td>
                </tr>
              )}

              {!loading &&
                items.map((s) => (
                  <tr key={s.solicitudCorteId} className="hover:bg-slate-50 align-top">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[s.solicitudCorteId])}
                        onChange={(e) =>
                          setSelected((prev) => ({
                            ...prev,
                            [s.solicitudCorteId]: e.target.checked,
                          }))
                        }
                      />
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium">{s.solicitudCorteId}</div>
                      <div className="text-xs text-slate-400">
                        row Pedido: <b>{s.rowIndexPedido || "—"}</b>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium break-all">{s.pedidoKey}</div>
                      <Link
                        className="text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-700"
                        href={`/planeacion/pedido/${encodeURIComponent(s.pedidoKey)}`}
                        title="Abrir pedido"
                      >
                        Ver pedido
                      </Link>
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-mono text-[12px]">
                        {s.productoSolicitado || "—"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right font-semibold">
                      {toNumber(s.cantidadSolicitadaUnd).toLocaleString("es-CO")}
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-600">
                      <div>
                        Inv: <b>{s.inventarioOrigenId || "—"}</b>
                      </div>
                      <div className="text-slate-500">
                        {s.productoOrigen ? `Prod: ${s.productoOrigen}` : "Prod: —"}
                      </div>
                      <div className="text-slate-500">
                        {s.largoOrigen ? `Largo: ${s.largoOrigen}` : "Largo: —"}
                      </div>
                    </td>

                    <td className="px-4 py-3">{s.estadoitem || "—"}</td>

                    <td className="px-4 py-3">
                      {s.OTE ? (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                          {s.OTE}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-500">
                      <div>Creación: {formatFechaColombia(s.fechaCreacion)}</div>
                      <div>Usuario: {s.usuario || "—"}</div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
          Esta tabla lee <b>SolicitudesCorte</b> filtrando <b>estadoitem=Pendiente</b>. Al crear OTE se actualiza la
          columna <b>OTE</b> y el estado a <b>Programado</b> para los ítems seleccionados.
        </div>
      </section>
    </main>
  );
}
