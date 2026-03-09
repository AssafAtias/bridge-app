import type { NextAuthConfig } from "next-auth";

// Lightweight config for Edge runtime (middleware) — no DB imports
export const authConfig: NextAuthConfig = {
  providers: [],
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      return true; // actual logic handled in proxy.ts
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
};
