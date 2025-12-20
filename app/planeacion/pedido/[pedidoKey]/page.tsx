"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type DestinoItem = "Almacén" | "Corte" | "Producción";

type Pedido = {
  pedidoKey: string;
  consecutivo: string;
  cliente: string;
  oc: string;
  direccion: string;
  fechaRequerida: string;

  pdfPath?: string;

  clasificacionPlaneacion?: string;
  observacionesPlaneacion?: string;

  items: Array<{
    rowIndex1Based?: number;
    productoKey: string;
    producto: string;
    cantidadUnd: string;
    cantidadM: string;
    inventarioDisponibleUnd: number;
    inventarioDisponibleM: number;
  }>;
};

function toNumber(v?: string) {
  if (!v) return 0;
  const s = String(v).trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatFechaColombia(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;

  const day = d.getDate().toString().padStart(2, "0");
  const month = d
    .toLocaleDateString("es-CO", { month: "short" })
    .replace(".", "")
    .replace(/^\w/, (c) => c.toUpperCase());
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export default function PlaneacionPedidoPage() {
  const router = useRouter();
  const params = useParams<{ pedidoKey: string }>();
  const pedidoKey = decodeURIComponent(params.pedidoKey || "");

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [obs, setObs] = useState("");

  // ✅ state por UID (no por rowIndex)
  const [reservas, setReservas] = useState<Record<string, number>>({});
  const [destinos, setDestinos] = useState<Record<string, DestinoItem>>({});

  async function load() {
    setLoading(true);
    setErr("");

    try {
      const res = await fetch(
        `/api/planeacion/pedido?pedidoKey=${encodeURIComponent(pedidoKey)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || "No se pudo cargar el pedido");

      const ped = json.pedido as Pedido;
      setPedido(ped);
      setObs((ped?.observacionesPlaneacion || "") as string);

      // defaults por UID
      const initialReservas: Record<string, number> = {};
      const initialDestinos: Record<string, DestinoItem> = {};

      (ped?.items || []).forEach((it, idx) => {
        const uid = `${it.rowIndex1Based || "X"}-${it.productoKey || "PK"}-${idx}`;
        initialReservas[uid] = 0;
        initialDestinos[uid] = "Almacén";
      });

      setReservas(initialReservas);
      setDestinos(initialDestinos);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Error cargando pedido");
      setPedido(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (pedidoKey) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoKey]);

  async function verPdf(pdfPath?: string) {
    if (!pdfPath) return alert("Este pedido no tiene pdfPath guardado.");

    const res = await fetch("/api/comercial/pedidos/pdf-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfPath }),
    });

    const json = await res.json();
    if (!json?.success) return alert(json?.message || "No se pudo abrir el PDF");

    window.open(json.url, "_blank", "noopener,noreferrer");
  }

  const computed = useMemo(() => {
    const items = pedido?.items || [];
    return items.map((it, idx) => {
      const uid = `${it.rowIndex1Based || "X"}-${it.productoKey || "PK"}-${idx}`;

      const solicitada = toNumber(it.cantidadUnd);
      const disponible = it.inventarioDisponibleUnd || 0;

      const reservar = Math.max(0, Math.min(reservas[uid] || 0, disponible, solicitada));
      const producir = Math.max(0, solicitada - reservar);

      const destino = destinos[uid] || "Almacén";

      return { ...it, uid, solicitada, disponible, reservar, producir, destino };
    });
  }, [pedido, reservas, destinos]);

  async function guardar() {
    if (!pedido) return;

    const payload = {
      pedidoKey: pedido.pedidoKey,
      observacionesPlaneacion: obs || "",
      usuario: "planeacion",
      items: computed.map((x) => ({
        rowIndex1Based: x.rowIndex1Based || 0,
        productoKey: x.productoKey,
        destino: x.destino,
        cantidadReservarUnd: x.reservar,
      })),
    };

    const res = await fetch("/api/planeacion/pedido/guardar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!json?.success) return alert(json?.message || "Error guardando planeación");

    alert("Planeación guardada ✅");
    router.push("/planeacion");
  }

  const totals = useMemo(() => {
    const items = computed || [];
    let totalSolicitado = 0;
    let totalReservar = 0;
    let totalProducir = 0;

    for (const it of items) {
      totalSolicitado += Number(it.solicitada || 0);
      totalReservar += Number(it.reservar || 0);
      totalProducir += Number(it.producir || 0);
    }
    return { totalSolicitado, totalReservar, totalProducir };
  }, [computed]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <button
        className="mb-4 text-sm text-slate-500 hover:text-slate-700"
        type="button"
        onClick={() => router.push("/planeacion")}
      >
        ← Volver a planeación
      </button>

      {loading && <p className="text-sm text-slate-500">Cargando…</p>}

      {!loading && err && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {err}
        </div>
      )}

      {!loading && pedido && (
        <>
          {/* Header como Comercial */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Clasificar pedido</h1>
              <p className="text-sm text-slate-500">
                Consecutivo:{" "}
                <span className="font-medium text-slate-700">{pedido.consecutivo || "—"}</span>
              </p>
              <p className="text-xs text-slate-400 break-all">pedidoKey: {pedido.pedidoKey}</p>
            </div>

            <div className="flex items-center gap-3">

              {pedido?.pdfPath ? (
                <button
                  onClick={() => verPdf(pedido.pdfPath)}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Ver PDF
                </button>
              ) : (
                <button
                  disabled
                  className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-500"
                >
                  Sin PDF
                </button>
              )}

              <button
                onClick={guardar}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Guardar planeación
              </button>
            </div>
          </div>

          {/* Card info (como Comercial) */}
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2 space-y-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-500">Cliente</p>
                    <p className="text-sm font-medium">{pedido.cliente || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">OC</p>
                    <p className="text-sm font-medium">{pedido.oc || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Dirección</p>
                    <p className="text-sm">{pedido.direccion || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Fecha requerida</p>
                    <p className="text-sm font-medium">{formatFechaColombia(pedido.fechaRequerida)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Observaciones planeación</p>
                  <input
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Notas de inventario / prioridad / aclaraciones…"
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-xs text-slate-500">Resumen</p>
                <p className="mt-1 text-3xl font-semibold">{pedido.items?.length ?? 0}</p>
                <p className="text-sm text-slate-600">items</p>

                <div className="mt-4 grid gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Solicitado (und)</span>
                    <span className="font-medium">{totals.totalSolicitado.toLocaleString("es-CO")}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Reservar (und)</span>
                    <span className="font-medium">{totals.totalReservar.toLocaleString("es-CO")}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">A producir (und)</span>
                    <span className="font-semibold">{totals.totalProducir.toLocaleString("es-CO")}</span>
                  </div>
                </div>

                {pedido?.pdfPath ? (
                  <div className="mt-4">
                    <p className="text-xs text-slate-500">pdfPath</p>
                    <p className="text-xs break-all text-slate-600">{pedido.pdfPath}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {/* Tabla estilo “pro” */}
          <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="text-base font-semibold">Items + inventario + reserva</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Producto</th>
                    <th className="px-4 py-3 text-left font-medium">Destino</th>
                    <th className="px-4 py-3 text-right font-medium">Solicitado</th>
                    <th className="px-4 py-3 text-right font-medium">Disponible</th>
                    <th className="px-4 py-3 text-right font-medium">Reservar</th>
                    <th className="px-4 py-3 text-right font-medium">Producir</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {computed.map((it) => (
                    <tr key={it.uid} className="hover:bg-slate-50 align-top">
                      <td className="px-4 py-3 whitespace-pre-wrap">
                        <div className="font-medium">{it.producto || "—"}</div>
                        <div className="text-xs text-slate-400 break-all">{it.productoKey}</div>
                      </td>

                      <td className="px-4 py-3">
                        <select
                          value={destinos[it.uid] || "Almacén"}
                          onChange={(e) =>
                            setDestinos((prev) => ({
                              ...prev,
                              [it.uid]: e.target.value as DestinoItem,
                            }))
                          }
                          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        >
                          <option value="Almacén">Almacén</option>
                          <option value="Corte">Corte</option>
                          <option value="Producción">Producción</option>
                        </select>
                      </td>

                      <td className="px-4 py-3 text-right">{it.solicitada.toLocaleString("es-CO")}</td>
                      <td className="px-4 py-3 text-right">{(it.disponible || 0).toLocaleString("es-CO")}</td>

                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={reservas[it.uid] ?? 0}
                          onChange={(e) =>
                            setReservas((prev) => ({
                              ...prev,
                              [it.uid]: Number(e.target.value || 0),
                            }))
                          }
                          className="w-24 rounded-xl border border-slate-300 px-2 py-1 text-right"
                        />
                      </td>

                      <td className="px-4 py-3 text-right font-semibold">{it.producir.toLocaleString("es-CO")}</td>
                    </tr>
                  ))}

                  <tr className="bg-slate-50">
                    <td className="px-4 py-3 font-semibold">Totales</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-right font-semibold">{totals.totalSolicitado.toLocaleString("es-CO")}</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-right font-semibold">{totals.totalReservar.toLocaleString("es-CO")}</td>
                    <td className="px-4 py-3 text-right font-semibold">{totals.totalProducir.toLocaleString("es-CO")}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
              Nota: “Reservar” crea un movimiento en <b>MovimientosInventario</b> tipo <b>Reserva</b> (cantidad negativa).
            </div>
          </section>
        </>
      )}
    </main>
  );
}
