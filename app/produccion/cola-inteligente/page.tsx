"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ItemPedidoCompleto = {
  producto: string;
  cantidadUnd?: number;
  estado: string;
  ordenesTrabajo?: string;
};

type ItemCola = {
  prioridad: "CRÍTICA" | "ALTA" | "MEDIA" | "BAJA";
  puntaje: number;
  accion: string;
  pedido: string;
  pedidosKey?: string;
  cliente: string;
  direccion?: string;
  ordenCompra?: string;
  producto: string;
  cantidadUnd?: number;
  estado: string;
  fechaSolicitud: string;
  fechaRequerida: string;
  diasAbierto: number;
  diasParaEntrega: number;
  avancePedido: string;
  completaPedido: boolean;
  ordenesTrabajo?: string;
  itemsPedido?: ItemPedidoCompleto[];
};

type GrupoPedido = {
  pedido: string;
  cliente: string;
  direccion?: string;
  ordenCompra?: string;
  prioridad: ItemCola["prioridad"];
  puntaje: number;
  accion: string;
  fechaSolicitud: string;
  fechaRequerida: string;
  diasAbierto: number;
  diasParaEntrega: number;
  avancePedido: string;
  completaPedido: boolean;
  items: ItemCola[];
  itemsPedido: ItemPedidoCompleto[];
};

const badgePrioridad: Record<string, string> = {
  CRÍTICA: "bg-red-50 text-red-700 ring-red-100",
  ALTA: "bg-orange-50 text-orange-700 ring-orange-100",
  MEDIA: "bg-yellow-50 text-yellow-700 ring-yellow-100",
  BAJA: "bg-slate-50 text-slate-700 ring-slate-100",
};

const borderPrioridad: Record<string, string> = {
  CRÍTICA: "border-l-red-500",
  ALTA: "border-l-orange-500",
  MEDIA: "border-l-yellow-500",
  BAJA: "border-l-slate-300",
};

function ordenClass(ordenes?: string) {
  const txt = String(ordenes || "").toUpperCase();

  if (txt.includes("OPE")) return "bg-blue-50 text-blue-700 ring-blue-100";
  if (txt.includes("OTE") || txt.includes("CORTE")) {
    return "bg-purple-50 text-purple-700 ring-purple-100";
  }

  return "bg-slate-50 text-slate-700 ring-slate-100";
}

