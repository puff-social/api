import { createDecipheriv, createHash } from "crypto";
import { z } from "zod";
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

export const diagValidation = z.object({
  device_model: z.string(),
  device_firmware: z.string(),
  device_name: z.string(),
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