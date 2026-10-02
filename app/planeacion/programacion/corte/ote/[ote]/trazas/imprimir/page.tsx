"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

/* =========================================================
   TIPOS
   ========================================================= */

type ItemValidado = {
  solicitudCorteId: string;

  ote: string;

  consecutivo: string;

  productoInicial: string;
  productoSolicitado: string;

  referencia: string;
  color: string;
  ancho: string;
  largo: string;
  acabado: string;

  cliente: string;
  direccion: string;
  oc: string;

  codigoSiigo: string;

  fechaCreacion: string;

  cantidadSolicitada: number;

  cantidadPorPaquete: number;

  distribucion: number[];

  totalPaquetes: number;
};

type PayloadTrazas = {
  ote: string;

  generadoEn: string;

  items: ItemValidado[];
};

type Traza = ItemValidado & {
  numeroPaquete: number;
  cantidadPaquete: number;
};

/* =========================================================
   HELPERS
   ========================================================= */

function formatFecha(
  fechaIso: string
) {
  const fecha =
    new Date(fechaIso);

  if (
    Number.isNaN(
      fecha.getTime()
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "es-CO",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone:
        "America/Bogota",
    }
  ).format(fecha);
}

function productoTraza(
  item: ItemValidado
) {
  const referencia =
    String(
      item.referencia || ""
    ).trim();

  const acabado =
    String(
      item.acabado || ""
    ).trim();

  if (
    referencia &&
    acabado
  ) {
    return `${referencia} - ${acabado}`;
  }

  return (
    referencia ||
    acabado ||
    item.productoInicial
  );
}

function chunk<T>(
  array: T[],
  size: number
) {
  const result: T[][] =
    [];

  for (
    let i = 0;
    i < array.length;
    i += size
  ) {
    result.push(
      array.slice(
        i,
        i + size
      )
    );
  }

  return result;
}

/* =========================================================
   COMPONENTE TRAZA
   ========================================================= */

function TarjetaTraza({
  traza,
}: {
  traza: Traza;
}) {
  const codigoSiigo =
    traza.codigoSiigo ||
    "Pte Código";

  const clienteCompleto =
    [
      traza.cliente,
      traza.direccion,
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <article className="traza-card">
      {/* =================================================
          CABECERA
         ================================================= */}

      <table className="traza-header">
        <tbody>
          <tr>
            <td
              rowSpan={2}
              className="logo-cell"
            >
              <img
                src="/logo-gr.png"
                alt="GR"
                className="traza-logo"
              />
            </td>

            <td className="titulo-cell">
              <div className="titulo-traza">
                TRAZABILIDAD
                <br />
                DE EXTRUSIÓN
              </div>
            </td>

            <td className="meta-label">
              Código
            </td>

            <td className="meta-value">
              PEX-FO-02
            </td>
          </tr>

          <tr>
            <td className="sistema-cell">
              SISTEMA INTEGRADO DE GESTIÓN
            </td>

            <td className="meta-label">
              Versión
            </td>

            <td className="meta-value">
              5
            </td>
          </tr>

          <tr>
            <td
              colSpan={2}
              className="sistema-bottom"
            >
              SISTEMA INTEGRADO DE GESTIÓN
            </td>

            <td className="meta-label">
              Fecha
            </td>

            <td className="meta-value">
              01-07-2025
            </td>
          </tr>
        </tbody>
      </table>

      {/* =================================================
          PRODUCTO
         ================================================= */}

      <table className="producto-table">
        <thead>
          <tr>
            <th className="producto-col">
              PRODUCTO
            </th>

            <th className="color-col">
              COLOR
            </th>

            <th className="ancho-col">
              ANCHO
            </th>

            <th className="largo-col">
              LARGO
            </th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>
              {productoTraza(
                traza
              )}
            </td>

            <td>
              {traza.color}
            </td>

            <td>
              {traza.ancho}
            </td>

            <td>
              {traza.largo}
            </td>
          </tr>
        </tbody>
      </table>

      {/* =================================================
          DATOS / APROBADO
         ================================================= */}

      <div className="datos-aprobado">
        <table className="datos-table">
          <tbody>
            <tr>
              <th className="lote-label">
                LOTE N°:
              </th>

              <td>
                {traza.ote} -{" "}
                {traza.consecutivo}
              </td>
            </tr>

            <tr>
              <th>
                CODIGO SIIGO:
              </th>

              <td>
                {codigoSiigo}
              </td>
            </tr>

            <tr>
              <th>
                OC:
              </th>

              <td>
                {traza.oc}
              </td>
            </tr>

            <tr>
              <th>
                CLIENTE:
              </th>

              <td className="cliente-cell">
                {
                  clienteCompleto
                }
              </td>
            </tr>

            <tr>
              <th>
                ENCARGADO:
              </th>

              <td>
                &nbsp;
              </td>
            </tr>

            <tr>
              <th>
                FECHA:
              </th>

              <td>
                {formatFecha(
                  traza.fechaCreacion
                )}
              </td>
            </tr>

            <tr>
              <th>
                N° PAQUETE:
              </th>

              <td>
                <div className="paquete-row">
                  <span>
                    {
                      traza.numeroPaquete
                    }
                  </span>

                  <strong>
                    DE
                  </strong>

                  <span>
                    {
                      traza.totalPaquetes
                    }
                  </span>
                </div>
              </td>
            </tr>

            <tr>
              <th>
                CANTIDAD x PAQUETE:
              </th>

              <td>
                {
                  traza.cantidadPaquete
                }
              </td>
            </tr>
          </tbody>
        </table>

        <div className="aprobado-box">
          APROBADO
        </div>
      </div>
    </article>
  );
}

