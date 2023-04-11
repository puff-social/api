import fastify from 'fastify';

import { env } from './env';
import { InternalRoutes } from './routes';

const server = fastify();

server.register(InternalRoutes);

server.get('/health', (req, res) => res.status(204).send());

server.setNotFoundHandler((req, res) => {
  res.status(404).send({ success: false, error: { code: 'route_not_found' } });
});

server.listen({ port: env.INT_PORT, host: '0.0.0.0' }, () => {
  console.log(`API > Internal API listening on ${env.INT_PORT}`);
});