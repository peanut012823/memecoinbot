# Solana Meme Radar Bot

A production-ready Telegram bot for scanning Solana meme coins using Moralis + DexScreener.

## Features

- Low market cap alerts every 30 minutes
- Auto contract address scanning
- AI token analysis
- Security checks
- Multi Moralis API key rotation
- Telegram alert controls
- Railway deployment ready

## Suggested Bot Names

- SolRadarAI
- MemeScope SOL
- Solana Meme Radar
- PumpGuard AI
- MoonScan SOL

Recommended: **SolRadarAI**

---

# Commands

```bash
/start
/alerts
/alerts_on
/alerts_off
```

Users can also paste any Solana contract address directly into the bot.

---

# Environment Variables

Create a `.env` file:

```env
BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN

MORALIS_API_KEY_1=YOUR_KEY_1
MORALIS_API_KEY_2=YOUR_KEY_2
MORALIS_API_KEY_3=YOUR_KEY_3
```

---

# Local Development

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Build production:

```bash
npm run build
```

Start production:

```bash
npm start
```

---

# Railway Deployment

## 1. Push To GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin YOUR_GITHUB_REPO
git push -u origin main
```

---

## 2. Create Railway Project

1. Open Railway
2. Create New Project
3. Deploy from GitHub Repo
4. Select your repository

---

## 3. Add Environment Variables

Inside Railway Variables:

```env
BOT_TOKEN=
MORALIS_API_KEY_1=
MORALIS_API_KEY_2=
MORALIS_API_KEY_3=
```

---

## 4. Deploy

Railway automatically detects Node.js.

The bot will start automatically.

---

# API Sources

- Moralis Solana API
- DexScreener API

---

# Example Alert

```text
🚨 LOW MCAP ALERT 🚨

🐸 PEPEKING
CA: 9xQeWvG816bUx9EPjHmaT23yvVMi7YxwP7L9KxBpump

📊 Stats
├ USD $0.00002841
├ MC $28.4K
├ Vol $36.4K
├ LP $6.6K
└ 1H +1500%

🔒 Security
├ Mint: Renounced ✅
├ LP Burned: 92% ✅
└ Rug Risk: LOW 🟢

🧠 AI Analysis
✅ Strong buy pressure
✅ Organic volume growth

⭐ Score: 8.4/10
💡 GOOD BUY ZONE
```