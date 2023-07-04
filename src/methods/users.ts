import { users } from "@puff-social/commons";

import { FastifyReply, FastifyRequest } from "fastify";

import { env } from "../env";
import { prisma } from "../connectivity/prisma";
import { userUpdateValidation } from "../utils";

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

export async function updateUser(
  req: FastifyRequest<{
    Body: Pick<users, "display_name" | "image" | "banner" | "bio" | "location">;
  }>,
  res: FastifyReply
) {
  const validate = await userUpdateValidation.parseAsync(req.body);

  const user = await prisma.users.update({
    where: { id: req.user.id },
    data: validate,
  });

  fetch(`${env.GATEWAY_HOST}/user/${req.user.id}/update`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user }),
  }).catch(console.error);

  return res.status(200).send({
    success: true,
    data: {
      user,
    },
  });
}
