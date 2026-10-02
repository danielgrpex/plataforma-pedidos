"use client";

import { useEffect, useMemo, useState } from "react";

import { useParams, useRouter } from "next/navigation";

type OTEItem = {

  solicitudCorteId: string;

  sheetRowSolicitudCorte: number;

  pedidoKey: string;

  rowIndexPedido: number;

  consecutivo: string;

  cliente: string;

  direccion: string;

  oc: string;

  fechaRequerida: string;

  productoPedido: string;

  cantidadPedido: unknown;

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

  ote: string;

  referencia: string;

  color: string;

  ancho: string;

  largo: string;

  acabado: string;

  codigoSiigo: string;

};

type OTEResponse = {

  success: boolean;

  ote: string;

  resumen: {

    totalItems: number;

    totalPedidos: number;

    totalUnidades: number;

  };

  items: OTEItem[];

  message?: string;

};

type ActividadMaestroItem = {
  sheetRow: number;
  acabado: string;
  acabadoNormalizado: string;
  actividadesRealizar: string;
  configurado: boolean;
};

type ActividadesResponse = {
  success: boolean;
  resumen: {
    total: number;
    configurados: number;
    sinActividad: number;
  };
  items: ActividadMaestroItem[];
  message?: string;
};

type InsumoAcabadoMaestroItem = {
  sheetRow: number;
  codigoSiigo: string;
  insumo: string;
  acabadoSencillo: string;
  acabadoSencilloNormalizado: string;
  acabadoDoble: string;
  acabadoDobleNormalizado: string;
  acabadoTriple: string;
  acabadoTripleNormalizado: string;
  configurado: boolean;
};

type InsumosAcabadosResponse = {
  success: boolean;
  resumen: {
    total: number;
    configurados: number;
    sinConfigurar: number;
  };
  items: InsumoAcabadoMaestroItem[];
  message?: string;
};

type ReglaInsumo = {
  codigoSiigo: string;
  insumo: string;
  multiplicador: number;
};

type InsumoCalculado = {
  codigoSiigo: string;
  insumo: string;
  unidad: "Metros";
  cantidad: number;
};

/* =========================================================

   HELPERS

   ========================================================= */

function formatCantidad(value: number) {

  return Number(value || 0).toLocaleString("es-CO", {

    maximumFractionDigits: 3,

  });

}

function extraerMetros(largo: string) {

  const texto = String(largo || "")

    .toLowerCase()

    .replace(/\s/g, "")

    .replace("metros", "")

    .replace("metro", "")

    .replace("m", "")

    .replace(",", ".");

  const n = Number(texto);

  return Number.isFinite(n) ? n : 0;

}

function formatearFechaGeneracion(items: OTEItem[]) {

  const fechas = items

    .map((item) => new Date(item.fechaCreacion))

    .filter((fecha) => !Number.isNaN(fecha.getTime()))

    .sort((a, b) => a.getTime() - b.getTime());

  const fecha = fechas[0] || new Date();

  return new Intl.DateTimeFormat("es-CO", {

    weekday: "long",

    day: "numeric",

    month: "long",

    year: "numeric",

    timeZone: "America/Bogota",

  }).format(fecha);

}

function obtenerProductoInicial(item: OTEItem) {

  return [

    item.referencia,

    item.color,

    item.ancho,

  ]

    .filter(Boolean)

    .join(" | ");

}

