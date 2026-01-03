// app/planeacion/ajustes-inventario/page.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type AjusteRow = {
  inventarioId: string;
  almacen: string;
  productoDescripcion: string;
  productoKey: string;
  disponibleSistemaUnd: number;
};

function cx(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

export default function AjustesInventarioPage() {
  const [fechaConteo, setFechaConteo] = useState<string>("");
  const [almacen, setAlmacen] = useState<string>("Producto Terminado");
  const [q, setQ] = useState("");

  // ✅ MOCK de inventario visible para ajustes (luego lo conectamos a /api/inventario/disponible?almacen=...)
  const base: AjusteRow[] = useMemo(
    () => [
      {
        inventarioId: "INV-1001",
        almacen: "Producto Terminado",
        productoDescripcion: "Prod C Negro 60cm 1.2m Laminado",
        productoKey: "ProdC|Negro|60|1.2|Laminado",
        disponibleSistemaUnd: 12600,
      },
      {
        inventarioId: "INV-1002",
        almacen: "Producto Terminado",
        productoDescripcion: "Prod B Azul 50cm 0.998m Sin acabados",
        productoKey: "ProdB|Azul|50|0.998|Sin acabados",
        disponibleSistemaUnd: 145,
      },
      {
        inventarioId: "INV-1003",
        almacen: "Producto Terminado",
        productoDescripcion: "Prod B Azul 50cm 1.200m Sin acabados",
        productoKey: "ProdB|Azul|50|1.2|Sin acabados",
        disponibleSistemaUnd: 60,
      },
    ],
    []
  );

  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return base.filter((r) => {
      if (almacen && r.almacen !== almacen) return false;
      if (!qq) return true;
      return (
        r.inventarioId.toLowerCase().includes(qq) ||
        r.productoDescripcion.toLowerCase().includes(qq) ||
        r.productoKey.toLowerCase().includes(qq)
      );
    });
  }, [base, almacen, q]);

  // conteo físico: inventarioId -> number
  const [conteo, setConteo] = useState<Record<string, number>>({});

  function setConteoVal(invId: string, v: number) {
    setConteo((prev) => ({ ...prev, [invId]: Math.max(0, Math.floor(v || 0)) }));
  }

  function diff(invId: string, sistema: number) {
    const fisico = conteo[invId];
    if (fisico === undefined || fisico === null) return null;
    return Math.floor(fisico) - Math.floor(sistema);
  }

  function generarAjustes() {
    if (!fechaConteo) {
      alert("⚠ Debes seleccionar la fecha del conteo.");
      return;
    }

    const ajustes = rows
      .map((r) => {
        const d = diff(r.inventarioId, r.disponibleSistemaUnd);
        if (d === null || d === 0) return null;
        return {
          inventarioId: r.inventarioId,
          almacen: r.almacen,
          productoKey: r.productoKey,
          sistema: r.disponibleSistemaUnd,
          fisico: conteo[r.inventarioId],
          diferencia: d,
        };
      })
      .filter(Boolean);

    if (!ajustes.length) {
      alert("No hay diferencias para ajustar ✅");
      return;
    }

    // Frontend-only: luego conectamos a AjustesInventario y/o MovimientosInventario
    console.log("AJUSTES A CREAR:", ajustes);
    alert(`✅ Se generaron ${ajustes.length} ajustes (mock). Mira consola.`);
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/planeacion" className="text-sm text-slate-500 hover:text-slate-700">
            ← Volver
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Ajustes de inventario</h1>
          <p className="text-sm text-slate-500">
            Conteo físico mensual y generación de ajustes (diferencias).
          </p>
        </div>

        <button
          type="button"
          onClick={generarAjustes}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Generar ajustes
        </button>
      </div>

      {/* Filtros */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Fecha del conteo
            </label>
            <input
              type="date"
              value={fechaConteo}
              onChange={(e) => setFechaConteo(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Almacén
            </label>
            <select
              value={almacen}
              onChange={(e) => setAlmacen(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option>Materia Prima e Insumos</option>
              <option>Producto en Proceso</option>
              <option>Producto Terminado</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Buscar
            </label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="inventarioId, producto, productoKey…"
            />
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Ingresa el conteo físico por lote. El sistema calcula la diferencia automáticamente.
        </p>
      </section>

      {/* Tabla */}
      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">InventarioId</th>
                <th className="px-4 py-3 text-left font-medium">Producto</th>
                <th className="px-4 py-3 text-right font-medium">Sistema (und)</th>
                <th className="px-4 py-3 text-right font-medium">Físico (und)</th>
                <th className="px-4 py-3 text-right font-medium">Diferencia</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No hay registros para este filtro.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const d = diff(r.inventarioId, r.disponibleSistemaUnd);
                  const isPos = typeof d === "number" && d > 0;
                  const isNeg = typeof d === "number" && d < 0;

                  return (
                    <tr key={r.inventarioId} className="hover:bg-slate-50 align-top">
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs">{r.inventarioId}</div>
                        <div className="text-[11px] text-slate-400">{r.almacen}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium">{r.productoDescripcion}</div>
                        <div className="mt-1 text-xs text-slate-400 break-all">{r.productoKey}</div>
                      </td>

                      <td className="px-4 py-3 text-right font-medium">
                        {r.disponibleSistemaUnd.toLocaleString("es-CO")}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={conteo[r.inventarioId] ?? ""}
                          onChange={(e) => setConteoVal(r.inventarioId, Number(e.target.value || 0))}
                          className="w-32 rounded-xl border border-slate-300 px-3 py-2 text-right"
                          placeholder="—"
                        />
                      </td>

                      <td className="px-4 py-3 text-right">
                        {d === null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span
                            className={cx(
                              "rounded-full px-2 py-1 text-xs font-semibold",
                              isPos && "bg-emerald-50 text-emerald-700",
                              isNeg && "bg-red-50 text-red-700",
                              !isPos && !isNeg && "bg-slate-100 text-slate-700"
                            )}
                          >
                            {d > 0 ? "+" : ""}
                            {d.toLocaleString("es-CO")}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
          Nota: luego conectamos “Generar ajustes” a <b>AjustesInventario</b> y opcionalmente a <b>MovimientosInventario</b>.
        </div>
      </section>
    </main>
  );
}
