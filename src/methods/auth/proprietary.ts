import { pika } from "@puff-social/commons";
import { keydb } from "@puff-social/commons/dist/connectivity/keydb";

import { hash, verify } from "argon2";
import { FastifyRequest } from "fastify";

import { prisma } from "../../connectivity/prisma";
import { loginValidation, registerValidation } from "../../utils";
import { LogTypes, trackLog } from "../../utils/logging";

export async function createAccount(req: FastifyRequest, res) {
  const { username, display_name, email, password } =
    await registerValidation.parseAsync(req.body);
  const account = await prisma.accounts.findFirst({
    where: {
      email: email.toLowerCase(),
    },
  });

  if (account)
    return res.status(400).send({
      error: true,
      code: "email_already_registered",
    });

  const user = await prisma.users.findFirst({
    where: {
      name: { equals: username, mode: "insensitive" },
    },
  });

  if (user)
    return res.status(400).send({
      error: true,
      code: "username_taken",
    });

  const id = pika.gen("user");
  const account_id = pika.gen("account");

  trackLog(LogTypes.NewUser, {
    id,
    name: username,
    display_name,
    auth_type: "first",
  });

  await prisma.users.create({
    data: {
      id,
      name: username,
      display_name,
    },
  });

  await prisma.accounts.create({
    data: {
      id: account_id,
      email: email.toLowerCase(),
      password: await hash(password),
      user_id: id,
    },
  });

  const session = pika.gen("session");
  await keydb.hset(`sessions/${session}`, {
    user_id: id,
    account_id,
  });

  await prisma.sessions.create({
    data: {
      ip: (req.headers["cf-connecting-ip"] ||
        req.socket.remoteAddress ||
        "0.0.0.0") as string,
      token: session,
      user_agent: req.headers["user-agent"] || "N/A",
      user_id: id,
      account_id,
    },
  });

  return res.status(200).send({
    success: true,
    data: {
      user: { id, name: username, display_name, image: null },
      token: session,
    },
  });
}

export async function loginAccount(req: FastifyRequest, res) {
  const { email, password } = await loginValidation.parseAsync(req.body);
  const account = await prisma.accounts.findFirst({
    include: { users: true },
    where: {
      email: email.toLowerCase(),
    },
  });

  if (!account)
    return res.status(400).send({
      error: true,
      code: "email_not_registered",
    });

  const check = await verify(account.password, password);
  if (!check)
    return res.status(400).send({
      error: true,
      code: "invalid_password",
    });

  const session = pika.gen("session");
  await keydb.hset(`sessions/${session}`, {
    user_id: account.user_id,
    account_id: account.id,
  });

  await prisma.sessions.create({
    data: {
      ip: (req.headers["cf-connecting-ip"] ||
        req.socket.remoteAddress ||
        "0.0.0.0") as string,
      token: session,
      user_agent: req.headers["user-agent"] || "N/A",
      user_id: account.user_id,
      account_id: account.id,
    },
  });

  return res.status(200).send({
    success: true,
    data: {
      user: account.users,
      token: session,
    },
  });
}
