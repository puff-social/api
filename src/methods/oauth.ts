import { keydb } from "@puff-social/commons/dist/connectivity/keydb";
import { pika } from "@puff-social/commons";

import { FastifyReply, FastifyRequest } from "fastify";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { stringify } from "querystring";
import { hash } from "argon2";

import { env } from "../env";
import { normalizeUsername } from "../utils";
import { minio } from "../connectivity/minio";
import { prisma } from "../connectivity/prisma";
import { exchangeDiscordCode, fetchDiscordUser } from "../helpers/discord";

export async function getOAuthURL(
  req: FastifyRequest<{ Params: { platform: string } }>,
  res: FastifyReply
) {
  switch (req.params.platform) {
    case "discord": {
      const state = pika.gen("oauth");
      await keydb.set(`oauth_state/${state}`, state, "EX", 500);
      const params = stringify({
        client_id: env.DISCORD_CLIENT_ID,
        response_type: "code",
        scope: "identify",
        state,
        redirect_uri: `${
          req.headers.origin || env.APPLICATION_HOST
        }/callback/discord`,
      });
      return res.status(200).send({
        success: true,
        data: { url: `https://discord.com/oauth2/authorize?${params}` },
      });
    }
    default: {
      return res
        .status(400)
        .send({ success: false, error: "invalid_platform" });
    }
  }
}

export async function callbackOAuth(
  req: FastifyRequest<{
    Params: { platform: string };
    Querystring: { state: string; code: string };
  }>,
  res
) {
  const { state, code } = req.query;

  switch (req.params.platform) {
    case "discord": {
      const validState = await keydb.exists(`oauth_state/${state}`);
      if (!validState)
        return res.status(400).send({ success: false, error: "invalid_state" });

      const tokens = await exchangeDiscordCode(
        code,
        `${req.headers.origin || env.APPLICATION_HOST}/callback/discord`
      );
      const user = await fetchDiscordUser(tokens.access_token);

      await keydb.set(
        `oauth/discord/${user.id}`,
        tokens.access_token,
        "EX",
        tokens.expires_in
      );
      await keydb.del(`oauth_state/${state}`);

      await keydb.set(`oauth/discord/${user.id}/refresh`, tokens.refresh_token);

      const existingConnection = await prisma.connections.findFirst({
        where: { platform: "discord", platform_id: user.id },
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

        return res.status(200).send({
          success: true,
          data: {
            user: existingConnection.users,
            connection: existingConnection,
            token: session,
          },
        });
      }

      const id = pika.gen("user");
      const connection_id = pika.gen("connection");

      let image: string | undefined = undefined;
      if (user.avatar) {
        const img = await fetch(
          `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${
            user.avatar.startsWith("a_") ? "gif" : "png"
          }?size=512`
        ).then((r) => r.arrayBuffer());
        const imgBuffer = Buffer.from(img);
        const hash = user.avatar;
        await minio.send(
          new PutObjectCommand({
            Bucket: env.MINIO_BUCKET,
            Key: `avatars/${id}/${hash}.${
              hash.startsWith("a_") ? "gif" : "png"
            }`,
            Body: imgBuffer,
            ContentType: "image/png",
          })
        );
        image = hash;
      }

      await prisma.users.create({
        data: {
          id,
          name: normalizeUsername(user.username),
          display_name: user.global_name || user.username,
          image,
        },
      });

      await prisma.connections.create({
        data: {
          id: connection_id,
          platform: "discord",
          platform_id: user.id,
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

      return res.status(200).send({
        success: true,
        data: {
          user: {
            id,
            name: normalizeUsername(user.username),
            display_name: user.global_name || user.username,
            image: hash,
          },
          connection: {
            id: connection_id,
            platform: "discord",
            platform_id: user.id,
            user_id: id,
            verified: true,
          },
          token: session,
        },
      });
    }
    default: {
      return res
        .status(400)
        .send({ success: false, error: "invalid_platform" });
    }
  }
}
