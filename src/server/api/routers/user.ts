import { z } from "zod";
import {
    createTRPCRouter,
    publicProcedure,
  } from "~/server/api/trpc";
  
  export const userRouter = createTRPCRouter({
    howdy: publicProcedure
      .input(z.object({ text: z.string() }))
      .query(({ input }) => {
        return {
          greeting: `Hello ${input.text}`,
        };
      }),
  
    getAll: publicProcedure.query(({ ctx }) => {
      return ctx.prisma.account.findMany();
    })
  })
