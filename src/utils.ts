import { z } from "zod";
import { createDecipheriv, createHash } from "crypto";

import { env } from "./env";
import { ProductModelMap } from "./constants";

export const feedbackValidation = z.object({
  message: z.string().max(1024),
});

const mac = z.custom<string>((val) => {
  return /^([0-9A-F]{2}[:]){5}([0-9A-F]{2})$/.test(val as string);
});

export const trackingValidation = z.object({
  name: z.string().max(32),
  device: z.object({
    dob: z.number(),
    mac,
    name: z.string().max(32),
    totalDabs: z.number(),
    dabsPerDay: z.number(),
    model: z.enum(ProductModelMap),
    firmware: z.string(),
    hardware: z.number(),
    gitHash: z.string().max(7),
  }),
});

const profileValidation = z.object({
  name: z.string(),
  temp: z.number(),
  time: z.string(),
});

export const diagValidation = z.object({
  session_id: z.string(),
  device_services: z.array(
    z.object({ uuid: z.string(), characteristicCount: z.number() })
  ),
  device_profiles: z
    .object({
      1: profileValidation,
      2: profileValidation,
      3: profileValidation,
      4: profileValidation,
    })
    .optional(),
  device_parameters: z.object({
    name: z.string(),
    model: z.enum(ProductModelMap),
    firmware: z.string(),
    hash: z.string().max(7).optional(),
    uptime: z.number().optional(),
    utc: z.number().optional(),
    batteryCapacity: z.number().optional(),
    mac: z.string().optional(),
    dob: z.number().optional(),
    chamberType: z.number().optional(),
    authenticated: z.boolean().optional(),
    pupService: z.boolean().optional(),
    loraxService: z.boolean().optional(),
    serialNumber: z.string().optional(),
    hardwareVersion: z.number().optional(),
  }),
});

export function verifyRequest<T>(body: Buffer, signature: string): T {
  const key = Buffer.from(env.METRICS_KEY);

  const iv = Buffer.alloc(16, 0);
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  const dec = decipher.update(body).toString() + decipher.final().toString();

  const newSignature = createHash("sha256").update(dec).digest("base64");
  if (signature != newSignature) throw { code: "invalid_signature" };

  return JSON.parse(dec) as T;
}

export function sanitize<T>(object: T, keys: string[]): T {
  for (const key of keys) delete object[key as keyof T];
  return object;
}

export function macAddressToUint8Array(macAddress: string): Uint8Array {
  const cleanedMacAddress = macAddress.replace(/:/g, "");

  const arr = new Uint8Array(cleanedMacAddress.length / 2);

  for (let i = 0; i < arr.length; i++) {
    const hexByte = cleanedMacAddress.substring(i * 2, (i + 1) * 2);
    arr[i] = parseInt(hexByte, 16);
  }

  const reversedArray = new Uint8Array(arr.length);
  for (let i = 0; i < arr.length; i++)
    reversedArray[i] = arr[arr.length - i - 1];

  return reversedArray;
}
