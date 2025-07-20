// @ts-ignore: fallback for missing next-auth/providers type
type OAuthConfig<T = any> = any;
import type { User } from "next-auth";

export interface TelegramProfile extends Record<string, any> {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date?: number;
  hash?: string;
  phone_number?: string;
}

export default function TelegramProvider(options: {
  botToken: string;
}): OAuthConfig<TelegramProfile> {
  return {
    id: "telegram",
    name: "Telegram",
    type: "oauth",
    version: "2.0",
    wellKnown: undefined,
    authorization: {
      url: "https://oauth.telegram.org/auth",
      params: { scope: "" },
    },
    token: "",
    userinfo: async ({ query }: { query: any }) => {
      // Telegram does not provide a userinfo endpoint; use query params
      return query as TelegramProfile;
    },
    profile(profile: any) {
      return {
        id: profile.id,
        name: profile.first_name + (profile.last_name ? ` ${profile.last_name}` : ""),
        email: profile.username ? `${profile.username}@telegram` : undefined,
        image: profile.photo_url,
        phone_number: profile.phone_number,
      } as User & { phone_number?: string };
    },
    options,
  };
}
