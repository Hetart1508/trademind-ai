export interface Indicators {
  ema9: number;
  ema21: number;
  rsi: number;
  vwap: number;
  currentPrice: number;
}

class IndicatorService {
  /**
   * Calculates EMA for a given period
   */
  public calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    if (prices.length < period) {
      // Fallback: simple moving average of whatever we have
      const sum = prices.reduce((acc, p) => acc + p, 0);
      return sum / prices.length;
    }

    const k = 2 / (period + 1);
    // Start with SMA as initial value
    let ema = prices.slice(0, period).reduce((acc, p) => acc + p, 0) / period;

    for (let i = period; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }

    return parseFloat(ema.toFixed(2));
  }

  /**
   * Calculates RSI 14
   */
  public calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length <= period) {
      // Safe default if there is not enough history
      return 50.0;
    }

    let gains = 0;
    let losses = 0;

    // Calculate initial average gain and loss
    for (let i = 1; i <= period; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff > 0) {
        gains += diff;
      } else {
        losses -= diff;
      }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Wilder's smoothing technique for RSI
    for (let i = period + 1; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) {
      return 100.0;
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    return parseFloat(rsi.toFixed(2));
  }

  /**
   * Calculates Volume Weighted Average Price (VWAP)
   */
  public calculateVWAP(ticks: { price: number; volume: number }[]): number {
    if (ticks.length === 0) return 0;

    let totalTypicalPriceVolume = 0;
    let totalVolume = 0;

    ticks.forEach((tick) => {
      // In high-frequency ticks, the tick price itself is treated as typical price
      totalTypicalPriceVolume += tick.price * tick.volume;
      totalVolume += tick.volume;
    });

    if (totalVolume === 0) return ticks[ticks.length - 1].price;

    return parseFloat((totalTypicalPriceVolume / totalVolume).toFixed(2));
  }

  /**
   * Compute all indicators for a stock based on its ticks
   */
  public computeAll(ticks: { price: number; volume: number }[]): Indicators | null {
    if (ticks.length === 0) return null;

    const prices = ticks.map((t) => t.price);
    const currentPrice = prices[prices.length - 1];

    const ema9 = this.calculateEMA(prices, 9);
    const ema21 = this.calculateEMA(prices, 21);
    const rsi = this.calculateRSI(prices, 14);
    const vwap = this.calculateVWAP(ticks);

    return {
      ema9,
      ema21,
      rsi,
      vwap,
      currentPrice,
    };
  }
}

export const indicatorService = new IndicatorService();
