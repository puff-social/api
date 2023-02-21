import { z } from "zod";

export const feedbackValidation = z.object({
  message: z.string().max(1024)
});