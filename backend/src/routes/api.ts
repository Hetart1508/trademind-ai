import { Router, Request, Response } from "express";
import { db } from "../config/db.js";
import { marketDataService } from "../services/marketDataService.js";
import { signalService } from "../services/signalService.js";
import { paperTradingService } from "../services/paperTradingService.js";
import { dashboardService } from "../services/dashboardService.js";
import { riskManagerService } from "../services/riskManagerService.js";

const router = Router();

// ==========================================
// SYSTEM HEALTH & DIAGNOSTICS
// ==========================================
router.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database: {
      watchlistCount: db.getTable("watchlist").length,
      ticksCount: db.getTable("market_ticks").length,
      signalsCount: db.getTable("signals").length,
      tradesCount: db.getTable("paper_trades").length,
    },
    bypassTimeConstraint: riskManagerService.getBypassTimeConstraint(),
  });
});

// ==========================================
// WATCHLIST MODULE
// ==========================================
router.get("/watchlist", (req: Request, res: Response) => {
  try {
    const list = db.getTable("watchlist");
    res.json({ success: true, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/watchlist", (req: Request, res: Response) => {
  try {
    const { symbol } = req.body;
    if (!symbol || typeof symbol !== "string") {
       res.status(400).json({ success: false, error: "Symbol string is required" });
       return;
    }

    const cleanSymbol = symbol.trim().toUpperCase();
    const list = db.getTable("watchlist");

    // Check duplicate
    if (list.some((item) => item.symbol === cleanSymbol)) {
       res.status(400).json({ success: false, error: "Symbol already in watchlist" });
       return;
    }

    const newItem = {
      id: list.length > 0 ? Math.max(...list.map((l) => l.id)) + 1 : 1,
      symbol: cleanSymbol,
      created_at: new Date().toISOString(),
    };

    db.updateTable("watchlist", [...list, newItem]);
    marketDataService.addWatchSymbol(cleanSymbol); // initialize in price generator

    res.status(201).json({ success: true, data: newItem });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/watchlist/:symbol", (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    if (!symbol) {
       res.status(400).json({ success: false, error: "Symbol is required" });
       return;
    }

    const cleanSymbol = symbol.trim().toUpperCase();
    const list = db.getTable("watchlist");
    const filtered = list.filter((item) => item.symbol !== cleanSymbol);

    if (list.length === filtered.length) {
       res.status(404).json({ success: false, error: "Symbol not found in watchlist" });
       return;
    }

    db.updateTable("watchlist", filtered);
    res.json({ success: true, message: `Removed ${cleanSymbol} from watchlist.` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// MARKET DATA MODULE
// ==========================================
router.get("/market/live", (req: Request, res: Response) => {
  try {
    const prices = marketDataService.getLivePrices();
    res.json({ success: true, data: prices });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/market/ticks/:symbol", (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    
    if (!symbol) {
       res.status(400).json({ success: false, error: "Symbol is required" });
       return;
    }

    const ticks = marketDataService.getTicks(symbol.toUpperCase(), limit);
    res.json({ success: true, symbol: symbol.toUpperCase(), count: ticks.length, data: ticks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// STRATEGY SIGNAL MODULE
// ==========================================
router.get("/signals", (req: Request, res: Response) => {
  try {
    const list = db.getTable("signals");
    res.json({ success: true, count: list.length, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/signals/generate", (req: Request, res: Response) => {
  try {
    const signals = signalService.scanAllWatchlist();
    res.json({ success: true, count: signals.length, data: signals });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// PAPER TRADING ENGINE
// ==========================================
router.get("/paper-trades", (req: Request, res: Response) => {
  try {
    const list = db.getTable("paper_trades");
    res.json({ success: true, count: list.length, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/paper-trades/open", (req: Request, res: Response) => {
  try {
    const list = db.getTable("paper_trades").filter((t) => t.status === "OPEN");
    res.json({ success: true, count: list.length, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/paper-trades/closed", (req: Request, res: Response) => {
  try {
    const list = db.getTable("paper_trades").filter((t) => t.status === "CLOSED");
    res.json({ success: true, count: list.length, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/paper-trades/manual-exit/:id", (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
       res.status(400).json({ success: false, error: "Valid trade ID is required" });
       return;
    }

    const success = paperTradingService.executeManualExit(id);
    if (!success) {
       res.status(404).json({ success: false, error: "Open trade not found with that ID" });
       return;
    }

    res.json({ success: true, message: `Successfully executed manual exit for trade #${id}` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// DASHBOARD MODULES
// ==========================================
router.get("/dashboard/summary", (req: Request, res: Response) => {
  try {
    const summary = dashboardService.getSummary();
    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/dashboard/analytics", (req: Request, res: Response) => {
  try {
    const analytics = dashboardService.getAnalytics();
    res.json({ success: true, data: analytics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// ADMIN CONTROL ROUTE EXTENSIONS
// ==========================================
router.get("/risk-logs", (req: Request, res: Response) => {
  try {
    const logs = db.getTable("risk_logs");
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/system/reset", (req: Request, res: Response) => {
  try {
    db.clearAll();
    res.json({ success: true, message: "System database successfully reset to default initial settings." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/system/tick", (req: Request, res: Response) => {
  try {
    // Manually force a market tick generation
    const ticks = marketDataService.generateTicks();
    // Re-check open trades
    paperTradingService.checkOpenTrades();
    res.json({ success: true, message: "Manually triggered market ticks successfully.", generated: ticks.length, ticks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/system/toggle-risk", (req: Request, res: Response) => {
  try {
    const current = riskManagerService.getBypassTimeConstraint();
    riskManagerService.setBypassTimeConstraint(!current);
    res.json({
      success: true,
      message: `Risk time limit bypass is now set to ${!current}.`,
      bypassTimeConstraint: !current,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
