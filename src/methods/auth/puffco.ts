import { keydb } from "@puff-social/commons/dist/connectivity/keydb";
import { pika } from "@puff-social/commons";

import { decode, JwtPayload } from "jsonwebtoken";
import { FastifyRequest } from "fastify";

import { prisma } from "../../connectivity/prisma";
import { fetchUser, login } from "../../helpers/puffco";
import { sanitize } from "../../utils";

export async function puffcoLogin(
  req: FastifyRequest<{ Body: { email: string; password: string } }>,
  res
) {
  const { email, password } = req.body;
  const log = await login(email, password);
  const puffcoUser = await fetchUser(log.accessToken);

  const decodedAccessToken = decode(log.accessToken) as JwtPayload;
  const decodedRefreshToken = decode(log.refreshToken) as JwtPayload;

  const existingConnection = await prisma.connections.findFirst({
    where: { platform: "puffco", platform_id: puffcoUser.id.toString() },
    include: { users: true },
  });

  if (existingConnection) {
    const session = pika.gen("session");
    await keydb.hset(`sessions/${session}`, {
      user_id: existingConnection.users.id,
      connection_id: existingConnection.id,
    });

    await prisma.sessions.create({
      data: {
        ip: (req.headers["cf-connecting-ip"] ||
          req.socket.remoteAddress ||
          "0.0.0.0") as string,
        token: session,
        user_agent: req.headers["user-agent"] || "N/A",
        user_id: existingConnection.users.id,
        connection_id: existingConnection.id,
      },
    });

    await prisma.connections.update({
      where: { id: existingConnection.id },
      data: {
        verified: puffcoUser.verified,
      },
    });

    await keydb.set(
      `tokens/puffco/${existingConnection.users.id}/refresh_token`,
      log.refreshToken,
      "EXAT",
      Math.floor(decodedRefreshToken.exp as number)
    );

    await keydb.set(
      `tokens/puffco/${existingConnection.users.id}/access_token`,
      log.accessToken,
      "EXAT",
      Math.floor(decodedAccessToken.exp as number)
    );

    return res.status(200).send({
      success: true,
      data: {
        user: sanitize(existingConnection.users, [
          "platform_id",
          "refresh_token",
        ]),
        token: session,
      },
    });
  }

  const id = pika.gen("user");
  const connection_id = pika.gen("connection");

  await prisma.users.create({
    data: {
      id,
      name: puffcoUser.username,
      display_name: puffcoUser.username,
    },
  });

  await prisma.connections.create({
    data: {
      id: connection_id,
      platform: "puffco",
      platform_id: puffcoUser.id.toString(),
      user_id: id,
      verified: true,
    },
  });

  const session = pika.gen("session");
  await keydb.hset(`sessions/${session}`, {
    user_id: id,
    connection_id: connection_id,
  });

  await prisma.sessions.create({
    data: {
      ip: (req.headers["cf-connecting-ip"] ||
        req.socket.remoteAddress ||
        "0.0.0.0") as string,
      token: session,
      user_agent: req.headers["user-agent"] || "N/A",
      user_id: id,
      connection_id,
    },
  });

  await keydb.set(
    `tokens/puffco/${id}/refresh_token`,
    log.refreshToken,
    "EXAT",
    Math.floor(decodedRefreshToken.exp as number)
  );

  await keydb.set(
    `tokens/puffco/${id}/access_token`,
    log.accessToken,
    "EXAT",
    Math.floor(decodedAccessToken.exp as number)
  );

  return res.status(200).send({
    success: true,
    data: {
      user: { id, name: puffcoUser.username, image: null },
      token: session,
    },
  });
}
