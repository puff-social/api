import { RemoteActionPayload } from "@puff-social/commons";
import { FastifyRequest, FastifyReply } from "fastify";
import { env } from "../env";

export async function remoteActionTrigger(
  req: FastifyRequest<{ Body: RemoteActionPayload }>,
  res: FastifyReply
) {
  fetch(`${env.GATEWAY_HOST}/remote_action`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user: req.user, payload: req.body }),
  }).catch(console.error);

  return res.status(204).send();
}
