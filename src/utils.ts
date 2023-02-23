import { z } from "zod";

export const feedbackValidation = z.object({
  message: z.string().max(1024)
});

export const trackingValidation = z.object({
  name: z.string(),
  device: z.object({
    id: z.string(),
    uid: z.string(),
    name: z.string(),
    totalDabs: z.number()
  })
});

export function sanitize<T>(object: T, keys: string[]): T {
  for (const key of keys) delete object[key as keyof T];
  return object;
}