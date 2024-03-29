import { users } from "@puff-social/commons";

import { FastifyReply, FastifyRequest } from "fastify";

import { env } from "../env";
import { prisma } from "../connectivity/prisma";
import { userUpdateValidation } from "../utils";

export async function getUsersRoute(
  req: FastifyRequest<{ Querystring: { limit?: string; all: boolean } }>,
  res: FastifyReply
) {
  const currentDate = new Date();
  let users = await prisma.users.findMany({
    where: {
      NOT: { devices: { none: {} } },
      devices: req.query.all
        ? undefined
        : {
            some: {
              last_active: {
                gte: new Date(
                  currentDate.getFullYear(),
                  currentDate.getMonth(),
                  currentDate.getDate() - 28
                ),
              },
            },
          },
    },
    include: {
      devices: true,
      accounts: true,
      connections: true,
    },
  });

  // Remove the devices that are older then 28 days from the users array
  // This is not done from the above query as that is just part of the
  // filtering the users table, all devices are still returned regardless.
  if (!req.query.all)
    users = users.map((user) => {
      user.devices = user.devices.filter(
        (device) =>
          device.last_active.getTime() >=
          new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            currentDate.getDate() - 28
          ).getTime()
      );
      return user;
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
