import { ZodError } from "zod";
import { stringify } from "querystring";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";

import { env } from "./env";
import { pika } from "./pika";
import { keydb } from "./connectivity/redis";
import { minio } from "./connectivity/minio";
import { prisma } from "./connectivity/prsima";
import { AuthMiddleware } from "./middleware";
import { exchangeDiscordCode, fetchDiscordUser } from "./helpers/discord";
import {
  diagValidation,
  feedbackValidation,
  sanitize,
  trackingValidation,
  userUpdateValidation,
  verifyRequest,
} from "./utils";
import { getDevicesRoute } from "./methods/devices";
import { fetchUser, login as puffcoLogin } from "./helpers/puffco";
import { users } from "@prisma/client";
import { NameDisplay } from "./constants";

export function InternalRoutes(
  server: FastifyInstance,
  opts: FastifyPluginOptions,
  next: () => void
) {
  server.get("/devices", getDevicesRoute);

  server.get("/verify", async (req, res) => {
    const authorization = req.headers.authorization;
    if (!authorization) return res.status(200).send({ valid: false });

    const session = await keydb.get(`sessions/${authorization}`);
    if (!session) return res.status(200).send({ valid: false });

    const user = await prisma.users.findFirst({ where: { id: session } });

    return res.status(200).send({
      valid: true,
      user: sanitize(user, [
        "platform_id",
        "refresh_token",
        ...(user?.name_display == NameDisplay.FirstName
          ? ["last_name"]
          : user?.name_display == NameDisplay.FirstLast
          ? []
          : ["first_name", "last_name"]),
      ]),
    });
  });

  next();
}

export function AdministrativeRoutes(
  server: FastifyInstance,
  opts: FastifyPluginOptions,
  next: () => void
) {
  server.register(AuthMiddleware, { required: true, admin: true });

  server.get("/devices", getDevicesRoute);

  next();
}

export function AuthedRoutes(
  server: FastifyInstance,
  opts: FastifyPluginOptions,
  next: () => void
) {
  server.register(AuthMiddleware, { required: true });

  server.get("/user", async (req, res) => {
    return res.status(200).send({
      success: true,
      data: {
        user: sanitize(req.user, ["platform_id", "refresh_token"]),
      },
    });
  });

  server.patch(
    "/user",
    async (req: FastifyRequest<{ Body: Pick<users, "name_display"> }>, res) => {
      const validate = await userUpdateValidation.parseAsync(req.body);

      const user = await prisma.users.update({
        where: { id: req.user.id },
        data: validate,
      });

      return res.status(200).send({
        success: true,
        data: {
          user: sanitize(user, ["platform_id", "refresh_token"]),
        },
      });
    }
  );

  server.get("/puffco/profiles", async (req, res) => {
    if (req.user.platform != "puffco")
      return res
        .status(400)
        .send({ error: true, code: "invalid_user_platform" });

    // get token for the user and regen if required

    // get the users heat profiles

    return res.status(200).send();
  });

  server.get("/puffco/moodlights", async (req, res) => {
    if (req.user.platform != "puffco")
      return res
        .status(400)
        .send({ error: true, code: "invalid_user_platform" });

    // get token for the user and regen if required

    // get the users moodlights

    return res.status(200).send();
  });

  next();
}

