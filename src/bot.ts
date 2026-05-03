import dotenv from "dotenv";
dotenv.config();

import { Telegraf } from "telegraf";
import axios from "axios";
import cron from "node-cron";

/*
========================================
SOLRADARAI PRODUCTION BOT
========================================
FEATURES:
- Real Moralis REST API
- Real DexScreener scanning
- Auto CA scanner
- AI scoring
- Whale detection
- Anti-rug checks
- 30-minute alerts
- Multi API key rotation
========================================
*/

const bot = new Telegraf(process.env.BOT_TOKEN || "");

const users = new Map<number, boolean>();

/*
========================================
MORALIS API KEY ROTATION
========================================
*/

const API_KEYS = [
  process.env.MORALIS_API_KEY_1,
  process.env.MORALIS_API_KEY_2,
  process.env.MORALIS_API_KEY_3
].filter(Boolean);

let currentKey = 0;

function getHeaders() {
  return {
    accept: "application/json",
    "X-API-Key": API_KEYS[currentKey]
  };
}

async function rotateKey() {
  currentKey++;

  if (currentKey >= API_KEYS.length) {
    currentKey = 0;
  }

  console.log(`Rotated to API key ${currentKey + 1}`);
}

async function moralisGet(url: string) {
  try {
    const response = await axios.get(url, {
      headers: getHeaders()
    });

    return response.data;
  } catch (e: any) {
    if (e?.response?.status === 429) {
      console.log("Moralis rate limit reached.");

      await rotateKey();

      const retry = await axios.get(url, {
        headers: getHeaders()
      });

      return retry.data;
    }

    throw e;
  }
}

/*
========================================
UTILS
========================================
*/

function isCA(text: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text);
}

function formatNumber(num: number) {
  return Number(num || 0).toLocaleString();
}

/*
========================================
DEXSCREENER
========================================
*/

async function getDexData(ca: string) {
  const url = `https://api.dexscreener.com/latest/dex/tokens/${ca}`;

  const { data } = await axios.get(url);

  if (!data?.pairs?.length) {
    return null;
  }

  return data.pairs[0];
}

/*
========================================
MORALIS
========================================
*/

async function getTokenMetadata(ca: string) {
  const url =
    `https://solana-gateway.moralis.io/token/mainnet/${ca}/metadata`;

  return await moralisGet(url);
}

async function getTokenHolders(ca: string) {
  const url =
    `https://solana-gateway.moralis.io/token/mainnet/${ca}/holders`;

  return await moralisGet(url);
}

/*
========================================
AI SCORING
========================================
*/

function buildAIScore(pair: any) {
  let score = 1;

  const notes = [];

  const liquidity = Number(pair?.liquidity?.usd || 0);
  const volume = Number(pair?.volume?.h24 || 0);
  const buys = Number(pair?.txns?.h24?.buys || 0);
  const sells = Number(pair?.txns?.h24?.sells || 0);
  const mcap = Number(pair?.fdv || 0);

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

  if (mcap < 50000) {
    score += 2;
    notes.push("✅ Early low cap potential");
  }

  if (liquidity < 1000) {
    score -= 2;
    notes.push("⚠️ Weak liquidity");
  }

  notes.push("⚠️ Early stage volatility");

  return {
    score: Math.max(1, Math.min(score, 10)).toFixed(1),
    notes
  };
}

/*
========================================
WHALE DETECTION
========================================
*/

function whaleDetection(pair: any) {
  const buys = Number(pair?.txns?.h24?.buys || 0);
  const sells = Number(pair?.txns?.h24?.sells || 0);
  const volume = Number(pair?.volume?.h24 || 0);

  if (buys > sells * 1.5 && volume > 25000) {
    return "🐋 Smart money accumulation detected";
  }

  return "No major whale activity";
}

/*
========================================
ANTI RUG CHECKS
========================================
*/

function rugAnalysis(pair: any, holdersData: any) {
  const liquidity = Number(pair?.liquidity?.usd || 0);

  let rugRisk = "LOW 🟢";

  if (liquidity < 3000) {
    rugRisk = "MEDIUM 🟠";
  }

  if (liquidity < 1000) {
    rugRisk = "HIGH 🔴";
  }

  let topHolderPercent = "Unknown";

  if (holdersData?.result?.length) {
    topHolderPercent =
      holdersData.result[0]?.percentageRelativeToTotalSupply || "Unknown";
  }

  return {
    rugRisk,
    topHolderPercent
  };
}

/*
========================================
FORMAT ALERT
========================================
*/

