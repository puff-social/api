import { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import { ZodError } from "zod"
  ;
import { pika } from "./pika";
import { diagValidation, feedbackValidation, sanitize, trackingValidation, verifyRequest } from "./utils";
import { prisma } from "./connectivity/prsima";

export function Routes(server: FastifyInstance, opts: FastifyPluginOptions, next: () => void) {
  server.get('/leaderboard', async (req, res) => {
    const leaderboards = await prisma.leaderboard.findMany({ orderBy: { total_dabs: 'desc' }, take: 10 });
    for (const lb of leaderboards) sanitize(lb, ['last_ip']);

    return res.status(200).send({ success: true, data: { leaderboards } });
  });

  server.post('/track', async (req, res) => {
    if (!req.headers['x-signature']) return res.status(400).send({ code: 'invalid_tracking_data' });
    const body = await verifyRequest(Buffer.from(req.rawBody as string, 'base64'), req.headers['x-signature'] as string);
    const validate = await trackingValidation.parseAsync(body);

    const id = pika.gen('leaderboard');
    const ip = (req.headers['cf-connecting-ip'] || req.socket.remoteAddress || '0.0.0.0') as string;
    const deviceUid = Buffer.from(validate.device.uid, 'base64').toString('utf8');

    if (isNaN(Number(deviceUid)))
      return res.status(400).send({ code: 'invalid_tracking_data' });

    const date = new Date(validate.device.dob * 1000);
    if (isNaN(date.getTime())) return res.status(400).send({ code: 'invalid_tracking_data' });

    const generatedDeviceId = `device_${Buffer.from(deviceUid).toString('base64')}`;

    const existing = await prisma.leaderboard.findFirst({ where: { device_id: generatedDeviceId } });
    if (existing) {
      await prisma.leaderboard.update({
        data: {
          device_name: validate.device.name,
          device_dob: date,
          device_model: validate.device.model,
          owner_name: validate.name,
          total_dabs: validate.device.totalDabs,
          last_active: new Date().toISOString(),
          last_ip: ip,
        },
        where: {
          device_id: generatedDeviceId
        }
      });
    } else {
      await prisma.leaderboard.create({
        data: {
          id,
          device_id: generatedDeviceId,
          device_name: validate.device.name,
          device_dob: new Date(validate.device.dob * 1000),
          device_model: validate.device.model,
          owner_name: validate.name,
          total_dabs: validate.device.totalDabs,
          last_ip: ip,
        }
      });
    }

    const leaderboard = await prisma.leaderboard.findMany({ orderBy: { total_dabs: 'desc' } });

    return res.status(200).send({
      success: true,
      data: {
        device: leaderboard.find(d => d.device_id == generatedDeviceId),
        position: leaderboard.findIndex(d => d.device_id == generatedDeviceId) + 1
      }
    });
  });

  server.post('/diag', async (req, res) => {
    if (!req.headers['x-signature']) return res.status(400).send({ code: 'invalid_diag_data' });
    const body = await verifyRequest(Buffer.from(req.rawBody as string, 'base64'), req.headers['x-signature'] as string);
    const validate = await diagValidation.parseAsync(body);

    const id = pika.gen('diagnostics');
    const ip = (req.headers['cf-connecting-ip'] || req.socket.remoteAddress || '0.0.0.0') as string;
    const userAgent = req.headers["user-agent"];

    try {
      await prisma.diag.create({
        data: {
          id,
          device_name: validate.device_parameters.name,
          device_model: validate.device_parameters.model,
          device_firmware: validate.device_parameters.firmware,
          device_git_hash: validate.device_parameters.hash,
          device_uptime: validate.device_parameters.uptime,
          device_utc_time: validate.device_parameters.utc,
          device_battery_capacity: validate.device_parameters.batteryCapacity,
          authenticated: validate.device_parameters.authenticated,
          pup: validate.device_parameters.pupService,
          lorax: validate.device_parameters.loraxService,
          device_uid: validate.device_parameters.uid,
          device_dob: validate.device_parameters.dob != 1000 ? new Date(validate.device_parameters.dob as number * 1000) : null,
          device_chamber_type: validate.device_parameters.chamberType,
          device_profiles: validate.device_profiles,
          device_services: validate.device_services,
          session_id: validate.session_id,
          user_agent: userAgent || 'unknown',
          ip,
        }
      });
    } catch (error) {
      console.error(error);
    }

    return res.status(204).send();
  });

  server.post('/feedback', async (req, res) => {
    try {
      if (!req.headers['x-signature']) return res.status(400).send({ code: 'invalid_feedback_request' });
      const body = await verifyRequest(Buffer.from(req.rawBody as string, 'base64'), req.headers['x-signature'] as string);
      const validate = await feedbackValidation.parseAsync(body);

      const id = pika.gen('feedback');
      const ip = (req.headers['cf-connecting-ip'] || req.socket.remoteAddress || '0.0.0.0') as string;

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

  server.get('/device/:device_id', async (req: FastifyRequest<{ Params: { device_id: string } }>, res) => {
    try {
      const device = await prisma.leaderboard.findFirst({ where: { device_id: req.params.device_id } });
      if (!device) return res.status(404).send({ success: false, error: { code: 'device_not_found' } });
      const position = await prisma.leaderboard_positions.findFirst({ where: { device_id: device.device_id } });

      return res.status(200).send({
        success: true,
        data: {
          device: sanitize(device, ['last_ip']),
          position: position?.position
        }
      });
    } catch (error) {
      console.error('error with get device', error);
      return res.status(500).send({ success: false, error: { code: 'internal_error' } });
    }
  });

  return next();
}