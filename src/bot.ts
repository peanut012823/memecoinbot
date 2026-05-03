
import dotenv from "dotenv";
dotenv.config();

import { Telegraf } from "telegraf";
import axios from "axios";
import cron from "node-cron";
import Moralis from "moralis";

const bot = new Telegraf(process.env.BOT_TOKEN || "");

const users = new Map<number, boolean>();

const API_KEYS = [
  process.env.MORALIS_API_KEY_1,
  process.env.MORALIS_API_KEY_2,
  process.env.MORALIS_API_KEY_3
].filter(Boolean);

let currentKey = 0;
let initialized = false;

async function initMoralis() {
  if (initialized) return;

  await Moralis.start({
    apiKey: API_KEYS[currentKey]
  });

  initialized = true;
}

async function rotateKey() {
  currentKey = (currentKey + 1) % API_KEYS.length;
  initialized = false;
  await initMoralis();
}

async function safeRequest(callback: any) {
  try {
    await initMoralis();
    return await callback();
  } catch (e: any) {
    if (e?.response?.status === 429) {
      await rotateKey();
      return await callback();
    }

    throw e;
  }
}

function isCA(text: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text);
}

async function getDexData(ca: string) {
  const url = `https://api.dexscreener.com/latest/dex/tokens/${ca}`;

  const { data } = await axios.get(url);

  if (!data?.pairs?.length) return null;

  return data.pairs[0];
}

async function getMoralisSecurity(ca: string) {
  return await safeRequest(async () => {
    return await Moralis.SolApi.token.getTokenMetadata({
      network: "mainnet",
      addresses: [ca]
    });
  });
}

function buildAI(pair: any) {
  let score = 1;
  const notes = [];

  const liquidity = Number(pair?.liquidity?.usd || 0);
  const volume = Number(pair?.volume?.h24 || 0);
  const buys = Number(pair?.txns?.h24?.buys || 0);
  const sells = Number(pair?.txns?.h24?.sells || 0);

  if (liquidity > 5000) {
    score += 2;
    notes.push("✅ Healthy LP ratio");
  }

  if (volume > 15000) {
    score += 2;
    notes.push("✅ Organic volume growth");
  }

  if (buys > sells) {
    score += 2;
    notes.push("✅ Strong buy pressure");
  }

  notes.push("⚠️ Early stage volatility");

  return {
    score: Math.min(score, 10).toFixed(1),
    notes
  };
}

function rugRisk(pair: any) {
  const liquidity = Number(pair?.liquidity?.usd || 0);

  if (liquidity < 1000) return "HIGH 🔴";
  if (liquidity < 3000) return "MEDIUM 🟠";

  return "LOW 🟢";
}

function whaleCheck(pair: any) {
  const buys = Number(pair?.txns?.h24?.buys || 0);
  const sells = Number(pair?.txns?.h24?.sells || 0);

  if (buys > sells * 1.5) {
    return "🐋 Smart money accumulation detected";
  }

  return "No major whale accumulation";
}

function formatAlert(pair: any, ai: any, rug: string, whale: string) {
  const socials = pair?.info?.socials || [];

  const x = socials.find((s: any) => s.type === "twitter")?.url || "N/A";
  const tg = socials.find((s: any) => s.type === "telegram")?.url || "N/A";
  const web = pair?.info?.websites?.[0]?.url || "N/A";

  return `
🚨 LOW MCAP ALERT 🚨

🐸 ${pair.baseToken.name}
CA: ${pair.baseToken.address}

📊 Stats
├ USD $${pair.priceUsd}
├ MC $${Number(pair.fdv).toLocaleString()}
├ Vol $${Number(pair.volume.h24).toLocaleString()}
├ LP $${Number(pair.liquidity.usd).toLocaleString()}
├ Buys ${pair.txns.h24.buys}
├ Sells ${pair.txns.h24.sells}
└ 1H ${pair.priceChange.h1}%

🔒 Security
└ Rug Risk: ${rug}

🌐 Socials
├ X: ${x}
├ TG: ${tg}
└ Web: ${web}

🐋 Whale Detection
${whale}

🧠 AI Analysis
${ai.notes.join("\n")}

⭐ Score: ${ai.score}/10
💡 GOOD BUY ZONE
`;
}

async function analyze(ca: string) {
  const pair = await getDexData(ca);

  if (!pair) {
    return "❌ Token not found.";
  }

  await getMoralisSecurity(ca);

  const ai = buildAI(pair);
  const rug = rugRisk(pair);
  const whale = whaleCheck(pair);

  return formatAlert(pair, ai, rug, whale);
}

async function scanTrending() {
  try {
    const { data } = await axios.get(
      "https://api.dexscreener.com/token-profiles/latest/v1"
    );

    return data.slice(0, 10);
  } catch {
    return [];
  }
}

cron.schedule("*/30 * * * *", async () => {
  const tokens = await scanTrending();

  for (const token of tokens.slice(0, 3)) {
    try {
      const result = await analyze(token.tokenAddress);

      for (const [user, enabled] of users.entries()) {
        if (!enabled) continue;

        await bot.telegram.sendMessage(user, result);
      }
    } catch (e) {
      console.log(e);
    }
  }
});

bot.start(async (ctx) => {
  users.set(ctx.chat.id, true);

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
  await ctx.reply("📡 Alerts active every 30 minutes.");
});

bot.command("alerts_on", async (ctx) => {
  users.set(ctx.chat.id, true);
  await ctx.reply("✅ Alerts enabled.");
});

bot.command("alerts_off", async (ctx) => {
  users.set(ctx.chat.id, false);
  await ctx.reply("🛑 Alerts disabled.");
});

bot.on("text", async (ctx) => {
  const text = ctx.message.text.trim();

  if (text.startsWith("/")) return;

  if (!isCA(text)) return;

  const loading = await ctx.reply("🔍 Scanning token...");

  try {
    const result = await analyze(text);

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loading.message_id,
      undefined,
      result
    );
  } catch {
    await ctx.reply("❌ Scan failed.");
  }
});

bot.launch();

console.log("SolRadarAI started...");
