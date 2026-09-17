"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/* =========================================================
   TIPOS
   ========================================================= */

type ProdItem = {
  rowIndex: number;
  OPE: string;
  productoKey: string;
  cantidadUND: any;
  rowIndexPedido: any;
  estado: string;
};

/* =========================================================
   HELPERS
   ========================================================= */

async function safeJsonFetch<T>(
  url: string
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function norm(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/* =========================================================
   COMPONENTE
   ========================================================= */

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

  /* =========================================================
     SELECCIÓN PRODUCCIÓN
     ========================================================= */

  const [ope, setOpe] = useState("");

  const [prodItemRow, setProdItemRow] =
    useState<number | "">("");

  /*
   * Desde Máquinas esta pantalla solo permite:
   *
   * Generada → Producido
   *
   * Empacado pertenece al flujo de Empaque.
   */
  const nuevoEstadoProd = "Producido";

  /* =========================================================
     SOLO ÍTEMS GENERADA
     ========================================================= */

  const prodGenerada = useMemo(
    () =>
      prod.filter(
        (item) =>
          norm(item.estado) === "generada"
      ),
    [prod]
  );

  /* =========================================================
     LISTADO DE OPE
     ========================================================= */

  const opes = useMemo(
    () =>
      Array.from(
        new Set(
          prodGenerada.map(
            (item) => item.OPE
          )
        )
      ).filter(Boolean),
    [prodGenerada]
  );

  /* =========================================================
     ÍTEMS DE LA OPE SELECCIONADA
     ========================================================= */

  const prodItemsOpe = useMemo(
    () =>
      prodGenerada.filter(
        (item) =>
          item.OPE === ope
      ),
    [
      prodGenerada,
      ope,
    ]
  );

  /* =========================================================
     CARGAR PRODUCCIÓN
     ========================================================= */

  async function cargarProduccion() {
    setLoading(true);

    const p =
      await safeJsonFetch<ProdItem[]>(
        "/api/produccion/entregas-almacen/produccion/en-cola"
      );

    /*
     * Guardamos respuesta completa.
     *
     * La protección visual definitiva está
     * en prodGenerada, que solo deja pasar
     * estado Generada.
     */
    setProd(
      Array.isArray(p)
        ? p
        : []
    );

    setLoading(false);
  }

  /* =========================================================
     CARGA INICIAL
     ========================================================= */

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const p =
        await safeJsonFetch<ProdItem[]>(
          "/api/produccion/entregas-almacen/produccion/en-cola"
        );

      if (!mounted) {
        return;
      }

      setProd(
        Array.isArray(p)
          ? p
          : []
      );

      setLoading(false);
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  /* =========================================================
     LIMPIAR OPE SI YA NO TIENE ÍTEMS GENERADA
     ========================================================= */

  useEffect(() => {
    if (!ope) {
      return;
    }

    const sigueDisponible =
      opes.includes(ope);

    if (!sigueDisponible) {
      setOpe("");
      setProdItemRow("");
    }
  }, [
    opes,
    ope,
  ]);

  /* =========================================================
     ACTUALIZAR OPE
     ========================================================= */

  const actualizarProd =
    async () => {
      setMsg(null);
      setErr(null);

      if (!prodItemRow) {
        return setErr(
          "Selecciona un ítem de producción."
        );
      }

      /*
       * Protección adicional del cliente.
       *
       * Verificamos que la fila todavía corresponda
       * a un ítem Generada dentro de los datos
       * actualmente cargados.
       */
      const itemSeleccionado =
        prodGenerada.find(
          (item) =>
            item.rowIndex ===
            prodItemRow
        );

      if (!itemSeleccionado) {
        setErr(
          "El ítem seleccionado ya no se encuentra en estado Generada. Actualiza la página e intenta nuevamente."
        );

        await cargarProduccion();

        setOpe("");
        setProdItemRow("");

        return;
      }

      try {
        const res =
          await fetch(
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

                /*
                 * No sale de un selector.
                 * Siempre será Producido.
                 */
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
          "✅ Ítem actualizado de Generada a Producido."
        );

        /*
         * Recargamos.
         *
         * Como ahora el ítem es Producido,
         * prodGenerada dejará de mostrarlo.
         */
        await cargarProduccion();

        setProdItemRow("");

        /*
         * Dejamos la OPE seleccionada solamente
         * si todavía tiene otros ítems Generada.
         *
         * El useEffect también se encargará
         * de limpiarla si ya no existe.
         */
      } catch {
        setErr(
          "No fue posible actualizar el estado."
        );
      }
    };

  /* =========================================================
     RENDER
     ========================================================= */

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
              INFORMACIÓN SOBRE FLUJO
             ================================================= */}

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
            <div className="text-sm font-semibold text-emerald-800">
              Estados controlados por cada proceso
            </div>

            <p className="mt-1 text-sm text-emerald-700">
              Desde Máquinas únicamente se permite
              actualizar un ítem de{" "}
              <b>Generada → Producido</b>.
            </p>

            <p className="mt-2 text-xs text-emerald-700">
              El estado <b>Empacado</b> pertenece al
              proceso de Empaque y no puede asignarse
              desde esta pantalla.
            </p>

            <p className="mt-1 text-xs text-emerald-700">
              Los ítems que ya estén en estado{" "}
              <b>Producido</b> dejarán de aparecer
              automáticamente en este listado.
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
              Se muestran únicamente los ítems que se
              encuentran actualmente en estado Generada.
            </p>

            <div className="mt-5 space-y-4">
              {/* =============================================
                  OPE
                 ============================================= */}

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
                    setMsg(null);
                    setErr(null);
                  }}
                  className={inputCls}
                  disabled={
                    loading ||
                    opes.length === 0
                  }
                >
                  <option value="">
                    {loading
                      ? "Cargando..."
                      : opes.length ===
                          0
                        ? "No hay OPE en estado Generada"
                        : "Selecciona…"}
                  </option>

                  {opes.map(
                    (x) => (
                      <option
                        key={x}
                        value={x}
                      >
                        {x}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* =============================================
                  ITEM
                 ============================================= */}

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
                    {!ope
                      ? "Selecciona primero una OPE"
                      : prodItemsOpe.length ===
                          0
                        ? "No hay ítems Generada"
                        : "Selecciona…"}
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

              {/* =============================================
                  NUEVO ESTADO
                 ============================================= */}

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Nuevo estado
                </label>

                <select
                  value="Producido"
                  className={inputCls}
                  disabled
                >
                  <option value="Producido">
                    Producido
                  </option>
                </select>

                <p className="mt-1 text-xs text-neutral-500">
                  Desde Máquinas únicamente se puede
                  confirmar que la producción fue terminada.
                </p>
              </div>

              {/* =============================================
                  BOTÓN
                 ============================================= */}

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
                  : "Marcar como Producido"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   ESTILOS
   ========================================================= */

const inputCls =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-900/10 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500";