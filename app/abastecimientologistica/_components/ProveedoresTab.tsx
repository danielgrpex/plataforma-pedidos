//app/abastecimientologistica/_components/ProveedoresTab.tsx
import { HeaderBlock } from "./ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export function ProveedoresTab() {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
      <HeaderBlock
        title="Ingreso de proveedores"
        subtitle="Pendiente por construir (entradas / recepciones / movimientos inventario)."
      />
    </section>
  );
}
