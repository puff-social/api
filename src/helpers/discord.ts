import { stringify } from "querystring";
import { env } from "../env";
import { DiscordTokens, DiscordUser } from "../types/Discord";

export async function exchangeDiscordCode(code: string, redirect_uri: string) {
  const req = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: stringify({
      code,
      grant_type: "authorization_code",
      redirect_uri,
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
    }),
  });

  if (req.status != 200) throw { code: "invalid_token_request" };

  const json: DiscordTokens = await req.json();

  if (env.DEBUG)
    console.debug(
      `API > Exchanged tokens for code : ${code}`,
      json.access_token.substring(0, 10),
      json.scope
    );

  return json;
}

export async function fetchDiscordUser(token: string) {
  const req = await fetch("https://discord.com/api/users/@me", {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (env.DEBUG)
    console.debug(
      `API > Discord user fetched : ${token.substring(0, 10)}`,
      req.status,
      req.headers
    );

  if (req.status != 200) throw { code: "invalid_authentication" };

  const json: DiscordUser = await req.json();

  if (env.DEBUG)
    console.debug(
      `API > Discord user fetched #2 : ${token.substring(0, 10)}`,
      json
    );

  return json;
}
