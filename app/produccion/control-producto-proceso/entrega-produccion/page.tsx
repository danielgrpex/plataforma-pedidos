"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { allowedProduccionTabsForUser } from "@/lib/auth/permissions";

type ItemProduccion = {
  sheetRow: number;
  solicitudProdId: string;
  pedidoKey: string;
  rowIndexPedido: string | number;
  producto: string;
  cantidadProgramadaUnd: number;
  estado: string;
  OPE: string;
};

type GrupoOPE = {
  OPE: string;
  cantidadItems: number;
  items: ItemProduccion[];
};

type ApiResponse = {
  ok: boolean;
  totalOPE: number;
  totalItems: number;
  opes: GrupoOPE[];
  error?: string;
};

type ResultadoGuardar = {
  success: boolean;
  entregaKey?: string;
  OPE?: string;
  turno?: string;
  supervisor?: string;
  movimientosCreados?: number;
  movimientosYaExistentes?: number;
  inventariosCreados?: number;
  inventariosActualizados?: number;
  message?: string;
};

function crearEntregaKey() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `ENTPP_${crypto.randomUUID()}`;
  }

  return `ENTPP_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export default function EntregaProduccionPage() {
  const { data: session, status } = useSession();

  const email = (session?.user as any)?.email || "";
  const role = (session?.user as any)?.role || "";

  const allowedTabs = allowedProduccionTabsForUser({
    email,
    role,
  });

  const canAccess = allowedTabs.includes(
    "control-producto-proceso"
  );

  // =========================================================
  // DATOS OPE
  // =========================================================

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // =========================================================
  // SUPERVISORES
  // =========================================================

  const [supervisores, setSupervisores] = useState<string[]>([]);
  const [supervisor, setSupervisor] = useState("");
  const [loadingSupervisores, setLoadingSupervisores] =
    useState(true);

  // =========================================================
  // FORMULARIO
  // =========================================================

  const [opeSeleccionada, setOpeSeleccionada] =
    useState<GrupoOPE | null>(null);

  const [cantidades, setCantidades] = useState<
    Record<string, string>
  >({});

  const [turno, setTurno] = useState("");
  const [observacion, setObservacion] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState("");

  const [resultado, setResultado] =
    useState<ResultadoGuardar | null>(null);

  const [entregaKey, setEntregaKey] = useState("");

  // =========================================================
  // CARGAR OPE
  // =========================================================

  async function cargarOPE() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(
        "/api/produccion/control-producto-proceso/opes",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(
          json?.error ||
            "No fue posible consultar las OPE."
        );
      }

      setData(json);
    } catch (e: any) {
      setError(
        e?.message ||
          "Ocurrió un error consultando las OPE."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === "loading") return;

    if (!canAccess) {
      setLoading(false);
      return;
    }

    cargarOPE();
  }, [status, canAccess]);

  // =========================================================
  // CARGAR SUPERVISORES DESDE INFORMACIÓN
  // =========================================================

  useEffect(() => {
    if (status === "loading") return;
    if (!canAccess) return;

    let cancelled = false;

    async function cargarSupervisores() {
      try {
        setLoadingSupervisores(true);

        const res = await fetch(
          "/api/produccion/control-producto-proceso/supervisores",
          {
            cache: "no-store",
          }
        );

        const json = await res.json();

        if (!res.ok || !json?.ok) {
          throw new Error(
            json?.error ||
              "No fue posible consultar los supervisores."
          );
        }

        if (!cancelled) {
          setSupervisores(
            Array.isArray(json.supervisores)
              ? json.supervisores
              : []
          );
        }
      } catch (e) {
        console.error(
          "Error cargando supervisores",
          e
        );

        if (!cancelled) {
          setSupervisores([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingSupervisores(false);
        }
      }
    }

    cargarSupervisores();

    return () => {
      cancelled = true;
    };
  }, [status, canAccess]);

  // =========================================================
  // FILTRO
  // =========================================================

  const opesFiltradas = useMemo(() => {
    const opes = data?.opes || [];
    const q = search.trim().toLowerCase();

    if (!q) return opes;

    return opes.filter((grupo) => {
      if (grupo.OPE.toLowerCase().includes(q)) {
        return true;
      }

      return grupo.items.some((item) =>
        item.producto.toLowerCase().includes(q)
      );
    });
  }, [data, search]);

  // =========================================================
  // TOTAL DE ENTREGA
  // =========================================================

  const totalEntregaActual = useMemo(() => {
    if (!opeSeleccionada) return 0;

    return opeSeleccionada.items.reduce(
      (total, item) => {
        const valor = Number(
          cantidades[item.solicitudProdId] || 0
        );

        return (
          total +
          (Number.isFinite(valor) ? valor : 0)
        );
      },
      0
    );
  }, [opeSeleccionada, cantidades]);

  // =========================================================
  // ABRIR FORMULARIO
  // =========================================================

  function abrirEntrega(grupo: GrupoOPE) {
    const inicial: Record<string, string> = {};

    grupo.items.forEach((item) => {
      inicial[item.solicitudProdId] = "";
    });

    setOpeSeleccionada(grupo);
    setCantidades(inicial);

    setTurno("");
    setSupervisor("");
    setObservacion("");

    setErrorGuardar("");
    setResultado(null);

    // Llave única para proteger contra doble registro
    setEntregaKey(crearEntregaKey());

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // =========================================================
  // CERRAR FORMULARIO
  // =========================================================

  function cerrarEntrega() {
    if (guardando) return;

    setOpeSeleccionada(null);
    setCantidades({});

    setTurno("");
    setSupervisor("");
    setObservacion("");

    setErrorGuardar("");
    setResultado(null);
    setEntregaKey("");
  }

  // =========================================================
  // CAMBIAR CANTIDAD
  // =========================================================

  function cambiarCantidad(
    solicitudProdId: string,
    valor: string
  ) {
    // Solo enteros positivos o vacío
    if (valor !== "" && !/^\d+$/.test(valor)) {
      return;
    }

    setCantidades((prev) => ({
      ...prev,
      [solicitudProdId]: valor,
    }));
  }

  // =========================================================
  // GUARDAR ENTREGA
  // =========================================================

  async function guardarEntrega() {
    if (!opeSeleccionada) return;

    setErrorGuardar("");
    setResultado(null);

    if (!turno) {
      setErrorGuardar(
        "Selecciona el turno antes de guardar."
      );
      return;
    }

    if (!supervisor) {
      setErrorGuardar(
        "Selecciona el supervisor que entrega el turno."
      );
      return;
    }

    const items = opeSeleccionada.items
      .map((item) => ({
        solicitudProdId: item.solicitudProdId,

        cantidadEntregadaUnd: Number(
          cantidades[item.solicitudProdId] || 0
        ),
      }))
      .filter(
        (item) =>
          Number.isFinite(
            item.cantidadEntregadaUnd
          ) &&
          item.cantidadEntregadaUnd > 0
      );

    if (!items.length) {
      setErrorGuardar(
        "Debes registrar al menos una cantidad física mayor a 0."
      );
      return;
    }

    const confirmado = window.confirm(
      [
        "¿Confirmas la entrega de producción?",
        "",
        `OPE: ${opeSeleccionada.OPE}`,
        `Turno: ${turno}`,
        `Supervisor: ${supervisor}`,
        `Total reportado en esta entrega: ${totalEntregaActual.toLocaleString(
          "es-CO"
        )} und`,
        "",
        "Esta operación generará movimientos reales en el inventario de producto en proceso.",
      ].join("\n")
    );

    if (!confirmado) return;

    try {
      setGuardando(true);

      const res = await fetch(
        "/api/produccion/control-producto-proceso/entrega-produccion",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            entregaKey,
            OPE: opeSeleccionada.OPE,
            turno,
            supervisor,

            // Usuario técnico / correo general PEX
            usuario: email,

            observacion,
            items,
          }),
        }
      );

      const json =
        (await res.json()) as ResultadoGuardar;

      if (!res.ok || !json?.success) {
        throw new Error(
          json?.message ||
            "No fue posible registrar la entrega."
        );
      }

      setResultado(json);

      // Limpia cantidades para impedir doble registro
      const vacias: Record<string, string> = {};

      opeSeleccionada.items.forEach((item) => {
        vacias[item.solicitudProdId] = "";
      });

      setCantidades(vacias);

      // Refrescamos las OPE
      await cargarOPE();
    } catch (e: any) {
      setErrorGuardar(
        e?.message ||
          "Ocurrió un error registrando la entrega."
      );
    } finally {
      setGuardando(false);
    }
  }

  // =========================================================
  // SESIÓN CARGANDO
  // =========================================================

  if (status === "loading") {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            Cargando...
          </p>
        </div>
      </main>
    );
  }

  // =========================================================
  // SIN PERMISO
  // =========================================================

  if (!canAccess) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-semibold text-red-800">
            Acceso no autorizado
          </h1>

          <p className="mt-2 text-sm text-red-700">
            Tu usuario no tiene permisos para
            registrar entregas de producción.
          </p>

          <Link
            href="/produccion"
            className="mt-4 inline-flex rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700"
          >
            ← Volver a Producción
          </Link>
        </div>
      </main>
    );
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 text-sm text-slate-500">
            Producción · Control Producto en Proceso ·
            Entrega de producción
          </div>

          <h1 className="text-2xl font-semibold">
            Entrega de producción
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Registra el conteo físico real entregado por
            el supervisor al finalizar cada turno.
          </p>
        </div>

        <Link
          href="/produccion/control-producto-proceso"
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          ← Control P.P.
        </Link>
      </div>

      {/* =====================================================
          FORMULARIO DE ENTREGA
         ===================================================== */}

      {opeSeleccionada ? (
        <section className="mt-6 rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                Nueva entrega de turno
              </div>

              <h2 className="mt-1 text-xl font-semibold text-slate-900">
                {opeSeleccionada.OPE}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Registra únicamente lo que físicamente
                estás entregando en este turno.
              </p>
            </div>

            <button
              type="button"
              onClick={cerrarEntrega}
              disabled={guardando}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cerrar
            </button>
          </div>

          {/* RESULTADO EXITOSO */}

          {resultado?.success ? (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="font-semibold text-emerald-800">
                Entrega registrada correctamente
              </div>

              <div className="mt-2 text-sm text-emerald-700">
                Supervisor:{" "}
                <b>{supervisor}</b>
              </div>

              <div className="mt-1 text-sm text-emerald-700">
                Se crearon{" "}
                <b>
                  {resultado.movimientosCreados ?? 0}
                </b>{" "}
                movimiento(s) de producción.
              </div>

              <div className="mt-1 text-sm text-emerald-700">
                Inventarios nuevos:{" "}
                <b>
                  {resultado.inventariosCreados ?? 0}
                </b>{" "}
                · Inventarios actualizados:{" "}
                <b>
                  {resultado.inventariosActualizados ??
                    0}
                </b>
              </div>

              <button
                type="button"
                onClick={cerrarEntrega}
                className="mt-4 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
              >
                Finalizar
              </button>
            </div>
          ) : (
            <>
              {/* TURNO + SUPERVISOR */}

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Turno *
                  </label>

                  <select
                    value={turno}
                    onChange={(e) =>
                      setTurno(e.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">
                      Seleccionar turno
                    </option>

                    <option value="06:00-14:00">
                      06:00 - 14:00
                    </option>

                    <option value="14:00-22:00">
                      14:00 - 22:00
                    </option>

                    <option value="22:00-06:00">
                      22:00 - 06:00
                    </option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Supervisor *
                  </label>

                  <select
                    value={supervisor}
                    onChange={(e) =>
                      setSupervisor(e.target.value)
                    }
                    disabled={loadingSupervisores}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                  >
                    <option value="">
                      {loadingSupervisores
                        ? "Cargando supervisores..."
                        : "Seleccionar supervisor"}
                    </option>

                    {supervisores.map((nombre) => (
                      <option
                        key={nombre}
                        value={nombre}
                      >
                        {nombre}
                      </option>
                    ))}
                  </select>

                  {!loadingSupervisores &&
                  supervisores.length === 0 ? (
                    <p className="mt-2 text-xs text-red-600">
                      No se encontraron supervisores en
                      Información → Supervisores.
                    </p>
                  ) : null}
                </div>
              </div>

              {/* ITEMS */}

              <div className="mt-6">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Conteo físico entregado
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    Puedes dejar en blanco los ítems que no
                    tuvieron producción durante este turno.
                  </p>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="divide-y divide-slate-200">
                    {opeSeleccionada.items.map(
                      (item) => (
                        <div
                          key={
                            item.solicitudProdId ||
                            item.sheetRow
                          }
                          className="grid gap-4 p-4 md:grid-cols-[1fr_140px_180px] md:items-center"
                        >
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {item.producto}
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                              Solicitud:{" "}
                              {item.solicitudProdId}
                            </div>
                          </div>

                          <div className="md:text-right">
                            <div className="text-xs text-slate-500">
                              Programado
                            </div>

                            <div className="font-semibold text-slate-900">
                              {Number(
                                item.cantidadProgramadaUnd ||
                                  0
                              ).toLocaleString(
                                "es-CO"
                              )}{" "}
                              und
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-slate-600">
                              Entrega este turno
                            </label>

                            <div className="mt-1 flex items-center gap-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={
                                  cantidades[
                                    item
                                      .solicitudProdId
                                  ] ?? ""
                                }
                                onChange={(e) =>
                                  cambiarCantidad(
                                    item.solicitudProdId,
                                    e.target.value
                                  )
                                }
                                placeholder="0"
                                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-right text-sm font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                              />

                              <span className="text-xs text-slate-500">
                                und
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* OBSERVACIÓN */}

              <div className="mt-5">
                <label className="text-sm font-medium text-slate-700">
                  Observación
                </label>

                <textarea
                  value={observacion}
                  onChange={(e) =>
                    setObservacion(e.target.value)
                  }
                  rows={3}
                  placeholder="Opcional. Ej. Turno entrega conteo físico validado en planta."
                  className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* ERROR */}

              {errorGuardar ? (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                  {errorGuardar}
                </div>
              ) : null}

              {/* TOTAL */}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5">
                <div>
                  <div className="text-xs text-slate-500">
                    Total reportado en esta entrega
                  </div>

                  <div className="text-xl font-semibold text-slate-900">
                    {totalEntregaActual.toLocaleString(
                      "es-CO"
                    )}{" "}
                    und
                  </div>
                </div>

                <button
                  type="button"
                  onClick={guardarEntrega}
                  disabled={
                    guardando ||
                    totalEntregaActual <= 0 ||
                    !turno ||
                    !supervisor
                  }
                  className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {guardando
                    ? "Guardando..."
                    : "Confirmar entrega"}
                </button>
              </div>
            </>
          )}
        </section>
      ) : null}

      {/* =====================================================
          RESUMEN / BUSCADOR
         ===================================================== */}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              OPE disponibles
            </div>

            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {data?.totalOPE ?? 0}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Ítems disponibles
            </div>

            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {data?.totalItems ?? 0}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Estado consultado
            </div>

            <div className="mt-1 text-lg font-semibold text-slate-900">
              Generada
            </div>
          </div>
        </div>

        <div className="mt-5">
          <label className="text-sm font-medium text-slate-700">
            Buscar OPE o producto
          </label>

          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Ej. OPE260318 o Perfil Plano Transparente"
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </section>

      {/* =====================================================
          LISTADO DE OPE
         ===================================================== */}

      {loading ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            Consultando órdenes de producción...
          </p>
        </section>
      ) : error ? (
        <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-medium text-red-700">
            {error}
          </p>
        </section>
      ) : (
        <section className="mt-6 space-y-4">
          {opesFiltradas.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">
                No se encontraron OPE con ese criterio.
              </p>
            </div>
          ) : (
            opesFiltradas.map((grupo) => (
              <div
                key={grupo.OPE}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-900">
                        {grupo.OPE}
                      </h2>

                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        Generada
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      {grupo.cantidadItems}{" "}
                      {grupo.cantidadItems === 1
                        ? "ítem"
                        : "ítems"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      abrirEntrega(grupo)
                    }
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
                  >
                    Registrar entrega
                  </button>
                </div>

                <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                  <div className="divide-y divide-slate-200">
                    {grupo.items.map((item) => (
                      <div
                        key={
                          item.solicitudProdId ||
                          item.sheetRow
                        }
                        className="grid gap-3 p-4 md:grid-cols-[1fr_auto]"
                      >
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            {item.producto ||
                              "Producto sin descripción"}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            Solicitud:{" "}
                            {item.solicitudProdId ||
                              "Sin ID"}
                          </div>
                        </div>

                        <div className="md:text-right">
                          <div className="text-xs text-slate-500">
                            Programado
                          </div>

                          <div className="text-base font-semibold text-slate-900">
                            {Number(
                              item.cantidadProgramadaUnd ||
                                0
                            ).toLocaleString(
                              "es-CO"
                            )}{" "}
                            und
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      )}
    </main>
  );
}