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

async function safeJsonFetch<T>(
  url: string
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
    });

    if (!res.ok) return null;

    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function ActualizarEstadoPage() {
  const router = useRouter();

  const [prod, setProd] = useState<ProdItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [msg, setMsg] = useState<string | null>(
    null
  );

  const [err, setErr] = useState<string | null>(
    null
  );

  // =========================================================
  // SELECCIÓN PRODUCCIÓN
  // =========================================================

  const [ope, setOpe] = useState("");

  const [prodItemRow, setProdItemRow] =
    useState<number | "">("");

  const [nuevoEstadoProd, setNuevoEstadoProd] =
    useState<"Producido" | "Empacado">(
      "Producido"
    );

  // =========================================================
  // LISTADOS
  // =========================================================

  const opes = useMemo(
    () =>
      Array.from(
        new Set(
          prod.map((x) => x.OPE)
        )
      ).filter(Boolean),
    [prod]
  );

  const prodItemsOpe = useMemo(
    () =>
      prod.filter(
        (x) => x.OPE === ope
      ),
    [prod, ope]
  );

  // =========================================================
  // CARGA
  // =========================================================

  async function cargarProduccion() {
    setLoading(true);

    const p =
      await safeJsonFetch<ProdItem[]>(
        "/api/produccion/entregas-almacen/produccion/en-cola"
      );

    setProd(p ?? []);

    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const p =
        await safeJsonFetch<ProdItem[]>(
          "/api/produccion/entregas-almacen/produccion/en-cola"
        );

      if (!mounted) return;

      setProd(p ?? []);
      setLoading(false);
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  // =========================================================
  // ACTUALIZAR OPE
  // =========================================================

  const actualizarProd = async () => {
    setMsg(null);
    setErr(null);

    if (!prodItemRow) {
      return setErr(
        "Selecciona un item de producción."
      );
    }

    try {
      const res = await fetch(
        "/api/produccion/entregas-almacen/produccion/actualizar-estado",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            rowIndex:
              prodItemRow,

            nuevoEstado:
              nuevoEstadoProd,
          }),
        }
      );

      const j =
        await res.json();

      if (!res.ok) {
        return setErr(
          j?.error ??
            "No se pudo actualizar."
        );
      }

      setMsg(
        "✅ Estado de producción actualizado."
      );

      await cargarProduccion();

      setProdItemRow("");
    } catch {
      setErr(
        "No fue posible actualizar el estado."
      );
    }
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        {/* ===================================================
            CABECERA
           =================================================== */}

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Actualizar Estado
            </h1>

            <p className="mt-1 text-sm text-neutral-600">
              Actualización de estado para órdenes de producción (OPE).
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/produccion/entregas-almacen"
              )
            }
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-neutral-50"
          >
            Volver
          </button>
        </div>

        {/* ===================================================
            MENSAJES
           =================================================== */}

        <div className="space-y-4">
          {(msg || err) && (
            <div
              className={[
                "rounded-xl border px-4 py-3 text-sm",

                err
                  ? "border-red-200 bg-red-50 text-red-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900",
              ].join(" ")}
            >
              {err ?? msg}
            </div>
          )}

          {/* =================================================
              INFORMACIÓN SOBRE CORTE / EMPAQUE
             ================================================= */}

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
            <div className="text-sm font-semibold text-emerald-800">
              Corte y empaque se gestionan automáticamente
            </div>

            <p className="mt-1 text-sm text-emerald-700">
              Los ítems de OTE pasan de{" "}
              <b>Generada → Empacado</b>{" "}
              automáticamente cuando Control Producto en Proceso confirma que la cantidad pendiente llegó a 0.
            </p>

            <p className="mt-2 text-xs text-emerald-700">
              El estado Empacado ya no puede asignarse manualmente a una orden de corte.
            </p>
          </div>

          {/* =================================================
              PRODUCCIÓN
             ================================================= */}

          <div className="max-w-3xl rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <h2 className="text-base font-semibold">
              Producción (OPE)
            </h2>

            <p className="mt-1 text-xs text-neutral-600">
              Selecciona un ítem de producción en cola y actualiza su estado.
            </p>

            <div className="mt-5 space-y-4">
              {/* OPE */}

              <div>
                <label className="mb-1 block text-sm font-medium">
                  OPE
                </label>

                <select
                  value={ope}
                  onChange={(e) => {
                    setOpe(
                      e.target.value
                    );

                    setProdItemRow("");
                  }}
                  className={inputCls}
                  disabled={loading}
                >
                  <option value="">
                    Selecciona…
                  </option>

                  {opes.map((x) => (
                    <option
                      key={x}
                      value={x}
                    >
                      {x}
                    </option>
                  ))}
                </select>
              </div>

              {/* ITEM */}

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Item
                </label>

                <select
                  value={
                    prodItemRow
                  }
                  onChange={(e) =>
                    setProdItemRow(
                      e.target.value
                        ? Number(
                            e.target.value
                          )
                        : ""
                    )
                  }
                  className={inputCls}
                  disabled={
                    loading ||
                    !ope
                  }
                >
                  <option value="">
                    Selecciona…
                  </option>

                  {prodItemsOpe.map(
                    (it) => (
                      <option
                        key={
                          it.rowIndex
                        }
                        value={
                          it.rowIndex
                        }
                      >
                        {it.productoKey}
                        {" — "}
                        {it.cantidadUND}
                        {" UND — rowPedido "}
                        {
                          it.rowIndexPedido
                        }
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* NUEVO ESTADO */}

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Nuevo estado
                </label>

                <select
                  value={
                    nuevoEstadoProd
                  }
                  onChange={(e) =>
                    setNuevoEstadoProd(
                      e.target
                        .value as
                        | "Producido"
                        | "Empacado"
                    )
                  }
                  className={inputCls}
                  disabled={
                    !ope ||
                    loading
                  }
                >
                  <option value="Producido">
                    Producido
                  </option>

                  <option value="Empacado">
                    Empacado
                  </option>
                </select>
              </div>

              {/* BOTÓN */}

              <button
                type="button"
                onClick={
                  actualizarProd
                }
                className="w-full rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
                disabled={
                  loading ||
                  !prodItemRow
                }
              >
                {loading
                  ? "Cargando..."
                  : "Actualizar item"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500";