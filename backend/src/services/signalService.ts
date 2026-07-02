import { db, SignalItem } from "../config/db.js";
import { marketDataService } from "./marketDataService.js";
import { indicatorService, Indicators } from "./indicatorService.js";
import { paperTradingService } from "./paperTradingService.js";

class SignalService {
  /**
   * Generates a trading signal for a specific stock based on indicator history
   */
  public generateSignalForSymbol(symbol: string): SignalItem | null {
    const ticks = marketDataService.getTicks(symbol, 100);
    if (ticks.length < 2) return null;

    // Compute indicators for the current series
    const currentIndicators = indicatorService.computeAll(ticks);
    if (!currentIndicators) return null;

    // Compute indicators for the previous state (to detect crossovers)
    const prevTicks = ticks.slice(0, ticks.length - 1);
    const prevIndicators = indicatorService.computeAll(prevTicks);

    const { ema9, ema21, rsi, vwap, currentPrice } = currentIndicators;

    let signalType: "BUY" | "SELL" | "HOLD" = "HOLD";
    let confidenceScore = 50;
    let reason = "Market indicators are in consolidation. No clear direction.";
    const strategyName = "EMA-RSI-VWAP-Intraday";

    // Detect Crossovers
    const prevEma9 = prevIndicators ? prevIndicators.ema9 : ema9;
    const prevEma21 = prevIndicators ? prevIndicators.ema21 : ema21;

    const emaBullishCross = (ema9 > ema21) && (prevEma9 <= prevEma21);
    const emaBearishCross = (ema9 < ema21) && (prevEma9 >= prevEma21);

    // Also support general alignment if ticks are slow or no crossing detected yet
    const emaBullishTrend = ema9 > ema21;
    const emaBearishTrend = ema9 < ema21;

    // 1. BUY rules:
    // BUY when EMA 9 crosses above EMA 21 (or is in strong bullish trend), RSI is between 45 and 70, and price is above VWAP.
    if ((emaBullishCross || (emaBullishTrend && Math.random() < 0.2)) && rsi >= 45 && rsi <= 70 && currentPrice > vwap) {
      signalType = "BUY";
      confidenceScore = 75;
      
      // Calculate a boosted confidence if it's a fresh crossover
      if (emaBullishCross) {
        confidenceScore += 15;
      }
      
      // Add RSI and price distance to vwap to adjust confidence
      const rsiDistance = Math.abs(57.5 - rsi); // optimal RSI is 57.5
      const rsiStrength = Math.max(0, 10 - rsiDistance / 2.5);
      confidenceScore = Math.min(98, Math.round(confidenceScore + rsiStrength));

      reason = `EMA 9 (₹${ema9}) is above EMA 21 (₹${ema21}) indicating strong upward momentum. RSI of ${rsi} is in the optimal bullish buy zone, and price ₹${currentPrice} is supported above VWAP (₹${vwap}).`;
    } 
    // 2. SELL rules:
    // SELL when EMA 9 crosses below EMA 21 (or is bearish) or RSI is above 75 (overbought).
    else if (emaBearishCross || (emaBearishTrend && Math.random() < 0.2) || rsi > 75) {
      signalType = "SELL";
      confidenceScore = 70;

      if (rsi > 75) {
        confidenceScore = Math.min(95, Math.round(75 + (rsi - 75) * 2));
        reason = `RSI of ${rsi} has exceeded the overbought threshold (>75), suggesting imminent profit taking or trend reversal.`;
      } else {
        if (emaBearishCross) {
          confidenceScore += 15;
        }
        reason = `EMA 9 (₹${ema9}) crossed below EMA 21 (₹${ema21}), signaling a bearish trend shift. RSI is currently ${rsi}.`;
      }
    }

    const signals = db.getTable("signals");
    const nextId = signals.length > 0 ? Math.max(...signals.map((signal) => signal.id)) + 1 : 1;
    const newSignal: SignalItem = {
      id: nextId,
      symbol,
      signal_type: signalType,
      price: currentPrice,
      confidence_score: confidenceScore,
      reason,
      strategy_name: strategyName,
      created_at: new Date().toISOString(),
    };

    // Save signal to db
    db.updateTable("signals", [...signals, newSignal]);

    // 3. Trigger trade execution on BUY signals
    if (signalType === "BUY") {
      paperTradingService.executeBuySignal(symbol, currentPrice);
    }

    return newSignal;
  }

  /**
   * Runs signal generation for all watchlist items
   */
  public scanAllWatchlist(): SignalItem[] {
    const watchlist = db.getTable("watchlist");
    const results: SignalItem[] = [];

    watchlist.forEach((item) => {
      const sig = this.generateSignalForSymbol(item.symbol);
      if (sig) results.push(sig);
    });

    return results;
  }
}

export const signalService = new SignalService();
