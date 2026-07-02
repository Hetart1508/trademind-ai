import { db, MarketTick } from "../config/db.js";

// Helper to get relative imports right or support typescript file compile.
// Note that in Node, ES module imports might require .js extension when compiled.

const BASE_PRICES: Record<string, number> = {
  RELIANCE: 2450.0,
  TCS: 3400.0,
  INFY: 1450.0,
  HDFCBANK: 1600.0,
  ICICIBANK: 950.0,
  SBIN: 580.0,
  BHARTIARTL: 870.0,
  ITC: 430.0,
};

class MarketDataService {
  // Store active session prices to simulate random walks
  private activePrices: Record<string, { price: number; lastPrice: number; openPrice: number }> = {};

  constructor() {
    this.initializePrices();
  }

  private initializePrices() {
    const watchlist = db.getTable("watchlist");
    watchlist.forEach((item) => {
      const base = BASE_PRICES[item.symbol] || 500.0;
      this.activePrices[item.symbol] = {
        price: base,
        lastPrice: base,
        openPrice: base,
      };
    });
  }

  /**
   * Generates a new price tick for all watched symbols
   */
  public generateTicks(): MarketTick[] {
    const watchlist = db.getTable("watchlist");
    const ticks = db.getTable("market_ticks");
    const newTicks: MarketTick[] = [];
    const nextId = ticks.length > 0 ? Math.max(...ticks.map((tick) => tick.id)) + 1 : 1;
    const now = new Date().toISOString();

    // Check if we need to initialize newly added symbols
    watchlist.forEach((item) => {
      if (!this.activePrices[item.symbol]) {
        const base = BASE_PRICES[item.symbol] || 500.0;
        this.activePrices[item.symbol] = {
          price: base,
          lastPrice: base,
          openPrice: base,
        };
      }
    });

    watchlist.forEach((item) => {
      const state = this.activePrices[item.symbol];
      if (!state) return;

      // Realistic intraday walk: -0.15% to +0.15% per tick
      const pctChange = (Math.random() * 0.3 - 0.15) / 100;
      const priceChange = state.price * pctChange;
      
      state.lastPrice = state.price;
      state.price = parseFloat((state.price + priceChange).toFixed(2));
      
      // Generate some realistic tick volume
      const volume = Math.floor(Math.random() * 1500) + 100;

      const newTick: MarketTick = {
        id: nextId + newTicks.length,
        symbol: item.symbol,
        price: state.price,
        volume,
        created_at: now,
      };

      newTicks.push(newTick);
    });

    // Save and cap size of market_ticks table to prevent memory leaks
    let updatedTicks = [...ticks, ...newTicks];
    const MAX_TICKS_SAVED = 1000;
    if (updatedTicks.length > MAX_TICKS_SAVED) {
      updatedTicks = updatedTicks.slice(updatedTicks.length - MAX_TICKS_SAVED);
    }
    db.updateTable("market_ticks", updatedTicks);

    return newTicks;
  }

  public getLatestPrice(symbol: string): number {
    const state = this.activePrices[symbol];
    if (state) return state.price;
    return BASE_PRICES[symbol] || 100.0;
  }

  public getLatestTick(symbol: string): MarketTick | null {
    const ticks = db.getTable("market_ticks");
    for (let i = ticks.length - 1; i >= 0; i--) {
      if (ticks[i].symbol === symbol) {
        return ticks[i];
      }
    }
    return null;
  }

  public getTicks(symbol: string, limit: number = 100): MarketTick[] {
    const ticks = db.getTable("market_ticks");
    return ticks.filter((t) => t.symbol === symbol).slice(-limit);
  }

  public getLivePrices() {
    const watchlist = db.getTable("watchlist");
    const result: Record<string, { price: number; lastPrice: number; change: number; changePercent: number; volume: number; lastUpdated: string }> = {};

    watchlist.forEach((item) => {
      const state = this.activePrices[item.symbol] || { price: BASE_PRICES[item.symbol] || 500, lastPrice: BASE_PRICES[item.symbol] || 500, openPrice: BASE_PRICES[item.symbol] || 500 };
      const latestTick = this.getLatestTick(item.symbol);
      const change = parseFloat((state.price - state.openPrice).toFixed(2));
      const changePercent = parseFloat(((change / state.openPrice) * 100).toFixed(2));

      result[item.symbol] = {
        price: state.price,
        lastPrice: state.lastPrice,
        change,
        changePercent,
        volume: latestTick ? latestTick.volume : 0,
        lastUpdated: latestTick ? latestTick.created_at : new Date().toISOString(),
      };
    });

    return result;
  }

  // Allow adding symbols to internal state
  public addWatchSymbol(symbol: string) {
    if (!this.activePrices[symbol]) {
      const base = BASE_PRICES[symbol] || 500.0;
      this.activePrices[symbol] = {
        price: base,
        lastPrice: base,
        openPrice: base,
      };
    }
  }
}

export const marketDataService = new MarketDataService();
