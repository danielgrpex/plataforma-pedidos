//app/produccion/entregas-almacen/entregar-stock/page.tsx
"use client";

import { Suspense } from "react";
import EntregarStockClient from "./EntregarStockClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-50 p-8 text-sm text-neutral-600">
          Cargando…
        </div>
      }
    >
      <EntregarStockClient />
    </Suspense>
  );
}
