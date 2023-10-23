import { FastifyInstance, FastifyPluginOptions } from "fastify";

import { AuthMiddleware } from "./middleware";
import { getUsersRoute, updateUser } from "./methods/users";
import { getDeviceByMac, getDevicesRoute } from "./methods/devices";
import { getOtaFirmware } from "./methods/firmware";
import { callbackOAuth, getOAuthURL } from "./methods/oauth";
import { puffcoLogin } from "./methods/auth/puffco";
import { createAccount, loginAccount } from "./methods/auth/proprietary";
import { userFeedback } from "./methods/feedback";
import { trackDevice, trackDiags } from "./methods/analytics";
import { getDeviceLeaderboard } from "./methods/leaderboard";
import { verifyToken } from "./methods/internal/verify";
import { remoteActionTrigger } from "./methods/remote";

export function InternalRoutes(
  server: FastifyInstance,
  opts: FastifyPluginOptions,
  next: () => void
) {
  server.get("/users", getUsersRoute);
  server.get("/devices", getDevicesRoute);

  server.get("/verify", verifyToken);

  next();
}

export function AdministrativeRoutes(
  server: FastifyInstance,
  opts: FastifyPluginOptions,
  next: () => void
) {
  server.register(AuthMiddleware, { required: true, admin: true });

  server.get("/users", getUsersRoute);

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
        user: req.user,
        connection: req.linkedConnection,
      },
    });
  });

  server.patch("/user", updateUser);

  server.post("/remote", remoteActionTrigger);

  server.get("/puffco/profiles", async (req, res) => {
    // if (req.user.platform != "puffco")
    //   return res
    //     .status(400)
    //     .send({ error: true, code: "invalid_user_platform" });

    // get token for the user and regen if required

    // get the users heat profiles

    return res.status(200).send();
  });

  server.get("/puffco/moodlights", async (req, res) => {
    // if (req.user.platform != "puffco")
    //   return res
    //     .status(400)
    //     .send({ error: true, code: "invalid_user_platform" });

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

  server.get("/leaderboard", getDeviceLeaderboard);

  server.post("/feedback", userFeedback);

  server.post("/track", trackDevice);
  server.post("/diag", trackDiags);

  server.get("/device/:device_mac", getDeviceByMac);
  server.get("/fw/peak/:serial", getOtaFirmware);

  server.get("/oauth/:platform", getOAuthURL);
  server.post("/oauth/:platform", callbackOAuth);

  server.post("/auth/puffco", puffcoLogin);
  server.post("/auth", loginAccount);
  server.post("/auth/create", createAccount);

  return next();
}
