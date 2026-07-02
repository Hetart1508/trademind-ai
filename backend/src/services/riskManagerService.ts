import { db, RiskLog } from "../config/db.js";

export interface RiskCheckResult {
  allowed: boolean;
  reason: string;
}

class RiskManagerService {
  // Option to bypass hours constraint for easy testing
  private bypassTimeConstraint: boolean = true;

  public setBypassTimeConstraint(value: boolean) {
    this.bypassTimeConstraint = value;
  }

  public getBypassTimeConstraint(): boolean {
    return this.bypassTimeConstraint;
  }

  /**
   * Evaluates if a trade can be opened based on the risk rules
   */
  public evaluateTradeRisk(symbol: string): RiskCheckResult {
    const trades = db.getTable("paper_trades");
    const riskLogs = db.getTable("risk_logs");
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const monthStr = todayStr.substring(0, 7); // YYYY-MM

    // Rule 1: No duplicate open trade for the same symbol
    const activeTrade = trades.find((t) => t.symbol === symbol && t.status === "OPEN");
    if (activeTrade) {
      this.logRejection(symbol, "DUPLICATE_OPEN_POSITION");
      return { allowed: false, reason: `Duplicate trade: ${symbol} is already open.` };
    }

    // Rule 2: No new trades after 2:45 PM (14:45)
    if (!this.bypassTimeConstraint) {
      const hours = now.getHours();
      const minutes = now.getMinutes();
      if (hours > 14 || (hours === 14 && minutes > 45)) {
        this.logRejection(symbol, "OUT_OF_TRADING_HOURS_AFTER_1445");
        return { allowed: false, reason: "Trading hours ended: No new trades allowed after 2:45 PM (14:45)." };
      }
      
      // Also prevent before market open (9:15 AM)
      if (hours < 9 || (hours === 9 && minutes < 15)) {
        this.logRejection(symbol, "OUT_OF_TRADING_HOURS_BEFORE_0915");
        return { allowed: false, reason: "Trading hours not started: Market opens at 9:15 AM." };
      }
    }

    // Get trades opened today
    const tradesToday = trades.filter((t) => {
      const tradeDate = t.entry_time.split("T")[0];
      return tradeDate === todayStr;
    });

    // Rule 3: Max 2 trades per day
    if (tradesToday.length >= 2) {
      this.logRejection(symbol, "MAX_DAILY_TRADES_LIMIT_REACHED");
      return { allowed: false, reason: `Max trade count reached: Already opened ${tradesToday.length} trades today (Limit: 2).` };
    }

    // Calculate today's P&L (Realized + Unrealized)
    let dailyPnL = 0;
    tradesToday.forEach((t) => {
      dailyPnL += t.pnl;
    });

    // Rule 4: Max daily loss threshold ₹250 (loss is negative, so dailyPnL <= -250)
    const MAX_DAILY_LOSS = -250;
    if (dailyPnL <= MAX_DAILY_LOSS) {
      this.logRejection(symbol, "MAX_DAILY_LOSS_EXCEEDED");
      return { allowed: false, reason: `Max daily loss exceeded: Today's P&L is ₹${dailyPnL.toFixed(2)} (Limit: -₹250).` };
    }

    // Calculate monthly P&L (from trades in this calendar month)
    const tradesThisMonth = trades.filter((t) => {
      const tradeMonth = t.entry_time.substring(0, 7);
      return tradeMonth === monthStr;
    });

    let monthlyPnL = 0;
    tradesThisMonth.forEach((t) => {
      monthlyPnL += t.pnl;
    });

    // Rule 5: Max monthly loss threshold ₹1000 (loss <= -1000)
    const MAX_MONTHLY_LOSS = -1000;
    if (monthlyPnL <= MAX_MONTHLY_LOSS) {
      this.logRejection(symbol, "MAX_MONTHLY_LOSS_EXCEEDED");
      return { allowed: false, reason: `Max monthly loss exceeded: Month's P&L is ₹${monthlyPnL.toFixed(2)} (Limit: -₹1000).` };
    }

    return { allowed: true, reason: "Risk parameters approved." };
  }

  private logRejection(symbol: string, reason: string) {
    const logs = db.getTable("risk_logs");
    const newLog: RiskLog = {
      id: logs.length + 1,
      symbol,
      reason,
      created_at: new Date().toISOString(),
    };
    db.updateTable("risk_logs", [...logs, newLog]);
    console.warn(`[Risk Manager] Trade for ${symbol} rejected: ${reason}`);
  }
}

export const riskManagerService = new RiskManagerService();
