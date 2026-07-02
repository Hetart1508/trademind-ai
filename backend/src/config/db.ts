import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "backend", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

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
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        // Ensure all keys exist
        return { ...DEFAULT_DB, ...parsed };
      }
    } catch (e) {
      console.error("Failed to load local DB, resetting to defaults:", e);
    }
    this.save(DEFAULT_DB);
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }

  private save(data: DatabaseSchema) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to save local DB:", e);
    }
  }

  public getTable<K extends keyof DatabaseSchema>(table: K): DatabaseSchema[K] {
    return this.data[table];
  }

  public updateTable<K extends keyof DatabaseSchema>(table: K, value: DatabaseSchema[K]) {
    this.data[table] = value;
    this.save(this.data);
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
    this.save(this.data);
  }

  public clearAll() {
    this.data = JSON.parse(JSON.stringify(DEFAULT_DB));
    this.data.market_ticks = [];
    this.data.signals = [];
    this.data.paper_trades = [];
    this.data.risk_logs = [];
    this.data.daily_summary = [];
    this.data.capital = 20000;
    this.data.paper_balance = 20000;
    this.save(this.data);
  }
}

export const db = new LocalDB();
