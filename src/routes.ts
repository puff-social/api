import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { ZodError } from "zod"
  ;
import { pika } from "./pika";
import { feedbackValidation } from "./utils";
import { prisma } from "./connectivity/prsima";

export function Routes(server: FastifyInstance, opts: FastifyPluginOptions, next: () => void) {
  server.post('/track', (req, res) => {
    console.log(req.body);
    return res.status(204).send();
  });

  server.post('/feedback', async (req, res) => {
    try {
      const id = pika.gen('feedback');
      const validate = await feedbackValidation.parseAsync(req.body);
      const ip = (req.headers['cf-connecting-ip'] || req.connection.remoteAddress || '0.0.0.0') as string;

      await prisma.feedback.create({
        data: {
          id, message: validate.message, ip
        }
      });

      return res.status(204).send();
    } catch (error) {
      if (error instanceof ZodError)
        return res.status(400).send({ success: false, error: { code: 'validation_error', issues: error.issues } });


      console.error('error with feedback', error);
      return res.status(500).send({ success: false, error: { code: 'internal_error' } });
    }

  });

  return next();
}