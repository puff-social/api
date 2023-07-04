import { pika } from "@puff-social/commons";

import { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

import { prisma } from "../connectivity/prisma";
import { verifyRequest, feedbackValidation } from "../utils";

export async function userFeedback(req: FastifyRequest, res: FastifyReply) {
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
}
