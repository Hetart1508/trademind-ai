import { db, PaperTrade } from "../config/db.js";
import { riskManagerService } from "./riskManagerService.js";
import { marketDataService } from "./marketDataService.js";

class PaperTradingService {
  /**
   * Opens a new paper trade if risk rules are met
   */
  public executeBuySignal(symbol: string, entryPrice: number): PaperTrade | null {
    // 1. Verify risk parameters
    const riskCheck = riskManagerService.evaluateTradeRisk(symbol);
    if (!riskCheck.allowed) {
      return null;
    }

    const currentBalance = db.getPaperBalance();

    // 2. Position sizing math:
    // Risk ₹100 per trade. Stop loss is 0.5% below entry.
    // stopLossDistance = entryPrice * 0.005
    // quantity = Math.floor(100 / stopLossDistance)
    const stopLossPercent = 0.005;
    const targetPercent = 0.01;
    const stopLossDistance = entryPrice * stopLossPercent;
    
    let quantity = Math.floor(100 / stopLossDistance);
    if (quantity <= 0) quantity = 1;

    const totalTradeValue = entryPrice * quantity;
    if (totalTradeValue > currentBalance) {
      // If we don't have enough capital to purchase the shares, scale down quantity
      quantity = Math.floor(currentBalance / entryPrice);
      if (quantity <= 0) {
        console.warn(`[Paper Trading] Insufficient balance (₹${currentBalance.toFixed(2)}) to open trade for ${symbol} at ₹${entryPrice}`);
        return null;
      }
    }

    const stopLossPrice = parseFloat((entryPrice - stopLossDistance).toFixed(2));
    const targetPrice = parseFloat((entryPrice * (1 + targetPercent)).toFixed(2));

    const now = new Date().toISOString();
    const trades = db.getTable("paper_trades");
    const nextId = trades.length > 0 ? Math.max(...trades.map((trade) => trade.id)) + 1 : 1;

    const newTrade: PaperTrade = {
      id: nextId,
      symbol,
      entry_price: entryPrice,
      quantity,
      target_price: targetPrice,
      stop_loss_price: stopLossPrice,
      exit_price: null,
      pnl: 0,
      status: "OPEN",
      entry_time: now,
      exit_time: null,
      exit_reason: null,
      created_at: now,
      updated_at: now,
    };

    // Deduct cost of purchase from paper balance (since we are long)
    const updatedBalance = currentBalance - (entryPrice * quantity);
    db.updateTable("paper_trades", [...trades, newTrade]);
    db.updateCapitalAndBalance(db.getCapital(), parseFloat(updatedBalance.toFixed(2)));

    console.log(`[Paper Trading] Trade OPENED for ${symbol}: ${quantity} shares @ ₹${entryPrice}. Target: ₹${targetPrice}, SL: ₹${stopLossPrice}`);
    return newTrade;
  }

  /**
   * Monitor open trades and evaluate exit triggers (Target, Stop Loss) based on latest prices
   */
  public checkOpenTrades() {
    const trades = db.getTable("paper_trades");
    const openTrades = trades.filter((t) => t.status === "OPEN");
    if (openTrades.length === 0) return;

    let updatedAny = false;

    const updatedTrades = trades.map((trade) => {
      if (trade.status !== "OPEN") return trade;

      const currentPrice = marketDataService.getLatestPrice(trade.symbol);
      let exitPrice: number | null = null;
      let exitReason: "TARGET_HIT" | "STOP_LOSS_HIT" | "MARKET_CLOSE" | null = null;

      // Check Target Hit
      if (currentPrice >= trade.target_price) {
        exitPrice = trade.target_price;
        exitReason = "TARGET_HIT";
      }
      // Check Stop Loss Hit
      else if (currentPrice <= trade.stop_loss_price) {
        exitPrice = trade.stop_loss_price;
        exitReason = "STOP_LOSS_HIT";
      }

      if (exitPrice && exitReason) {
        updatedAny = true;
        const pnl = parseFloat(((exitPrice - trade.entry_price) * trade.quantity).toFixed(2));
        const now = new Date().toISOString();

        // Release balance and add PnL
        const currentBalance = db.getPaperBalance();
        const tradeValueAtExit = exitPrice * trade.quantity;
        const newBalance = parseFloat((currentBalance + tradeValueAtExit).toFixed(2));
        db.updateCapitalAndBalance(db.getCapital(), newBalance);

        console.log(`[Paper Trading] Trade CLOSED for ${trade.symbol} (${exitReason}): Exit ₹${exitPrice}, PnL: ₹${pnl}`);

        return {
          ...trade,
          exit_price: exitPrice,
          pnl,
          status: "CLOSED" as const,
          exit_time: now,
          exit_reason: exitReason,
          updated_at: now,
        };
      }

      // Update active float P&L of open trade for real-time tracking
      const floatPnL = parseFloat(((currentPrice - trade.entry_price) * trade.quantity).toFixed(2));
      if (trade.pnl !== floatPnL) {
        updatedAny = true;
        return {
          ...trade,
          pnl: floatPnL,
          updated_at: new Date().toISOString(),
        };
      }

      return trade;
    });

    if (updatedAny) {
      db.updateTable("paper_trades", updatedTrades);
      this.syncDailySummary();
    }
  }

