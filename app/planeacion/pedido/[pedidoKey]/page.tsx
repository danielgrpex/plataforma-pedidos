//app/planeacion/pedido/[pedidoKey]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type DestinoItem = "Almacén" | "Corte" | "Producción";

type OpcionInv = {
  inventarioId: string;
  almacen?: string;
  productoTexto?: string; // viene del bulk
  descripcion?: string;   // por si en algún punto lo armaste así
  disponibleUnd?: number;
  disponibleM?: number;
  largo?: number;
  acabados?: string;
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
    rowIndex1Based?: number;
    productoKey: string;
    producto: string;
    cantidadUnd: string;
    cantidadM: string;
    inventarioDisponibleUnd: number;
    inventarioDisponibleM: number;

    opcionesInventario?: {
      "Almacén": OpcionInv[];
      "Corte": OpcionInv[];
      "Producción": OpcionInv[];
    };
  }>;
};

function toNumber(v?: string) {
  if (!v) return 0;
  const s = String(v).trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export default function PlaneacionPedidoPage() {
  const router = useRouter();
  const params = useParams<{ pedidoKey: string }>();
  const pedidoKey = decodeURIComponent(params.pedidoKey || "");

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);

  const [obs, setObs] = useState("");

  // state por UID
  const [reservas, setReservas] = useState<Record<string, number>>({});
  const [destinos, setDestinos] = useState<Record<string, DestinoItem>>({});
  const [opcionSel, setOpcionSel] = useState<Record<string, string>>({}); // uid -> inventarioId

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

    const initialReservas: Record<string, number> = {};
    const initialDestinos: Record<string, DestinoItem> = {};
    const initialOpcion: Record<string, string> = {};

    (ped?.items || []).forEach((it, idx) => {
      const uid = `${it.rowIndex1Based || "X"}-${it.productoKey || "PK"}-${idx}`;
      initialReservas[uid] = 0;
      initialDestinos[uid] = "Almacén";

      // default: primera opción de almacén si existe
      const opts = it.opcionesInventario?.["Almacén"] || [];
      initialOpcion[uid] = opts[0]?.inventarioId || "";
    });

    setReservas(initialReservas);
    setDestinos(initialDestinos);
    setOpcionSel(initialOpcion);

    setLoading(false);
  }

  useEffect(() => {
    if (pedidoKey) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoKey]);

  const computed = useMemo(() => {
    const items = pedido?.items || [];

    return items.map((it, idx) => {
      const uid = `${it.rowIndex1Based || "X"}-${it.productoKey || "PK"}-${idx}`;

      const solicitada = toNumber(it.cantidadUnd);
      const disponibleExacto = it.inventarioDisponibleUnd || 0;

      const reservar = Math.max(0, Math.min(reservas[uid] || 0, disponibleExacto, solicitada));
      const producir = Math.max(0, solicitada - reservar);

      const destino = destinos[uid] || "Almacén";
      const opciones = it.opcionesInventario?.[destino] || [];

      // siempre leemos la selección desde el state
      const selectedInvId = opcionSel[uid] || (opciones[0]?.inventarioId ?? "");

      return {
        ...it,
        uid,
        solicitada,
        disponibleExacto,
        reservar,
        producir,
        destino,
        opciones,
        selectedInvId,
      };
    });
  }, [pedido, reservas, destinos, opcionSel]);

  function optionLabel(op: OpcionInv) {
    const base = (op.descripcion || op.productoTexto || "").trim();
    const disp = (op.disponibleUnd ?? 0);
    const alm = (op.almacen || "").trim();
    const extra = [
      alm ? `— ${alm}` : "",
      `— disp: ${disp}`,
    ].filter(Boolean).join(" ");
    return `${base || op.inventarioId}${extra}`;
  }

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

        // ✅ CLAVE: ahora sí mandamos el inventarioId seleccionado
        inventarioId: x.selectedInvId || "",
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
              <p className="text-xs text-slate-400 break-all">pedidoKey: {pedido.pedidoKey}</p>
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
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Producto</th>
                    <th className="px-4 py-3 text-left font-medium">Destino</th>
                    <th className="px-4 py-3 text-right font-medium">Solicitado</th>
                    <th className="px-4 py-3 text-right font-medium">Disponible (exacto)</th>
                    <th className="px-4 py-3 text-left font-medium">Opción inventario</th>
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
                          onChange={(e) => {
                            const nuevo = e.target.value as DestinoItem;
                            setDestinos((prev) => ({ ...prev, [it.uid]: nuevo }));

                            // al cambiar destino, setear default (primera opción compatible)
                            const opciones = it.opcionesInventario?.[nuevo] || [];
                            setOpcionSel((prev) => ({
                              ...prev,
                              [it.uid]: opciones[0]?.inventarioId || "",
                            }));
                          }}
                          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        >
                          <option value="Almacén">Almacén</option>
                          <option value="Corte">Corte</option>
                          <option value="Producción">Producción</option>
                        </select>
                      </td>

                      <td className="px-4 py-3 text-right font-medium">{it.solicitada}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {it.disponibleExacto?.toLocaleString("es-CO") ?? 0}
                      </td>

                      <td className="px-4 py-3">
                        <select
                          value={opcionSel[it.uid] || ""}
                          onChange={(e) =>
                            setOpcionSel((prev) => ({ ...prev, [it.uid]: e.target.value }))
                          }
                          className="min-w-[520px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        >
                          {it.opciones.length === 0 ? (
                            <option value="">Sin opciones</option>
                          ) : (
                            it.opciones.map((op) => (
                              <option key={op.inventarioId} value={op.inventarioId}>
                                {optionLabel(op)}
                              </option>
                            ))
                          )}
                        </select>

                        <div className="mt-1 text-xs text-slate-500">
                          {it.opciones.length === 0
                            ? "No hay inventario compatible para este destino"
                            : it.destino === "Corte"
                            ? "En Corte puedes usar largos mayores o iguales; acabados no importan."
                            : "En Almacén/Producción mostramos match exacto."}
                        </div>
                      </td>

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
                          className="w-28 rounded-xl border border-slate-300 px-2 py-1 text-right"
                        />
                      </td>

                      <td className="px-4 py-3 text-right font-semibold">{it.producir}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
              Nota: “Reservar” crea un movimiento en <b>MovimientosInventario</b> tipo <b>Reserva</b> (cantidad negativa).
              <br />
              Las “Opciones inventario” son para que planeación decida el mejor origen (especialmente en <b>Corte</b>).
            </div>
          </section>
        </>
      )}
    </main>
  );
}
