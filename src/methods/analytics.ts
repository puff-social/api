import { pika } from "@puff-social/commons";

import { FastifyReply, FastifyRequest } from "fastify";

import { prisma } from "../connectivity/prisma";
import {
  verifyRequest,
  diagValidation,
  trackingValidation,
  sanitize,
} from "../utils";
import { LogTypes, Owner, trackLog } from "../utils/logging";

export async function trackDiags(req: FastifyRequest, res: FastifyReply) {
  if (!req.headers["x-signature"])
    return res.status(400).send({ code: "invalid_diag_data" });
  const body = verifyRequest(
    Buffer.from(req.rawBody as string, "base64"),
    req.headers["x-signature"] as string
  );
  const validate = await diagValidation.parseAsync(body);

  const id = pika.gen("diagnostics");
  const ip = (req.headers["cf-connecting-ip"] ??
    req.socket.remoteAddress ??
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

      trackLog(LogTypes.DeviceConnection, "devices", {
        id: device.id,
        name: device.name,
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
        user_agent: userAgent ?? "unknown",
        ip,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(400).send({ code: "invalid_tracking_data" });
  }

  return res.status(204).send();
}

export async function trackDevice(req: FastifyRequest, res: FastifyReply) {
  if (!req.headers["x-signature"])
    return res.status(400).send({ code: "invalid_tracking_data" });
  const body = verifyRequest(
    Buffer.from(req.rawBody as string, "base64"),
    req.headers["x-signature"] as string
  );
  try {
    const validate = await trackingValidation.parseAsync(body);

    const ip = (req.headers["cf-connecting-ip"] ??
      req.socket.remoteAddress ??
      "0.0.0.0") as string;

    const date = new Date(validate.device.dob * 1000);
    if (isNaN(date.getTime()))
      return res.status(400).send({ code: "invalid_tracking_data" });

    const existing = await prisma.devices.findFirst({
      where: { mac: validate.device.mac },
      include: {
        users: { select: { id: true, name: true, display_name: true } },
      },
    });
    if (existing) {
      if (existing.dabs != validate.device.totalDabs)
        trackLog(LogTypes.DeviceDabsUpdate, "devices", {
          id: existing.id,
          name: existing.name,
          dabs: validate.device.totalDabs,
        });
      if (req.user && existing.users && req.user.id != existing.user_id)
        trackLog(LogTypes.DeviceNewOwner, "devices", {
          id: existing.id,
          name: existing.name,
          new_owner: {
            id: req.user.id,
            name: req.user.name,
            display_name: req.user.display_name,
          },
          old_owner: existing.users as Owner,
        });

      await prisma.devices.update({
        data: {
          name: validate.device.name,
          dabs: validate.device.totalDabs,
          avg_dabs: validate.device.dabsPerDay,
          model: validate.device.model,
          firmware: validate.device.firmware,
          hardware: validate.device.hardware,
          git_hash: validate.device.gitHash,
          last_dab: validate.device.lastDabAt
            ? new Date(validate.device.lastDabAt)
            : undefined,
          dob: new Date(validate.device.dob * 1000),
          last_active: new Date().toISOString(),
          last_ip: ip,
          serial_number: validate.device.serial,
          ...(req.user ? { user_id: req.user.id } : {}),
        },
        where: {
          mac: validate.device.mac,
        },
      });
    } else {
      const id = pika.gen("device");
      trackLog(LogTypes.NewDevice, "devices", {
        id,
        name: validate.device.name,
        mac: validate.device.mac,
        firmware: validate.device.firmware,
        serial_number: validate.device.serial,
        device_model: validate.device.model,
        dabs: validate.device.totalDabs,
      });
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
          last_dab: validate.device.lastDabAt
            ? new Date(validate.device.lastDabAt)
            : undefined,
          dob: new Date(validate.device.dob * 1000),
          last_active: new Date().toISOString(),
          last_ip: ip,
          serial_number: validate.device.serial,
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
}
