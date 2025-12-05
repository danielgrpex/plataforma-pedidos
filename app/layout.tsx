// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import type React from "react";

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
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">
        {children}
      </body>
    </html>
  );
}