function normalizarAcabado(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

function separarAcabados(value: unknown) {
  return String(value ?? "")
    .split(",")
    .map((parte) => normalizarAcabado(parte))
    .filter(Boolean);
}

function calcularInsumos(
  items: OTEItem[],
  reglas: Record<string, ReglaInsumo>
): InsumoCalculado[] {
  const acumulado = new Map<
    string,
    InsumoCalculado
  >();

  for (const item of items) {
    const largo = extraerMetros(
      item.largo
    );

    const cantidad = Number(
      item.cantidadSolicitadaUnd || 0
    );

    if (
      largo <= 0 ||
      cantidad <= 0
    ) {
      continue;
    }

    const acabados =
      separarAcabados(
        item.acabado
      );

    for (
      const acabado of acabados
    ) {
      const regla =
        reglas[acabado];

      if (!regla) {
        continue;
      }

      const consumo =
        largo *
        cantidad *
        regla.multiplicador;

      const actual =
        acumulado.get(
          regla.codigoSiigo
        );

      if (actual) {
        actual.cantidad +=
          consumo;
      } else {
        acumulado.set(
          regla.codigoSiigo,
          {
            codigoSiigo:
              regla.codigoSiigo,
            insumo:
              regla.insumo,
            unidad:
              "Metros",
            cantidad:
              consumo,
          }
        );
      }
    }
  }

  return Array.from(
  acumulado.values()
)
  .map((insumo) => ({
    ...insumo,
    cantidad: Math.ceil(
      insumo.cantidad
    ),
  }))
  .sort((a, b) =>
    a.codigoSiigo.localeCompare(
      b.codigoSiigo
    )
  );
}

/* =========================================================

   PAGE

   ========================================================= */

export default function OTEPreviewPage() {

  const params =

    useParams<{

      ote: string;

    }>();

  const router =

    useRouter();

  const ote =

    decodeURIComponent(

      String(params?.ote || "")

    );

  const [data, setData] =

    useState<OTEResponse | null>(

      null

    );

  const [
    actividadesMaestro,
    setActividadesMaestro,
  ] = useState<Record<string, string>>({});

  const [
    reglasInsumos,
    setReglasInsumos,
  ] = useState<Record<string, ReglaInsumo>>({});

  const [loading, setLoading] =

    useState(true);

  const [error, setError] =

    useState("");

  /* =======================================================

     CARGAR OTE

     ======================================================= */

  useEffect(() => {

    let mounted = true;

    async function load() {

      setLoading(true);

      setError("");

      try {
        const [
          detalleRes,
          actividadesRes,
          insumosRes,
        ] = await Promise.all([
          fetch(
            `/api/planeacion/programacion/corte/ote/detalle?ote=${encodeURIComponent(
              ote
            )}`,
            {
              cache: "no-store",
            }
          ),
          fetch(
            "/api/planeacion/programacion/corte/ote/actividades-realizar",
            {
              cache: "no-store",
            }
          ),
          fetch(
            "/api/planeacion/programacion/corte/ote/insumos-acabados",
            {
              cache: "no-store",
            }
          ),
        ]);

        const detalleJson =
          (await detalleRes
            .json()
            .catch(() => null)) as OTEResponse | null;

        const actividadesJson =
          (await actividadesRes
            .json()
            .catch(() => null)) as ActividadesResponse | null;

        const insumosJson =
          (await insumosRes
            .json()
            .catch(() => null)) as InsumosAcabadosResponse | null;

        if (
          !detalleRes.ok ||
          !detalleJson?.success
        ) {
          throw new Error(
            detalleJson?.message ||
              "No se pudo cargar la OTE."
          );
        }

        if (
          !actividadesRes.ok ||
          !actividadesJson?.success
        ) {
          throw new Error(
            actividadesJson?.message ||
              "No se pudo cargar el maestro ActividadesRealizar."
          );
        }

        if (
          !insumosRes.ok ||
          !insumosJson?.success
        ) {
          throw new Error(
            insumosJson?.message ||
              "No se pudo cargar el maestro InsumosAcabados."
          );
        }

        if (!mounted) {
          return;
        }

        const actividadesMap: Record<string, string> = {};

        for (const actividad of actividadesJson.items) {
          if (
            !actividad.configurado ||
            !actividad.actividadesRealizar
          ) {
            continue;
          }

          const key =
            actividad.acabadoNormalizado ||
            normalizarAcabado(
              actividad.acabado
            );

          if (key) {
            actividadesMap[key] =
              actividad.actividadesRealizar;
          }
        }

        setActividadesMaestro(
          actividadesMap
        );

        const reglasMap: Record<
          string,
          ReglaInsumo
        > = {};

        for (
          const insumo of
          insumosJson.items
        ) {
          if (
            !insumo.configurado ||
            !insumo.codigoSiigo ||
            !insumo.insumo
          ) {
            continue;
          }

          const registrar = (
            acabado: string,
            multiplicador: number
          ) => {
            const key =
              normalizarAcabado(
                acabado
              );

            if (!key) {
              return;
            }

            reglasMap[key] = {
              codigoSiigo:
                insumo.codigoSiigo,
              insumo:
                insumo.insumo,
              multiplicador,
            };
          };

          registrar(
            insumo.acabadoSencilloNormalizado ||
              insumo.acabadoSencillo,
            1
          );

          registrar(
            insumo.acabadoDobleNormalizado ||
              insumo.acabadoDoble,
            2
          );

          registrar(
            insumo.acabadoTripleNormalizado ||
              insumo.acabadoTriple,
            3
          );
        }

        setReglasInsumos(
          reglasMap
        );

        setData(detalleJson);

      } catch (e) {

        console.error(e);

        if (!mounted) {

          return;

        }

        setError(

          e instanceof Error

            ? e.message

            : "Error cargando OTE."

        );

      } finally {

        if (mounted) {

          setLoading(false);

        }

      }

    }

    if (ote) {

      load();

    }

    return () => {

      mounted = false;

    };

  }, [ote]);

  /* =======================================================

     CÁLCULOS

     ======================================================= */

  const items =

    data?.items || [];

  const fechaGeneracion =

    useMemo(

      () =>

        formatearFechaGeneracion(

          items

        ),

      [items]

    );

  const year =

    useMemo(() => {

      const fechas =

        items

          .map(

            (item) =>

              new Date(

                item.fechaCreacion

              )

          )

          .filter(

            (fecha) =>

              !Number.isNaN(

                fecha.getTime()

              )

          );

      if (fechas.length) {

        return new Intl.DateTimeFormat(

          "es-CO",

          {

            year: "numeric",

            timeZone:

              "America/Bogota",

          }

        ).format(

          fechas[0]

        );

      }

      return String(

        new Date().getFullYear()

      );

    }, [items]);

  const insumosCalculados =
    useMemo(
      () =>
        calcularInsumos(
          items,
          reglasInsumos
        ),
      [
        items,
        reglasInsumos,
      ]
    );

  const totalMetrosInsumos =
    useMemo(
      () =>
        insumosCalculados.reduce(
          (
            total,
            insumo
          ) =>
            total +
            insumo.cantidad,
          0
        ),
      [insumosCalculados]
    );

  function obtenerActividades(
    item: OTEItem
  ) {
    const acabadoNormalizado =
      normalizarAcabado(
        item.acabado
      );

    if (!acabadoNormalizado) {
      return "PENDIENTE DEFINIR";
    }

    return (
      actividadesMaestro[
        acabadoNormalizado
      ] ||
      "PENDIENTE DEFINIR"
    );
  }

  /* =======================================================

     ESTADOS

     ======================================================= */

  if (loading) {

    return (

      <main className="mx-auto max-w-6xl px-6 py-8">

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          Cargando {ote}...

        </div>

      </main>

    );

  }

  if (error || !data) {

    return (

      <main className="mx-auto max-w-6xl px-6 py-8">

        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">

          {error ||

            "No fue posible cargar la OTE."}

        </div>

      </main>

    );

  }

  /* =======================================================

     RENDER

     ======================================================= */

  return (

    <>

      <style jsx global>{`

  @media print {

    @page {

      size: A4 landscape;

      margin: 4mm;

    }

    html,

    body {

      margin: 0 !important;

      padding: 0 !important;

      background: white !important;

    }

    /* Ocultar navegación y pie global de PEX. */

    header,

    nav,

    footer {

      display: none !important;

    }

    .no-print {

      display: none !important;

    }

    /* Quitar márgenes y ancho máximo de la página web. */

    .print-wrapper {

      width: 100% !important;

      max-width: none !important;

      margin: 0 !important;

      padding: 0 !important;

    }

    /*

     * IMPORTANTE PARA OTE GRANDES:
     * el documento completo SÍ puede dividirse entre páginas.
     * Antes estaba en break-inside: avoid y Chrome desplazaba
     * la tabla completa, dejando una primera página casi vacía.

     */

    .orden-documento {

      width: 100% !important;

      margin: 0 !important;

      padding: 0 !important;

      border: none !important;

      box-shadow: none !important;

      break-inside: auto !important;

      page-break-inside: auto !important;

      overflow: visible !important;

      zoom: 0.94;

    }

    /*

     * La tabla principal puede continuar en varias páginas.
     * El encabezado de columnas se repite automáticamente.

     */

    .tabla-principal {

      break-inside: auto !important;

      page-break-inside: auto !important;

    }

    .tabla-principal thead {

      display: table-header-group !important;

    }

    .tabla-principal tbody {

      break-inside: auto !important;

      page-break-inside: auto !important;

    }

    /*

     * Nunca partir una fila individual por la mitad.
     * Sí permitimos que el conjunto completo de filas
     * se distribuya entre varias hojas.

     */

    .tabla-principal tr {

      break-inside: avoid !important;

      page-break-inside: avoid !important;

    }

    .tabla-principal td,

    .tabla-principal th {

      break-inside: avoid !important;

      page-break-inside: avoid !important;

    }

    /*

     * El bloque final debe viajar unido:
     * Solicitud de Insumos + Observaciones +
     * Elaboró/Aprobó + Conformidad.

     * Si no cabe al final de la última página de ítems,
     * Chrome lo pasa completo a la siguiente, evitando
     * dejar firmas o conformidad solas.

     */

    .cierre-orden {

      break-inside: avoid !important;

      page-break-inside: avoid !important;

    }

    .cierre-orden table,

    .cierre-orden tr,

    .cierre-orden td,

    .cierre-orden th {

      break-inside: avoid !important;

      page-break-inside: avoid !important;

    }

  }

`}</style>

      <main className="print-wrapper mx-auto max-w-[1500px] px-6 py-8">

        {/* =================================================

            CONTROLES

           \================================================= */}

        <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">

          <div>

            <div className="text-sm text-slate-500">

              Planeación · Programación · Corte · Orden de Trabajo

            </div>

            <h1 className="mt-1 text-2xl font-semibold">

              {data.ote}

            </h1>

            <p className="mt-1 text-sm text-slate-500">

              Vista previa del formato de Orden de Trabajo.

            </p>

          </div>

          <div className="flex flex-wrap gap-2">
  <button
    type="button"
    onClick={() =>
      router.push(
        "/planeacion/programacion/corte"
      )
    }
    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
  >
    ← Volver
  </button>

  <button
    type="button"
    onClick={() =>
      router.push(
        `/planeacion/programacion/corte/ote/${encodeURIComponent(
          data.ote
        )}/trazas`
      )
    }
    className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
  >
    Validar empaque / Generar trazas
  </button>

  <button
    type="button"
    onClick={() =>
      window.print()
    }
    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
  >
    Imprimir / Guardar PDF
  </button>
</div>

        </div>

        {/* =================================================

            DOCUMENTO

           \================================================= */}

        <section className="orden-documento overflow-hidden bg-white text-black shadow-xl">

          <div className="border border-black p-[6px]">

            {/* =============================================

                ENCABEZADO

               \============================================= */}

            <table className="w-full border-collapse text-[9px] leading-tight">

              <tbody>

                <tr>

                  <td

                    rowSpan={2}

                    className="w-[23%] border border-black px-2 py-1"

                  >

                    <div className="flex items-center justify-center">

                      <img

                        src="/logo-gr.png"

                        alt="Industrias Plásticas GR"

                        className="h-[46px] max-w-[150px] object-contain"

                      />

                    </div>

                  </td>

                  <td className="border border-black px-2 py-1 text-center text-[14px] font-bold">

                    ORDEN DE TRABAJO EXTRUSIÓN

                  </td>

                  <td

                    rowSpan={2}

                    className="w-[17%] border border-black p-0"

                  >

                    <table className="h-full w-full border-collapse">

                      <tbody>

                        <tr>

                          <td className="border-b border-r border-black px-2 py-[3px] font-semibold">

                            Código

                          </td>

                          <td className="border-b border-black px-2 py-[3px] font-semibold">

                            PEX-FO-16

                          </td>

                        </tr>

                        <tr>

                          <td className="border-b border-r border-black px-2 py-[3px] font-semibold">

                            Versión

                          </td>

                          <td className="border-b border-black px-2 py-[3px] font-semibold">

                            2

                          </td>

                        </tr>

                        <tr>

                          <td className="border-r border-black px-2 py-[3px] font-semibold">

                            Fecha

                          </td>

                          <td className="px-2 py-[3px] font-semibold">

                            01/07/2025

                          </td>

                        </tr>

                      </tbody>

                    </table>

                  </td>

                </tr>

                <tr>

                  <td className="border border-black px-2 py-1 text-center font-semibold">

                    SISTEMAS INTEGRADOS DE GESTIÓN

                  </td>

                </tr>

              </tbody>

            </table>

            {/* =============================================

                INFORMACIÓN SUPERIOR

               \============================================= */}

            <div className="flex items-center justify-between px-2 py-3 text-[10px]">

              <div>

                <span className="font-bold">

                  Fecha de Generación:

                </span>{" "}

                {fechaGeneracion}

              </div>

              <div>

                <span className="font-semibold text-sky-700">

                  ORDEN N°:

                </span>{" "}

                <span className="border-b border-black font-bold text-sky-700">

                  {data.ote}

                </span>

              </div>

            </div>

            {/* =============================================

                TABLA PRINCIPAL

               \============================================= */}

            <table className="tabla-principal w-full table-fixed border-collapse text-[8px] leading-[1.15]">

              <thead>

                <tr className="font-bold">

                  <th className="w-[5%] border border-black px-1 py-2">

                    Consecutivo

                  </th>

                  <th className="w-[16%] border border-black px-1 py-2">

                    Cliente

                  </th>

                  <th className="w-[10%] border border-black px-1 py-2">

                    # OC/Pedido/Cot.

                  </th>

                  <th className="w-[8%] border border-black px-1 py-2">

                    # Orden Producción

                  </th>

                  <th className="w-[13%] border border-black px-1 py-2">

                    Producto Inicial

                  </th>

                  <th className="w-[6%] border border-black px-1 py-2">

                    Cantidad Inicial

                  </th>

                  <th className="w-[10%] border border-black px-1 py-2">

                    Actividades a Realizar

                  </th>

                  <th className="w-[7%] border border-black px-1 py-2">

                    Código Siigo Final

                  </th>

                  <th className="w-[19%] border border-black px-1 py-2">

                    Producto Final

                  </th>

                  <th className="w-[6%] border border-black px-1 py-2">

                    Cantidad Final

                  </th>

                </tr>

              </thead>

              <tbody>

                {items.map(

                  (item) => {

                    const productoInicial =

                      obtenerProductoInicial(

                        item

                      );

                    const actividades =

                      obtenerActividades(

                        item

                      );

                    const codigoSiigo =

                      item.codigoSiigo ||

                      "Pte Código";

                    return (

                      <tr

                        key={

                          item.solicitudCorteId

                        }

                      >

                        <td className="border border-black px-1 py-2 text-center font-semibold">

                          {Number(

                            item.consecutivo

                          ).toLocaleString(

                            "es-CO"

                          )}

                        </td>

                        <td className="border border-black px-1 py-2 text-center">

                          {item.cliente}{" "}

                          {item.direccion}

                        </td>

                        <td className="border border-black px-1 py-2 text-center font-semibold">

                          {item.oc ||

                            "—"}

                        </td>

                        <td className="border border-black px-1 py-2 text-center">

                          Empaque -{" "}

                          {year}

                        </td>

                        <td className="border border-black px-1 py-2 text-center">

                          {

                            productoInicial

                          }

                        </td>

                        <td className="border border-black px-1 py-2 text-center font-semibold">

                          {formatCantidad(

                            item.cantidadSolicitadaUnd

                          )}

                        </td>

                        <td className="border border-black px-1 py-2 text-center">

                          {actividades}

                        </td>

                        <td className="border border-black px-1 py-2 text-center">

                          {codigoSiigo}

                        </td>

                        <td className="border border-black px-1 py-2 text-center">

                          {

                            item.productoSolicitado

                          }

                        </td>

                        <td className="border border-black px-1 py-2 text-center font-semibold">

                          {formatCantidad(

                            item.cantidadSolicitadaUnd

                          )}

                        </td>

                      </tr>

                    );

                  }

                )}

                {/* Filas vacías para mantener formato similar */}

                {Array.from({

                  length: Math.max(

                    0,

                    8 -

                      items.length

                  ),

                }).map(

                  (_, index) => (

                    <tr

                      key={`empty-${index}`}

                    >

                      {Array.from({

                        length: 10,

                      }).map(

                        (

                          __,

                          col

                        ) => (

                          <td

                            key={col}

                            className="h-[27px] border border-black"

                          />

                        )

                      )}

                    </tr>

                  )

                )}

              </tbody>

            </table>

            <div className="cierre-orden">
            {/* =============================================

                SOLICITUD DE INSUMOS

               \============================================= */}

            <table className="mt-3 w-full border-collapse text-[8px]">

              <thead>

                <tr>

                  <th

                    colSpan={6}

                    className="border border-black px-2 py-2 text-center font-bold"

                  >

                    Solicitud de Insumos

                  </th>

                </tr>

                <tr>

                  <th className="w-[24%] border border-black px-2 py-1">

                    Código Insumo

                  </th>

                  <th className="w-[33%] border border-black px-2 py-1">

                    Nombre Insumo

                  </th>

                  <th className="w-[10%] border border-black px-2 py-1">

                    Und. de Medida

                  </th>

                  <th className="w-[12%] border border-black px-2 py-1">

                    Cantidad

                  </th>

                  <th className="w-[10%] border border-black px-2 py-1">

                    Quién Entrega

                  </th>

                  <th className="w-[11%] border border-black px-2 py-1">

                    Quién Recibe

                  </th>

                </tr>

              </thead>

              <tbody>

                {insumosCalculados.length >
                0 ? (
                  insumosCalculados.map(
                    (insumo) => (
                      <tr
                        key={
                          insumo.codigoSiigo
                        }
                      >
                        <td className="border border-black px-2 py-2 text-center">
                          {
                            insumo.codigoSiigo
                          }
                        </td>

                        <td className="border border-black px-2 py-2 text-center">
                          {
                            insumo.insumo
                          }
                        </td>

                        <td className="border border-black px-2 py-2 text-center">
                          {
                            insumo.unidad
                          }
                        </td>

                        <td className="border border-black px-2 py-2 text-center font-semibold">
                          {formatCantidad(
                            insumo.cantidad
                          )}
                        </td>

                        <td className="border border-black px-2 py-2" />

                        <td className="border border-black px-2 py-2" />
                      </tr>
                    )
                  )
                ) : (
                  <tr>
                    {Array.from({
                      length: 6,
                    }).map(
                      (
                        _,
                        index
                      ) => (
                        <td
                          key={
                            index
                          }
                          className="h-[27px] border border-black px-2 py-2"
                        />
                      )
                    )}
                  </tr>
                )}

              </tbody>

            </table>

            {/* =============================================

                OBSERVACIONES

               \============================================= */}

            <table className="mt-3 w-full border-collapse text-[8px]">

              <tbody>

                <tr>

                  <th className="border border-black px-2 py-2 text-center font-bold">

                    Observaciones

                  </th>

                </tr>

                <tr>

                  <td className="h-[30px] border border-black" />

                </tr>

              </tbody>

            </table>

            {/* =============================================

                ELABORÓ / APROBÓ

               \============================================= */}

            <div className="grid grid-cols-2 gap-14 px-10 pb-4 pt-8 text-center text-[8px]">

              <div>

                <div className="h-[30px] border-b border-black" />

                <div className="pt-2 font-semibold">

                  ELABORÓ: Asistente de Automatización, Infraestructura, Soplado y Extrusión

                </div>

              </div>

              <div>

                <div className="h-[30px] border-b border-black" />

                <div className="pt-2 font-semibold">

                  APROBÓ: Gerente de Automatización, Infraestructura, Soplado y Extrusión

                </div>

              </div>

            </div>

            {/* =============================================

                CONFORMIDAD

               \============================================= */}

            <table className="w-full border-collapse text-[8px]">

              <tbody>

                <tr>

                  <th

                    colSpan={3}

                    className="border border-black px-2 py-2 text-center font-bold"

                  >

                    Conformidad de Producto - Inicio de Orden de Trabajo

                  </th>

                </tr>

                <tr>

                  <td className="w-1/3 border border-black px-4 pb-1 pt-7 text-center font-semibold">

                    Coordinador de Extrusión y Empaque

                  </td>

                  <td className="w-1/3 border border-black px-4 pb-1 pt-7 text-center font-semibold">

                    Analista de Aseguramiento de Calidad - Extrusión

                  </td>

                  <td className="w-1/3 border border-black px-4 pb-1 pt-7 text-center font-semibold">

                    Fecha y Hora de Inicio

                  </td>

                </tr>

              </tbody>

            </table>
            </div>

          </div>

        </section>

        {/* =================================================

            RESUMEN SOLO PANTALLA

           \================================================= */}

        <div className="no-print mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="text-sm font-semibold">

            Datos calculados automáticamente

          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-4">

            <div className="rounded-xl bg-slate-50 p-3">

              <div className="text-xs text-slate-500">

                Ítems

              </div>

              <div className="mt-1 text-xl font-semibold">

                {

                  data.resumen

                    .totalItems

                }

              </div>

            </div>

            <div className="rounded-xl bg-slate-50 p-3">

              <div className="text-xs text-slate-500">

                Pedidos

              </div>

              <div className="mt-1 text-xl font-semibold">

                {

                  data.resumen

                    .totalPedidos

                }

              </div>

            </div>

            <div className="rounded-xl bg-slate-50 p-3">

              <div className="text-xs text-slate-500">

                Unidades

              </div>

              <div className="mt-1 text-xl font-semibold">

                {formatCantidad(

                  data.resumen

                    .totalUnidades

                )}

              </div>

            </div>

            <div className="rounded-xl bg-emerald-50 p-3">

              <div className="text-xs text-emerald-700">

                Insumos calculados

              </div>

              <div className="mt-1 text-xl font-semibold text-emerald-800">

                {
                  insumosCalculados.length
                }{" "}
                tipo(s)

              </div>

              <div className="mt-1 text-xs text-emerald-700">

                {formatCantidad(
                  totalMetrosInsumos
                )}{" "}
                m consolidados

              </div>

            </div>

          </div>

        </div>

      </main>

    </>

  );

}