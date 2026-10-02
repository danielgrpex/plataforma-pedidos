"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { allowedProduccionTabsForUser } from "@/lib/auth/permissions";

type ItemCorte = {
  sheetRow: number;
  solicitudCorteId: string;
  pedidoKey: string;
  rowIndexPedido: string;
  productoSolicitado: string;
  cantidadSolicitadaUnd: number;

  inventarioOrigenId: string;
  productoOrigen: string;
  largoOrigen: string;
  cantidadOrigenUnd: number;

  largoFinal: string;
  actividades: string;
  cantidadResultanteUnd: number;

  estadoitem: string;
  fechaCreacion: string;
  usuario: string;
  OTE: string;
};

type GrupoOTE = {
  OTE: string;
  cantidadItems: number;
  totalSolicitadoUnd: number;
  items: ItemCorte[];
};

type ApiResponse = {
  ok: boolean;
  totalOTE: number;
  totalItems: number;
  ordenes: GrupoOTE[];
  error?: string;
};

type InventarioCompatible = {
  sheetRow: number;
  inventarioKey: string;
  OPE: string;
  producto: string;
  referencia: string;
  color: string;
  ancho: string;
  acabado: string;
  medida_mm: number;
  cantidadDisponible: number;
  fechaUltimoMovimiento: string;
  estado: string;
  familiaOrigen: string;
  colorOrigen: string;
  anchoOrigen: string;
};

type CompatiblesResponse = {
  ok: boolean;

  item?: {
    sheetRow: number;
    solicitudCorteId: string;
    OTE: string;
    rowIndexPedido: string;
    productoSolicitado: string;
    cantidadSolicitadaUnd: number;
    estadoitem: string;
  };

  productoObjetivo?: {
    familia: string;
    color: string;
    ancho: string;
    medidaFinal_mm: number;
    acabadoFinal: string;
  };

  totalDisponibles?: number;
  totalCompatibles?: number;
  compatibles?: InventarioCompatible[];

  error?: string;
};

type CriterioComponente = {
  color: string;
  ancho: string;
  medida_mm: number;
  acabado: string;
};

type ComponenteInventario = {
  productoFinal: string;
  componente: string;
  factorPorUnidad: number;
  criterioComponente: CriterioComponente;
  cantidadFinalSolicitada: number;
  necesarioTeorico: number;
  totalDisponible: number;
  cubreNecesidad: boolean;
  cantidadLotes: number;
  lotes: InventarioCompatible[];
};

type ComponentesResponse = {
  ok: boolean;
  solicitudCorteId?: string;
  OTE?: string;
  rowIndexPedido?: string;
  productoSolicitado?: string;
  cantidadSolicitadaUnd?: number;
  productoObjetivo?: {
    referencia: string;
    color: string;
    ancho: string;
    medidaFinal_mm: number;
    acabadoFinal: string;
  };
  tieneComposicion?: boolean;
  totalComponentes?: number;
  todosCubiertos?: boolean;
  componentes?: ComponenteInventario[];
  error?: string;
};

type ConsumosComponentes = Record<
  string,
  Record<string, string>
>;

type RemanenteForm = {
  id: string;
  cantidad: string;
  medidaMetros: string;
};

type ResultadoTransformacion = {
  success: boolean;

  transformacionKey?: string;

  OTE?: string;
  consecutivoCorte?: string;
  solicitudCorteId?: string;

  OPEOrigen?: string;
  inventarioOrigenKey?: string;

  cantidadOrigenUnd?: number;
  cantidadObtenidaUnd?: number;

  supervisor?: string;
  turno?: string;

  movimientosCreados?: number;
  remanentesCreados?: number;

  metrosOrigen?: number;
  metrosProductoBueno?: number;
  metrosRemanentes?: number;
  diferenciaMetros?: number;

  cantidadSolicitada?: number;
  obtenidoAnterior?: number;
  pendienteAntes?: number;
  pendienteDespues?: number;

  saldos?: Array<{
    inventarioKey: string;
    OPE: string;
    producto: string;
    medida_mm: number;
    saldoDisponible: number;
  }>;

  message?: string;
};

function formatMedida(mm: number) {
  if (!mm) return "-";

  return `${(mm / 1000).toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })} m`;
}

