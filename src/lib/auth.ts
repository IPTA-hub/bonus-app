import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { getUserByUsername } from "./db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await getUserByUsername(credentials.username as string);
        if (!user) return null;

        const valid = await compare(
          credentials.password as string,
          user.password_hash
        );
        if (!valid) return null;

        return {
          id: String(user.id),
          name: user.name,
          email: user.username,
          image: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.image;
        token.username = user.email;
        // Look up therapist_slug from DB
        const dbUser = await getUserByUsername(user.email as string);
        token.therapist_slug = dbUser?.therapist_slug || null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        (session as unknown as SessionWithRole).role = token.role as string;
        (session as unknown as SessionWithRole).therapist_slug =
          token.therapist_slug as string | null;
        (session as unknown as SessionWithRole).username = token.username as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});

export interface SessionWithRole {
  user: {
    id: string;
    name: string;
    email: string;
    image: string;
  };
  role: string;
  therapist_slug: string | null;
  username: string;
  expires: string;
}
