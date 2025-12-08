// lib/auth.ts
import { getServerSession, type NextAuthOptions } from "next-auth";
import Auth0Provider from "next-auth/providers/auth0";

type UserRole = "comercial" | "produccion" | "admin" | null;

const getRoleFromEmail = (email: string): UserRole => {
  const map: Record<string, Exclude<UserRole, null>> = {
    "daniel.alfonso@implastgr.com": "admin",
  };

  if (map[email]) return map[email];

  if (email.endsWith("@implastgr.com")) return "comercial";

  return null;
};

export const authOptions: NextAuthOptions = {
  providers: [
    Auth0Provider({
      clientId: process.env.AUTH0_CLIENT_ID!,
      clientSecret: process.env.AUTH0_CLIENT_SECRET!,
      issuer: process.env.AUTH0_ISSUER!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      if (!user.email.endsWith("@implastgr.com")) return false;
      return true;
    },
    async jwt({ token, account, profile }) {
      if (account && profile?.email) {
        const email = profile.email as string;
        token.email = email;
        token.role = getRoleFromEmail(email);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        // @ts-ignore
        session.user.role = token.role;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
};

export const getAuthSession = () => getServerSession(authOptions);
