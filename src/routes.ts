import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { ZodError } from "zod"
  ;
import { pika } from "./pika";
import { feedbackValidation, trackingValidation } from "./utils";
import { prisma } from "./connectivity/prsima";

export function Routes(server: FastifyInstance, opts: FastifyPluginOptions, next: () => void) {
  server.get('/leaderboard', async (req, res) => {
    const leaderboards = await prisma.leaderboard.findMany({ orderBy: { total_dabs: 'desc' }, take: 10 });

    return res.status(200).send({ success: true, data: { leaderboards } });
  });

  server.post('/track', async (req, res) => {
    const validate = await trackingValidation.parseAsync(req.body);

    const id = pika.gen('leaderboard');
    const deviceBirthday = new Date(Number(Buffer.from(validate.device.id, 'base64').toString('utf8')) * 1000);

    const existing = await prisma.leaderboard.findFirst({ where: { device_id: validate.device.id } });
    if (existing) {
      await prisma.leaderboard.update({
        data: {
          device_name: validate.device.name, device_birthday: deviceBirthday, owner_name: validate.name, total_dabs: validate.device.totalDabs
        },
        where: {
          device_id: validate.device.id
        }
      });
    } else {
      await prisma.leaderboard.create({
        data: {
          id, device_id: validate.device.id, device_name: validate.device.name, device_birthday: deviceBirthday, owner_name: validate.name, total_dabs: validate.device.totalDabs
        }
      });
    }

    return res.status(204).send();
  });

  server.post('/feedback', async (req, res) => {
    try {
      const validate = await feedbackValidation.parseAsync(req.body);

      const id = pika.gen('feedback');
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