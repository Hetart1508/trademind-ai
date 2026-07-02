import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import apiRoutes from "./backend/src/routes/api.js";
import { marketDataService } from "./backend/src/services/marketDataService.js";
import { paperTradingService } from "./backend/src/services/paperTradingService.js";
import { signalService } from "./backend/src/services/signalService.js";
import { db } from "./backend/src/config/db.js";

const isProduction = process.env.NODE_ENV === "production";
const PORT = 3000;

async function bootstrap() {
  const app = express();

  // Middleware for parsing JSON and urlencoded requests
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ==========================================
  // 1. DATA PRE-POPULATION ON SERVER START
  // ==========================================
  console.log("[TradeMind Server] Initializing mock stock data sequence...");
  const existingTicks = db.getTable("market_ticks");
  if (existingTicks.length === 0) {
    console.log("[TradeMind Server] Pre-populating 60 historical market ticks to initialize EMA/RSI curves...");
    // Generate 60 steps of historical ticks to initialize EMA 9, EMA 21, and RSI 14 indicators
    for (let i = 0; i < 60; i++) {
      marketDataService.generateTicks();
    }
    console.log(`[TradeMind Server] Loaded ${db.getTable("market_ticks").length} ticks successfully.`);
    
    // Scan watchlist to produce initial trade signals
    console.log("[TradeMind Server] Running initial market signal scan...");
    signalService.scanAllWatchlist();
  } else {
    console.log(`[TradeMind Server] Resuming database state. Found ${existingTicks.length} ticks.`);
  }

  // ==========================================
  // 2. BACKGROUND INTERVAL JOBS
  // ==========================================
  console.log("[TradeMind Server] Starting background simulation engines...");
  
  // Job A: Tick Updates & Active Positions Check (Every 5 Seconds)
  setInterval(() => {
    try {
      marketDataService.generateTicks();
      paperTradingService.checkOpenTrades();
    } catch (err) {
      console.error("[Interval 5s Error]:", err);
    }
  }, 5000);

  // Job B: Strategy Scanning & Signal Evaluation (Every 30 Seconds)
  setInterval(() => {
    try {
      console.log("[Strategy Engine] Scanning watched stocks for trade signals...");
      signalService.scanAllWatchlist();
    } catch (err) {
      console.error("[Interval 30s Error]:", err);
    }
  }, 30000);

  // ==========================================
  // 3. API ROUTING
  // ==========================================
  app.use("/api", apiRoutes);

  // ==========================================
  // 4. VITE MIDDLEWARE / STATIC ASSETS
  // ==========================================
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("[TradeMind Server] Integrated Vite Development Middleware.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("[TradeMind Server] Integrated production static server.");
  }

  // ==========================================
  // 5. BOOT SERVER
  // ==========================================
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`===================================================`);
    console.log(`🚀 TradeMind AI Backend online at http://localhost:${PORT}`);
    console.log(`🛠️ Mode: ${process.env.NODE_ENV || "development"}`);
    console.log(`===================================================`);
  });
}

bootstrap().catch((err) => {
  console.error("Bootstrap crash:", err);
  process.exit(1);
});
