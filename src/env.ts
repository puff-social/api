import { envsafe, port, str } from "envsafe";

export const env = envsafe({
  PORT: port({
    default: 8000
  }),
  METRICS_KEY: str({
    desc: "Signing key for metrics data"
  })
});