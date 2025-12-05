import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

// app/layout.tsx
export const metadata = {
  title: "Sistema de información PEX | Industrias Plásticas GR",
  description:
    "Sistema interno para gestionar pedidos, producción y almacenes en Industrias Plásticas GR.",
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-gray-100 text-gray-900">
        <nav className="w-full bg-white shadow-sm px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Industrias Plásticas GR</h1>

          <div className="flex gap-6 text-sm font-medium">
            <Link href="/">Inicio</Link>
            <Link href="/ventas">Ventas</Link>
            <Link href="/logistica">Logística</Link>
            <Link href="/produccion">Producción</Link>
            <Link href="/almacen">Almacén</Link>
          </div>
        </nav>

        <main className="p-8">{children}</main>
      </body>
    </html>
  );
}
