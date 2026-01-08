//app/abastecimientologistica/_components/DespachosOrdenTab.tsx
import { HeaderBlock } from "./ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;


export function DespachosOrdenTab() {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <HeaderBlock
        title="Despachos por orden completa"
        subtitle="Pendiente por construir (despacho total por pedido)."
      />
    </section>
  );
}