export function Routes(
  server: FastifyInstance,
  opts: FastifyPluginOptions,
  next: () => void
) {
  server.register(AuthMiddleware);

  server.get(
    "/leaderboard",
    async (req: FastifyRequest<{ Querystring: { limit?: string } }>, res) => {
      const leaderboard = await prisma.device_leaderboard.findMany({
        orderBy: { position: "asc" },
        take: Number(req.query.limit) || 25,
        where: { devices: { users: { isNot: null } } },
        include: {
          devices: {
            include: {
              users: {
                select: {
                  name: true,
                  image: true,
                  flags: true,
                  platform: true,
                  platform_id: true,
                },
              },
            },
          },
        },
      });

      for (const lb of leaderboard)
        sanitize(lb.devices, [
          "mac",
          "git_hash",
          "profiles",
          "last_ip",
          "serial_number",
        ]);

      return res
        .status(200)
        .send({ success: true, data: { leaderboards: leaderboard } });
    }
  );

  server.post("/track", async (req, res) => {
    if (!req.headers["x-signature"])
      return res.status(400).send({ code: "invalid_tracking_data" });
    const body = verifyRequest(
      Buffer.from(req.rawBody as string, "base64"),
      req.headers["x-signature"] as string
    );
    try {
      const validate = await trackingValidation.parseAsync(body);

      const ip = (req.headers["cf-connecting-ip"] ||
        req.socket.remoteAddress ||
        "0.0.0.0") as string;

      const date = new Date(validate.device.dob * 1000);
      if (isNaN(date.getTime()))
        return res.status(400).send({ code: "invalid_tracking_data" });

      const existing = await prisma.devices.findFirst({
        where: { mac: validate.device.mac },
      });
      if (existing) {
        await prisma.devices.update({
          data: {
            name: validate.device.name,
            dabs: validate.device.totalDabs,
            avg_dabs: validate.device.dabsPerDay,
            model: validate.device.model,
            firmware: validate.device.firmware,
            hardware: validate.device.hardware,
            git_hash: validate.device.gitHash,
            dob: new Date(validate.device.dob * 1000),
            last_active: new Date().toISOString(),
            last_ip: ip,
            ...(req.user ? { user_id: req.user.id } : {}),
          },
          where: {
            mac: validate.device.mac,
          },
        });
      } else {
        const id = pika.gen("device");
        await prisma.devices.create({
          data: {
            id,
            name: validate.device.name,
            mac: validate.device.mac,
            dabs: validate.device.totalDabs,
            avg_dabs: validate.device.dabsPerDay,
            model: validate.device.model,
            firmware: validate.device.firmware,
            hardware: validate.device.hardware,
            git_hash: validate.device.gitHash,
            dob: new Date(validate.device.dob * 1000),
            last_active: new Date().toISOString(),
            last_ip: ip,
            ...(req.user ? { user_id: req.user.id } : {}),
          },
        });
      }

      const device = await prisma.devices.findFirst({
        where: { mac: validate.device.mac },
      });

      const pos = await prisma.device_leaderboard.findFirst({
        where: { id: device?.id },
      });

      return res.status(200).send({
        success: true,
        data: {
          device: sanitize(device, [
            "mac",
            "model",
            "hardware",
            "serial_number",
            "dob",
            "last_ip",
            "user_id",
          ]),
          position: pos?.position,
        },
      });
    } catch (error) {
      console.error(error);
    }
  });

  server.post("/diag", async (req, res) => {
    if (!req.headers["x-signature"])
      return res.status(400).send({ code: "invalid_diag_data" });
    const body = verifyRequest(
      Buffer.from(req.rawBody as string, "base64"),
      req.headers["x-signature"] as string
    );
    const validate = await diagValidation.parseAsync(body);

    const id = pika.gen("diagnostics");
    const ip = (req.headers["cf-connecting-ip"] ||
      req.socket.remoteAddress ||
      "0.0.0.0") as string;
    const userAgent = req.headers["user-agent"];

    try {
      const device = await prisma.devices.findFirst({
        where: { mac: validate.device_parameters.mac },
      });

      if (device) {
        await prisma.devices.update({
          data: {
            profiles: validate.device_profiles,
            serial_number: validate.device_parameters.serialNumber,
          },
          where: {
            mac: validate.device_parameters.mac,
          },
        });
      }

      await prisma.diagnostics.create({
        data: {
          id,
          device_name: validate.device_parameters.name,
          device_model: validate.device_parameters.model,
          device_firmware: validate.device_parameters.firmware,
          device_git_hash: validate.device_parameters.hash,
          device_uptime: validate.device_parameters.uptime,
          device_utc_time: validate.device_parameters.utc,
          device_battery_capacity: validate.device_parameters.batteryCapacity,
          device_serial_number: validate.device_parameters.serialNumber,
          device_hardware_version:
            validate.device_parameters.hardwareVersion?.toString(),
          authenticated: validate.device_parameters.authenticated,
          pup: validate.device_parameters.pupService,
          lorax: validate.device_parameters.loraxService,
          device_mac: validate.device_parameters.mac,
          device_dob:
            validate.device_parameters.dob != 1000
              ? new Date((validate.device_parameters.dob as number) * 1000)
              : null,
          device_chamber_type: validate.device_parameters.chamberType,
          device_profiles: validate.device_profiles,
          device_services: validate.device_services,
          session_id: validate.session_id,
          user_agent: userAgent || "unknown",
          ip,
        },
      });
    } catch (error) {
      console.error(error);
      return res.status(400).send({ code: "invalid_tracking_data" });
    }

    return res.status(204).send();
  });

  server.post("/feedback", async (req, res) => {
    try {
      if (!req.headers["x-signature"])
        return res.status(400).send({ code: "invalid_feedback_request" });
      const body = verifyRequest(
        Buffer.from(req.rawBody as string, "base64"),
        req.headers["x-signature"] as string
      );
      const validate = await feedbackValidation.parseAsync(body);

      const id = pika.gen("feedback");
      const ip = (req.headers["cf-connecting-ip"] ||
        req.socket.remoteAddress ||
        "0.0.0.0") as string;

      await prisma.feedback.create({
        data: {
          id,
          message: validate.message,
          ip,
        },
      });

      return res.status(204).send();
    } catch (error) {
      if (error instanceof ZodError)
        return res.status(400).send({
          success: false,
          error: { code: "validation_error", issues: error.issues },
        });

      console.error("error with feedback", error);
      return res
        .status(500)
        .send({ success: false, error: { code: "internal_error" } });
    }
  });

  server.get(
    "/device/:device_mac",
    async (req: FastifyRequest<{ Params: { device_mac: string } }>, res) => {
      try {
        const device = await prisma.devices.findFirst({
          where: {
            mac: Buffer.from(
              req.params.device_mac.split("_")[1],
              "base64"
            ).toString(),
          },
          include: {
            users: {
              select: {
                name: true,
                image: true,
                flags: true,
                platform: true,
                platform_id: true,
              },
            },
          },
        });

        if (!device)
          return res
            .status(404)
            .send({ success: false, error: { code: "device_not_found" } });
        const position = await prisma.device_leaderboard.findFirst({
          where: { id: device.id },
        });

        return res.status(200).send({
          success: true,
          data: {
            device: sanitize(device, [
              "mac",
              "git_hash",
              "profiles",
              "last_ip",
              "serial_number",
            ]),
            position: position?.position,
          },
        });
      } catch (error) {
        console.error("error with get device", error);
        return res
          .status(500)
          .send({ success: false, error: { code: "internal_error" } });
      }
    }
  );

  server.get(
    "/oauth/:platform",
    async (req: FastifyRequest<{ Params: { platform: string } }>, res) => {
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
  );

  server.post(
    "/oauth/:platform",
    async (
      req: FastifyRequest<{
        Params: { platform: string };
        Querystring: { state: string; code: string };
      }>,
      res
    ) => {
      const { state, code } = req.query;

      switch (req.params.platform) {
        case "discord": {
          const validState = await keydb.exists(`oauth_state/${state}`);
          if (!validState)
            return res
              .status(400)
              .send({ success: false, error: "invalid_state" });

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

          const existingUser = await prisma.users.findFirst({
            where: { platform_id: user.id, platform: "discord" },
          });
          if (existingUser) {
            const session = pika.gen("session");
            await keydb.set(`sessions/${session}`, existingUser.id);

            if (user.avatar != existingUser.image) {
              if (existingUser.image)
                await minio.send(
                  new DeleteObjectCommand({
                    Bucket: env.MINIO_BUCKET,
                    Key: `avatars/${existingUser.id}/${existingUser.image}.${
                      existingUser.image.startsWith("a_") ? "gif" : "png"
                    }`,
                  })
                );

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
                  Key: `avatars/${existingUser.id}/${hash}.${
                    hash.startsWith("a_") ? "gif" : "png"
                  }`,
                  Body: imgBuffer,
                  ContentType: "image/png",
                })
              );

              await prisma.users.update({
                where: { id: existingUser.id },
                data: { image: hash },
              });

              existingUser.image = hash;
            }

            return res.status(200).send({
              success: true,
              data: {
                user: sanitize(existingUser, ["platform_id", "refresh_token"]),
                token: session,
              },
            });
          }

          const id = pika.gen("user");

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

          await prisma.users.create({
            data: {
              id,
              name: user.username,
              platform: "discord",
              platform_id: user.id,
              image: hash,
              refresh_token: tokens.refresh_token,
              platform_verified: true,
            },
          });

          const session = pika.gen("session");
          await keydb.set(`sessions/${session}`, id);

          return res.status(200).send({
            success: true,
            data: {
              user: { id, name: user.username, image: hash },
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
  );

  server.post(
    "/auth/puffco",
    async (
      req: FastifyRequest<{ Body: { email: string; password: string } }>,
      res
    ) => {
      const { email, password } = req.body;
      const login = await puffcoLogin(email, password);
      const puffcoUser = await fetchUser(login.accessToken);

      const existingUser = await prisma.users.findFirst({
        where: { platform_id: puffcoUser.id.toString(), platform: "puffco" },
      });

      if (existingUser) {
        const session = pika.gen("session");
        await keydb.set(`sessions/${session}`, existingUser.id);

        await prisma.users.update({
          where: { id: existingUser.id },
          data: {
            name: puffcoUser.username,
            first_name: puffcoUser.firstName,
            last_name: puffcoUser.lastName,
            platform_verified: puffcoUser.verified,
          },
        });

        return res.status(200).send({
          success: true,
          data: {
            user: sanitize(existingUser, ["platform_id", "refresh_token"]),
            token: session,
          },
        });
      }

      const id = pika.gen("user");

      await prisma.users.create({
        data: {
          id,
          name: puffcoUser.username,
          platform: "puffco",
          platform_id: puffcoUser.id.toString(),
          refresh_token: null,
          first_name: puffcoUser.firstName,
          last_name: puffcoUser.lastName,
          platform_verified: puffcoUser.verified,
        },
      });

      const session = pika.gen("session");
      await keydb.set(`sessions/${session}`, id);

      return res.status(200).send({
        success: true,
        data: {
          user: { id, name: puffcoUser.username, image: null },
          token: session,
        },
      });
    }
  );

  return next();
}
