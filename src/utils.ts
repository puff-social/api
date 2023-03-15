import { createDecipheriv, createHash } from "crypto";
import { number, z } from "zod";
import { env } from "./env";

export const feedbackValidation = z.object({
  message: z.string().max(1024)
});

export const trackingValidation = z.object({
  name: z.string(),
  device: z.object({
    id: z.string(),
    uid: z.string(),
    name: z.string(),
    totalDabs: z.number(),
    model: z.string(),
  })
});

const profileValidation = z.object({ name: z.string(), temp: z.number(), time: z.string() });

export const diagValidation = z.object({
  session_id: z.string(),
  device_services: z.array(z.object({ uuid: z.string(), characteristicCount: z.number() })),
  device_profiles: z.object({ 1: profileValidation, 2: profileValidation, 3: profileValidation, 4: profileValidation }).optional(),
  device_parameters: z.object({
    name: z.string(),
    model: z.string(),
    firmware: z.string(),
    hash: z.string().optional(),
    uptime: z.number().optional(),
    utc: z.number().optional(),
    batteryCapacity: z.number().optional(),
    uid: z.string().optional(),
    dob: z.number().optional(),
    chamberType: z.number().optional(),
    authenticated: z.boolean().optional(),
    pupService: z.boolean().optional(),
    loraxService: z.boolean().optional()
  })
});

export function verifyRequest<T>(body: Buffer, signature: string): T {
  const key = Buffer.from(env.METRICS_KEY);

  const iv = Buffer.alloc(16, 0);
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  const dec = decipher.update(body).toString() + decipher.final().toString();

  const newSignature = createHash('sha256').update(dec).digest('base64');
  if (signature != newSignature) throw { code: 'invalid_signature' };

  return JSON.parse(dec) as T;
}

export function sanitize<T>(object: T, keys: string[]): T {
  for (const key of keys) delete object[key as keyof T];
  return object;
}