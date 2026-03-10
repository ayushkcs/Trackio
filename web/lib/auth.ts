import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  debug: process.env.NODE_ENV === "development",
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user, account }) {
      console.log("[Trackio Auth] JWT callback - user:", !!user, "account:", !!account);
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      console.log("[Trackio Auth] Sign in success - user:", user.email, "provider:", account?.provider);
    },
    async signOut() {
      console.log("[Trackio Auth] Sign out");
    },
  },
  logger: {
    error(error) {
      console.error("[Trackio Auth Error]", error);
    },
    warn(code) {
      console.warn("[Trackio Auth Warning]", code);
    },
    debug(message, metadata) {
      console.log("[Trackio Auth Debug]", message, metadata);
    },
  },
});
