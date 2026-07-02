const TABLE_LIMITS = {
  market_ticks: 300,
  signals: 120,
  paper_trades: 200,
  risk_logs: 120,
  daily_summary: 60,
} as const;

export interface WatchlistItem {
  id: number;
  symbol: string;
  created_at: string;
}

export interface MarketTick {
  id: number;
  symbol: string;
  price: number;
  volume: number;
  created_at: string;
}

export interface SignalItem {
  id: number;
  symbol: string;
  signal_type: "BUY" | "SELL" | "HOLD";
  price: number;
  confidence_score: number;
  reason: string;
  strategy_name: string;
  created_at: string;
}

export interface PaperTrade {
  id: number;
  symbol: string;
  entry_price: number;
  quantity: number;
  target_price: number;
  stop_loss_price: number;
  exit_price: number | null;
  pnl: number;
  status: "OPEN" | "CLOSED";
  entry_time: string;
  exit_time: string | null;
  exit_reason: "TARGET_HIT" | "STOP_LOSS_HIT" | "MANUAL_EXIT" | "MARKET_CLOSE" | null;
  created_at: string;
  updated_at: string;
}

export interface RiskLog {
  id: number;
  symbol: string;
  reason: string;
  created_at: string;
}

export interface DailySummary {
  id: number;
  date: string;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  daily_pnl: number;
  created_at: string;
}

interface DatabaseSchema {
  watchlist: WatchlistItem[];
  market_ticks: MarketTick[];
  signals: SignalItem[];
  paper_trades: PaperTrade[];
  risk_logs: RiskLog[];
  daily_summary: DailySummary[];
  capital: number;
  paper_balance: number;
}

const DEFAULT_DB: DatabaseSchema = {
  watchlist: [
    { id: 1, symbol: "RELIANCE", created_at: new Date().toISOString() },
    { id: 2, symbol: "TCS", created_at: new Date().toISOString() },
    { id: 3, symbol: "INFY", created_at: new Date().toISOString() },
    { id: 4, symbol: "HDFCBANK", created_at: new Date().toISOString() },
    { id: 5, symbol: "ICICIBANK", created_at: new Date().toISOString() }
  ],
  market_ticks: [],
  signals: [],
  paper_trades: [],
  risk_logs: [],
  daily_summary: [],
  capital: 20000,
  paper_balance: 20000
};

class LocalDB {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.createDefaultData();
  }

  private createDefaultData(): DatabaseSchema {
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }

  private compactData(data: DatabaseSchema): DatabaseSchema {
    return {
      ...data,
      market_ticks: this.takeLast(data.market_ticks, TABLE_LIMITS.market_ticks),
      signals: this.takeLast(data.signals, TABLE_LIMITS.signals),
      paper_trades: this.compactTrades(data.paper_trades),
      risk_logs: this.takeLast(data.risk_logs, TABLE_LIMITS.risk_logs),
      daily_summary: this.takeLast(data.daily_summary, TABLE_LIMITS.daily_summary),
    };
  }

  private compactTrades(trades: PaperTrade[]): PaperTrade[] {
    const openTrades = trades.filter((trade) => trade.status === "OPEN");
    const closedSlots = Math.max(TABLE_LIMITS.paper_trades - openTrades.length, 0);
    const recentClosedTrades = this.takeLast(
      trades.filter((trade) => trade.status === "CLOSED"),
      closedSlots
    );

    return [...recentClosedTrades, ...openTrades].sort((a, b) => a.id - b.id);
  }

  private takeLast<T>(items: T[], limit: number): T[] {
    if (items.length <= limit) return items;
    return items.slice(items.length - limit);
  }

  public getTable<K extends keyof DatabaseSchema>(table: K): DatabaseSchema[K] {
    return this.data[table];
  }

  public updateTable<K extends keyof DatabaseSchema>(table: K, value: DatabaseSchema[K]) {
    this.data[table] = value;
    this.data = this.compactData(this.data);
  }

  public getCapital(): number {
    return this.data.capital;
  }

  public getPaperBalance(): number {
    return this.data.paper_balance;
  }

  public updateCapitalAndBalance(capital: number, balance: number) {
    this.data.capital = capital;
    this.data.paper_balance = balance;
  }

  public clearAll() {
    this.data = this.createDefaultData();
    this.data.market_ticks = [];
    this.data.signals = [];
    this.data.paper_trades = [];
    this.data.risk_logs = [];
    this.data.daily_summary = [];
    this.data.capital = 20000;
    this.data.paper_balance = 20000;
  }
}

export const db = new LocalDB();
