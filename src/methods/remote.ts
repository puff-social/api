import { RemoteAction, RemoteActionPayload } from "@puff-social/commons";
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

  if (req.headers["user-agent"]?.startsWith("BackgroundShortcutRunner"))
    switch (req.body.action) {
      case RemoteAction.BEGIN_HEAT: {
        return res.status(200).send("Heat started on connected device");
      }
      case RemoteAction.CANCEL_HEAT: {
        return res.status(200).send("Canceled session");
      }
      case RemoteAction.INQUIRE_DAB: {
        return res.status(200).send("Who's tryna dab?");
      }
    }

  return res.status(204).send();
}
