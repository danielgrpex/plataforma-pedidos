// types/next-auth.d.ts
import NextAuth from "next-auth";

export type AppRole =
  | "COMERCIAL"
  | "PLANEACION"
  | "PRODUCCION"
  | "LOGISTICA"
  | "ADMIN"
  | null;

declare module "next-auth" {
  interface User {
    role?: AppRole;
  }

  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: AppRole;
    };
    googleAccessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
    googleAccessToken?: string;
  }
}
