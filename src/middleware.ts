import fp from "fastify-plugin";
import { users } from "@prisma/client";
import { FastifyPluginAsync } from "fastify/types/plugin";

import { keydb } from "./connectivity/redis";
import { prisma } from "./connectivity/prsima";
import { UserFlags } from "./constants";

declare module "fastify" {
  interface FastifyRequest {
    user: users;
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
    const authorization = req.headers.authorization;
    if (!authorization && options.required)
      return res
        .status(403)
        .send({ error: true, code: "missing_authorization" });

    const session = await keydb.get(`sessions/${authorization}`);
    if (!session && options.required)
      return res
        .status(403)
        .send({ error: true, code: "invalid_authentication" });

    if (session) {
      const user = await prisma.users.findFirst({ where: { id: session } });
      if (!user && options.required)
        return res
          .status(403)
          .send({ error: true, code: "invalid_authentication" });
      if (user) req.user = user;

      if (options.admin && !((user?.flags || 0) & UserFlags.admin))
        return res
          .status(401)
          .send({ error: true, code: "invalid_permissions" });
    }
  });
};

export const AuthMiddleware = fp(middlewareCallback);
