import { FastifyReply, FastifyRequest } from "fastify";

import { prisma } from "../connectivity/prisma";
import { sanitize } from "../utils";

export async function getDeviceLeaderboard(
  req: FastifyRequest<{ Querystring: { limit?: string } }>,
  res: FastifyReply
) {
  const leaderboards = await prisma.device_leaderboard.findMany({
    orderBy: { position: "asc" },
    take: Number(req.query.limit) || 25,
    where: { devices: { isNot: { user_id: null } } },
    include: {
      devices: {
        include: {
          users: true,
        },
      },
    },
  });

  for (const lb of leaderboards) {
    sanitize(lb.devices, [
      "mac",
      "git_hash",
      "profiles",
      "last_ip",
      "serial_number",
    ]);
  }

  return res.status(200).send({ success: true, data: { leaderboards } });
}
