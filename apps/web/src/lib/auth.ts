import type { NextAuthOptions } from "next-auth";
import { prisma } from "@oshi-geinin/db";

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: "line",
      name: "LINE",
      type: "oauth",
      authorization: {
        url: "https://access.line.me/oauth2/v2.1/authorize",
        params: { scope: "profile openid" },
      },
      token: "https://api.line.me/oauth2/v2.1/token",
      userinfo: "https://api.line.me/v2/profile",
      clientId: process.env.LINE_CHANNEL_ID,
      clientSecret: process.env.LINE_CHANNEL_SECRET,
      profile(profile) {
        return {
          id: profile.userId,
          name: profile.displayName,
          image: profile.pictureUrl,
        };
      },
    },
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
