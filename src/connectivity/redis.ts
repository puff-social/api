import { Redis } from 'ioredis';
import { env } from '../env';

export const keydb = new Redis(env.REDIS_URI, { lazyConnect: true });

(async () => {
  await keydb.connect();
  console.log('KeyDB > Connected');
})();