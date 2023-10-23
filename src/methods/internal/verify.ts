import { connections, users } from "@puff-social/commons";
import { keydb } from "@puff-social/commons/dist/connectivity/keydb";

import { FastifyReply, FastifyRequest } from "fastify";

import { prisma } from "../../connectivity/prisma";
import { env } from "../../env";

export async function verifyToken(req: FastifyRequest, res: FastifyReply) {
  const authorization = req.headers.authorization;
  if (!authorization) return res.status(200).send({ valid: false });

  const session = (await keydb.hgetall(`sessions/${authorization}`)) as {
    user_id: string;
    connection_id: string;
  };
  if (!session) return res.status(200).send({ valid: false });

  const user = await prisma.users.findFirst({
    where: { id: session.user_id },
    include: { connections: true },
  });
  const connection = await prisma.connections.findFirst({
    where: { id: session.connection_id },
  });

  let voice: { id: string; name: string } | undefined = undefined;
  try {
    const discordConnection = user?.connections.find(
      (conn) => conn.platform == "discord"
    );
    if (discordConnection) {
      const voiceChannel = await keydb.get(
        `discord/${discordConnection?.platform_id}/voice`
      );
      if (voiceChannel) {
        const channel = await fetch(`${env.BOT_HOST}/channels/${voiceChannel}`);
        if (channel.status == 200) voice = await channel.json();
      }
    }
  } catch (error) {}

  delete (
    user as Partial<
      users & {
        connections: connections[];
      }
    >
  ).connections;

  return res.status(200).send({
    valid: true,
    user,
    connection,
    voice,
  });
}
