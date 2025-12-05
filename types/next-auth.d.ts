// types/next-auth.d.ts
import NextAuth from "next-auth";

declare module "next-auth" {
  interface User {
    role?: "comercial" | "produccion" | "admin" | null;
  }

  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: "comercial" | "produccion" | "admin" | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "comercial" | "produccion" | "admin" | null;
  }
}
