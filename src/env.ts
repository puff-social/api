import { bool, envsafe, port, str } from "envsafe";

export const env = envsafe({
  DEBUG: bool({
    default: false,
  }),
  PORT: port({
    default: 8000,
  }),
  INT_PORT: port({
    default: 8002,
  }),
  BOT_HOST: str({
    default: "http://bot:8000",
    devDefault: "http://10.8.99.24:8000",
  }),
  GATEWAY_HOST: str({
    default: "http://gateway:9002",
    devDefault: "http://10.8.99.23:9002",
  }),
  DASH_API_HOST: str({
    default: "http://int-api:8006",
    devDefault: "http://10.8.99.4:8006",
  }),
  METRICS_KEY: str({
    desc: "Signing key for metrics data",
  }),
  REDIS_URI: str({
    desc: "Redis Server URI",
  }),
  DISCORD_CLIENT_ID: str({
    desc: "Discord OAuth Client ID",
  }),
  DISCORD_CLIENT_SECRET: str({
    desc: "Discord OAuth Client Secret",
  }),
  APPLICATION_HOST: str({
    desc: "Application Host",
  }),
  MINIO_ENDPOINT: str({
    desc: "Minio Endpoint",
  }),
  MINIO_ACCESS_KEY: str({
    desc: "Minio access key",
  }),
  MINIO_SECRET_KEY: str({
    desc: "Minio secret key",
  }),
  MINIO_BUCKET: str({
    default: "puffcdn",
  }),
});