function formatFecha(value: string) {
  if (!value) return "-";

  const fecha = new Date(value);

  if (Number.isNaN(fecha.getTime())) {
    return value;
  }

  return fecha.toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function parseDecimal(value: string) {
  const limpio = String(value || "")
    .trim()
    .replace(",", ".");

  if (!limpio) return 0;

  const numero = Number(limpio);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function crearRemanente(): RemanenteForm {
  return {
    id: `REM_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    cantidad: "",
    medidaMetros: "",
  };
}

function crearTransformacionKey() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `TRFPP_${crypto.randomUUID()}`;
  }

  return `TRFPP_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export default function ConsumoEmpaquePage() {
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
  // OTE
  // =========================================================

  const [data, setData] = useState<ApiResponse | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [oteSeleccionada, setOteSeleccionada] =
    useState<GrupoOTE | null>(null);

  const [itemSeleccionado, setItemSeleccionado] =
    useState<ItemCorte | null>(null);

  // =========================================================
  // INVENTARIO COMPATIBLE
  // =========================================================

  const [compatibles, setCompatibles] = useState<
    InventarioCompatible[]
  >([]);

  const [loadingCompatibles, setLoadingCompatibles] =
    useState(false);

  const [errorCompatibles, setErrorCompatibles] =
    useState("");

  const [productoObjetivo, setProductoObjetivo] =
    useState<
      CompatiblesResponse["productoObjetivo"] | null
    >(null);

  const [origenSeleccionado, setOrigenSeleccionado] =
    useState<InventarioCompatible | null>(null);

  // =========================================================
  // PRODUCTOS COMPUESTOS
  // =========================================================

  const [modoCompuesto, setModoCompuesto] =
    useState(false);

  const [componentesInventario, setComponentesInventario] =
    useState<ComponenteInventario[]>([]);

  const [consumosComponentes, setConsumosComponentes] =
    useState<ConsumosComponentes>({});

  // =========================================================
  // SUPERVISORES
  // =========================================================

  const [supervisores, setSupervisores] = useState<
    string[]
  >([]);

  const [loadingSupervisores, setLoadingSupervisores] =
    useState(true);

  // =========================================================
  // TRANSFORMACIÓN
  // =========================================================

  const [cantidadOrigen, setCantidadOrigen] =
    useState("");

  const [cantidadObtenida, setCantidadObtenida] =
    useState("");

  const [hayRemanente, setHayRemanente] =
    useState(false);

  const [remanentes, setRemanentes] = useState<
    RemanenteForm[]
  >([]);

  const [turno, setTurno] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [observacion, setObservacion] =
    useState("");

  const [validacionSolicitada, setValidacionSolicitada] =
    useState(false);

  // =========================================================
  // GUARDADO REAL
  // =========================================================

  const [transformacionKey, setTransformacionKey] =
    useState("");

  const [guardando, setGuardando] =
    useState(false);

  const [errorGuardar, setErrorGuardar] =
    useState("");

  const [resultadoGuardar, setResultadoGuardar] =
    useState<ResultadoTransformacion | null>(null);

  // =========================================================
  // CARGAR ÓRDENES
  // =========================================================

  async function cargarOrdenes() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(
        "/api/produccion/control-producto-proceso/ordenes-corte",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(
          json?.error ||
            "No fue posible consultar las órdenes de corte."
        );
      }

      setData(json);
    } catch (e: any) {
      setError(
        e?.message ||
          "Ocurrió un error consultando las órdenes de corte."
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

    cargarOrdenes();
  }, [status, canAccess]);

  // =========================================================
  // CARGAR SUPERVISORES
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
              "No fue posible consultar supervisores."
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

  const ordenesFiltradas = useMemo(() => {
    const ordenes = data?.ordenes || [];

    const q = search
      .trim()
      .toLowerCase();

    if (!q) {
      return ordenes;
    }

    return ordenes.filter((grupo) => {
      if (
        grupo.OTE.toLowerCase().includes(q)
      ) {
        return true;
      }

      return grupo.items.some((item) =>
        [
          item.rowIndexPedido,
          item.productoSolicitado,
          item.pedidoKey,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(q)
        )
      );
    });
  }, [data, search]);

  // =========================================================
  // LIMPIAR TRANSFORMACIÓN
  // =========================================================

  function limpiarTransformacion() {
    setCantidadOrigen("");
    setCantidadObtenida("");

    setHayRemanente(false);
    setRemanentes([]);

    setTurno("");
    setSupervisor("");
    setObservacion("");

    setValidacionSolicitada(false);

    setTransformacionKey("");
    setGuardando(false);
    setErrorGuardar("");
    setResultadoGuardar(null);
  }

  function limpiarModoCompuesto() {
    setModoCompuesto(false);
    setComponentesInventario([]);
    setConsumosComponentes({});
  }

  function seleccionarLoteComponente(
    componente: string,
    inventarioKey: string
  ) {
    setConsumosComponentes((actual) => ({
      ...actual,
      [componente]: {
        ...(actual[componente] || {}),
        [inventarioKey]: "",
      },
    }));

    setValidacionSolicitada(false);
    setErrorGuardar("");
  }

  function quitarLoteComponente(
    componente: string,
    inventarioKey: string
  ) {
    setConsumosComponentes((actual) => {
      const lotesComponente = {
        ...(actual[componente] || {}),
      };

      delete lotesComponente[inventarioKey];

      return {
        ...actual,
        [componente]: lotesComponente,
      };
    });

    setValidacionSolicitada(false);
    setErrorGuardar("");
  }

  function actualizarConsumoComponente(
    componente: string,
    inventarioKey: string,
    value: string
  ) {
    if (
      value !== "" &&
      !/^\d*$/.test(value)
    ) {
      return;
    }

    setConsumosComponentes((actual) => ({
      ...actual,
      [componente]: {
        ...(actual[componente] || {}),
        [inventarioKey]: value,
      },
    }));

    setValidacionSolicitada(false);
    setErrorGuardar("");
  }

  function totalConsumidoComponente(
    componente: string
  ) {
    const lotes =
      consumosComponentes[componente] || {};

    return Object.values(lotes).reduce(
      (total, value) =>
        total + parseDecimal(value),
      0
    );
  }

  // =========================================================
  // SELECCIÓN OTE
  // =========================================================

  function abrirOTE(grupo: GrupoOTE) {
    setOteSeleccionada(grupo);
    setItemSeleccionado(null);

    setCompatibles([]);
    setProductoObjetivo(null);
    setOrigenSeleccionado(null);
    setErrorCompatibles("");
    limpiarModoCompuesto();

    limpiarTransformacion();

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cerrarOTE() {
    setOteSeleccionada(null);
    setItemSeleccionado(null);

    setCompatibles([]);
    setProductoObjetivo(null);
    setOrigenSeleccionado(null);
    setErrorCompatibles("");
    limpiarModoCompuesto();

    limpiarTransformacion();
  }

  // =========================================================
  // CONSULTAR INVENTARIO COMPATIBLE
  // =========================================================

  async function seleccionarItem(item: ItemCorte) {
    setItemSeleccionado(item);

    setCompatibles([]);
    setProductoObjetivo(null);
    setOrigenSeleccionado(null);
    setErrorCompatibles("");
    limpiarModoCompuesto();

    limpiarTransformacion();

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    try {
      setLoadingCompatibles(true);

      /*
       * Primero preguntamos si el producto final tiene
       * composición configurada. Si la tiene, la pantalla
       * cambia a modo de múltiples componentes y múltiples
       * lotes por componente.
       */
      const resComponentes = await fetch(
        `/api/produccion/control-producto-proceso/inventario-componentes?solicitudCorteId=${encodeURIComponent(
          item.solicitudCorteId
        )}`,
        {
          cache: "no-store",
        }
      );

      const jsonComponentes =
        (await resComponentes.json()) as ComponentesResponse;

      if (!resComponentes.ok || !jsonComponentes?.ok) {
        throw new Error(
          jsonComponentes?.error ||
            "No fue posible consultar la composición del producto."
        );
      }

      if (jsonComponentes.tieneComposicion) {
        const componentes = Array.isArray(
          jsonComponentes.componentes
        )
          ? jsonComponentes.componentes
          : [];

        setModoCompuesto(true);
        setComponentesInventario(componentes);

        const consumosIniciales: ConsumosComponentes = {};

        componentes.forEach((componente) => {
          /*
           * Ningún lote se selecciona automáticamente.
           * El operario debe indicar explícitamente qué lote
           * está utilizando mediante "Usar este lote".
           */
          consumosIniciales[componente.componente] = {};
        });

        setConsumosComponentes(consumosIniciales);

        if (jsonComponentes.productoObjetivo) {
          setProductoObjetivo({
            familia:
              jsonComponentes.productoObjetivo.referencia,
            color:
              jsonComponentes.productoObjetivo.color,
            ancho:
              jsonComponentes.productoObjetivo.ancho,
            medidaFinal_mm:
              jsonComponentes.productoObjetivo.medidaFinal_mm,
            acabadoFinal:
              jsonComponentes.productoObjetivo.acabadoFinal,
          });
        }

        return;
      }

      /*
       * Producto simple: conservamos exactamente el flujo
       * que ya funcionaba antes.
       */
      const res = await fetch(
        `/api/produccion/control-producto-proceso/inventario-compatible?solicitudCorteId=${encodeURIComponent(
          item.solicitudCorteId
        )}`,
        {
          cache: "no-store",
        }
      );

      const json =
        (await res.json()) as CompatiblesResponse;

      if (!res.ok || !json?.ok) {
        throw new Error(
          json?.error ||
            "No fue posible consultar el inventario compatible."
        );
      }

      setCompatibles(
        Array.isArray(json.compatibles)
          ? json.compatibles
          : []
      );

      setProductoObjetivo(
        json.productoObjetivo || null
      );
    } catch (e: any) {
      setErrorCompatibles(
        e?.message ||
          "Ocurrió un error consultando el inventario compatible."
      );
    } finally {
      setLoadingCompatibles(false);
    }
  }

  function cambiarItem() {
    setItemSeleccionado(null);

    setCompatibles([]);
    setProductoObjetivo(null);
    setOrigenSeleccionado(null);
    setErrorCompatibles("");
    limpiarModoCompuesto();

    limpiarTransformacion();
  }

  function seleccionarOrigen(
    inventario: InventarioCompatible
  ) {
    setOrigenSeleccionado(inventario);

    limpiarTransformacion();

    /*
     * Se genera una llave única para esta transformación.
     * Si ocurre un problema de conexión y se reintenta,
     * se conserva esta misma llave.
     */
    setTransformacionKey(
      crearTransformacionKey()
    );
  }

  // =========================================================
  // REMANENTES
  // =========================================================

  function cambiarHayRemanente(
    value: boolean
  ) {
    setHayRemanente(value);

    setValidacionSolicitada(false);
    setErrorGuardar("");

    if (value) {
      setRemanentes([
        crearRemanente(),
      ]);
    } else {
      setRemanentes([]);
    }
  }

  function agregarRemanente() {
    setRemanentes((actual) => [
      ...actual,
      crearRemanente(),
    ]);

    setValidacionSolicitada(false);
    setErrorGuardar("");
  }

  function quitarRemanente(id: string) {
    setRemanentes((actual) =>
      actual.filter(
        (remanente) =>
          remanente.id !== id
      )
    );

    setValidacionSolicitada(false);
    setErrorGuardar("");
  }

  function actualizarRemanente(
    id: string,
    campo:
      | "cantidad"
      | "medidaMetros",
    valor: string
  ) {
    if (
      valor !== "" &&
      !/^\d*[.,]?\d*$/.test(valor)
    ) {
      return;
    }

    setRemanentes((actual) =>
      actual.map((remanente) =>
        remanente.id === id
          ? {
              ...remanente,
              [campo]: valor,
            }
          : remanente
      )
    );

    setValidacionSolicitada(false);
    setErrorGuardar("");
  }

  // =========================================================
  // CÁLCULOS DE BALANCE
  // =========================================================

  const calculos = useMemo(() => {
    const cantidadOrigenNum =
      parseDecimal(cantidadOrigen);

    const cantidadObtenidaNum =
      parseDecimal(cantidadObtenida);

    const largoOrigenM =
      origenSeleccionado
        ? origenSeleccionado.medida_mm /
          1000
        : 0;

    const largoFinalM =
      productoObjetivo
        ? productoObjetivo.medidaFinal_mm /
          1000
        : 0;

    const metrosOrigen =
      cantidadOrigenNum *
      largoOrigenM;

    const metrosProductoBueno =
      cantidadObtenidaNum *
      largoFinalM;

    const metrosRemanentes =
      remanentes.reduce(
        (total, remanente) => {
          const cantidad =
            parseDecimal(
              remanente.cantidad
            );

          const medida =
            parseDecimal(
              remanente.medidaMetros
            );

          return (
            total +
            cantidad * medida
          );
        },
        0
      );

    const diferencia =
      metrosOrigen -
      metrosProductoBueno -
      metrosRemanentes;

    const rendimientoTeoricoPorTira =
      largoOrigenM > 0 &&
      largoFinalM > 0
        ? Math.floor(
            largoOrigenM /
              largoFinalM
          )
        : 0;

    return {
      cantidadOrigenNum,
      cantidadObtenidaNum,

      largoOrigenM,
      largoFinalM,

      metrosOrigen,
      metrosProductoBueno,
      metrosRemanentes,

      diferencia,

      rendimientoTeoricoPorTira,
    };
  }, [
    cantidadOrigen,
    cantidadObtenida,
    origenSeleccionado,
    productoObjetivo,
    remanentes,
  ]);

  // =========================================================
  // VALIDACIONES
  // =========================================================

  const erroresTransformacion =
    useMemo(() => {
      const errores: string[] = [];

      if (!origenSeleccionado) {
        return errores;
      }

      if (
        calculos.cantidadOrigenNum <=
        0
      ) {
        errores.push(
          "Indica cuántas unidades del lote fueron tomadas."
        );
      }

      if (
        calculos.cantidadOrigenNum >
        origenSeleccionado.cantidadDisponible
      ) {
        errores.push(
          `No puedes consumir ${calculos.cantidadOrigenNum} und porque el lote tiene ${origenSeleccionado.cantidadDisponible} und disponibles.`
        );
      }

      if (
        calculos.cantidadObtenidaNum <=
        0
      ) {
        errores.push(
          "Indica cuántas piezas buenas se obtuvieron."
        );
      }

      if (
        itemSeleccionado &&
        calculos.cantidadObtenidaNum >
          itemSeleccionado.cantidadSolicitadaUnd
      ) {
        errores.push(
          `Las piezas obtenidas superan las ${itemSeleccionado.cantidadSolicitadaUnd} und solicitadas para este consecutivo.`
        );
      }

      if (!turno) {
        errores.push(
          "Selecciona el turno."
        );
      }

      if (!supervisor) {
        errores.push(
          "Selecciona el supervisor."
        );
      }

      if (hayRemanente) {
        if (!remanentes.length) {
          errores.push(
            "Agrega al menos un remanente."
          );
        }

        remanentes.forEach(
          (
            remanente,
            index
          ) => {
            const cantidad =
              parseDecimal(
                remanente.cantidad
              );

            const medida =
              parseDecimal(
                remanente.medidaMetros
              );

            if (cantidad <= 0) {
              errores.push(
                `Remanente ${
                  index + 1
                }: indica una cantidad válida.`
              );
            }

            if (medida <= 0) {
              errores.push(
                `Remanente ${
                  index + 1
                }: indica una medida válida.`
              );
            }

            if (
              origenSeleccionado &&
              medida >
                origenSeleccionado.medida_mm /
                  1000
            ) {
              errores.push(
                `Remanente ${
                  index + 1
                }: la medida no puede superar la medida del material de origen.`
              );
            }
          }
        );
      }

      /*
       * Una diferencia positiva es permitida:
       * corte, puntas, desperdicio no recuperable, etc.
       *
       * Lo que nunca permitimos es una diferencia negativa.
       */
      if (
        calculos.diferencia <
        -0.001
      ) {
        errores.push(
          "El producto obtenido más los remanentes superan la longitud total tomada del lote."
        );
      }

      return errores;
    }, [
      calculos,
      origenSeleccionado,
      itemSeleccionado,
      turno,
      supervisor,
      hayRemanente,
      remanentes,
    ]);

  const transformacionValida =
    erroresTransformacion.length ===
      0 &&
    calculos.cantidadOrigenNum >
      0 &&
    calculos.cantidadObtenidaNum >
      0;

  // =========================================================
  // GUARDAR TRANSFORMACIÓN REAL
  // =========================================================

  async function guardarTransformacion() {
    if (
      !itemSeleccionado ||
      !origenSeleccionado ||
      !productoObjetivo
    ) {
      return;
    }

    setErrorGuardar("");

    /*
     * Por seguridad exigimos que la transformación
     * haya sido validada antes de permitir guardarla.
     */
    if (
      !validacionSolicitada ||
      !transformacionValida
    ) {
      setErrorGuardar(
        "Primero valida la transformación antes de guardarla."
      );

      return;
    }

    /*
     * Si por alguna razón todavía no existe llave,
     * la generamos aquí.
     */
    const key =
      transformacionKey ||
      crearTransformacionKey();

    if (!transformacionKey) {
      setTransformacionKey(
        key
      );
    }

    /*
     * Convertimos los remanentes de metros a mm.
     */
    const remanentesPayload =
      hayRemanente
        ? remanentes.map(
            (remanente) => ({
              cantidad: Math.floor(
                parseDecimal(
                  remanente.cantidad
                )
              ),

              medidaMm: Math.round(
                parseDecimal(
                  remanente.medidaMetros
                ) * 1000
              ),
            })
          )
        : [];

    const detalleRemanentes =
      remanentesPayload.length
        ? remanentesPayload
            .map(
              (remanente) =>
                `${remanente.cantidad} und × ${formatMedida(
                  remanente.medidaMm
                )}`
            )
            .join("\n")
        : "Sin remanentes";

    const confirmado =
      window.confirm(
        [
          "¿Confirmas esta transformación?",
          "",
          `OTE: ${itemSeleccionado.OTE}`,
          `Consecutivo: ${itemSeleccionado.rowIndexPedido}`,
          `Lote origen: ${origenSeleccionado.OPE}`,
          `Medida origen: ${formatMedida(
            origenSeleccionado.medida_mm
          )}`,
          "",
          `Unidades tomadas: ${calculos.cantidadOrigenNum}`,
          `Piezas buenas obtenidas: ${calculos.cantidadObtenidaNum}`,
          "",
          "Remanentes:",
          detalleRemanentes,
          "",
          `Supervisor: ${supervisor}`,
          `Turno: ${turno}`,
          "",
          `Material origen: ${calculos.metrosOrigen.toLocaleString(
            "es-CO",
            {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            }
          )} m`,
          `Producto bueno: ${calculos.metrosProductoBueno.toLocaleString(
            "es-CO",
            {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            }
          )} m`,
          `Remanentes: ${calculos.metrosRemanentes.toLocaleString(
            "es-CO",
            {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            }
          )} m`,
          `Diferencia: ${calculos.diferencia.toLocaleString(
            "es-CO",
            {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            }
          )} m`,
          "",
          "Esta operación modificará realmente el inventario de producto en proceso.",
        ].join("\n")
      );

    if (!confirmado) {
      return;
    }

    try {
      setGuardando(true);
      setErrorGuardar("");

      const res = await fetch(
        "/api/produccion/control-producto-proceso/transformacion",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            transformacionKey:
              key,

            solicitudCorteId:
              itemSeleccionado.solicitudCorteId,

            inventarioOrigenKey:
              origenSeleccionado.inventarioKey,

            cantidadOrigenUnd:
              calculos.cantidadOrigenNum,

            cantidadObtenidaUnd:
              calculos.cantidadObtenidaNum,

            remanentes:
              remanentesPayload,

            /*
             * Correo técnico del sistema.
             */
            usuario: email,

            /*
             * Responsable físico de la operación.
             */
            supervisor,

            turno,

            observacion,
          }),
        }
      );

      const json =
        (await res.json()) as ResultadoTransformacion;

      if (
        !res.ok ||
        !json?.success
      ) {
        throw new Error(
          json?.message ||
            "No fue posible registrar la transformación."
        );
      }

      setResultadoGuardar(
        json
      );

      /*
       * Actualizamos las órdenes,
       * pero dejamos visible el resultado
       * para que el usuario pueda revisarlo.
       */
      await cargarOrdenes();

      /*
       * Importante:
       * NO generamos una nueva transformacionKey aquí.
       * La operación ya quedó cerrada.
       */
    } catch (e: any) {
      setErrorGuardar(
        e?.message ||
          "Ocurrió un error registrando la transformación."
      );
    } finally {
      setGuardando(false);
    }
  }

  // =========================================================
  // VALIDACIÓN Y GUARDADO · PRODUCTO COMPUESTO
  // =========================================================

  const validacionCompuesto =
    useMemo(() => {
      const errores: string[] = [];

      const cantidadFinal =
        parseDecimal(
          cantidadObtenida
        );

      const consumosPayload: Array<{
        componente: string;
        inventarioKey: string;
        cantidadConsumidaUnd: number;
      }> = [];

      if (!modoCompuesto) {
        return {
          errores,
          cantidadFinal: 0,
          consumosPayload,
          totalConsumido: 0,
        };
      }

      if (
        cantidadFinal <= 0
      ) {
        errores.push(
          "Indica la cantidad final buena obtenida."
        );
      }

      if (
        itemSeleccionado &&
        cantidadFinal >
          itemSeleccionado
            .cantidadSolicitadaUnd
      ) {
        errores.push(
          `La cantidad final buena no puede superar las ${itemSeleccionado.cantidadSolicitadaUnd.toLocaleString(
            "es-CO"
          )} und solicitadas.`
        );
      }

      for (
        const componente of
          componentesInventario
      ) {
        const seleccionados =
          consumosComponentes[
            componente.componente
          ] || {};

        const keys =
          Object.keys(
            seleccionados
          );

        if (!keys.length) {
          errores.push(
            `Selecciona al menos un lote para ${componente.componente}.`
          );

          continue;
        }

        let totalComponente =
          0;

        for (
          const inventarioKey of
            keys
        ) {
          const lote =
            componente.lotes.find(
              (item) =>
                item.inventarioKey ===
                inventarioKey
            );

          if (!lote) {
            errores.push(
              `Uno de los lotes seleccionados para ${componente.componente} ya no está disponible.`
            );

            continue;
          }

          const cantidad =
            Math.floor(
              parseDecimal(
                seleccionados[
                  inventarioKey
                ]
              )
            );

          if (
            cantidad <= 0
          ) {
            errores.push(
              `Indica la cantidad realmente utilizada del lote ${lote.OPE}.`
            );

            continue;
          }

          if (
            cantidad >
            lote.cantidadDisponible
          ) {
            errores.push(
              `El lote ${lote.OPE} solo tiene ${lote.cantidadDisponible.toLocaleString(
                "es-CO"
              )} und disponibles.`
            );

            continue;
          }

          totalComponente +=
            cantidad;

          consumosPayload.push({
            componente:
              componente.componente,

            inventarioKey:
              lote.inventarioKey,

            cantidadConsumidaUnd:
              cantidad,
          });
        }

        if (
          cantidadFinal > 0
        ) {
          const necesario =
            Math.ceil(
              cantidadFinal *
                componente.factorPorUnidad
            );

          if (
            totalComponente <
            necesario
          ) {
            errores.push(
              `${componente.componente}: se necesitan mínimo ${necesario.toLocaleString(
                "es-CO"
              )} und y registraste ${totalComponente.toLocaleString(
                "es-CO"
              )} und.`
            );
          }
        }
      }

      if (!turno) {
        errores.push(
          "Selecciona el turno."
        );
      }

      if (!supervisor) {
        errores.push(
          "Selecciona el supervisor."
        );
      }

      const totalConsumido =
        consumosPayload.reduce(
          (
            total,
            consumo
          ) =>
            total +
            consumo.cantidadConsumidaUnd,
          0
        );

      return {
        errores,
        cantidadFinal,
        consumosPayload,
        totalConsumido,
      };
    }, [
      modoCompuesto,
      cantidadObtenida,
      itemSeleccionado,
      componentesInventario,
      consumosComponentes,
      turno,
      supervisor,
    ]);

  const consumoCompuestoValido =
    modoCompuesto &&
    validacionCompuesto.errores
      .length === 0 &&
    validacionCompuesto
      .cantidadFinal > 0 &&
    validacionCompuesto
      .consumosPayload.length >
      0;

  async function guardarConsumoCompuesto() {
    if (
      !modoCompuesto ||
      !itemSeleccionado
    ) {
      return;
    }

    setValidacionSolicitada(
      true
    );

    setErrorGuardar("");

    if (
      !consumoCompuestoValido
    ) {
      return;
    }

    const key =
      transformacionKey ||
      crearTransformacionKey();

    if (!transformacionKey) {
      setTransformacionKey(
        key
      );
    }

    const detalleConsumos =
      componentesInventario
        .map(
          (componente) => {
            const seleccionados =
              consumosComponentes[
                componente.componente
              ] || {};

            const lotes =
              componente.lotes
                .filter(
                  (lote) =>
                    Object.prototype.hasOwnProperty.call(
                      seleccionados,
                      lote.inventarioKey
                    )
                )
                .map(
                  (lote) =>
                    `${lote.OPE}: ${
                      Math.floor(
                        parseDecimal(
                          seleccionados[
                            lote.inventarioKey
                          ]
                        )
                      )
                    } und`
                )
                .join(", ");

            const consumido =
              totalConsumidoComponente(
                componente.componente
              );

            const necesario =
              Math.ceil(
                validacionCompuesto
                  .cantidadFinal *
                  componente.factorPorUnidad
              );

            return (
              `${componente.componente}: ` +
              `${consumido.toLocaleString(
                "es-CO"
              )} und consumidas / ` +
              `${necesario.toLocaleString(
                "es-CO"
              )} necesarias` +
              (lotes
                ? ` (${lotes})`
                : "")
            );
          }
        )
        .join("\n");

    const confirmado =
      window.confirm(
        [
          "¿Confirmas este consumo compuesto?",
          "",
          `OTE: ${itemSeleccionado.OTE}`,
          `Consecutivo: ${itemSeleccionado.rowIndexPedido}`,
          `Producto final bueno: ${validacionCompuesto.cantidadFinal.toLocaleString(
            "es-CO"
          )} und`,
          "",
          "Consumos:",
          detalleConsumos,
          "",
          `Supervisor: ${supervisor}`,
          `Turno: ${turno}`,
          "",
          "Esta operación descontará realmente los lotes seleccionados del inventario de producto en proceso.",
        ].join("\n")
      );

    if (!confirmado) {
      return;
    }

    try {
      setGuardando(true);
      setErrorGuardar("");

      const res =
        await fetch(
          "/api/produccion/control-producto-proceso/consumo-compuesto",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  transformacionKey:
                    key,

                  solicitudCorteId:
                    itemSeleccionado
                      .solicitudCorteId,

                  cantidadObtenidaUnd:
                    Math.floor(
                      validacionCompuesto
                        .cantidadFinal
                    ),

                  consumos:
                    validacionCompuesto
                      .consumosPayload,

                  usuario:
                    email,

                  supervisor,

                  turno,

                  observacion,
                }
              ),
          }
        );

      const json =
        (await res.json()) as ResultadoTransformacion;

      if (
        !res.ok ||
        !json?.success
      ) {
        throw new Error(
          json?.message ||
            "No fue posible registrar el consumo compuesto."
        );
      }

      setResultadoGuardar(
        json
      );

      await cargarOrdenes();
    } catch (e: any) {
      setErrorGuardar(
        e?.message ||
          "Ocurrió un error registrando el consumo compuesto."
      );
    } finally {
      setGuardando(false);
    }
  }

  // =========================================================
  // SESIÓN
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

  if (!canAccess) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-semibold text-red-800">
            Acceso no autorizado
          </h1>

          <p className="mt-2 text-sm text-red-700">
            Tu usuario no tiene permisos para
            registrar consumos de empaque.
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
      {/* =====================================================
          CABECERA
         ===================================================== */}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 text-sm text-slate-500">
            Producción · Control Producto en
            Proceso · Consumo de empaque
          </div>

          <h1 className="text-2xl font-semibold">
            Consumo de empaque
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Selecciona una orden de corte, el
            ítem y el lote de producto en
            proceso utilizado.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={
              cargarOrdenes
            }
            disabled={
              loading ||
              guardando
            }
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ↻ Actualizar
          </button>

          <Link
            href="/produccion/control-producto-proceso"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            ← Control P.P.
          </Link>
        </div>
      </div>

      {/* =====================================================
          ITEM SELECCIONADO
         ===================================================== */}

      {itemSeleccionado ? (
        <section className="mt-6 rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                Ítem a trabajar
              </div>

              <h2 className="mt-1 text-xl font-semibold text-slate-900">
                {itemSeleccionado.OTE}
                {" · "}
                Consecutivo{" "}
                {
                  itemSeleccionado.rowIndexPedido
                }
              </h2>
            </div>

            {!resultadoGuardar?.success ? (
              <button
                type="button"
                onClick={
                  cambiarItem
                }
                disabled={
                  guardando
                }
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cambiar ítem
              </button>
            ) : null}
          </div>

          {/* =================================================
              NECESIDAD
             ================================================= */}

          <div className="mt-5 rounded-xl border border-slate-200 p-5">
            <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Producto solicitado
                </div>

                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {
                    itemSeleccionado.productoSolicitado
                  }
                </div>

                <div className="mt-2 text-xs text-slate-500">
                  Solicitud:{" "}
                  {
                    itemSeleccionado.solicitudCorteId
                  }
                </div>
              </div>

              <div className="md:text-right">
                <div className="text-xs text-slate-500">
                  Cantidad solicitada
                </div>

                <div className="text-2xl font-semibold text-slate-900">
                  {Number(
                    itemSeleccionado.cantidadSolicitadaUnd ||
                      0
                  ).toLocaleString(
                    "es-CO"
                  )}{" "}
                  <span className="text-sm">
                    und
                  </span>
                </div>
              </div>
            </div>

            {productoObjetivo ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  {
                    productoObjetivo.familia
                  }
                </span>

                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  {
                    productoObjetivo.color
                  }
                </span>

                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  {
                    productoObjetivo.ancho
                  }
                </span>

                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  Final:{" "}
                  {formatMedida(
                    productoObjetivo.medidaFinal_mm
                  )}
                </span>
              </div>
            ) : null}
          </div>

          {/* =================================================
              INVENTARIO / COMPONENTES
             ================================================= */}

          {modoCompuesto &&
          resultadoGuardar?.success ? (
            <div className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-5">
              <div className="text-lg font-semibold text-emerald-800">
                ✓ Consumo compuesto registrado correctamente
              </div>

              <p className="mt-1 text-sm text-emerald-700">
                Los componentes fueron descontados de sus lotes reales y el avance del producto final quedó registrado.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-white/80 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                    Producto bueno
                  </div>

                  <div className="mt-1 text-xl font-semibold text-emerald-900">
                    {(
                      resultadoGuardar.cantidadObtenidaUnd ??
                      0
                    ).toLocaleString("es-CO")}{" "}
                    <span className="text-sm">
                      und
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-white/80 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                    Movimientos
                  </div>

                  <div className="mt-1 text-xl font-semibold text-emerald-900">
                    {resultadoGuardar.movimientosCreados ?? 0}
                  </div>
                </div>

                <div className="rounded-xl bg-white/80 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                    Pendiente
                  </div>

                  <div className="mt-1 text-xl font-semibold text-emerald-900">
                    {(
                      resultadoGuardar.pendienteDespues ??
                      0
                    ).toLocaleString("es-CO")}{" "}
                    <span className="text-sm">
                      und
                    </span>
                  </div>
                </div>
              </div>

              {resultadoGuardar.saldos?.length ? (
                <div className="mt-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Inventario después de la operación
                  </div>

                  <div className="mt-3 space-y-2">
                    {resultadoGuardar.saldos.map(
                      (saldo) => (
                        <div
                          key={saldo.inventarioKey}
                          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-100 bg-white/80 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900">
                              {saldo.producto}
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                              {saldo.OPE} ·{" "}
                              {formatMedida(
                                saldo.medida_mm
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-xs text-slate-500">
                              Saldo
                            </div>

                            <div className="text-lg font-semibold text-emerald-700">
                              {saldo.saldoDisponible.toLocaleString(
                                "es-CO"
                              )}{" "}
                              <span className="text-sm">
                                und
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 rounded-xl bg-white/60 px-4 py-3 text-xs text-emerald-800">
                Transformación:{" "}
                <b>
                  {resultadoGuardar.transformacionKey}
                </b>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    cambiarItem();
                    cargarOrdenes();

                    window.scrollTo({
                      top: 0,
                      behavior:
                        "smooth",
                    });
                  }}
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  Finalizar
                </button>

                <Link
                  href="/produccion/control-producto-proceso/inventario"
                  className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
                >
                  Ver inventario actual →
                </Link>

                <Link
                  href="/produccion/control-producto-proceso/historial"
                  className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
                >
                  Ver historial →
                </Link>
              </div>
            </div>
          ) : !resultadoGuardar?.success ? (
            modoCompuesto ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                        Producto compuesto
                      </div>

                      <h3 className="mt-1 text-lg font-semibold text-slate-900">
                        Componentes requeridos para este producto
                      </h3>

                      <p className="mt-1 text-sm text-slate-600">
                        Puedes consumir uno o varios lotes por componente. La cantidad usada en cada lote debe corresponder a lo que realmente ocurrió en planta.
                      </p>
                    </div>

                    <div className="rounded-xl bg-white px-4 py-3 text-right shadow-sm">
                      <div className="text-xs text-slate-500">
                        Componentes
                      </div>
                      <div className="text-xl font-semibold text-slate-900">
                        {componentesInventario.length}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="grid gap-4 md:grid-cols-[1fr_220px] md:items-end">
                    <div>
                      <label className="text-sm font-semibold text-slate-800">
                        Cantidad final buena a registrar
                      </label>
                      <p className="mt-1 text-xs text-slate-500">
                        Esta es la cantidad de conjuntos buenos que realmente se obtuvieron en esta operación.
                      </p>
                    </div>

                    <div>
                      <input
                        value={cantidadObtenida}
                        onChange={(e) => {
                          const value = e.target.value;

                          if (
                            value === "" ||
                            /^\d*$/.test(value)
                          ) {
                            setCantidadObtenida(value);
                            setValidacionSolicitada(false);
                            setErrorGuardar("");
                          }
                        }}
                        inputMode="numeric"
                        placeholder={String(
                          itemSeleccionado.cantidadSolicitadaUnd || ""
                        )}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-right text-lg font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  </div>
                </div>

                {componentesInventario.map((componente) => {
                  const cantidadFinal =
                    parseDecimal(cantidadObtenida);

                  const necesario =
                    cantidadFinal > 0
                      ? cantidadFinal * componente.factorPorUnidad
                      : componente.necesarioTeorico;

                  const consumido =
                    totalConsumidoComponente(
                      componente.componente
                    );

                  const diferencia =
                    consumido - necesario;

                  const completo =
                    cantidadFinal > 0 &&
                    consumido >= necesario;

                  return (
                    <div
                      key={componente.componente}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                    >
                      <div className="border-b border-slate-100 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                              Componente
                            </div>

                            <h4 className="mt-1 text-lg font-semibold text-slate-900">
                              {componente.componente}
                            </h4>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                                {componente.criterioComponente.color}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                                {componente.criterioComponente.ancho}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                                {formatMedida(
                                  componente.criterioComponente.medida_mm
                                )}
                              </span>
                              {componente.criterioComponente.acabado ? (
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                                  {componente.criterioComponente.acabado}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                              <div className="text-[11px] text-slate-500">
                                Factor
                              </div>
                              <div className="mt-1 font-semibold">
                                ×{componente.factorPorUnidad}
                              </div>
                            </div>

                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                              <div className="text-[11px] text-slate-500">
                                Necesario
                              </div>
                              <div className="mt-1 font-semibold">
                                {Number(necesario || 0).toLocaleString("es-CO")}
                              </div>
                            </div>

                            <div
                              className={`rounded-xl px-3 py-2 ${
                                completo
                                  ? "bg-emerald-50"
                                  : "bg-amber-50"
                              }`}
                            >
                              <div className="text-[11px] text-slate-500">
                                Consumido
                              </div>
                              <div
                                className={`mt-1 font-semibold ${
                                  completo
                                    ? "text-emerald-700"
                                    : "text-amber-700"
                                }`}
                              >
                                {Number(consumido || 0).toLocaleString("es-CO")}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {componente.lotes.length ? (
                        <div className="divide-y divide-slate-100">
                          {componente.lotes.map((lote) => {
                            const lotesSeleccionados =
                              consumosComponentes[
                                componente.componente
                              ] || {};

                            const seleccionado =
                              Object.prototype.hasOwnProperty.call(
                                lotesSeleccionados,
                                lote.inventarioKey
                              );

                            const value = seleccionado
                              ? lotesSeleccionados[
                                  lote.inventarioKey
                                ] || ""
                              : "";

                            const cantidadUsada =
                              parseDecimal(value);

                            const superaDisponible =
                              seleccionado &&
                              cantidadUsada >
                                lote.cantidadDisponible;

                            return (
                              <div
                                key={lote.inventarioKey}
                                className={`p-5 transition ${
                                  seleccionado
                                    ? "bg-indigo-50/40"
                                    : "bg-white"
                                }`}
                              >
                                <div className="grid gap-4 lg:grid-cols-[1fr_130px_150px_180px] lg:items-center">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="font-semibold text-slate-900">
                                        {lote.OPE}
                                      </div>

                                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                        Disponible
                                      </span>

                                      {seleccionado ? (
                                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                                          ✓ Seleccionado
                                        </span>
                                      ) : null}
                                    </div>

                                    <div className="mt-1 text-sm text-slate-700">
                                      {lote.producto}
                                    </div>

                                    <div className="mt-1 text-xs text-slate-400">
                                      Último movimiento: {formatFecha(
                                        lote.fechaUltimoMovimiento
                                      )}
                                    </div>
                                  </div>

                                  <div className="lg:text-right">
                                    <div className="text-xs text-slate-500">
                                      Medida
                                    </div>
                                    <div className="mt-1 font-semibold">
                                      {formatMedida(lote.medida_mm)}
                                    </div>
                                  </div>

                                  <div className="lg:text-right">
                                    <div className="text-xs text-slate-500">
                                      Disponible
                                    </div>
                                    <div className="mt-1 text-lg font-semibold text-emerald-700">
                                      {lote.cantidadDisponible.toLocaleString("es-CO")} und
                                    </div>
                                  </div>

                                  <div className="lg:text-right">
                                    {!seleccionado ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          seleccionarLoteComponente(
                                            componente.componente,
                                            lote.inventarioKey
                                          )
                                        }
                                        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                                      >
                                        Usar este lote
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          quitarLoteComponente(
                                            componente.componente,
                                            lote.inventarioKey
                                          )
                                        }
                                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                                      >
                                        Quitar lote
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {seleccionado ? (
                                  <div className="mt-4 rounded-xl border border-indigo-100 bg-white p-4">
                                    <div className="flex flex-wrap items-end justify-between gap-4">
                                      <div className="min-w-0 flex-1">
                                        <label className="text-xs font-semibold text-slate-700">
                                          Cantidad realmente utilizada
                                        </label>

                                        <p className="mt-1 text-xs text-slate-500">
                                          Registra las unidades que físicamente se tomaron de este lote.
                                        </p>
                                      </div>

                                      <div className="w-full sm:w-[240px]">
                                        <div className="flex items-center gap-2">
                                          <input
                                            value={value}
                                            onChange={(e) =>
                                              actualizarConsumoComponente(
                                                componente.componente,
                                                lote.inventarioKey,
                                                e.target.value
                                              )
                                            }
                                            inputMode="numeric"
                                            placeholder="0"
                                            className={`min-w-0 flex-1 rounded-xl border px-3 py-2 text-right font-semibold outline-none focus:ring-2 ${
                                              superaDisponible
                                                ? "border-red-300 text-red-700 focus:border-red-400 focus:ring-red-100"
                                                : "border-slate-300 focus:border-indigo-400 focus:ring-indigo-100"
                                            }`}
                                          />

                                          <span className="text-sm text-slate-500">
                                            und
                                          </span>
                                        </div>

                                        {superaDisponible ? (
                                          <div className="mt-1 text-xs font-medium text-red-600">
                                            Supera las {lote.cantidadDisponible.toLocaleString("es-CO")} und disponibles.
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="m-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                          No hay inventario disponible que cumpla el criterio de este componente.
                        </div>
                      )}

                      <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                          <div className="text-slate-500">
                            Total disponible: {componente.totalDisponible.toLocaleString("es-CO")} und · {componente.cantidadLotes} lote(s)
                          </div>

                          <div className="flex items-center gap-3">
                            {cantidadFinal <= 0 ? (
                              <span className="font-medium text-slate-500">
                                Indica la cantidad final buena
                              </span>
                            ) : diferencia < 0 ? (
                              <span className="font-semibold text-amber-700">
                                Faltan {Math.abs(diferencia).toLocaleString("es-CO")} und
                              </span>
                            ) : (
                              <>
                                <span className="font-semibold text-emerald-700">
                                  Cubierto
                                </span>
                                {diferencia > 0 ? (
                                  <span className="font-medium text-rose-600">
                                    Exceso / pérdida: {diferencia.toLocaleString("es-CO")} und
                                  </span>
                                ) : null}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="font-semibold text-slate-900">
                    Confirmar consumo compuesto
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    Revisa las cantidades reales utilizadas y registra quién realizó la operación.
                  </p>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        Turno *
                      </label>

                      <select
                        value={turno}
                        disabled={guardando}
                        onChange={(e) => {
                          setTurno(
                            e.target.value
                          );

                          setValidacionSolicitada(
                            false
                          );

                          setErrorGuardar(
                            ""
                          );
                        }}
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
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
                        disabled={
                          loadingSupervisores ||
                          guardando
                        }
                        onChange={(e) => {
                          setSupervisor(
                            e.target.value
                          );

                          setValidacionSolicitada(
                            false
                          );

                          setErrorGuardar(
                            ""
                          );
                        }}
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                      >
                        <option value="">
                          {loadingSupervisores
                            ? "Cargando supervisores..."
                            : "Seleccionar supervisor"}
                        </option>

                        {supervisores.map(
                          (nombre) => (
                            <option
                              key={nombre}
                              value={nombre}
                            >
                              {nombre}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="text-sm font-medium text-slate-700">
                      Observación
                    </label>

                    <textarea
                      value={observacion}
                      disabled={guardando}
                      onChange={(e) => {
                        setObservacion(
                          e.target.value
                        );

                        setErrorGuardar(
                          ""
                        );
                      }}
                      rows={3}
                      placeholder="Opcional. Ej. Se consumieron unidades adicionales por producto no conforme."
                      className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                    />
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-white p-3">
                      <div className="text-xs text-slate-500">
                        Producto final bueno
                      </div>

                      <div className="mt-1 text-lg font-semibold text-slate-900">
                        {validacionCompuesto.cantidadFinal.toLocaleString(
                          "es-CO"
                        )}{" "}
                        und
                      </div>
                    </div>

                    <div className="rounded-xl bg-white p-3">
                      <div className="text-xs text-slate-500">
                        Total consumido
                      </div>

                      <div className="mt-1 text-lg font-semibold text-slate-900">
                        {validacionCompuesto.totalConsumido.toLocaleString(
                          "es-CO"
                        )}{" "}
                        und
                      </div>
                    </div>

                    <div
                      className={`rounded-xl p-3 ${
                        consumoCompuestoValido
                          ? "bg-emerald-50"
                          : "bg-amber-50"
                      }`}
                    >
                      <div className="text-xs text-slate-500">
                        Estado
                      </div>

                      <div
                        className={`mt-1 text-lg font-semibold ${
                          consumoCompuestoValido
                            ? "text-emerald-700"
                            : "text-amber-700"
                        }`}
                      >
                        {consumoCompuestoValido
                          ? "Listo para guardar"
                          : "Pendiente"}
                      </div>
                    </div>
                  </div>

                  {validacionSolicitada &&
                  validacionCompuesto.errores.length ? (
                    <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                      <div className="text-sm font-semibold text-red-800">
                        Revisa antes de guardar:
                      </div>

                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
                        {validacionCompuesto.errores.map(
                          (errorItem) => (
                            <li key={errorItem}>
                              {errorItem}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  ) : null}

                  {errorGuardar ? (
                    <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                      {errorGuardar}
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      Al confirmar, PEX descontará cada lote seleccionado y registrará una sola cantidad final buena para la OTE.
                    </p>

                    <button
                      type="button"
                      disabled={guardando}
                      onClick={() => {
                        setValidacionSolicitada(
                          true
                        );

                        if (
                          consumoCompuestoValido
                        ) {
                          guardarConsumoCompuesto();
                        }
                      }}
                      className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {guardando
                        ? "Registrando consumo..."
                        : "Registrar consumo compuesto"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (

            <div className="mt-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Producto en proceso
                    disponible
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Selecciona el lote que
                    físicamente estás utilizando.
                  </p>
                </div>

                {!loadingCompatibles ? (
                  <div className="text-sm text-slate-500">
                    {compatibles.length}{" "}
                    {compatibles.length ===
                    1
                      ? "lote compatible"
                      : "lotes compatibles"}
                  </div>
                ) : null}
              </div>

              {loadingCompatibles ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                  Buscando producto en
                  proceso compatible...
                </div>
              ) : errorCompatibles ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
                  {errorCompatibles}
                </div>
              ) : compatibles.length ===
                0 ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-5">
                  <div className="text-sm font-semibold text-amber-800">
                    No hay producto
                    compatible disponible
                  </div>

                  <p className="mt-1 text-sm text-amber-700">
                    No se encontró inventario
                    con la misma familia,
                    color y ancho, y con
                    longitud suficiente para
                    este ítem.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {compatibles.map(
                    (inv) => {
                      const seleccionado =
                        origenSeleccionado?.inventarioKey ===
                        inv.inventarioKey;

                      return (
                        <div
                          key={
                            inv.inventarioKey
                          }
                          className={`rounded-xl border p-5 transition ${
                            seleccionado
                              ? "border-indigo-400 bg-indigo-50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="grid gap-4 lg:grid-cols-[1fr_130px_140px_150px] lg:items-center">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-base font-semibold text-slate-900">
                                  {
                                    inv.OPE
                                  }
                                </div>

                                {seleccionado ? (
                                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                                    Seleccionado
                                  </span>
                                ) : null}
                              </div>

                              <div className="mt-1 text-sm font-medium text-slate-800">
                                {
                                  inv.producto
                                }
                              </div>

                              <div className="mt-2 text-xs text-slate-400">
                                Último
                                movimiento:{" "}
                                {formatFecha(
                                  inv.fechaUltimoMovimiento
                                )}
                              </div>
                            </div>

                            <div className="lg:text-right">
                              <div className="text-xs text-slate-500">
                                Medida origen
                              </div>

                              <div className="text-lg font-semibold text-slate-900">
                                {formatMedida(
                                  inv.medida_mm
                                )}
                              </div>
                            </div>

                            <div className="lg:text-right">
                              <div className="text-xs text-slate-500">
                                Disponible
                              </div>

                              <div className="text-xl font-semibold text-emerald-700">
                                {inv.cantidadDisponible.toLocaleString(
                                  "es-CO"
                                )}{" "}
                                <span className="text-sm">
                                  und
                                </span>
                              </div>
                            </div>

                            <div className="lg:text-right">
                              <button
                                type="button"
                                disabled={
                                  guardando
                                }
                                onClick={() =>
                                  seleccionarOrigen(
                                    inv
                                  )
                                }
                                className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                  seleccionado
                                    ? "bg-indigo-100 text-indigo-700"
                                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                                }`}
                              >
                                {seleccionado
                                  ? "Lote seleccionado"
                                  : "Usar este lote"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>

            )
          ) : null}

          {/* =================================================
              FORMULARIO DE TRANSFORMACIÓN
             ================================================= */}

          {origenSeleccionado &&
          productoObjetivo ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Registrar transformación
                </div>

                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {
                    origenSeleccionado.OPE
                  }
                  {" → "}
                  {
                    itemSeleccionado.OTE
                  }
                  {" / "}
                  {
                    itemSeleccionado.rowIndexPedido
                  }
                </h3>

                <p className="mt-1 text-sm text-slate-600">
                  Registra lo que realmente
                  ocurrió durante el corte y
                  empaque.
                </p>
              </div>

              {/* =============================================
                  SI YA GUARDÓ, MOSTRAR RESULTADO
                 ============================================= */}

              {resultadoGuardar?.success ? (
                <div className="mt-5 rounded-xl border border-emerald-300 bg-emerald-50 p-5">
                  <div className="text-lg font-semibold text-emerald-800">
                    ✓ Transformación registrada correctamente
                  </div>

                  <div className="mt-2 text-sm text-emerald-700">
                    La operación ya fue aplicada
                    al inventario de producto en
                    proceso.
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-white/80 p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                        Tomadas
                      </div>

                      <div className="mt-1 text-xl font-semibold text-emerald-900">
                        {(
                          resultadoGuardar.cantidadOrigenUnd ??
                          0
                        ).toLocaleString(
                          "es-CO"
                        )}{" "}
                        <span className="text-sm">
                          und
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl bg-white/80 p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                        Obtenidas
                      </div>

                      <div className="mt-1 text-xl font-semibold text-emerald-900">
                        {(
                          resultadoGuardar.cantidadObtenidaUnd ??
                          0
                        ).toLocaleString(
                          "es-CO"
                        )}{" "}
                        <span className="text-sm">
                          und
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl bg-white/80 p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                        Pendiente
                      </div>

                      <div className="mt-1 text-xl font-semibold text-emerald-900">
                        {(
                          resultadoGuardar.pendienteDespues ??
                          0
                        ).toLocaleString(
                          "es-CO"
                        )}{" "}
                        <span className="text-sm">
                          und
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-white/70 p-4">
                      <div className="text-xs text-slate-500">
                        Movimientos creados
                      </div>

                      <div className="mt-1 font-semibold text-slate-900">
                        {
                          resultadoGuardar.movimientosCreados ??
                          0
                        }
                      </div>
                    </div>

                    <div className="rounded-xl bg-white/70 p-4">
                      <div className="text-xs text-slate-500">
                        Tipos de remanente
                      </div>

                      <div className="mt-1 font-semibold text-slate-900">
                        {
                          resultadoGuardar.remanentesCreados ??
                          0
                        }
                      </div>
                    </div>
                  </div>

                  {resultadoGuardar.saldos?.length ? (
                    <div className="mt-5">
                      <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        Inventario después de la operación
                      </div>

                      <div className="mt-3 space-y-2">
                        {resultadoGuardar.saldos.map(
                          (saldo) => (
                            <div
                              key={
                                saldo.inventarioKey
                              }
                              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-100 bg-white/80 px-4 py-3"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-900">
                                  {
                                    saldo.producto
                                  }
                                </div>

                                <div className="mt-1 text-xs text-slate-500">
                                  {
                                    saldo.OPE
                                  }{" "}
                                  ·{" "}
                                  {formatMedida(
                                    saldo.medida_mm
                                  )}
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-xs text-slate-500">
                                  Saldo
                                </div>

                                <div
                                  className={`text-lg font-semibold ${
                                    saldo.saldoDisponible >
                                    0
                                      ? "text-emerald-700"
                                      : "text-slate-600"
                                  }`}
                                >
                                  {saldo.saldoDisponible.toLocaleString(
                                    "es-CO"
                                  )}{" "}
                                  <span className="text-sm">
                                    und
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5 rounded-xl bg-white/60 px-4 py-3 text-xs text-emerald-800">
                    Transformación:{" "}
                    <b>
                      {
                        resultadoGuardar.transformacionKey
                      }
                    </b>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        cambiarItem();

                        cargarOrdenes();

                        window.scrollTo({
                          top: 0,
                          behavior:
                            "smooth",
                        });
                      }}
                      className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                    >
                      Finalizar
                    </button>

                    <Link
                      href="/produccion/control-producto-proceso/inventario"
                      className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
                    >
                      Ver inventario actual →
                    </Link>

                    <Link
                      href="/produccion/control-producto-proceso/historial"
                      className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
                    >
                      Ver historial →
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  {/* =========================================
                      ORIGEN / OBTENIDO
                     ========================================= */}

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Material origen
                      </div>

                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        {formatMedida(
                          origenSeleccionado.medida_mm
                        )}{" "}
                        por unidad
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        Disponible:{" "}
                        {
                          origenSeleccionado.cantidadDisponible
                        }{" "}
                        und
                      </div>

                      <label className="mt-4 block text-sm font-medium text-slate-700">
                        Unidades tomadas *
                      </label>

                      <input
                        type="text"
                        inputMode="numeric"
                        value={
                          cantidadOrigen
                        }
                        disabled={
                          guardando
                        }
                        onChange={(e) => {
                          const valor =
                            e.target.value;

                          if (
                            valor !== "" &&
                            !/^\d+$/.test(
                              valor
                            )
                          ) {
                            return;
                          }

                          setCantidadOrigen(
                            valor
                          );

                          setValidacionSolicitada(
                            false
                          );

                          setErrorGuardar(
                            ""
                          );
                        }}
                        placeholder="Ej. 10"
                        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                      />
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Producto obtenido
                      </div>

                      <div className="mt-2 text-sm font-semibold text-slate-900">
                        {formatMedida(
                          productoObjetivo.medidaFinal_mm
                        )}{" "}
                        por pieza
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        Pedido:{" "}
                        {
                          itemSeleccionado.cantidadSolicitadaUnd
                        }{" "}
                        und
                      </div>

                      <label className="mt-4 block text-sm font-medium text-slate-700">
                        Piezas buenas obtenidas *
                      </label>

                      <input
                        type="text"
                        inputMode="numeric"
                        value={
                          cantidadObtenida
                        }
                        disabled={
                          guardando
                        }
                        onChange={(e) => {
                          const valor =
                            e.target.value;

                          if (
                            valor !== "" &&
                            !/^\d+$/.test(
                              valor
                            )
                          ) {
                            return;
                          }

                          setCantidadObtenida(
                            valor
                          );

                          setValidacionSolicitada(
                            false
                          );

                          setErrorGuardar(
                            ""
                          );
                        }}
                        placeholder="Ej. 10"
                        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                      />
                    </div>
                  </div>

                  {calculos.rendimientoTeoricoPorTira >
                  0 ? (
                    <div className="mt-3 text-xs text-slate-500">
                      Aprovechamiento
                      teórico sin considerar
                      pérdidas de corte: hasta{" "}
                      <b>
                        {
                          calculos.rendimientoTeoricoPorTira
                        }
                      </b>{" "}
                      pieza(s) de{" "}
                      {formatMedida(
                        productoObjetivo.medidaFinal_mm
                      )}{" "}
                      por cada unidad de{" "}
                      {formatMedida(
                        origenSeleccionado.medida_mm
                      )}
                      .
                    </div>
                  ) : null}

                  {/* =========================================
                      REMANENTES
                     ========================================= */}

                  <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">
                          ¿Quedó material aprovechable?
                        </h4>

                        <p className="mt-1 text-xs text-slate-500">
                          Registra únicamente
                          sobrantes que vuelvan
                          físicamente al
                          inventario.
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={
                            guardando
                          }
                          onClick={() =>
                            cambiarHayRemanente(
                              true
                            )
                          }
                          className={`rounded-xl px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                            hayRemanente
                              ? "bg-indigo-600 text-white"
                              : "border border-slate-300 bg-white text-slate-700"
                          }`}
                        >
                          Sí
                        </button>

                        <button
                          type="button"
                          disabled={
                            guardando
                          }
                          onClick={() =>
                            cambiarHayRemanente(
                              false
                            )
                          }
                          className={`rounded-xl px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                            !hayRemanente
                              ? "bg-slate-800 text-white"
                              : "border border-slate-300 bg-white text-slate-700"
                          }`}
                        >
                          No
                        </button>
                      </div>
                    </div>

                    {hayRemanente ? (
                      <div className="mt-5 space-y-3">
                        {remanentes.map(
                          (
                            remanente,
                            index
                          ) => (
                            <div
                              key={
                                remanente.id
                              }
                              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-slate-800">
                                  Remanente{" "}
                                  {index +
                                    1}
                                </div>

                                {remanentes.length >
                                1 ? (
                                  <button
                                    type="button"
                                    disabled={
                                      guardando
                                    }
                                    onClick={() =>
                                      quitarRemanente(
                                        remanente.id
                                      )
                                    }
                                    className="text-xs font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Quitar
                                  </button>
                                ) : null}
                              </div>

                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <div>
                                  <label className="text-xs font-medium text-slate-600">
                                    Cantidad
                                    física
                                  </label>

                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    disabled={
                                      guardando
                                    }
                                    value={
                                      remanente.cantidad
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      actualizarRemanente(
                                        remanente.id,
                                        "cantidad",
                                        e
                                          .target
                                          .value
                                      )
                                    }
                                    placeholder="Ej. 10"
                                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs font-medium text-slate-600">
                                    Medida real
                                    de cada
                                    remanente
                                  </label>

                                  <div className="mt-1 flex items-center gap-2">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      disabled={
                                        guardando
                                      }
                                      value={
                                        remanente.medidaMetros
                                      }
                                      onChange={(
                                        e
                                      ) =>
                                        actualizarRemanente(
                                          remanente.id,
                                          "medidaMetros",
                                          e
                                            .target
                                            .value
                                        )
                                      }
                                      placeholder="Ej. 1,26"
                                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                                    />

                                    <span className="text-sm text-slate-500">
                                      m
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        )}

                        <button
                          type="button"
                          disabled={
                            guardando
                          }
                          onClick={
                            agregarRemanente
                          }
                          className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          + Agregar otro
                          remanente
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {/* =========================================
                      RESPONSABLE
                     ========================================= */}

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        Turno *
                      </label>

                      <select
                        value={
                          turno
                        }
                        disabled={
                          guardando
                        }
                        onChange={(e) => {
                          setTurno(
                            e.target.value
                          );

                          setValidacionSolicitada(
                            false
                          );

                          setErrorGuardar(
                            ""
                          );
                        }}
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
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
                        value={
                          supervisor
                        }
                        disabled={
                          loadingSupervisores ||
                          guardando
                        }
                        onChange={(e) => {
                          setSupervisor(
                            e.target.value
                          );

                          setValidacionSolicitada(
                            false
                          );

                          setErrorGuardar(
                            ""
                          );
                        }}
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                      >
                        <option value="">
                          {loadingSupervisores
                            ? "Cargando supervisores..."
                            : "Seleccionar supervisor"}
                        </option>

                        {supervisores.map(
                          (
                            nombre
                          ) => (
                            <option
                              key={
                                nombre
                              }
                              value={
                                nombre
                              }
                            >
                              {
                                nombre
                              }
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="text-sm font-medium text-slate-700">
                      Observación
                    </label>

                    <textarea
                      value={
                        observacion
                      }
                      disabled={
                        guardando
                      }
                      onChange={(e) => {
                        setObservacion(
                          e.target.value
                        );

                        setErrorGuardar(
                          ""
                        );
                      }}
                      rows={3}
                      placeholder="Opcional. Ej. Corte realizado y remanente medido físicamente."
                      className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                    />
                  </div>

                  {/* =========================================
                      BALANCE
                     ========================================= */}

                  <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
                    <h4 className="text-sm font-semibold text-slate-900">
                      Balance de material
                    </h4>

                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <div className="text-xs text-slate-500">
                          Material origen
                        </div>

                        <div className="mt-1 font-semibold text-slate-900">
                          {calculos.metrosOrigen.toLocaleString(
                            "es-CO",
                            {
                              minimumFractionDigits:
                                3,
                              maximumFractionDigits:
                                3,
                            }
                          )}{" "}
                          m
                        </div>
                      </div>

                      <div className="rounded-xl bg-emerald-50 p-3">
                        <div className="text-xs text-emerald-700">
                          Producto bueno
                        </div>

                        <div className="mt-1 font-semibold text-emerald-700">
                          {calculos.metrosProductoBueno.toLocaleString(
                            "es-CO",
                            {
                              minimumFractionDigits:
                                3,
                              maximumFractionDigits:
                                3,
                            }
                          )}{" "}
                          m
                        </div>
                      </div>

                      <div className="rounded-xl bg-blue-50 p-3">
                        <div className="text-xs text-blue-700">
                          Remanentes
                        </div>

                        <div className="mt-1 font-semibold text-blue-700">
                          {calculos.metrosRemanentes.toLocaleString(
                            "es-CO",
                            {
                              minimumFractionDigits:
                                3,
                              maximumFractionDigits:
                                3,
                            }
                          )}{" "}
                          m
                        </div>
                      </div>

                      <div
                        className={`rounded-xl p-3 ${
                          calculos.diferencia <
                          -0.001
                            ? "bg-red-50"
                            : "bg-amber-50"
                        }`}
                      >
                        <div
                          className={`text-xs ${
                            calculos.diferencia <
                            -0.001
                              ? "text-red-700"
                              : "text-amber-700"
                          }`}
                        >
                          Diferencia
                        </div>

                        <div
                          className={`mt-1 font-semibold ${
                            calculos.diferencia <
                            -0.001
                              ? "text-red-700"
                              : "text-amber-700"
                          }`}
                        >
                          {calculos.diferencia.toLocaleString(
                            "es-CO",
                            {
                              minimumFractionDigits:
                                3,
                              maximumFractionDigits:
                                3,
                            }
                          )}{" "}
                          m
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-slate-500">
                      Una diferencia positiva
                      corresponde al material no
                      recuperado por corte,
                      puntas, ajuste o
                      desperdicio. Una
                      diferencia negativa no es
                      válida.
                    </p>
                  </div>

                  {/* =========================================
                      VALIDACIÓN
                     ========================================= */}

                  {validacionSolicitada ? (
                    transformacionValida ? (
                      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="font-semibold text-emerald-800">
                          ✓ Transformación matemáticamente válida
                        </div>

                        <p className="mt-1 text-sm text-emerald-700">
                          Revisa los datos y
                          confirma el guardado
                          para afectar el
                          inventario real.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="font-semibold text-red-800">
                          Revisa la
                          transformación
                        </div>

                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
                          {erroresTransformacion.map(
                            (
                              error,
                              index
                            ) => (
                              <li
                                key={
                                  index
                                }
                              >
                                {
                                  error
                                }
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )
                  ) : null}

                  {/* =========================================
                      ERROR DE GUARDADO
                     ========================================= */}

                  {errorGuardar ? (
                    <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                      {
                        errorGuardar
                      }
                    </div>
                  ) : null}

                  {/* =========================================
                      BOTONES
                     ========================================= */}

                  <div className="mt-6 flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      disabled={
                        guardando
                      }
                      onClick={() => {
                        setErrorGuardar(
                          ""
                        );

                        setValidacionSolicitada(
                          true
                        );
                      }}
                      className="rounded-xl border border-indigo-200 bg-white px-5 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Validar transformación
                    </button>

                    {validacionSolicitada &&
                    transformacionValida ? (
                      <button
                        type="button"
                        onClick={
                          guardarTransformacion
                        }
                        disabled={
                          guardando
                        }
                        className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {guardando
                          ? "Guardando..."
                          : "Guardar transformación"}
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* =====================================================
          OTE SELECCIONADA
         ===================================================== */}

      {oteSeleccionada &&
      !itemSeleccionado ? (
        <section className="mt-6 rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                Orden de corte seleccionada
              </div>

              <h2 className="mt-1 text-xl font-semibold text-slate-900">
                {
                  oteSeleccionada.OTE
                }
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Selecciona el
                consecutivo que vas a
                trabajar.
              </p>
            </div>

            <button
              type="button"
              onClick={
                cerrarOTE
              }
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Cambiar OTE
            </button>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            <div className="divide-y divide-slate-200">
              {oteSeleccionada.items.map(
                (item) => (
                  <div
                    key={
                      item.solicitudCorteId ||
                      item.sheetRow
                    }
                    className="grid gap-4 p-4 lg:grid-cols-[100px_1fr_140px_140px] lg:items-center"
                  >
                    <div>
                      <div className="text-xs text-slate-500">
                        Consecutivo
                      </div>

                      <div className="text-base font-semibold text-slate-900">
                        {
                          item.rowIndexPedido
                        }
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {
                          item.productoSolicitado
                        }
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {
                          item.solicitudCorteId
                        }
                      </div>
                    </div>

                    <div className="lg:text-right">
                      <div className="text-xs text-slate-500">
                        Solicitado
                      </div>

                      <div className="font-semibold text-slate-900">
                        {Number(
                          item.cantidadSolicitadaUnd ||
                            0
                        ).toLocaleString(
                          "es-CO"
                        )}{" "}
                        und
                      </div>
                    </div>

                    <div className="lg:text-right">
                      <button
                        type="button"
                        onClick={() =>
                          seleccionarItem(
                            item
                          )
                        }
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
                      >
                        Seleccionar
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* =====================================================
          RESUMEN Y BUSCADOR
         ===================================================== */}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              OTE disponibles
            </div>

            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {data?.totalOTE ??
                0}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Ítems disponibles
            </div>

            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {data?.totalItems ??
                0}
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
            Buscar OTE, consecutivo o producto
          </label>

          <input
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Ej. OTE260073, 7005, Enganche Central..."
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </section>

      {/* =====================================================
          LISTADO DE ÓRDENES
         ===================================================== */}

      {loading ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            Consultando órdenes de corte...
          </p>
        </section>
      ) : error ? (
        <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-medium text-red-700">
            {error}
          </p>
        </section>
      ) : ordenesFiltradas.length ===
        0 ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            No se encontraron órdenes con ese criterio.
          </p>
        </section>
      ) : (
        <section className="mt-6 space-y-4">
          {ordenesFiltradas.map(
            (grupo) => (
              <div
                key={
                  grupo.OTE
                }
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-900">
                        {
                          grupo.OTE
                        }
                      </h2>

                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        Generada
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      {
                        grupo.cantidadItems
                      }{" "}
                      {grupo.cantidadItems ===
                      1
                        ? "ítem"
                        : "ítems"}
                    </p>
                  </div>

                  <div className="flex items-center gap-5">
                    <div className="text-right">
                      <div className="text-xs text-slate-500">
                        Total solicitado
                      </div>

                      <div className="font-semibold text-slate-900">
                        {grupo.totalSolicitadoUnd.toLocaleString(
                          "es-CO"
                        )}{" "}
                        und
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        abrirOTE(
                          grupo
                        )
                      }
                      className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
                    >
                      Ver ítems
                    </button>
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                  <div className="divide-y divide-slate-200">
                    {grupo.items
                      .slice(
                        0,
                        3
                      )
                      .map(
                        (
                          item
                        ) => (
                          <div
                            key={
                              item.solicitudCorteId ||
                              item.sheetRow
                            }
                            className="grid gap-3 p-4 md:grid-cols-[100px_1fr_auto]"
                          >
                            <div>
                              <div className="text-xs text-slate-500">
                                Consecutivo
                              </div>

                              <div className="font-semibold text-slate-900">
                                {
                                  item.rowIndexPedido
                                }
                              </div>
                            </div>

                            <div className="text-sm font-medium text-slate-900">
                              {
                                item.productoSolicitado
                              }
                            </div>

                            <div className="md:text-right">
                              <div className="text-xs text-slate-500">
                                Solicitado
                              </div>

                              <div className="font-semibold text-slate-900">
                                {Number(
                                  item.cantidadSolicitadaUnd ||
                                    0
                                ).toLocaleString(
                                  "es-CO"
                                )}{" "}
                                und
                              </div>
                            </div>
                          </div>
                        )
                      )}
                  </div>
                </div>

                {grupo.items.length >
                3 ? (
                  <div className="mt-3 text-xs text-slate-500">
                    +{" "}
                    {grupo.items.length -
                      3}{" "}
                    ítem(s) adicionales.
                    Pulsa{" "}
                    <b>
                      Ver ítems
                    </b>{" "}
                    para consultar la
                    orden completa.
                  </div>
                ) : null}
              </div>
            )
          )}
        </section>
      )}
    </main>
  );
}