import { db } from "../config/db.js";

export interface DashboardSummary {
  totalCapital: number;
  paperBalance: number;
  todayPnL: number;
  monthlyPnL: number;
  openTradesCount: number;
  closedTradesCount: number;
  winRate: number;
  dailyLossLimit: {
    current: number;
    limit: number;
    percentUsed: number;
    exceeded: boolean;
  };
  monthlyLossLimit: {
    current: number;
    limit: number;
    percentUsed: number;
    exceeded: boolean;
  };
}

export interface AnalyticsData {
  pnlChart: { date: string; pnl: number; tradesCount: number }[];
  winLossChart: { name: string; value: number }[];
  tradesPerSymbol: { symbol: string; count: number; pnl: number }[];
  strategyPerformance: { strategyName: string; tradesCount: number; winRate: number; totalPnL: number }[];
}

class DashboardService {
  /**
   * Computes the real-time summary statistics for the dashboard
   */
  public getSummary(): DashboardSummary {
    const capital = db.getCapital();
    const balance = db.getPaperBalance();
    const trades = db.getTable("paper_trades");

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const monthStr = todayStr.substring(0, 7);

    // Filter trades
    const openTrades = trades.filter((t) => t.status === "OPEN");
    const closedTrades = trades.filter((t) => t.status === "CLOSED");

    const tradesToday = trades.filter((t) => t.entry_time.split("T")[0] === todayStr);
    const tradesThisMonth = trades.filter((t) => t.entry_time.substring(0, 7) === monthStr);

    // Calculate P&L
    const todayPnL = parseFloat(tradesToday.reduce((sum, t) => sum + t.pnl, 0).toFixed(2));
    const monthlyPnL = parseFloat(tradesThisMonth.reduce((sum, t) => sum + t.pnl, 0).toFixed(2));

    // Calculate Win Rate
    const closedTradesCount = closedTrades.length;
    const winningTradesCount = closedTrades.filter((t) => t.pnl > 0).length;
    const winRate = closedTradesCount > 0 ? parseFloat(((winningTradesCount / closedTradesCount) * 100).toFixed(1)) : 0;

    // Daily loss status (daily P&L is negative for losses)
    const dailyLossCurrent = todayPnL < 0 ? Math.abs(todayPnL) : 0;
    const dailyLossLimitVal = 250;
    const dailyLossPercent = parseFloat(((dailyLossCurrent / dailyLossLimitVal) * 100).toFixed(1));
    const dailyLossExceeded = dailyLossCurrent >= dailyLossLimitVal;

    // Monthly loss status
    const monthlyLossCurrent = monthlyPnL < 0 ? Math.abs(monthlyPnL) : 0;
    const monthlyLossLimitVal = 1000;
    const monthlyLossPercent = parseFloat(((monthlyLossCurrent / monthlyLossLimitVal) * 100).toFixed(1));
    const monthlyLossExceeded = monthlyLossCurrent >= monthlyLossLimitVal;

    return {
      totalCapital: capital,
      paperBalance: balance,
      todayPnL,
      monthlyPnL,
      openTradesCount: openTrades.length,
      closedTradesCount,
      winRate,
      dailyLossLimit: {
        current: dailyLossCurrent,
        limit: dailyLossLimitVal,
        percentUsed: Math.min(100, dailyLossPercent),
        exceeded: dailyLossExceeded,
      },
      monthlyLossLimit: {
        current: monthlyLossCurrent,
        limit: monthlyLossLimitVal,
        percentUsed: Math.min(100, monthlyLossPercent),
        exceeded: monthlyLossExceeded,
      },
    };
  }

  /**
   * Computes grouped analytics data for visualization charts
   */
  public getAnalytics(): AnalyticsData {
    const trades = db.getTable("paper_trades");
    const dailySummaries = db.getTable("daily_summary");

    // 1. P&L Chart over time
    const pnlChart = dailySummaries.map((summary) => ({
      date: summary.date,
      pnl: summary.daily_pnl,
      tradesCount: summary.total_trades,
    }));

    // If no histories exist, show a placeholder list with today
    if (pnlChart.length === 0) {
      const todayStr = new Date().toISOString().split("T")[0];
      const todaySummary = this.getSummary();
      pnlChart.push({
        date: todayStr,
        pnl: todaySummary.todayPnL,
        tradesCount: todaySummary.openTradesCount + todaySummary.closedTradesCount,
      });
    }

    // 2. Win / Loss Chart
    const closedTrades = trades.filter((t) => t.status === "CLOSED");
    const wins = closedTrades.filter((t) => t.pnl > 0).length;
    const losses = closedTrades.filter((t) => t.pnl < 0).length;
    const evens = closedTrades.filter((t) => t.pnl === 0).length;

    const winLossChart = [
      { name: "Wins", value: wins },
      { name: "Losses", value: losses },
    ];
    if (evens > 0) {
      winLossChart.push({ name: "Breakeven", value: evens });
    }

    // 3. Trades Per Symbol
    const symbolMap: Record<string, { count: number; pnl: number }> = {};
    trades.forEach((t) => {
      if (!symbolMap[t.symbol]) {
        symbolMap[t.symbol] = { count: 0, pnl: 0 };
      }
      symbolMap[t.symbol].count += 1;
      symbolMap[t.symbol].pnl += t.pnl;
    });

    const tradesPerSymbol = Object.keys(symbolMap).map((symbol) => ({
      symbol,
      count: symbolMap[symbol].count,
      pnl: parseFloat(symbolMap[symbol].pnl.toFixed(2)),
    }));

    // 4. Strategy Performance
    const strategyPerformance = [
      {
        strategyName: "EMA-RSI-VWAP-Intraday",
        tradesCount: closedTrades.length,
        winRate: closedTrades.length > 0 ? parseFloat(((wins / closedTrades.length) * 100).toFixed(1)) : 0,
        totalPnL: parseFloat(closedTrades.reduce((sum, t) => sum + t.pnl, 0).toFixed(2)),
      },
    ];

    return {
      pnlChart,
      winLossChart,
      tradesPerSymbol,
      strategyPerformance,
    };
  }
}

export const dashboardService = new DashboardService();
