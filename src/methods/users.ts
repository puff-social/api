import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../connectivity/prisma";

export async function getUsersRoute(
  req: FastifyRequest<{ Querystring: { limit?: string } }>,
  res: FastifyReply
) {
  let users = await prisma.users.findMany({
    where: { NOT: { devices: { none: {} } } },
    include: {
      devices: true,
      accounts: true,
      connections: true,
    },
  });

  // Sort the users by their total dabs across all devices
  users.sort((user, user2) => {
    const totalDabs1 = user.devices
      .map((d) => d.dabs)
      .reduce((pre, curr) => pre + curr);
    const totalDabs2 = user2.devices
      .map((d) => d.dabs)
      .reduce((pre, curr) => pre + curr);

    return totalDabs2 - totalDabs1;
  });

  if (req.query.limit) users = users.slice(0, Number(req.query.limit));

  return res.status(200).send({ success: true, data: { users } });
}
