import "./globals.css";
import type { Metadata } from "next";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { MainHeader } from "@/components/layout/MainHeader";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Plataforma Pedidos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 flex flex-col">
        <SessionProvider>
          <MainHeader />
          <main className="flex-1">{children}</main>
          <Footer />
        </SessionProvider>
      </body>
    </html>
  );
}