function estadoClass(estado?: string) {
  const txt = String(estado || "").toLowerCase();

  if (txt.includes("almacén") || txt.includes("almacen")) {
    return "bg-green-100 text-green-700";
  }

  if (txt.includes("corte") || txt.includes("empaque")) {
    return "bg-purple-100 text-purple-700";
  }

  if (txt.includes("producción") || txt.includes("produccion")) {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-slate-100 text-slate-700";
}

function enAlmacen(estado?: string) {
  const txt = String(estado || "").toLowerCase();
  return txt.includes("almacén") || txt.includes("almacen");
}

function motivoGrupo(g: GrupoPedido) {
  if (g.completaPedido) return "Si se terminan estos ítems, el pedido queda listo para despacho.";
  if (g.diasParaEntrega < 0) return "Pedido vencido. Debe priorizarse para evitar mayor retraso.";
  if (g.diasParaEntrega <= 2) return "Pedido con entrega inmediata.";
  if (g.diasAbierto >= 10) return "Pedido antiguo abierto varios días.";
  return "Trabajar según orden de prioridad.";
}

function groupItems(items: ItemCola[]): GrupoPedido[] {
  const map = new Map<string, GrupoPedido>();

  for (const item of items) {
    const key = item.pedidosKey || `${item.pedido}-${item.cliente}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        pedido: item.pedido,
        cliente: item.cliente,
        direccion: item.direccion,
        ordenCompra: item.ordenCompra,
        prioridad: item.prioridad,
        puntaje: item.puntaje,
        accion: item.accion,
        fechaSolicitud: item.fechaSolicitud,
        fechaRequerida: item.fechaRequerida,
        diasAbierto: item.diasAbierto,
        diasParaEntrega: item.diasParaEntrega,
        avancePedido: item.avancePedido,
        completaPedido: item.completaPedido,
        items: [item],
        itemsPedido: item.itemsPedido || [],
      });
    } else {
      existing.items.push(item);

      if (existing.itemsPedido.length === 0 && item.itemsPedido?.length) {
        existing.itemsPedido = item.itemsPedido;
      }

      if (item.puntaje > existing.puntaje) {
        existing.prioridad = item.prioridad;
        existing.puntaje = item.puntaje;
        existing.accion = item.accion;
      }

      existing.completaPedido = existing.completaPedido || item.completaPedido;
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje;
    return a.diasParaEntrega - b.diasParaEntrega;
  });
}

export default function ColaInteligentePage() {
  const [items, setItems] = useState<ItemCola[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function cargar() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/produccion/cola-inteligente", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "No se pudo cargar el centro de prioridades");
      }

      setItems(data.items || []);
    } catch (err: any) {
      setMessage(err?.message || "Error cargando centro de prioridades");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const grupos = useMemo(() => groupItems(items), [items]);

  function toggleDetalle(key: string) {
    setExpanded((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function exportarTurnoCSV() {
    const rows = [
      [
        "Prioridad",
        "Pedido",
        "Cliente",
        "Dirección",
        "OC",
        "Avance",
        "Producto pendiente",
        "Estado",
        "Cantidad",
        "OPE/OTE",
        "Hecho",
        "Observación",
      ],
    ];

    grupos.forEach((g) => {
      g.items.forEach((item) => {
        rows.push([
          g.prioridad,
          `Pedido #${g.pedido}`,
          g.cliente || "",
          g.direccion || "",
          g.ordenCompra || "",
          g.avancePedido || "",
          item.producto || "",
          item.estado || "",
          String(item.cantidadUnd || ""),
          item.ordenesTrabajo || "",
          "",
          "",
        ]);
      });
    });

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `centro-prioridades-turno-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
            Producción
          </span>

          <h1 className="mt-3 text-2xl font-semibold text-slate-900">
            Centro de Prioridades de Planta
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Pedidos agrupados por impacto operativo. La planta debe trabajar de arriba hacia abajo.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportarTurnoCSV}
            disabled={grupos.length === 0}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
          >
            Exportar turno
          </button>

          <button
            onClick={cargar}
            disabled={loading}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "Cargando..." : "Refrescar"}
          </button>

          <Link
            href="/produccion"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            ← Producción
          </Link>
        </div>
      </div>

      {message && (
        <div className="mt-5 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          {message}
        </div>
      )}

      <section className="mt-6 space-y-4">
        {grupos.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            {loading ? "Cargando..." : "No hay pedidos pendientes en el centro de prioridades."}
          </div>
        )}

        {grupos.map((g) => {
          const key = `${g.pedido}-${g.cliente}`;
          const isExpanded = !!expanded[key];

          return (
            <article
              key={key}
              className={`rounded-2xl border border-slate-200 border-l-4 bg-white p-5 shadow-sm ${
                borderPrioridad[g.prioridad]
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${
                        badgePrioridad[g.prioridad]
                      }`}
                    >
                      {g.prioridad}
                    </span>

                    <span className="text-xs font-semibold text-slate-400">{g.puntaje} pts</span>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      Avance {g.avancePedido}
                    </span>
                  </div>

                  <h2 className="mt-3 text-xl font-black text-slate-900">Pedido #{g.pedido}</h2>

                  <div className="mt-1 space-y-1 text-sm font-semibold text-slate-600">
                    <p>Cliente: {g.cliente}</p>
                    <p>Dirección: {g.direccion || "-"}</p>
                    <p>OC: {g.ordenCompra || "-"}</p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-black text-slate-900">{g.accion}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    Req: <b>{g.fechaRequerida || "-"}</b>
                  </div>
                  <div className="text-xs text-slate-400">
                    Solicitud: {g.fechaSolicitud || "-"} · Abierto: {g.diasAbierto} días · Entrega:{" "}
                    {g.diasParaEntrega} días
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
                <div className="text-sm text-slate-600">
                  <b>{g.items.length}</b> ítem(s) pendiente(s) por trabajar · Pedido completo:{" "}
                  <b>{g.itemsPedido.length}</b> ítem(s)
                </div>

                <button
                  type="button"
                  onClick={() => toggleDetalle(key)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100"
                >
                  {isExpanded ? "Ocultar detalle" : "Ver detalle"}
                </button>
              </div>

              {isExpanded && (
                <>
                  <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                    <h3 className="text-sm font-black text-slate-900">Faltan por trabajar</h3>

                    <div className="mt-3 space-y-3">
                      {g.items.map((item, idx) => (
                        <div
                          key={`${item.producto}-${idx}`}
                          className="rounded-xl border border-slate-200 bg-white p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="max-w-3xl">
                              <div className="font-bold text-slate-900">{item.producto}</div>

                              <div className="mt-2 flex flex-wrap gap-2">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${estadoClass(
                                    item.estado
                                  )}`}
                                >
                                  Estado: {item.estado}
                                </span>

                                {typeof item.cantidadUnd === "number" && item.cantidadUnd > 0 && (
                                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                    Cantidad: {item.cantidadUnd}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="min-w-44 text-right">
                              {item.ordenesTrabajo ? (
                                <span
                                  className={`inline-flex rounded-xl px-3 py-2 text-xs font-black ring-1 ${ordenClass(
                                    item.ordenesTrabajo
                                  )}`}
                                >
                                  {item.ordenesTrabajo}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">Sin OPE/OTE</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-black text-slate-900">Pedido completo</h3>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {g.itemsPedido.length} ítems
                      </span>
                    </div>

                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2">Producto</th>
                            <th className="px-3 py-2">Estado</th>
                            <th className="px-3 py-2">Cantidad</th>
                            <th className="px-3 py-2">Orden</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {g.itemsPedido.map((item, idx) => (
                            <tr
                              key={`${item.producto}-${idx}`}
                              className={enAlmacen(item.estado) ? "bg-green-50/60" : "bg-white"}
                            >
                              <td className="px-3 py-2 font-semibold text-slate-900">
                                {item.producto}
                              </td>

                              <td className="px-3 py-2">
                                <span
                                  className={`rounded-full px-2 py-1 text-xs font-bold ${estadoClass(
                                    item.estado
                                  )}`}
                                >
                                  {item.estado}
                                </span>
                              </td>

                              <td className="px-3 py-2 font-semibold text-slate-700">
                                {item.cantidadUnd || "-"}
                              </td>

                              <td className="px-3 py-2">
                                {item.ordenesTrabajo ? (
                                  <span
                                    className={`rounded-lg px-2 py-1 text-xs font-bold ring-1 ${ordenClass(
                                      item.ordenesTrabajo
                                    )}`}
                                  >
                                    {item.ordenesTrabajo}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                            </tr>
                          ))}

                          {g.itemsPedido.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-3 py-4 text-center text-slate-400">
                                No se encontró el detalle completo del pedido.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-green-100 bg-green-50 p-4">
                    <div className="text-sm font-black text-green-800">Resultado esperado</div>
                    <p className="mt-1 text-sm font-semibold text-green-700">{motivoGrupo(g)}</p>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}