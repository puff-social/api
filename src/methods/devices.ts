import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../connectivity/prsima";

export async function getDevicesRoute(
  req: FastifyRequest<{ Querystring: { limit?: string } }>,
  res: FastifyReply
) {
  const leaderboard = await prisma.device_leaderboard.findMany({
    orderBy: { position: "asc" },
    take: req.query.limit ? Number(req.query.limit) : undefined,
    include: {
      devices: {
        include: {
          users: {
            select: {
              name: true,
              image: true,
              flags: true,
              platform: true,
              platform_id: true,
            },
          },
        },
      },
    },
  });

  return res
    .status(200)
    .send({ success: true, data: { devices: leaderboard } });
}
