import { z } from "zod";

export const feedbackValidation = z.object({
  message: z.string().max(1024)
});

export const trackingValidation = z.object({
  device: z.object({
    id: z.string(),
    name: z.string(),
    totalDabs: z.number(),
  }),
  name: z.string()
});