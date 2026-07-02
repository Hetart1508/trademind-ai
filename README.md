# TradeMind AI Paper Trading MVP (Phase 1)

Welcome to **TradeMind AI Paper Trading MVP**—an advanced full-stack paper trading backtesting and simulation platform for Indian intraday stocks. 

This is **Phase 1 (MVP Mode)** focusing purely on signal logic, risk controls, and order simulation using mock-live ticks without deploying real capital or broker accounts.

---

## 🚀 Features & Architecture

This application consists of a **Node.js/Express** backend running background simulations, connected to a developer **React/Vite** dashboard that lets you test endpoints and monitor active ticker logs.

1. **Market Ticker Engine**: Generates continuous random walks (-0.15% to +0.15%) every 5 seconds for watched stocks, reproducing realistic high-frequency order flows.
2. **Strategy Signal Engine**: Computes technical indicators (**EMA 9**, **EMA 21**, **RSI 14**, and **VWAP**) on historical ticks, executing trades automatically on bullish alignments.
3. **Paper Trading Engine**: Sizes positions dynamically so that risk is capped at **₹100 per trade** with stop-loss at **0.5%** and target at **1.0%** (calculated as `Quantity = Math.floor(100 / stopLossDistance)`).
4. **Risk Manager**: Fully monitors and logs rule approvals or rejections, restricting active trades based on Max Daily Loss (₹250), Max Monthly Loss (₹1,000), Max Trades per Day (2), and Trading Hours (9:15 AM - 2:45 PM).

---

## 📦 Tech Stack

- **Frontend**: React, Tailwind CSS, Lucide Icons, Vite
- **Backend**: Node.js, Express, TSX compiler, Esbuild
- **Database**: Local JSON State Engine (Phase 1 local testing) / MySQL-ready Schema

---

## 🛠️ Local Installation & Setup

### 1. Prerequisites
Ensure you have [Node.js v18+](https://nodejs.org) and [npm](https://npmjs.com) installed.

### 2. Install Dependencies
Clone this workspace and run:
```bash
npm install
```

### 3. Environment Variables
Create a file named `.env` in the root folder using `.env.example` as a guide:
```env
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=trademind_ai
MARKET_DATA_MODE=mock
FRONTEND_URL=http://localhost:3000
```

### 4. Running the App locally

Run the unified full-stack developer server:
```bash
npm run dev
```
This boots the Express backend server on **Port 3000** and integrates Vite's asset compiler, running both in a single process. Open `http://localhost:3000` in your browser.

---

## 🗄️ Database Setup (Moving to MySQL)

For Phase 1 local execution, data is automatically stored and persisted inside `/backend/data/db.json` so the app is instantly usable without any setup. 

To transition to a live **MySQL** server:
1. Open your MySQL client or CLI.
2. Run the SQL schema script provided in `/schema.sql`:
   ```bash
   mysql -u root -p < schema.sql
   ```
3. Update `/backend/src/config/db.ts` to connect using a driver such as `mysql2` rather than reading/writing file states.

---

## 📈 Technical Indicators & Strategy Formula

Signals are evaluated every 30 seconds for the watchlist:
* **BUY Signal**: Triggered when `EMA 9` crosses above `EMA 21`, `RSI 14` is between 45 and 70 (ideal momentum), and `Price` is trading above the `VWAP` support line.
* **SELL Signal**: Triggered when `EMA 9` crosses below `EMA 21` (bearish trend) or `RSI` rises above 75 (overbought extreme).
* **HOLD**: Applied when indicators are in consolidation.

---

## 🗺️ Future Roadmap

* **Phase 2 - Consumer Dashboard**: Transition the current developer console into consumer visual screens including Interactive Recharts curves, portfolio summaries, and symbol editors.
* **Phase 3 - Broker Integration**: Plug in real brokerage APIs (Zerodha Kite Connect, Angel One SmartAPI, or Upstox API) to toggle between Paper and Live Trading.
* **Phase 4 - Gemini AI Agent Integration**: Incorporate Gemini LLM to analyze strategy performance, digest stock news sentiments, and explain risk rejections.
