import { FastifyReply, FastifyRequest } from "fastify";

import {pika} from '@puff-social/commons/dist/pika';
import { keydb } from "@puff-social/commons/dist/connectivity/keydb";
import { prisma } from "../connectivity/prisma";

export async function generateDebuggingSession(
  req: FastifyRequest<{ Body: { deviceIdentifier: string } }>,
  res: FastifyReply
) {
  try {
    const id = pika.gen('debugging');

    await keydb.set(`debugging/${id}`, req.body.deviceIdentifier, 'EX', 18_000);

    return res.status(200).send({
      success: true,
      data: {
        id
      },
    });
  } catch (error) {
    console.error("error with debugging session generation", error);
    return res
      .status(500)
      .send({ success: false, error: { code: "internal_error" } });
  }
}

export async function submitDebuggingSession(
  req: FastifyRequest<{ Params: { id: string }, Body: Record<string, any> }>,
  res: FastifyReply
) {
  try {
    const deviceIden = await keydb.get(`debugging/${req.params.id}`);
    
    if (deviceIden != '')
      return res.status(400).send({ success: false, code: 'debug_session_id_mismatch' });

    await prisma.debug_sessions.create({data: {
      id: req.params.id,
      identifier: deviceIden,
      data: req.body,
      ip_address:  (req.headers["cf-connecting-ip"] ?? req.socket.remoteAddress ?? "0.0.0.0") as string,
      user_agent: req.headers["user-agent"] ?? 'Unknown'
    }});

    // Send a hook that we received some debugging data from a session.

    return res.status(204).send();
  } catch (error) {
    console.error("error with debugging session submission", error);
    return res
      .status(500)
      .send({ success: false, error: { code: "internal_error" } });
  }
}