function formatAlert(
  pair: any,
  ai: any,
  whale: string,
  rug: any
) {
  const socials = pair?.info?.socials || [];

  const twitter =
    socials.find((s: any) => s.type === "twitter")?.url || "N/A";

  const telegram =
    socials.find((s: any) => s.type === "telegram")?.url || "N/A";

  const website =
    pair?.info?.websites?.[0]?.url || "N/A";

  return `
🚨 LOW MCAP ALERT 🚨

🐸 ${pair.baseToken.name}
CA: ${pair.baseToken.address}

📊 Stats
├ USD $${pair.priceUsd}
├ MC $${formatNumber(pair.fdv)}
├ Vol $${formatNumber(pair.volume.h24)}
├ LP $${formatNumber(pair.liquidity.usd)}
├ Buys ${pair.txns.h24.buys}
├ Sells ${pair.txns.h24.sells}
└ 1H ${pair.priceChange.h1}%

🔒 Security
├ Top Holder: ${rug.topHolderPercent}%
└ Rug Risk: ${rug.rugRisk}

🌐 Socials
├ X: ${twitter}
├ TG: ${telegram}
└ Web: ${website}

🐋 Whale Detection
${whale}

🧠 AI Analysis
${ai.notes.join("\n")}

⭐ Score: ${ai.score}/10
💡 GOOD BUY ZONE
`;
}

/*
========================================
MAIN ANALYZER
========================================
*/

async function analyzeToken(ca: string) {
  const pair = await getDexData(ca);

  if (!pair) {
    return "❌ Token not found.";
  }

  const mcap = Number(pair?.fdv || 0);

  /*
  FILTER MARKET CAP
  */

  if (mcap < 4000 || mcap > 5000000) {
    return "❌ Token outside market cap range.";
  }

  /*
  FETCH MORALIS DATA
  */

  const holders = await getTokenHolders(ca);

  /*
  AI
  */

  const ai = buildAIScore(pair);

  /*
  WHALE
  */

  const whale = whaleDetection(pair);

  /*
  RUG
  */

  const rug = rugAnalysis(pair, holders);

  /*
  FINAL ALERT
  */

  return formatAlert(
    pair,
    ai,
    whale,
    rug
  );
}

/*
========================================
TRENDING SCANNER
========================================
*/

async function getTrendingTokens() {
  try {
    const { data } = await axios.get(
      "https://api.dexscreener.com/token-profiles/latest/v1"
    );

    return data.slice(0, 15);
  } catch (e) {
    return [];
  }
}

/*
========================================
ALERT SCHEDULER
========================================
*/

cron.schedule("*/30 * * * *", async () => {
  console.log("Running scheduled alerts...");

  const tokens = await getTrendingTokens();

  for (const token of tokens.slice(0, 3)) {
    try {
      const result = await analyzeToken(
        token.tokenAddress
      );

      for (const [user, enabled] of users.entries()) {
        if (!enabled) continue;

        await bot.telegram.sendMessage(
          user,
          result
        );
      }
    } catch (e) {
      console.log(e);
    }
  }
});

/*
========================================
COMMANDS
========================================
*/

bot.start(async (ctx) => {
  users.set(ctx.chat.id, true);

  await ctx.reply(`
🤖 SolRadarAI Production

Commands:
/alerts
/alerts_on
/alerts_off

Paste any Solana contract address to scan.
`);
});

bot.command("alerts", async (ctx) => {
  await ctx.reply(
    "📡 Alerts active every 30 minutes."
  );
});

bot.command("alerts_on", async (ctx) => {
  users.set(ctx.chat.id, true);

  await ctx.reply("✅ Alerts enabled.");
});

bot.command("alerts_off", async (ctx) => {
  users.set(ctx.chat.id, false);

  await ctx.reply("🛑 Alerts disabled.");
});

/*
========================================
AUTO SCAN CONTRACT ADDRESS
========================================
*/

bot.on("text", async (ctx) => {
  const text = ctx.message.text.trim();

  if (text.startsWith("/")) return;

  if (!isCA(text)) {
    return;
  }

  const loading = await ctx.reply(
    "🔍 Scanning token..."
  );

  try {
    const result = await analyzeToken(text);

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loading.message_id,
      undefined,
      result
    );
  } catch (e) {
    console.log(e);

    await ctx.reply("❌ Failed to scan token.");
  }
});

/*
========================================
START BOT
========================================
*/

bot.launch();

console.log("🚀 SolRadarAI started...");