/* =========================================================
   PAGE
   ========================================================= */

export default function ImprimirTrazasPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const ote =
    decodeURIComponent(
      String(
        params?.ote || ""
      )
    );

  const [
    payload,
    setPayload,
  ] =
    useState<PayloadTrazas | null>(
      null
    );

  const [
    error,
    setError,
  ] =
    useState("");

  /* =======================================================
     CARGAR CONFIGURACIÓN
     ======================================================= */

  useEffect(() => {
    try {
      const raw =
        sessionStorage.getItem(
          `pex-trazas-${ote}`
        );

      if (!raw) {
        setError(
          "No existe una validación de empaque para esta OTE. Regresa y confirma primero las cantidades por paquete."
        );

        return;
      }

      const parsed =
        JSON.parse(
          raw
        ) as PayloadTrazas;

      if (
        !parsed ||
        !Array.isArray(
          parsed.items
        )
      ) {
        throw new Error(
          "Configuración de trazas inválida."
        );
      }

      setPayload(
        parsed
      );
    } catch (e) {
      console.error(e);

      setError(
        e instanceof Error
          ? e.message
          : "No fue posible cargar las trazas."
      );
    }
  }, [ote]);

  /* =======================================================
     EXPANDIR PAQUETES
     ======================================================= */

  const trazas =
    useMemo(() => {
      if (!payload) {
        return [];
      }

      const result: Traza[] =
        [];

      for (
        const item of
        payload.items
      ) {
        const distribucion =
          Array.isArray(
            item.distribucion
          )
            ? item.distribucion
            : [];

        distribucion.forEach(
          (
            cantidad,
            index
          ) => {
            result.push({
              ...item,

              numeroPaquete:
                index + 1,

              totalPaquetes:
                distribucion.length,

              cantidadPaquete:
                cantidad,
            });
          }
        );
      }

      return result;
    }, [payload]);

  /* =======================================================
     PÁGINAS
     ======================================================= */

  const paginas =
    useMemo(
      () =>
        chunk(
          trazas,
          10
        ),
      [trazas]
    );

  /* =======================================================
     ERROR
     ======================================================= */

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          <div className="font-semibold">
            No se pueden generar las trazas
          </div>

          <p className="mt-2 text-sm">
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(
                `/planeacion/programacion/corte/ote/${encodeURIComponent(
                  ote
                )}/trazas`
              )
            }
            className="mt-4 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm"
          >
            ← Volver a validación
          </button>
        </div>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        Cargando trazas...
      </main>
    );
  }

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <>
      <style jsx global>{`
        /* =================================================
           VARIABLES DE IMPRESIÓN

           El PDF original de trazas usa tamaño CARTA vertical:
           215.9 mm x 279.4 mm.

           Márgenes aproximados del original:
           5 mm.

           Área útil:
           205.9 mm de ancho.
         ================================================= */

        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
        }

        /* =================================================
           PÁGINA DE TRAZAS
         ================================================= */

        .trazas-page {
          box-sizing: border-box;

          display: grid;

          /*
           * Dos columnas.
           * No dejamos separación entre tarjetas porque
           * el formato original trabaja prácticamente
           * como una cuadrícula continua.
           */
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );

          /*
           * Cinco filas por página.
           *
           * 51.4 mm x 5 = 257 mm
           *
           * Esto nos deja el mismo comportamiento visual
           * aproximado del formato original.
           */
          grid-template-rows:
            repeat(
              5,
              51.4mm
            );

          column-gap: 0;
          row-gap: 0;

          width: 205.9mm;
          height: 257mm;

          margin: 0 auto;

          padding: 0;

          background: white;

          overflow: hidden;
        }

        .traza-slot {
          min-width: 0;
          min-height: 0;

          width: 100%;
          height: 51.4mm;

          overflow: hidden;
        }

        /* =================================================
           TARJETA
         ================================================= */

        .traza-card {
          box-sizing: border-box;

          width: 100%;
          height: 51.4mm;

          border: 1px solid #111;

          background: white;

          color: #111;

          font-family:
            Arial,
            Helvetica,
            sans-serif;

          overflow: hidden;

          break-inside: avoid;
          page-break-inside: avoid;
        }

        /* =================================================
           TABLAS
         ================================================= */

        .traza-header,
        .producto-table,
        .datos-table {
          width: 100%;

          border-collapse: collapse;

          table-layout: fixed;
        }

        /* =================================================
           CABECERA
         ================================================= */

        .traza-header td {
          border: 1px solid #111;

          padding: 0.7px 2px;

          vertical-align: middle;
        }

        .logo-cell {
          width: 23%;

          text-align: center;

          vertical-align: middle;
        }

        .traza-logo {
          display: block;

          max-width: 62px;
          max-height: 24px;

          margin: 0 auto;

          object-fit: contain;
        }

        .titulo-cell {
          width: 48%;

          text-align: center;

          vertical-align: middle;
        }

        .titulo-traza {
          font-size: 7.3px;

          line-height: 1;

          font-weight: 700;
        }

        .sistema-cell,
        .sistema-bottom {
          font-size: 5.1px;

          line-height: 1;

          text-align: center;

          white-space: nowrap;
        }

        .meta-label {
          width: 13%;

          font-size: 5.1px;

          font-weight: 700;
        }

        .meta-value {
          width: 16%;

          font-size: 5.1px;

          font-weight: 700;

          text-align: center;
        }

        /* =================================================
           PRODUCTO
         ================================================= */

        .producto-table th,
        .producto-table td {
          border: 1px solid #111;

          text-align: center;
        }

        .producto-table th {
          background: #f2f0df;

          padding: 1px 2px;

          font-size: 5.2px;

          line-height: 1;
        }

        .producto-table td {
          height: 20px;

          padding: 1px 2px;

          font-size: 5.7px;

          line-height: 1.05;

          vertical-align: middle;

          overflow-wrap: anywhere;
        }

        .producto-col {
          width: 61%;
        }

        .color-col {
          width: 15%;
        }

        .ancho-col {
          width: 12%;
        }

        .largo-col {
          width: 12%;
        }

        /* =================================================
           DATOS / APROBADO
         ================================================= */

        .datos-aprobado {
          display: grid;

          grid-template-columns:
            59% 41%;

          /*
           * Altura restante aproximada después
           * de cabecera y producto.
           */
          height: calc(
            51.4mm - 17.5mm
          );

          min-height: 0;
        }

        .datos-table {
          height: 100%;
        }

        .datos-table tbody {
          height: 100%;
        }

        .datos-table tr {
          height: 12.5%;
        }

        .datos-table th,
        .datos-table td {
          border: 1px solid #111;

          padding: 0.5px 2px;

          font-size: 5.3px;

          line-height: 1;

          vertical-align: middle;
        }

        .datos-table th {
          width: 40%;

          background: #f2f0df;

          text-align: left;

          font-weight: 700;

          white-space: nowrap;
        }

        .datos-table td {
          text-align: center;

          overflow: hidden;

          text-overflow: ellipsis;
        }

        .datos-table .lote-label {
          color: #1597c6;
        }

        .cliente-cell {
          font-size: 4.9px !important;

          line-height: 1 !important;
        }

        .paquete-row {
          display: grid;

          grid-template-columns:
            1fr auto 1fr;

          align-items: center;

          gap: 3px;
        }

        /* =================================================
           APROBADO
         ================================================= */

        .aprobado-box {
          display: flex;

          align-items: center;

          justify-content: center;

          border-top: 1px solid #111;
          border-right: 1px solid #111;
          border-bottom: 1px solid #111;

          color: #d4cfb6;

          font-size: 16px;

          font-weight: 500;
        }

        /* =================================================
           VISTA EN PANTALLA

           Simulamos físicamente una hoja CARTA.
         ================================================= */

        @media screen {
          body {
            background: #f1f5f9;
          }

          .trazas-page {
            width: 215.9mm;

            height: 279.4mm;

            /*
             * En pantalla agregamos el margen físico
             * equivalente de la hoja.
             */
            padding:
              5mm 5mm 17.4mm 5mm;

            margin:
              0 auto 28px;

            box-shadow:
              0 4px 18px
              rgba(
                15,
                23,
                42,
                0.15
              );
          }

          .trazas-page
            .traza-slot {
            height: 51.4mm;
          }

          .trazas-page
            .traza-card {
            height: 51.4mm;
          }
        }

        /* =================================================
           IMPRESIÓN
         ================================================= */

        @media print {
          @page {
            /*
             * IMPORTANTE:
             * El formato original está en CARTA,
             * no A4.
             */
            size: letter portrait;

            margin: 5mm;
          }

          html,
          body {
            width: auto !important;

            height: auto !important;

            margin: 0 !important;

            padding: 0 !important;

            background: white !important;
          }

          /*
           * Ocultar la navegación global de PEX.
           */
          header,
          nav,
          footer {
            display: none !important;
          }

          .no-print {
            display: none !important;
          }

          .trazas-wrapper {
            width: 100% !important;

            max-width: none !important;

            margin: 0 !important;

            padding: 0 !important;

            background: white !important;
          }

          /*
           * Área imprimible:
           *
           * Carta:
           * 215.9 x 279.4 mm
           *
           * Menos 5 mm por cada lado:
           * 205.9 x 269.4 mm
           *
           * La cuadrícula ocupa:
           * 205.9 x 257 mm
           */
          .trazas-page {
            display: grid !important;

            grid-template-columns:
              repeat(
                2,
                102.95mm
              ) !important;

            grid-template-rows:
              repeat(
                5,
                51.4mm
              ) !important;

            column-gap: 0 !important;

            row-gap: 0 !important;

            width: 205.9mm !important;

            height: 257mm !important;

            margin: 0 !important;

            padding: 0 !important;

            background: white !important;

            box-shadow: none !important;

            overflow: hidden !important;

            /*
             * Cada grupo de 10 trazas
             * corresponde a una página.
             */
            page-break-after:
              always;

            break-after:
              page;
          }

          .trazas-page:last-child {
            page-break-after:
              auto;

            break-after:
              auto;
          }

          .traza-slot {
            width:
              102.95mm !important;

            height:
              51.4mm !important;

            min-width: 0 !important;

            min-height: 0 !important;

            margin: 0 !important;

            padding: 0 !important;

            overflow:
              hidden !important;

            break-inside:
              avoid !important;

            page-break-inside:
              avoid !important;
          }

          .traza-card {
            width:
              102.95mm !important;

            height:
              51.4mm !important;

            margin: 0 !important;

            padding: 0 !important;

            overflow:
              hidden !important;

            break-inside:
              avoid !important;

            page-break-inside:
              avoid !important;
          }

          /*
           * Evitar que Chrome cambie
           * tamaños internos de las tablas.
           */
          .traza-card table {
            page-break-inside:
              avoid !important;

            break-inside:
              avoid !important;
          }

          .traza-card tr,
          .traza-card td,
          .traza-card th {
            page-break-inside:
              avoid !important;

            break-inside:
              avoid !important;
          }
        }
      `}</style>

      <main className="trazas-wrapper mx-auto max-w-6xl px-6 py-8">
        {/* =================================================
            CONTROLES
           ================================================= */}

        <div className="no-print mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm text-slate-500">
              Planeación · Programación · Corte · Trazas · Vista previa
            </div>

            <h1 className="mt-1 text-2xl font-semibold">
              Trazas · {ote}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {trazas.length} trazas ·{" "}
              {paginas.length} página(s) · 10 trazas por página.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/planeacion/programacion/corte/ote/${encodeURIComponent(
                    ote
                  )}/trazas`
                )
              }
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
            >
              ← Validación
            </button>

            <button
              type="button"
              onClick={() =>
                window.print()
              }
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Imprimir / Guardar PDF
            </button>
          </div>
        </div>

        {/* =================================================
            PÁGINAS
           ================================================= */}

        {paginas.map(
          (
            pagina,
            paginaIndex
          ) => {
            const slots =
              Array.from({
                length: 10,
              });

            return (
              <section
                key={
                  paginaIndex
                }
                className="trazas-page"
              >
                {slots.map(
                  (
                    _,
                    slotIndex
                  ) => {
                    const traza =
                      pagina[
                        slotIndex
                      ];

                    return (
                      <div
                        key={
                          slotIndex
                        }
                        className="traza-slot"
                      >
                        {traza ? (
                          <TarjetaTraza
                            traza={
                              traza
                            }
                          />
                        ) : null}
                      </div>
                    );
                  }
                )}
              </section>
            );
          }
        )}
      </main>
    </>
  );
}