  /**
   * Manually exit an active trade
   */
  public executeManualExit(tradeId: number): boolean {
    const trades = db.getTable("paper_trades");
    const tradeIdx = trades.findIndex((t) => t.id === tradeId && t.status === "OPEN");
    if (tradeIdx === -1) return false;

    const trade = trades[tradeIdx];
    const currentPrice = marketDataService.getLatestPrice(trade.symbol);
    const pnl = parseFloat(((currentPrice - trade.entry_price) * trade.quantity).toFixed(2));
    const now = new Date().toISOString();

    // Release balance and add PnL
    const currentBalance = db.getPaperBalance();
    const tradeValueAtExit = currentPrice * trade.quantity;
    const newBalance = parseFloat((currentBalance + tradeValueAtExit).toFixed(2));
    db.updateCapitalAndBalance(db.getCapital(), newBalance);

    trades[tradeIdx] = {
      ...trade,
      exit_price: currentPrice,
      pnl,
      status: "CLOSED",
      exit_time: now,
      exit_reason: "MANUAL_EXIT",
      updated_at: now,
    };

    db.updateTable("paper_trades", trades);
    this.syncDailySummary();

    console.log(`[Paper Trading] Trade MANUALLY CLOSED for ${trade.symbol}: Exit ₹${currentPrice}, PnL: ₹${pnl}`);
    return true;
  }

  /**
   * Close all active trades immediately (e.g. at simulated 3:15 PM / 2:45 PM / user instruction)
   */
  public forceMarketCloseExits() {
    const trades = db.getTable("paper_trades");
    const openTrades = trades.filter((t) => t.status === "OPEN");
    if (openTrades.length === 0) return;

    const now = new Date().toISOString();

    const updatedTrades = trades.map((trade) => {
      if (trade.status !== "OPEN") return trade;

      const currentPrice = marketDataService.getLatestPrice(trade.symbol);
      const pnl = parseFloat(((currentPrice - trade.entry_price) * trade.quantity).toFixed(2));

      const currentBalance = db.getPaperBalance();
      const tradeValueAtExit = currentPrice * trade.quantity;
      const newBalance = parseFloat((currentBalance + tradeValueAtExit).toFixed(2));
      db.updateCapitalAndBalance(db.getCapital(), newBalance);

      console.log(`[Paper Trading] FORCE MARKET CLOSE for ${trade.symbol}: Exit ₹${currentPrice}, PnL: ₹${pnl}`);

      return {
        ...trade,
        exit_price: currentPrice,
        pnl,
        status: "CLOSED" as const,
        exit_time: now,
        exit_reason: "MARKET_CLOSE" as const,
        updated_at: now,
      };
    });

    db.updateTable("paper_trades", updatedTrades);
    this.syncDailySummary();
  }

  /**
   * Aggregates closed trades into daily summary logs
   */
  public syncDailySummary() {
    const trades = db.getTable("paper_trades");
    const summaries = db.getTable("daily_summary");

    const closedTrades = trades.filter((t) => t.status === "CLOSED");
    const groupedByDate: Record<string, typeof closedTrades> = {};

    closedTrades.forEach((t) => {
      const dateStr = t.entry_time.split("T")[0];
      if (!groupedByDate[dateStr]) groupedByDate[dateStr] = [];
      groupedByDate[dateStr].push(t);
    });

    const newSummaries = Object.keys(groupedByDate).map((dateStr, idx) => {
      const dayTrades = groupedByDate[dateStr];
      const winning = dayTrades.filter((t) => t.pnl > 0).length;
      const losing = dayTrades.filter((t) => t.pnl < 0).length;
      const dailyPnL = parseFloat(dayTrades.reduce((sum, t) => sum + t.pnl, 0).toFixed(2));

      return {
        id: idx + 1,
        date: dateStr,
        total_trades: dayTrades.length,
        winning_trades: winning,
        losing_trades: losing,
        daily_pnl: dailyPnL,
        created_at: new Date().toISOString(),
      };
    });

    db.updateTable("daily_summary", newSummaries);
  }
}

export const paperTradingService = new PaperTradingService();
