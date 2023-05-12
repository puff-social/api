import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../connectivity/prsima";
import { getOtaLatest } from "../helpers/puffco";

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

  const newDevices = await Promise.all(
    leaderboard.map(async (lb) => {
      if (!lb.devices.serial_number) return lb;
      const ota = await getOtaLatest(lb.devices.serial_number);
      return {
        ...lb,
        ota: ota
          ? {
              version: ota.version,
              gitHash: ota.fileMedia.filename.split("-")[2],
              date: ota.fileMedia.created,
            }
          : undefined,
      };
    })
  );

  return res.status(200).send({ success: true, data: { devices: newDevices } });
}
