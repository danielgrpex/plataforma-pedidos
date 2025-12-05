import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
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
      <head>
        {/* Muy importante: indicamos que la página sólo usa esquema claro */}
        <meta name="color-scheme" content="light" />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
