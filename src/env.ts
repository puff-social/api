import { envsafe, port } from "envsafe";

export const env = envsafe({
  PORT: port({
    default: 8000
  })
});