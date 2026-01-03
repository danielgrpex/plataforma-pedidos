// app/planeacion/pedido/[pedidoKey]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type DestinoItem = "Almacén" | "Corte" | "Producción";

type OpcionInv = {
  inventarioId: string;
  almacen?: string;
  productoTexto?: string;
  descripcion?: string;
  disponibleUnd?: number;
  disponibleM?: number;
  largo?: number;
  acabados?: string;
  matchType?: "exact" | "compatible";
};

type Pedido = {
  pedidoKey: string;
  consecutivo: string;
  cliente: string;
  oc: string;
  direccion: string;
  fechaRequerida: string;

  clasificacionPlaneacion: string;
  observacionesPlaneacion: string;

  items: Array<{
    rowIndex1Based: number;
    productoKey: string;
    producto: string;
    cantidadUnd: string;
    cantidadM: string;

    inventarioDisponibleExactoUnd: number;
    inventarioDisponibleCompatibleUnd: number;

    opcionesInventario: {
      "Almacén": OpcionInv[];
      "Corte": OpcionInv[];
      "Producción": OpcionInv[];
    };
  }>;
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

function formatESDate(isoOrYmd?: string) {
  if (!isoOrYmd) return "";
  const d = new Date(isoOrYmd);
  if (isNaN(d.getTime())) return isoOrYmd;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

// ✅ Para Sheets (USER_ENTERED): mejor dd/MM/yyyy
function toSheetsDate(ymd?: string) {
  if (!ymd) return "";
  // input type="date" => YYYY-MM-DD
  const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return formatESDate(ymd);
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

export default function PlaneacionPedidoPage() {
  const router = useRouter();
  const params = useParams<{ pedidoKey: string }>();
  const pedidoKey = decodeURIComponent(params.pedidoKey || "");

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);

  // cabecera
  const [obs, setObs] = useState("");

  // fechas por ítem (YYYY-MM-DD)
  const [fechaAlmacen, setFechaAlmacen] = useState<Record<string, string>>({});
  const [fechaDespacho, setFechaDespacho] = useState<Record<string, string>>({});

  // reservas por item y por inventarioId
  const [reservasByItem, setReservasByItem] = useState<
    Record<string, Record<string, number>>
  >({});

  // destino por ítem
  const [destinos, setDestinos] = useState<Record<string, DestinoItem>>({});

  async function load() {
    setLoading(true);

    const res = await fetch(
      `/api/planeacion/pedido?pedidoKey=${encodeURIComponent(pedidoKey)}`,
      { cache: "no-store" }
    );
    const json = await res.json();

    if (!json?.success) {
      setLoading(false);
      alert(json?.message || "Error cargando pedido");
      return;
    }

    const ped = json.pedido as Pedido;
    setPedido(ped);
    setObs((ped?.observacionesPlaneacion || "") as string);

    const initDest: Record<string, DestinoItem> = {};
    const initRes: Record<string, Record<string, number>> = {};
    const initFA: Record<string, string> = {};
    const initFD: Record<string, string> = {};

    (ped?.items || []).forEach((it, idx) => {
      const uid = `${it.rowIndex1Based || "X"}-${it.productoKey || "PK"}-${idx}`;
      initDest[uid] = "Almacén";
      initRes[uid] = {};
      initFA[uid] = "";
      initFD[uid] = "";
    });

    setDestinos(initDest);
    setReservasByItem(initRes);
    setFechaAlmacen(initFA);
    setFechaDespacho(initFD);

    setLoading(false);
  }

  useEffect(() => {
    if (pedidoKey) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoKey]);

  function optionLabel(op: OpcionInv) {
    const base = (op.descripcion || op.productoTexto || "").trim();
    const disp = op.disponibleUnd ?? 0;
    const alm = (op.almacen || "").trim();
    const tag = op.matchType === "compatible" ? "Compatible" : "Exacto";
    const largoTxt =
      typeof op.largo === "number" && !Number.isNaN(op.largo)
        ? ` — largo: ${op.largo}`
        : "";
    return `${tag} — ${base || op.inventarioId}${alm ? ` — ${alm}` : ""}${largoTxt} — disp: ${disp}`;
  }

  function totalReservado(uid: string) {
    const m = reservasByItem[uid] || {};
    return Object.values(m).reduce((acc, x) => acc + (Number(x) || 0), 0);
  }

  function setReserva(uid: string, inventarioId: string, qty: number) {
    setReservasByItem((prev) => {
      const cur = { ...(prev[uid] || {}) };
      const v = Math.max(0, Math.floor(Number(qty) || 0));
      if (v <= 0) delete cur[inventarioId];
      else cur[inventarioId] = v;
      return { ...prev, [uid]: cur };
    });
  }

  function onChangeDestino(uid: string, nuevo: DestinoItem, opciones: OpcionInv[]) {
    setDestinos((prev) => ({ ...prev, [uid]: nuevo }));

    setReservasByItem((prev) => {
      const cur = { ...(prev[uid] || {}) };

      if (nuevo === "Producción") {
        return { ...prev, [uid]: {} };
      }

      const allowed = new Set(opciones.map((o) => o.inventarioId));
      const filtered: Record<string, number> = {};
      Object.entries(cur).forEach(([invId, qty]) => {
        if (allowed.has(invId) && (Number(qty) || 0) > 0) {
          filtered[invId] = Math.floor(Number(qty));
        }
      });

      return { ...prev, [uid]: filtered };
    });
  }

  const computed = useMemo(() => {
    const items = pedido?.items || [];

    return items.map((it, idx) => {
      const uid = `${it.rowIndex1Based || "X"}-${it.productoKey || "PK"}-${idx}`;
      const solicitada = toNumber(it.cantidadUnd);
      const destino = destinos[uid] || "Almacén";

      const disponibleTotal =
        destino === "Almacén"
          ? it.inventarioDisponibleExactoUnd || 0
          : destino === "Corte"
          ? it.inventarioDisponibleCompatibleUnd || 0
          : 0;

      const opciones = it.opcionesInventario?.[destino] || [];

      const reservado = totalReservado(uid);
      const reservarCapped = Math.max(0, Math.min(reservado, solicitada));
      const producir = Math.max(0, solicitada - reservarCapped);

      return {
        ...it,
        uid,
        solicitada,
        destino,
        disponibleTotal,
        opciones,
        reservado,
        reservarCapped,
        producir,
        fechaEstimadaAlmacen: fechaAlmacen[uid] || "",
        fechaEstimadaDespacho: fechaDespacho[uid] || "",
      };
    });
  }, [pedido, destinos, reservasByItem, fechaAlmacen, fechaDespacho]);

  // ✅✅✅ AQUÍ ESTÁ EL FIX: mandar fechas + reservas[] por item
  async function guardar() {
    if (!pedido) return;

    const payload = {
      pedidoKey: pedido.pedidoKey,
      observacionesPlaneacion: obs || "",
      usuario: "planeacion",
      items: computed.map((x) => {
        const m = reservasByItem[x.uid] || {};
        const reservas = Object.entries(m)
          .map(([inventarioId, cantidadUnd]) => ({
            inventarioId,
            cantidadUnd: Math.max(0, Math.floor(Number(cantidadUnd) || 0)),
          }))
          .filter((r) => r.inventarioId && r.cantidadUnd > 0);

        return {
          rowIndex1Based: x.rowIndex1Based || 0,
          productoKey: x.productoKey,
          destino: x.destino,
          fechas: {
            entregaAlmacen: toSheetsDate(fechaAlmacen[x.uid] || ""),
            despacho: toSheetsDate(fechaDespacho[x.uid] || ""),
          },
          // Producción no crea movimientos, pero igual manda reservas vacío (ok)
          reservas: x.destino === "Producción" ? [] : reservas,
        };
      }),
    };

    const res = await fetch("/api/planeacion/pedido/guardar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!json?.success) return alert(json?.message || "Error guardando planeación");

    alert(
      `Planeación guardada ✅\nMovimientos creados: ${json.movimientosCreados ?? "?"}`
    );
    router.push("/planeacion");
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <button
        className="mb-4 text-sm text-slate-500 hover:text-slate-700"
        type="button"
        onClick={() => router.push("/planeacion")}
      >
        ← Volver
      </button>

      {loading && <p className="text-sm text-slate-500">Cargando…</p>}

      {!loading && pedido && (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Clasificar pedido</h1>
              <p className="text-sm text-slate-500">
                {pedido.consecutivo} — {pedido.cliente} — OC {pedido.oc}
              </p>
              <p className="text-xs text-slate-400 break-all">
                pedidoKey: {pedido.pedidoKey}
              </p>
            </div>

            <button
              onClick={guardar}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Guardar planeación
            </button>
          </div>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="block text-xs font-medium mb-1 text-slate-600">
              Observaciones planeación
            </label>
            <input
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Notas de inventario / prioridad / aclaraciones…"
            />
          </section>

          <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="text-base font-semibold">Items + inventario + opciones</h2>
              <p className="mt-1 text-xs text-slate-500">
                Ahora puedes <b>dividir reservas</b> entre varios lotes (inventarioId). Producción no usa inventario.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Producto</th>
                    <th className="px-4 py-3 text-left font-medium">Destino</th>
                    <th className="px-4 py-3 text-right font-medium">Solicitado</th>
                    <th className="px-4 py-3 text-right font-medium">Disponible</th>
                    <th className="px-4 py-3 text-left font-medium">Fechas (por ítem)</th>
                    <th className="px-4 py-3 text-left font-medium">Reservas por lote</th>
                    <th className="px-4 py-3 text-right font-medium">Reservado</th>
                    <th className="px-4 py-3 text-right font-medium">Producir</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {computed.map((it) => {
                    const uid = it.uid;
                    const opciones = it.opciones || [];

                    return (
                      <tr key={uid} className="hover:bg-slate-50 align-top">
                        <td className="px-4 py-3 whitespace-pre-wrap">
                          <div className="font-medium">{it.producto || "—"}</div>
                          <div className="text-xs text-slate-400 break-all">{it.productoKey}</div>
                        </td>

                        <td className="px-4 py-3">
                          <select
                            value={destinos[uid] || "Almacén"}
                            onChange={(e) => {
                              const nuevo = e.target.value as DestinoItem;
                              const nextOpts =
                                pedido?.items?.find((x, idx2) => {
                                  const uid2 = `${x.rowIndex1Based || "X"}-${x.productoKey || "PK"}-${idx2}`;
                                  return uid2 === uid;
                                })?.opcionesInventario?.[nuevo] || [];

                              onChangeDestino(uid, nuevo, nextOpts);
                            }}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          >
                            <option value="Almacén">Almacén</option>
                            <option value="Corte">Corte</option>
                            <option value="Producción">Producción</option>
                          </select>

                          <div className="mt-2 text-xs text-slate-500">
                            {it.destino === "Producción"
                              ? "Producción = sin inventario."
                              : it.destino === "Almacén"
                              ? "Almacén = Exacto (incluye acabados)."
                              : "Corte = Compatible (ignora acabados, largo ≥ requerido)."}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-right font-medium">{it.solicitada}</td>

                        <td className="px-4 py-3 text-right font-medium">
                          {it.destino === "Producción"
                            ? "—"
                            : (it.disponibleTotal?.toLocaleString("es-CO") ?? 0)}
                          {it.destino !== "Producción" && (
                            <div className="mt-1 text-[11px] text-slate-500">
                              {it.destino === "Almacén" ? (
                                <>Exacto: <b>{(it.inventarioDisponibleExactoUnd || 0).toLocaleString("es-CO")}</b></>
                              ) : (
                                <>Compatible: <b>{(it.inventarioDisponibleCompatibleUnd || 0).toLocaleString("es-CO")}</b></>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="grid gap-2 min-w-[260px]">
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                Fecha est. entrega a Almacén
                              </label>
                              <input
                                type="date"
                                value={fechaAlmacen[uid] || ""}
                                onChange={(e) =>
                                  setFechaAlmacen((prev) => ({ ...prev, [uid]: e.target.value }))
                                }
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                              />
                              <div className="mt-1 text-[11px] text-slate-500">
                                {fechaAlmacen[uid] ? `(${formatESDate(fechaAlmacen[uid])})` : "—"}
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                Fecha est. despacho
                              </label>
                              <input
                                type="date"
                                value={fechaDespacho[uid] || ""}
                                onChange={(e) =>
                                  setFechaDespacho((prev) => ({ ...prev, [uid]: e.target.value }))
                                }
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                              />
                              <div className="mt-1 text-[11px] text-slate-500">
                                {fechaDespacho[uid] ? `(${formatESDate(fechaDespacho[uid])})` : "—"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          {it.destino === "Producción" ? (
                            <div className="text-sm text-slate-400">Sin inventario</div>
                          ) : opciones.length === 0 ? (
                            <div className="text-sm text-slate-500">
                              Sin opciones de inventario para este destino.
                            </div>
                          ) : (
                            <div className="min-w-[520px] space-y-2">
                              {opciones.map((op) => {
                                const disp = Math.max(0, Math.floor(Number(op.disponibleUnd ?? 0)));
                                const current = reservasByItem[uid]?.[op.inventarioId] ?? 0;

                                const falta = Math.max(
                                  0,
                                  it.solicitada - totalReservado(uid) + current
                                );
                                const maxSug = Math.min(disp, falta);

                                return (
                                  <div
                                    key={op.inventarioId}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                                  >
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-medium">
                                        {optionLabel(op)}
                                      </div>
                                      <div className="text-[11px] text-slate-500">
                                        invId: <span className="font-mono">{op.inventarioId}</span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={current}
                                        onChange={(e) => {
                                          const v = Number(e.target.value || 0);
                                          setReserva(uid, op.inventarioId, Math.min(v, disp));
                                        }}
                                        className="w-24 rounded-xl border border-slate-300 px-2 py-1 text-right"
                                      />

                                      <button
                                        type="button"
                                        className="rounded-xl border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                                        onClick={() => setReserva(uid, op.inventarioId, maxSug)}
                                        title="Autocompletar con lo que falta (limitado por disponible)"
                                      >
                                        Llenar
                                      </button>

                                      <button
                                        type="button"
                                        className="rounded-xl border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                                        onClick={() => setReserva(uid, op.inventarioId, 0)}
                                        title="Quitar este lote"
                                      >
                                        0
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}

                              <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                Total reservado:{" "}
                                <b>{Math.min(totalReservado(uid), it.solicitada).toLocaleString("es-CO")}</b> /{" "}
                                {it.solicitada.toLocaleString("es-CO")}
                                {totalReservado(uid) >= it.solicitada ? (
                                  <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                                    ✅ Cubierto
                                  </span>
                                ) : (
                                  <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                                    ⚠ Falta{" "}
                                    {Math.max(0, it.solicitada - totalReservado(uid)).toLocaleString("es-CO")}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right font-semibold">
                          {Math.min(it.reservado, it.solicitada).toLocaleString("es-CO")}
                        </td>

                        <td className="px-4 py-3 text-right font-semibold">
                          {it.producir.toLocaleString("es-CO")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
              Nota: ahora puedes repartir “Reservar” entre varios lotes (cada lote = un movimiento en{" "}
              <b>MovimientosInventario</b>). <br />
              <b>Almacén</b> = Exacto (incluye acabados). <b>Corte</b> = Compatible (ignora acabados).{" "}
              <b>Producción</b> = sin inventario. <br />
              Fechas estimadas son <b>por ítem</b> y se guardan en <b>Pedidos</b>.
            </div>
          </section>
        </>
      )}
    </main>
  );
}

