import type { NextAuthOptions } from "next-auth";
import LineProvider from "next-auth/providers/line";
import { prisma } from "@oshi-geinin/db";

export const authOptions: NextAuthOptions = {
  providers: [
    // LINE の id_token は HS256 署名。標準 provider が wellKnown / idToken /
    // id_token_signed_response_alg=HS256 を正しく設定してくれる。
    LineProvider({
      clientId: process.env.LINE_CHANNEL_ID ?? "",
      clientSecret: process.env.LINE_CHANNEL_SECRET ?? "",
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      await prisma.user.upsert({
        where: { lineUserId: user.id },
        update: {},
        create: { lineUserId: user.id },
      });
      return true;
    },
    async session({ session, token }) {
      const dbUser = await prisma.user.findUnique({
        where: { lineUserId: token.sub! },
      });
      if (dbUser) {
        (session as any).userId = dbUser.id;
      }
      return session;
    },
  },
};
