//app/produccion/entregas-almacen/entregar-stock/EntregarStockClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const USUARIOS_ENTREGA = [
  "Eduin Galindo",
  "Paola Suarez",
  "Leidy Moreno",
  "Dalia Rodriguez",
  "Johana Begambre",
  "Daniel Alfonso",
];

type InvItem = {
  inventarioId: string;
  tipoInventario: string;
  almacen: string;
  productoKey: string;
  productoDescripcion: string;
  referencia: string;
  color: string;
  ancho: string;
  largo: string;
  acabados: string;
  unidadBase: string;
  estadoInventario: string;
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

export default function EntregarStockClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const usuarioFromQuery = sp.get("usuario") ?? "";

  const [usuarioEntrega, setUsuarioEntrega] = useState<string>(usuarioFromQuery);
  const [almacenDestino, setAlmacenDestino] = useState<string>("Producto Terminado");

  const [q, setQ] = useState("");
  const [items, setItems] = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [inventarioIdBase, setInventarioIdBase] = useState<string>("");
  const [cantidadUnd, setCantidadUnd] = useState<string>("");
  const [nota, setNota] = useState<string>("");

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const selected = useMemo(
    () => items.find((x) => String(x.inventarioId) === String(inventarioIdBase)) ?? null,
    [items, inventarioIdBase]
  );

  const load = async () => {
    setLoading(true);
    setErr(null);

    const url =
      `/api/inventario/items?soloDisponibles=true` +
      `&q=${encodeURIComponent(q.trim())}` +
      `&t=${Date.now()}`; // cache buster

    const data = await safeJsonFetch<InvItem[]>(url);
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parseQty = (v: string) => {
    const n = Number((v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  };

  const submit = async () => {
    setMsg(null);
    setErr(null);

    if (!usuarioEntrega) return setErr("Selecciona quién entrega.");
    if (!inventarioIdBase) return setErr("Selecciona un producto/lote.");
    const qty = parseQty(cantidadUnd);
    if (!Number.isFinite(qty) || qty <= 0) return setErr("Ingresa una cantidad UND válida (> 0).");

    const res = await fetch("/api/inventario/entrada-stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inventarioIdBase,
        cantidadUnd: qty,
        almacenDestino,
        usuario: usuarioEntrega,
        nota: nota || "Entrada de stock",
        referenciaOperacion: nota,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setErr(json?.error ?? "No se pudo registrar la entrada de stock.");
      return;
    }

    setMsg(`✅ Stock registrado. Lote Stock: ${json?.inventarioIdStock ?? "(ok)"}`);
    setCantidadUnd("");
    setNota("");
    setInventarioIdBase("");
    await load();
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Entregar Stock</h1>
            <p className="mt-1 text-sm text-neutral-600">
              Registra sobrantes como <span className="font-medium">Disponible</span>.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/produccion/entregas-almacen/entregar")}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-neutral-50"
          >
            Volver
          </button>
        </div>

        {(msg || err) && (
          <div
            className={[
              "mb-4 rounded-xl border px-4 py-3 text-sm",
              err ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900",
            ].join(" ")}
          >
            {err ?? msg}
          </div>
        )}

        <div className="mb-4 rounded-2xl bg-white shadow-sm ring-1 ring-black/5 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-900">Quién entrega</label>
              <select value={usuarioEntrega} onChange={(e) => setUsuarioEntrega(e.target.value)} className={inputCls}>
                <option value="">Selecciona…</option>
                {USUARIOS_ENTREGA.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-neutral-500">
                Se registrará en MovimientosInventario como <span className="font-medium">ENTRADA_STOCK</span>.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-900">Almacén destino</label>
              <input
                value={almacenDestino}
                onChange={(e) => setAlmacenDestino(e.target.value)}
                className={inputCls}
                placeholder="Producto Terminado"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="w-full md:max-w-xl">
              <label className="mb-1 block text-sm font-medium">Buscar producto</label>
              <div className="flex gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className={inputCls}
                  placeholder='Ej: "enganche 0,965" o "adh"'
                />
                <button
                  type="button"
                  onClick={load}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-neutral-50"
                >
                  {loading ? "Buscando…" : "Buscar"}
                </button>
              </div>
              <p className="mt-1 text-xs text-neutral-500">Fuente: hoja Inventario (solo disponibles).</p>
            </div>

            <div className="text-xs text-neutral-500">{loading ? "Cargando…" : `${items.length} resultados`}</div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Producto / Lote</label>
              <select value={inventarioIdBase} onChange={(e) => setInventarioIdBase(e.target.value)} className={inputCls}>
                <option value="">Selecciona…</option>
                {items.map((it) => (
                  <option key={it.inventarioId} value={it.inventarioId}>
                    {it.productoDescripcion || it.productoKey} — ID {it.inventarioId}
                  </option>
                ))}
              </select>

              {selected && (
                <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
                  <div className="font-medium">{selected.productoDescripcion || selected.productoKey}</div>
                  <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                    <div><span className="text-neutral-500">productoKey:</span> {selected.productoKey}</div>
                    <div><span className="text-neutral-500">unidad:</span> {selected.unidadBase || "-"}</div>
                    <div><span className="text-neutral-500">ref/color:</span> {selected.referencia} / {selected.color}</div>
                    <div><span className="text-neutral-500">ancho/largo:</span> {selected.ancho} / {selected.largo}</div>
                    <div className="col-span-2"><span className="text-neutral-500">acabados:</span> {selected.acabados || "-"}</div>
                    <div className="col-span-2"><span className="text-neutral-500">origen:</span> {selected.tipoInventario} — {selected.almacen}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Cantidad a ingresar (UND)</label>
                <input value={cantidadUnd} onChange={(e) => setCantidadUnd(e.target.value)} className={inputCls} placeholder="Ej: 5" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Nota (opcional)</label>
                <input value={nota} onChange={(e) => setNota(e.target.value)} className={inputCls} placeholder='Ej: "Sobrante OPE260001"' />
              </div>

              <button
                type="button"
                onClick={submit}
                disabled={!usuarioEntrega || !inventarioIdBase}
                className="w-full rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                Registrar entrada de Stock
              </button>

              <p className="text-xs text-neutral-500">
                Esto NO afecta pedidos. Aumenta inventario <span className="font-medium">Disponible</span>.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10";
