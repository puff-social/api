import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify/types/plugin";

import { connections, users, UserFlags } from "@puff-social/commons";
import { keydb } from "@puff-social/commons/dist/connectivity/keydb";

import { prisma } from "./connectivity/prisma";

declare module "fastify" {
  interface FastifyRequest {
    user: users;
    linkedConnection: connections;
  }
}

interface AuthOptions {
  admin?: boolean;
  required?: boolean;
}

const middlewareCallback: FastifyPluginAsync<AuthOptions> = async function (
  server,
  options
) {
  server.addHook("preParsing", async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const authorization = req.headers.authorization;
    if (!authorization && options.required)
      return res
        .status(403)
        .send({ error: true, code: "missing_authorization" });

    const session = (await keydb.hgetall(`sessions/${authorization}`)) as {
      user_id: string;
      connection_id: string;
    };
    if ((!session || Object.keys(session).length == 0) && options.required)
      return res
        .status(403)
        .send({ error: true, code: "invalid_authentication" });

    if (session.user_id) {
      const user = await prisma.users.findFirst({
        where: { id: session.user_id },
      });
      if (!user && options.required)
        return res
          .status(403)
          .send({ error: true, code: "invalid_authentication" });
      if (user) req.user = user;

      if (
        user &&
        options.required &&
        (user?.flags || 0) & UserFlags.suspended &&
        !url.pathname.endsWith("/user")
      )
        return res.status(403).send({ error: true, code: "user_suspended" });

      const connnection = await prisma.connections.findFirst({
        where: { id: session.connection_id },
      });
      if (!user && options.required)
        return res
          .status(403)
          .send({ error: true, code: "invalid_authentication" });
      if (connnection) req.linkedConnection = connnection;

      if (options.admin && !((user?.flags || 0) & UserFlags.admin))
        return res
          .status(401)
          .send({ error: true, code: "invalid_permissions" });
    }
  });
};

export const AuthMiddleware = fp(middlewareCallback);
