import { FastifyReply, FastifyRequest } from "fastify";
import { getOtaLatest } from "../helpers/puffco";

export async function getOtaFirmware(
  req: FastifyRequest<{ Params: { serial: string } }>,
  res: FastifyReply
) {
  const ota = await getOtaLatest(req.params.serial);

  if (!ota)
    return res.status(404).send({ error: true, code: "firmware_not_found" });

  const firmware = {
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
  };

  return res.status(200).send({ success: true, data: { firmware } });
}
