import NextAuth, { NextAuthOptions } from "next-auth";
import Auth0Provider from "next-auth/providers/auth0";

const getRoleFromEmail = (email: string): "comercial" | "produccion" | "admin" | null => {
  const map: Record<string, "comercial" | "produccion" | "admin"> = {
    "daniel.alfonso@inplastgr.com": "admin",
  };

  if (map[email]) return map[email];

  if (email.endsWith("@inplastgr.com")) return "comercial";

  return null;
};

export const authOptions: NextAuthOptions = {
  providers: [
    Auth0Provider({
      clientId: process.env.AUTH0_CLIENT_ID!,
      clientSecret: process.env.AUTH0_CLIENT_SECRET!,
      issuer: process.env.AUTH0_ISSUER,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      if (!user.email.endsWith("@inplastgr.com")) return false;
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
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
