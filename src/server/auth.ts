import { type GetServerSidePropsContext } from "next";
import {
  getServerSession,
  type NextAuthOptions,
  type DefaultSession,
} from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";
import SpotifyWebApi from "spotify-web-api-node";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { env } from "~/env.mjs";
import { prisma } from "~/server/db";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      access_token?: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }
}
/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authOptions: NextAuthOptions = { 
  adapter: PrismaAdapter(prisma),
  callbacks: {
    async session({ session: existingSession, user }) {
      if (!existingSession || !user) {
        return existingSession;
      }
    //   session = { ...session, user: {
    //     ...session.user,
    //     id: user.id,
    //   },
    // };

//     const getToken = await prisma.account.findFirst({
//       where: {
//         userId: user.id,
//       },
//     });

//     session.user.access_token = getToken?.access_token ?? undefined;
//       return session;

   
//   },
// },

//  
//   providers: [
//     SpotifyProvider({
//       clientId: env.SPOTIFY_CLIENT_ID,
//       clientSecret: env.SPOTIFY_CLIENT_SECRET, 
//       authorization: "https://accounts.spotify.com/authorize?scope=user-read-email+user-read-playback-state",
//     })
//     /**
//      * ...add more providers here.
//      *
//      * Most other providers require a bit more work than the Discord provider. For example, the
//      * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
//      * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
//      *
//      * @see https://next-auth.js.org/providers/github
//      */
//   ],
// }

try {
  const response = await prisma.user.findUnique({
    where: {
      id: user.id,
    },
    include: {
      accounts: true,
    },
  });
  if (!response) {
    return existingSession;
  }

  // Create a new session object with all the information we need
  const session = {
    id: response.id,
    user: response.name,
    account: response.accounts[0].providerAccountId,
    token: response.accounts[0].access_token,
    expires: response.accounts[0]?.expires_at,
  };

  // Prepare some data to check if the token is about to expire or has expired
  const now = Math.floor(Date.now() / 1000);
  const difference = Math.floor((session.accounts[0].expires_at - now) / 60);
  const refreshToken = session.accounts[0].refresh_token;
  console.log(`Token still active for ${difference} minutes.`);

  // If the token is older than 50 minutes, fetch a new one
  if (difference <= 10) {
    console.log("Token expired, fetching new one...");
    const request = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
      },
      body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
      cache: "no-cache"
    });

    if (request.ok) {
      const response = await request.json();
      const { access_token, expires_in, refresh_token } = response;
      const timestamp = Math.floor((Date.now() + expires_in * 1000) / 1000);

      console.log(response);
      console.log(`New access token: ${access_token}`);

      await prisma.account.update({
        where: {
          provider_providerAccountId: {
            provider: "spotify",
            providerAccountId: session.account,
          },
        },
        data: {
          access_token,
          expires_at: timestamp,
          refresh_token,
        },
      });

      session.token = access_token;
    } else {
      console.error(`Failed to refresh token: ${request.status} ${request.statusText}`);
    }
  }

  return session;
} catch (error) {
  console.error(`Failed to fetch session: ${error}`);
  return existingSession;
}
},
    },
    pages: {
    newUser: "/onboarding",
    },
      providers: [
    SpotifyProvider({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    authorization: { params: { scope: "user-read-email user-read-private user-read-currently-playing user-read-playback-position user-top-read user-read-recently-played" } },
    }),
    ],
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 */
export const getServerAuthSession = (ctx: {
  req: GetServerSidePropsContext["req"];
  res: GetServerSidePropsContext["res"];
}) => {
  return getServerSession(ctx.req, ctx.res, authOptions);
};
