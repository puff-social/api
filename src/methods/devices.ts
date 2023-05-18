import { FastifyReply, FastifyRequest } from "fastify";
import { getOtaLatest } from "../helpers/puffco";

import { prisma } from "../connectivity/prisma";

export async function getDevicesRoute(
  req: FastifyRequest<{ Querystring: { limit?: string } }>,
  res: FastifyReply
) {
  const users = await prisma.users.findMany({
    include: {
      devices: {
        include: {
          device_leaderboard: true,
        },
      },
      sessions: true,
      accounts: true,
      connections: true,
    },
  });

  users.sort(
    (user, user2) =>
      (user.devices[0].device_leaderboard?.position || 0) -
      (user2.devices[0].device_leaderboard?.position || 1)
  );

  // const newDevices = await Promise.all(
  //   users.map(async (lb) => {
  //     if (!lb.devices.serial_number) return lb;
  //     const ota = await getOtaLatest(lb.devices.serial_number);
  //     return {
  //       ...lb,
  //       ota: ota
  //         ? {
  //             version: ota.version,
  //             gitHash: ota.fileMedia.filename.split("-")[2],
  //             date: ota.fileMedia.created,
  //           }
  //         : undefined,
  //     };
  //   })
  // );

  return res.status(200).send({ success: true, data: { devices: [] } });
}
