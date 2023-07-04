import { FastifyReply, FastifyRequest } from "fastify";

import { prisma } from "../connectivity/prisma";
import { getOtaLatest } from "../helpers/puffco";
import { sanitize } from "../utils";

export async function getDevicesRoute(
  req: FastifyRequest<{ Querystring: { limit?: string } }>,
  res: FastifyReply
) {
  let devices = await prisma.devices.findMany({
    where: { NOT: { serial_number: null } },
  });

  if (req.query.limit) devices = devices.slice(0, Number(req.query.limit));

  const newDevices = await Promise.all(
    devices.map(async (device) => {
      if (!device.serial_number) return device;
      const ota = await getOtaLatest(device.serial_number).catch(() => null);

      return {
        ...device,
        ota: ota
          ? {
              version: ota.version,
              ...(() => {
                const match =
                  /([a-zA-Z].*)-(application|[a-zA-Z].*-[a-zA-Z].*)-([0-9a-zA-Z]{7})-release.(gbl|puff)/.exec(
                    ota.fileMedia.filename
                  );
                if (!match) return undefined;

                const [_, codename, name, gitHash, type] = match;

                return {
                  codename,
                  name,
                  gitHash,
                  type,
                  date: new Date(ota.fileMedia.created),
                };
              })(),
            }
          : undefined,
      };
    })
  );

  return res.status(200).send({ success: true, data: { devices: newDevices } });
}

export async function getDeviceByMac(
  req: FastifyRequest<{ Params: { device_mac: string } }>,
  res: FastifyReply
) {
  try {
    const device = await prisma.devices.findFirst({
      where: {
        mac: Buffer.from(
          req.params.device_mac.split("_")[1],
          "base64"
        ).toString(),
      },
      include: {
        users: true,
      },
    });

    if (!device)
      return res
        .status(404)
        .send({ success: false, error: { code: "device_not_found" } });
    const position = await prisma.device_leaderboard.findFirst({
      where: { id: device.id },
    });

    return res.status(200).send({
      success: true,
      data: {
        device: sanitize(device, [
          "mac",
          "git_hash",
          "profiles",
          "last_ip",
          "serial_number",
        ]),
        position: position?.position,
      },
    });
  } catch (error) {
    console.error("error with get device", error);
    return res
      .status(500)
      .send({ success: false, error: { code: "internal_error" } });
  }
}
