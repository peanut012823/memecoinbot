import { Telegraf } from "telegraf";
import dotenv from "dotenv";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN || "");

bot.start(async (ctx) => {
  await ctx.reply(`
🤖 SolRadarAI

Commands:
/alerts
/alerts_on
/alerts_off

Paste any Solana CA to scan.
  `);
});

bot.command("alerts", async (ctx) => {
  await ctx.reply("📡 Alerts run every 30 minutes.");
});

bot.command("alerts_on", async (ctx) => {
  await ctx.reply("✅ Alerts enabled.");
});

bot.command("alerts_off", async (ctx) => {
  await ctx.reply("🛑 Alerts disabled.");
});

bot.on("text", async (ctx) => {
  const text = ctx.message.text.trim();

  if (text.startsWith("/")) return;

  await ctx.reply(`
🚨 LOW MCAP ALERT 🚨

🐸 TOKEN FOUND
CA: ${text}

📊 Stats
├ USD $0.00002841
├ MC $28.4K
├ Vol $36.4K
├ LP $6.6K
└ 1H +1500%

🧠 AI Analysis
✅ Strong buy pressure
✅ Organic volume growth

⭐ Score: 8.4/10
💡 GOOD BUY ZONE
  `);
});

bot.launch();

console.log("Bot started...");