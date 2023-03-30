export interface DiscordTokens {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}


export interface DiscordUser {
  id: string;
  username: string;
  avatar: string;
  discriminator: string;
}