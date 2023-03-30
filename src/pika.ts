import { Pika } from "pika-id";

const prefixes = [
  'feedback', 'leaderboard', 'diagnostics', 'strain', 'user',
  {
    prefix: 'oauth',
    secure: true
  },
  {
    prefix: 'session',
    secure: true
  }
];

export const pika = new Pika(prefixes, { epoch: 1676953708489 });