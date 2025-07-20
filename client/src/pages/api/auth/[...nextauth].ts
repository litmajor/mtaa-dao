import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import TelegramProvider from "./telegram-provider";

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    TelegramProvider({
      botToken: process.env.TELEGRAM_BOT_TOKEN!,
    }),
  ],
  // Add callbacks, session, and database logic here
});
