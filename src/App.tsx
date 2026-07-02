import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Activity,
  Database,
  Sliders,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  Play,
  RefreshCw,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  History,
  PieChart as PieIcon,
  HelpCircle,
  Copy,
  ChevronRight,
  User,
  Zap,
  Info
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend
} from "recharts";

// TypeScript Interfaces for API response handling
interface WatchlistItem {
  id: number;
  symbol: string;
  created_at: string;
}

interface MarketTick {
  id: number;
  symbol: string;
  price: number;
  volume: number;
  created_at: string;
}

interface SignalItem {
  id: number;
  symbol: string;
  signal_type: "BUY" | "SELL" | "HOLD";
  price: number;
  confidence_score: number;
  reason: string;
  strategy_name: string;
  created_at: string;
}

interface PaperTrade {
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

interface RiskLog {
  id: number;
  symbol: string;
  reason: string;
  created_at: string;
}

export default function App() {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  // State Management
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [livePrices, setLivePrices] = useState<any>({});
  const [signals, setSignals] = useState<SignalItem[]>([]);
  const [paperTrades, setPaperTrades] = useState<PaperTrade[]>([]);
  const [riskLogs, setRiskLogs] = useState<RiskLog[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  
  // UI Inputs & Controls
  const [newSymbolInput, setNewSymbolInput] = useState<string>("");
  const [isBypassRisk, setIsBypassRisk] = useState<boolean>(true);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<{ status: "success" | "error" | null; text: string | null }>({ status: null, text: null });
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // SQL queries text for copy/paste migration
  const SQL_MIGRATION_SCRIPT = `-- TRADEMIND AI DATABASE MIGRATION SCRIPT
-- Create paper trading database and optimize indexing for high-frequency ticks.

CREATE DATABASE IF NOT EXISTS trademind_ai;
USE trademind_ai;

-- 1. Watchlist symbols configuration
CREATE TABLE IF NOT EXISTS watchlist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Fast-insert market ticks log table
CREATE TABLE IF NOT EXISTS market_ticks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  price DECIMAL(12, 2) NOT NULL,
  volume INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_symbol_time (symbol, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Trade signals analytics history
CREATE TABLE IF NOT EXISTS signals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  signal_type VARCHAR(10) NOT NULL,
  price DECIMAL(12, 2) NOT NULL,
  confidence_score INT NOT NULL,
  reason TEXT NOT NULL,
  strategy_name VARCHAR(100) DEFAULT 'EMA-RSI-VWAP-Intraday',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_symbol_created (symbol, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Dynamic paper trading execution table
CREATE TABLE IF NOT EXISTS paper_trades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  entry_price DECIMAL(12, 2) NOT NULL,
  quantity INT NOT NULL,
  target_price DECIMAL(12, 2) NOT NULL,
  stop_loss_price DECIMAL(12, 2) NOT NULL,
  exit_price DECIMAL(12, 2) DEFAULT NULL,
  pnl DECIMAL(12, 2) DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  entry_time TIMESTAMP NOT NULL,
  exit_time TIMESTAMP NULL DEFAULT NULL,
  exit_reason VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_symbol (symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Risk rule rejection telemetry
CREATE TABLE IF NOT EXISTS risk_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Consolidated intraday summary
CREATE TABLE IF NOT EXISTS daily_summary (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_trades INT DEFAULT 0,
  winning_trades INT DEFAULT 0,
  losing_trades INT DEFAULT 0,
  daily_pnl DECIMAL(12, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Populate default high liquidity Nifty-50 stocks
INSERT INTO watchlist (symbol) VALUES 
('RELIANCE'), ('TCS'), ('INFY'), ('HDFCBANK'), ('ICICIBANK')
ON DUPLICATE KEY UPDATE symbol=symbol;`;

  // Fetch all live data modules from Node.js backend endpoints
  const fetchAllData = async () => {
    setIsRefreshing(true);
    try {
      const [
        summaryRes,
        analyticsRes,
        watchlistRes,
        pricesRes,
        signalsRes,
        tradesRes,
        riskRes,
        healthRes
      ] = await Promise.all([
        fetch("/api/dashboard/summary"),
        fetch("/api/dashboard/analytics"),
        fetch("/api/watchlist"),
        fetch("/api/market/live"),
        fetch("/api/signals"),
        fetch("/api/paper-trades"),
        fetch("/api/risk-logs"),
        fetch("/api/health")
      ]);

      if (summaryRes.ok) {
        const d = await summaryRes.json();
        setSummary(d.data);
      }
      if (analyticsRes.ok) {
        const d = await analyticsRes.json();
        setAnalytics(d.data);
      }
      if (watchlistRes.ok) {
        const d = await watchlistRes.json();
        setWatchlist(d.data || []);
      }
      if (pricesRes.ok) {
        const d = await pricesRes.json();
        setLivePrices(d.data || {});
      }
      if (signalsRes.ok) {
        const d = await signalsRes.json();
        setSignals((d.data || []).reverse()); // newest first
      }
      if (tradesRes.ok) {
        const d = await tradesRes.json();
        setPaperTrades((d.data || []).reverse()); // newest first
      }
      if (riskRes.ok) {
        const d = await riskRes.json();
        setRiskLogs((d.data || []).reverse()); // newest first
      }
      if (healthRes.ok) {
        const d = await healthRes.json();
        setIsBypassRisk(d.bypassTimeConstraint);
      }

      setLastUpdatedTime(new Date());
    } catch (error) {
      console.error("Dashboard fetch error:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // On mount and polling interval of 4 seconds
  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 4000);
    return () => clearInterval(interval);
  }, []);

  // Action feedback timer
  const showFeedback = (text: string, isError: boolean = false) => {
    setActionFeedback({ status: isError ? "error" : "success", text });
    setTimeout(() => {
      setActionFeedback({ status: null, text: null });
    }, 5000);
  };

  // Add stock to Watchlist POST API
  const handleAddSymbol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbolInput.trim()) return;

    const symbolToAdd = newSymbolInput.trim().toUpperCase();
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: symbolToAdd })
      });

      const result = await res.json();
      if (result.success) {
        showFeedback(`Added ${symbolToAdd} to watchlist successfully!`);
        setNewSymbolInput("");
        fetchAllData();
      } else {
        showFeedback(result.error || `Failed to add ${symbolToAdd}`, true);
      }
    } catch (err: any) {
      showFeedback(err.message, true);
    }
  };

  // Remove stock from Watchlist DELETE API
  const handleRemoveSymbol = async (symbol: string) => {
    try {
      const res = await fetch(`/api/watchlist/${symbol}`, {
        method: "DELETE"
      });
      const result = await res.json();
      if (result.success) {
        showFeedback(`Removed ${symbol} from watchlist.`);
        fetchAllData();
      } else {
        showFeedback(result.error || `Failed to remove ${symbol}`, true);
      }
    } catch (err: any) {
      showFeedback(err.message, true);
    }
  };

  // Force Manual Position Close POST API
  const handleManualExit = async (tradeId: number) => {
    try {
      const res = await fetch(`/api/paper-trades/manual-exit/${tradeId}`, {
        method: "POST"
      });
      const result = await res.json();
      if (result.success) {
        showFeedback(`Successfully liquidated position ID #${tradeId}!`);
        fetchAllData();
      } else {
        showFeedback(result.error || "Failed to manually exit trade", true);
      }
    } catch (err: any) {
      showFeedback(err.message, true);
    }
  };

  // System Simulation Trigger Handlers
  const handleManualTick = async () => {
    try {
      const res = await fetch("/api/system/tick", { method: "POST" });
      const result = await res.json();
      if (result.success) {
        showFeedback("Triggered random-walk price tick simulation.");
        fetchAllData();
      }
    } catch (err: any) {
      showFeedback(err.message, true);
    }
  };

  const handleManualScan = async () => {
    try {
      const res = await fetch("/api/signals/generate", { method: "POST" });
      const result = await res.json();
      if (result.success) {
        showFeedback(`Strategy Scan completed! Found ${result.count} signal updates.`);
        fetchAllData();
      }
    } catch (err: any) {
      showFeedback(err.message, true);
    }
  };

  const handleToggleRiskBypass = async () => {
    try {
      const res = await fetch("/api/system/toggle-risk", { method: "POST" });
      const result = await res.json();
      if (result.success) {
        showFeedback(`Intraday hours rule bypass is now ${result.bypassTimeConstraint ? 'ENABLED' : 'DISABLED'}`);
        setIsBypassRisk(result.bypassTimeConstraint);
        fetchAllData();
      }
    } catch (err: any) {
      showFeedback(err.message, true);
    }
  };

  const handleResetSystem = async () => {
    if (!window.confirm("Are you sure you want to restore the system to empty states and seed defaults?")) return;
    try {
      const res = await fetch("/api/system/reset", { method: "POST" });
      const result = await res.json();
      if (result.success) {
        showFeedback("System database re-seeded successfully!");
        fetchAllData();
      }
    } catch (err: any) {
      showFeedback(err.message, true);
    }
  };

  // Copy Schema to Clipboard Helper
  const copySchemaToClipboard = () => {
    navigator.clipboard.writeText(SQL_MIGRATION_SCRIPT);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Helper values
  const openTradesList = paperTrades.filter((t) => t.status === "OPEN");
  const closedTradesList = paperTrades.filter((t) => t.status === "CLOSED");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col selection:bg-blue-100 selection:text-blue-900">
      
      {/* 1. Global Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white shadow-sm flex items-center justify-center">
              <TrendingUp className="w-5.5 h-5.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-slate-950">TradeMind AI</span>
                <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase">Intraday Paper MVP</span>
              </div>
              <p className="text-xs text-slate-400">Live Indian Markets Paper Trader (₹20,000 Cap)</p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "dashboard", label: "Dashboard", icon: Sliders },
              { id: "watchlist", label: "Watchlist", icon: Activity },
              { id: "market", label: "Market Data", icon: Database },
              { id: "signals", label: "Signals Feed", icon: Zap },
              { id: "trades", label: "Paper Trades", icon: ArrowUpRight },
              { id: "analytics", label: "P&L Analytics", icon: PieIcon },
              { id: "migration", label: "SQL Migration", icon: Info },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.id === "trades" && openTradesList.length > 0 && (
                    <span className="bg-amber-400 text-amber-950 font-bold px-1.5 py-0.2 text-[9px] rounded-full">
                      {openTradesList.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* 2. Top-Level Feedback Banner & Simulator Telemetry */}
      <section className="bg-slate-900 text-white py-2 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center text-xs gap-2">
          <div className="flex items-center gap-3.5 flex-wrap">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              Interval Tick Rate: <strong className="text-white">5s</strong>
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              Signal Evaluation: <strong className="text-white">30s</strong>
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              Risk Hours Bypass: <strong className={isBypassRisk ? "text-emerald-400" : "text-amber-400"}>
                {isBypassRisk ? "Active" : "Standard Limit"}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-500">Last synchronized: {lastUpdatedTime.toLocaleTimeString()}</span>
            <button
              onClick={fetchAllData}
              disabled={isRefreshing}
              className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-blue-400" : ""}`} />
            </button>
          </div>
        </div>
      </section>

      {/* Action Notification Feed */}
      {actionFeedback.text && (
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-3xl mx-auto p-4 flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2.5">
              {actionFeedback.status === "error" ? (
                <XCircle className="w-5 h-5 text-red-500 shrink-0" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              )}
              <span className="font-medium text-slate-700">{actionFeedback.text}</span>
            </div>
            <button 
              onClick={() => setActionFeedback({ status: null, text: null })}
              className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* 3. Main Body Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">

        {/* -------------------- TAB 1: DASHBOARD HOME -------------------- */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            
            {/* Simulation Controller Action Hub */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-blue-600" />
                  MVP Interactive Simulation Center
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  The backend simulates high-frequency price updates and evaluation logs. Use these triggers to test live behaviors immediately.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleManualTick}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border border-blue-200"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Force Market Price Tick (5s)
                </button>
                <button
                  onClick={handleManualScan}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border border-indigo-200"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Force Indicator Scan (30s)
                </button>
                <button
                  onClick={handleToggleRiskBypass}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border border-amber-200"
                >
                  <Shield className="w-3.5 h-3.5" />
                  Toggle Risk Hours Bypass
                </button>
                <button
                  onClick={handleResetSystem}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reset DB State
                </button>
              </div>
            </div>

            {/* KPI Metrics Ribbon */}
            {summary && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Initial Capital */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Initial Capital</span>
                    <strong className="text-2xl font-bold font-mono text-slate-900 block mt-1">₹{summary.totalCapital.toLocaleString()}</strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Fixed for Phase 1</span>
                  </div>
                  <div className="p-3 bg-slate-50 text-slate-600 rounded-lg">
                    <Database className="w-6 h-6" />
                  </div>
                </div>

                {/* Current Paper Balance */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Paper Balance</span>
                    <strong className="text-2xl font-bold font-mono text-blue-600 block mt-1">₹{summary.paperBalance.toLocaleString()}</strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Available Margin</span>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                </div>

                {/* Today's P&L */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Today's P&L</span>
                    <strong className={`text-2xl font-bold font-mono block mt-1 ${summary.todayPnL >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      ₹{summary.todayPnL.toFixed(2)}
                    </strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Realized & Float</span>
                  </div>
                  <div className={`p-3 rounded-lg ${summary.todayPnL >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                    {summary.todayPnL >= 0 ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
                  </div>
                </div>

                {/* Win Rate */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Win Rate (Closed)</span>
                    <strong className="text-2xl font-bold font-mono text-slate-900 block mt-1">{summary.winRate}%</strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {summary.closedTradesCount} Closed | {summary.openTradesCount} Active
                    </span>
                  </div>
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Activity className="w-6 h-6" />
                  </div>
                </div>
              </div>
            )}

            {/* Risk Control Parameters Snapshot */}
            {summary && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left: Risk Metrics & Speedometers */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Shield className="w-4.5 h-4.5 text-rose-500" />
                      Risk Manager Monitoring Logs
                    </h3>
                    <span className="text-xs font-semibold bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full">
                      Strict Limits Enforced
                    </span>
                  </div>

                  {/* Daily limit tracker */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-600">Daily Loss Utilization</span>
                      <span className="font-mono text-slate-900">
                        ₹{summary.dailyLossLimit.current.toFixed(2)} / ₹{summary.dailyLossLimit.limit}
                      </span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          summary.dailyLossLimit.exceeded ? "bg-red-600 animate-pulse" : "bg-rose-500"
                        }`}
                        style={{ width: `${summary.dailyLossLimit.percentUsed}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Max acceptable loss per day</span>
                      <span className="font-semibold text-rose-600">
                        {summary.dailyLossLimit.exceeded ? "CRITICAL: LIMIT REACHED!" : `${summary.dailyLossLimit.percentUsed}% utilized`}
                      </span>
                    </div>
                  </div>

                  {/* Monthly limit tracker */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-600">Monthly Loss Utilization</span>
                      <span className="font-mono text-slate-900">
                        ₹{summary.monthlyLossLimit.current.toFixed(2)} / ₹{summary.monthlyLossLimit.limit}
                      </span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          summary.monthlyLossLimit.exceeded ? "bg-red-600" : "bg-amber-500"
                        }`}
                        style={{ width: `${summary.monthlyLossLimit.percentUsed}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Max acceptable loss per month</span>
                      <span className="font-semibold text-amber-600">
                        {summary.monthlyLossLimit.percentUsed}% utilized
                      </span>
                    </div>
                  </div>

                  {/* Operational Risk Constants Bullet list */}
                  <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-400 block">Risk Per Trade</span>
                      <strong className="text-slate-800 font-bold font-mono">₹100</strong>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-400 block">Max Trade Count / Day</span>
                      <strong className="text-slate-800 font-bold font-mono">2 Trades</strong>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-400 block">Target Trigger %</span>
                      <strong className="text-slate-800 font-bold font-mono">1.0% Profit</strong>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-400 block">Stop Loss Trigger %</span>
                      <strong className="text-slate-800 font-bold font-mono">0.5% Loss</strong>
                    </div>
                  </div>
                </div>

                {/* Right: Risk Rejection Logs Telemetry */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Shield className="w-4.5 h-4.5 text-amber-500" />
                      Risk Evaluation Logs ({riskLogs.length})
                    </h3>
                    <span className="text-[10px] font-semibold text-slate-400">
                      Live Telemetry
                    </span>
                  </div>

                  <div className="flex-grow space-y-2 overflow-y-auto max-h-[220px] pr-1 scrollbar-thin">
                    {riskLogs.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-1.5">
                        <CheckCircle className="w-8 h-8 text-emerald-400" />
                        <span className="font-semibold text-xs">No Risk Breaches Logged</span>
                        <p className="text-[10px] text-slate-400 max-w-xs">All trades passed risk parameter screenings.</p>
                      </div>
                    ) : (
                      riskLogs.map((log) => (
                        <div key={log.id} className="p-2.5 bg-rose-50 border border-rose-100 rounded-lg flex items-start gap-2.5 text-xs">
                          <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                          <div className="space-y-0.5 flex-grow">
                            <div className="flex justify-between items-center">
                              <strong className="text-rose-950 font-bold font-mono">{log.symbol}</strong>
                              <span className="text-[9px] text-slate-400 font-mono">
                                {new Date(log.created_at).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-rose-800 text-[11px] leading-snug">
                              Rejected Trade: <span className="font-bold">{log.reason.replace(/_/g, " ")}</span>
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <p className="text-[10px] text-slate-400 border-t border-slate-100 pt-3 leading-relaxed">
                    *Our automated risk advisor screens all trade signals at execution time, blocking margin access if parameters are exceeded.
                  </p>
                </div>
              </div>
            )}

            {/* Open Trades Panel (Quick Control) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4.5 h-4.5 text-blue-600" />
                  Active Open Trades ({openTradesList.length})
                </h3>
                <button
                  onClick={() => setActiveTab("trades")}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-0.5"
                >
                  View Closed Trades <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {openTradesList.length === 0 ? (
                <div className="py-8 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
                  <Clock className="w-8 h-8 text-slate-300" />
                  <div>
                    <p className="font-semibold text-xs text-slate-600">No Active Intraday Positions</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">BUY signals generated by scanning will initiate paper trades automatically.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {openTradesList.map((trade) => {
                    const latestPrice = livePrices[trade.symbol]?.price || trade.entry_price;
                    const isUp = latestPrice >= trade.entry_price;
                    return (
                      <div key={trade.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5 relative overflow-hidden">
                        <div className="absolute right-0 top-0 bg-blue-100 text-blue-800 font-bold px-2.5 py-0.5 text-[9px] rounded-bl-lg uppercase tracking-wide">
                          ACTIVE LONG
                        </div>

                        <div className="flex justify-between items-center">
                          <div>
                            <strong className="text-sm font-black text-slate-900 tracking-tight block">{trade.symbol}</strong>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Qty: {trade.quantity} | Opened: {new Date(trade.entry_time).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="text-right pr-14">
                            <span className="text-[10px] text-slate-400 block">Current Price</span>
                            <strong className="text-sm font-mono font-bold text-slate-900">₹{latestPrice.toFixed(2)}</strong>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-lg border border-slate-150 text-center text-xs">
                          <div>
                            <span className="text-[9px] text-slate-400 block">Entry</span>
                            <strong className="font-mono text-slate-700">₹{trade.entry_price}</strong>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 block">Target (1.0%)</span>
                            <strong className="font-mono text-emerald-600">₹{trade.target_price}</strong>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 block">Stop-Loss (0.5%)</span>
                            <strong className="font-mono text-rose-600">₹{trade.stop_loss_price}</strong>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-1">
                          <div className="flex-grow">
                            <span className="text-[9px] text-slate-400 block uppercase">Floating P&L</span>
                            <strong className={`text-base font-bold font-mono ${trade.pnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                              ₹{trade.pnl >= 0 ? "+" : ""}{trade.pnl.toFixed(2)}
                            </strong>
                          </div>
                          <button
                            onClick={() => handleManualExit(trade.id)}
                            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition"
                          >
                            Liquidate Position
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* -------------------- TAB 2: WATCHLIST MODULE -------------------- */}
        {activeTab === "watchlist" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left: Watchlist management controls */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Plus className="w-4.5 h-4.5 text-blue-600" />
                Add Stock to Watchlist
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Add highly liquid Nifty 50 stocks (e.g., SBIN, ITC, COALINDIA) to evaluate indicators & execute paper signals automatically.
              </p>

              <form onSubmit={handleAddSymbol} className="space-y-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Symbol Code</label>
                  <input
                    type="text"
                    value={newSymbolInput}
                    onChange={(e) => setNewSymbolInput(e.target.value.toUpperCase())}
                    placeholder="e.g. SBIN"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold uppercase focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add Watchlist Item
                </button>
              </form>

              {/* Watchlist Summary metrics */}
              <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-100 text-xs space-y-2.5 pt-4">
                <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Watchlist Specs</div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Items Active:</span>
                  <strong className="text-slate-800 font-mono font-bold">{watchlist.length}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Scan Frequency:</span>
                  <strong className="text-slate-800 font-mono font-bold">Every 30s</strong>
                </div>
              </div>
            </div>

            {/* Right: Watchlist Grid items table */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4.5 h-4.5 text-blue-600" />
                  Active Watchlist Symbols & Latest Performance
                </h3>
                <span className="text-[10px] bg-slate-100 px-2 py-0.5 font-mono text-slate-500 rounded">
                  Live Intraday Ticks
                </span>
              </div>

              {watchlist.length === 0 ? (
                <div className="py-12 text-center text-slate-400">Watchlist is currently empty. Add items on the left side panel.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-semibold">
                        <th className="pb-3">Symbol</th>
                        <th className="pb-3">Latest Mock Price</th>
                        <th className="pb-3 text-right">Latest Trigger Signal</th>
                        <th className="pb-3 text-right">Added At</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {watchlist.map((item) => {
                        const stock = livePrices[item.symbol] || { price: 0 };
                        // Get the latest signal matching this symbol
                        const symSignal = signals.find((s) => s.symbol === item.symbol);
                        return (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-4.5 font-extrabold text-slate-900 text-sm tracking-tight">{item.symbol}</td>
                            <td className="py-4.5 font-mono font-semibold">
                              {stock.price > 0 ? `₹${stock.price.toFixed(2)}` : "Initializing..."}
                            </td>
                            <td className="py-4.5 text-right">
                              {symSignal ? (
                                <div className="space-y-1">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                    symSignal.signal_type === "BUY"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : symSignal.signal_type === "SELL"
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-slate-100 text-slate-600"
                                  }`}>
                                    {symSignal.signal_type}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block mt-0.5">{symSignal.confidence_score}% Confidence</span>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">No signals generated yet</span>
                              )}
                            </td>
                            <td className="py-4.5 text-right text-slate-400 font-mono">
                              {new Date(item.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-4.5 text-right">
                              <button
                                onClick={() => handleRemoveSymbol(item.symbol)}
                                className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition"
                                title={`Delete ${item.symbol}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

        {/* -------------------- TAB 3: LIVE MARKET PAGE -------------------- */}
        {activeTab === "market" && (
          <div className="space-y-6">
            
            {/* Watchlist ticker details with change status */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4.5 h-4.5 text-blue-600 animate-pulse" />
                  Live Orderbook Mock-Tick Feed
                </h3>
                <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Connected
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="pb-3">Symbol</th>
                      <th className="pb-3 text-right">Last Price</th>
                      <th className="pb-3 text-right">Net Price Chg (Day)</th>
                      <th className="pb-3 text-right">% Chg</th>
                      <th className="pb-3 text-right">Mock Trade Vol</th>
                      <th className="pb-3 text-right">Tick Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {Object.keys(livePrices).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">Awaiting first live price tick synchronization...</td>
                      </tr>
                    ) : (
                      Object.keys(livePrices).map((sym) => {
                        const ticker = livePrices[sym];
                        const isUp = ticker.change >= 0;
                        return (
                          <tr key={sym} className="hover:bg-slate-50 transition-colors">
                            <td className="py-4.5 font-bold text-slate-900">{sym}</td>
                            <td className="py-4.5 text-right font-mono font-semibold">₹{ticker.price.toFixed(2)}</td>
                            <td className={`py-4.5 text-right font-mono font-bold ${isUp ? "text-emerald-600" : "text-rose-600"}`}>
                              {isUp ? "+" : ""}{ticker.change.toFixed(2)}
                            </td>
                            <td className={`py-4.5 text-right font-mono font-bold ${isUp ? "text-emerald-600" : "text-rose-600"}`}>
                              {isUp ? "+" : ""}{ticker.changePercent}%
                            </td>
                            <td className="py-4.5 text-right font-mono text-slate-500">{ticker.volume.toLocaleString()}</td>
                            <td className="py-4.5 text-right text-slate-400 font-mono text-xs">
                              {new Date(ticker.lastUpdated).toLocaleTimeString()}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Architecture note about integration */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-start gap-4">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 text-xs text-blue-900">
                <h4 className="font-bold">Ready for Zerodha / Upstox Integrations</h4>
                <p className="leading-relaxed">
                  We have designed the backend price service `marketDataService.ts` using highly modular dependency patterns. The front-end queries simple API polling endpoints `/api/market/live`. For production deploy:
                </p>
                <ol className="list-decimal pl-4 space-y-1 font-mono text-[11px] text-blue-800">
                  <li>Swap out `marketDataService.generateTicks()` with a WebSocket connection to Kite Connect or Upstox.</li>
                  <li>Bind streaming ticks to database records. The frontend handles real-time updates seamlessly!</li>
                </ol>
              </div>
            </div>

          </div>
        )}

        {/* -------------------- TAB 4: SIGNALS PAGE -------------------- */}
        {activeTab === "signals" && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Zap className="w-4.5 h-4.5 text-blue-600" />
                  Technical Indicator Signals Log Feed
                </h3>
                <p className="text-xs text-slate-500">
                  Computed by cross-analyzing price channels against EMA 9 / EMA 21 crossovers, RSI 14, and volume-weighted averages.
                </p>
              </div>
              <button
                onClick={handleManualScan}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" /> Trigger Scan Now
              </button>
            </div>

            {signals.length === 0 ? (
              <div className="py-12 text-center text-slate-400">No signals generated yet. Click 'Trigger Scan Now' to force instantly.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="pb-3">Symbol</th>
                      <th className="pb-3">Direction</th>
                      <th className="pb-3">Trigger Price</th>
                      <th className="pb-3">Confidence Score</th>
                      <th className="pb-3">Algorithmic Reason</th>
                      <th className="pb-3 text-right">Strategy Name</th>
                      <th className="pb-3 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {signals.map((sig) => (
                      <tr key={sig.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 font-bold text-slate-900">{sig.symbol}</td>
                        <td className="py-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            sig.signal_type === "BUY"
                              ? "bg-emerald-100 text-emerald-800"
                              : sig.signal_type === "SELL"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-slate-100 text-slate-600"
                          }`}>
                            {sig.signal_type}
                          </span>
                        </td>
                        <td className="py-4 font-mono font-semibold">₹{sig.price.toFixed(2)}</td>
                        <td className="py-4">
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 bg-slate-100 h-2 rounded-full overflow-hidden shrink-0">
                              <div 
                                className={`h-full ${
                                  sig.signal_type === "BUY" ? "bg-emerald-500" : sig.signal_type === "SELL" ? "bg-rose-500" : "bg-slate-400"
                                }`}
                                style={{ width: `${sig.confidence_score}%` }}
                              ></div>
                            </div>
                            <span className="font-mono font-bold">{sig.confidence_score}%</span>
                          </div>
                        </td>
                        <td className="py-4 max-w-sm text-slate-600 leading-normal">{sig.reason}</td>
                        <td className="py-4 text-right font-mono text-slate-500 text-[11px]">{sig.strategy_name}</td>
                        <td className="py-4 text-right text-slate-400 font-mono">
                          {new Date(sig.created_at).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* -------------------- TAB 5: PAPER TRADES PAGE -------------------- */}
        {activeTab === "trades" && (
          <div className="space-y-6">
            
            {/* Active Open trades */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Activity className="w-4.5 h-4.5 text-blue-600 animate-pulse" />
                Active Open Positions ({openTradesList.length})
              </h3>

              {openTradesList.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">No active open trades. System will purchase automatically on BUY signal matches.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-semibold">
                        <th className="pb-3">Trade ID</th>
                        <th className="pb-3">Symbol</th>
                        <th className="pb-3">Purchase Price</th>
                        <th className="pb-3">Quantity</th>
                        <th className="pb-3">Stop Loss</th>
                        <th className="pb-3">Target Price</th>
                        <th className="pb-3">Current floating P&L</th>
                        <th className="pb-3 text-right">Open Timestamp</th>
                        <th className="pb-3 text-right">Liquidation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {openTradesList.map((trade) => {
                        const latestPrice = livePrices[trade.symbol]?.price || trade.entry_price;
                        return (
                          <tr key={trade.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-4 font-mono font-bold text-slate-500">#{trade.id}</td>
                            <td className="py-4 font-bold text-slate-900">{trade.symbol}</td>
                            <td className="py-4 font-mono">₹{trade.entry_price}</td>
                            <td className="py-4 font-mono">{trade.quantity}</td>
                            <td className="py-4 font-mono text-rose-600">₹{trade.stop_loss_price}</td>
                            <td className="py-4 font-mono text-emerald-600">₹{trade.target_price}</td>
                            <td className={`py-4 font-mono font-bold ${trade.pnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                              ₹{trade.pnl >= 0 ? "+" : ""}{trade.pnl.toFixed(2)}
                            </td>
                            <td className="py-4 text-right text-slate-400 font-mono">
                              {new Date(trade.entry_time).toLocaleTimeString()}
                            </td>
                            <td className="py-4 text-right">
                              <button
                                onClick={() => handleManualExit(trade.id)}
                                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition"
                              >
                                Manual Exit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Closed / Realized Trade Logs */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <History className="w-4.5 h-4.5 text-slate-700" />
                Settled & Realized Historical Trades ({closedTradesList.length})
              </h3>

              {closedTradesList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">No closed trades stored in database log yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-semibold">
                        <th className="pb-3">Trade ID</th>
                        <th className="pb-3">Symbol</th>
                        <th className="pb-3">Entry Price</th>
                        <th className="pb-3">Exit Price</th>
                        <th className="pb-3">Quantity</th>
                        <th className="pb-3">Realized P&L</th>
                        <th className="pb-3">Exit Reason</th>
                        <th className="pb-3 text-right">Settled Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {closedTradesList.map((trade) => (
                        <tr key={trade.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-4 font-mono font-bold text-slate-500">#{trade.id}</td>
                          <td className="py-4 font-bold text-slate-900">{trade.symbol}</td>
                          <td className="py-4 font-mono">₹{trade.entry_price}</td>
                          <td className="py-4 font-mono font-bold text-slate-800">
                            ₹{trade.exit_price ? trade.exit_price.toFixed(2) : "0.00"}
                          </td>
                          <td className="py-4 font-mono">{trade.quantity}</td>
                          <td className={`py-4 font-mono font-extrabold ${trade.pnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            ₹{trade.pnl >= 0 ? "+" : ""}{trade.pnl.toFixed(2)}
                          </td>
                          <td className="py-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              trade.exit_reason === "TARGET_HIT"
                                ? "bg-emerald-100 text-emerald-800"
                                : trade.exit_reason === "STOP_LOSS_HIT"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-slate-100 text-slate-700"
                            }`}>
                              {trade.exit_reason?.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="py-4 text-right text-slate-400 font-mono">
                            {trade.exit_time ? new Date(trade.exit_time).toLocaleTimeString() : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

        {/* -------------------- TAB 6: ANALYTICS PAGE -------------------- */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            
            {/* Grid for charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Daily Cumulative P&L Curve */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-950">Daily Cumulative Paper P&L Curve (₹)</h3>
                <div className="h-72">
                  {analytics?.pnlChart && analytics.pnlChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.pnlChart}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <Tooltip />
                        <Line type="monotone" dataKey="pnl" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400">Not enough daily summaries recorded yet.</div>
                  )}
                </div>
              </div>

              {/* Symbol specific volume analysis */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-950">Accumulated Paper P&L Per Stock Symbol</h3>
                <div className="h-72">
                  {analytics?.tradesPerSymbol && analytics.tradesPerSymbol.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.tradesPerSymbol}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="symbol" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="pnl" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                          {analytics.tradesPerSymbol.map((entry: any, index: number) => {
                            const isPositive = entry.pnl >= 0;
                            return <Cell key={`cell-${index}`} fill={isPositive ? "#10b981" : "#ef4444"} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400">No trading records found.</div>
                  )}
                </div>
              </div>

            </div>

            {/* Dynamic performance summary lists */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                Intraday Trade Strategy Analytics Summary
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="pb-3">Strategy Name</th>
                      <th className="pb-3">Indicators Selected</th>
                      <th className="pb-3">Executed Trade Count</th>
                      <th className="pb-3">Average Strategy Win Rate</th>
                      <th className="pb-3 text-right">Net Generated Yield P&L</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {analytics?.strategyPerformance?.map((strat: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-4 font-bold text-slate-950">{strat.strategyName}</td>
                        <td className="py-4 text-xs font-mono text-slate-500">EMA 9/21, RSI 14, VWAP Channel</td>
                        <td className="py-4 font-mono font-semibold">{strat.tradesCount}</td>
                        <td className="py-4 font-mono font-bold text-blue-600">{strat.winRate}%</td>
                        <td className={`py-4 text-right font-mono font-extrabold ${strat.totalPnL >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          ₹{strat.totalPnL.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* -------------------- TAB 7: DATABASE MIGRATION GUIDE -------------------- */}
        {activeTab === "migration" && (
          <div className="space-y-6">
            
            {/* SQL commands panel */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-600" />
                    MySQL Database Configuration & Migrations
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Execute these structured MySQL queries to create the schemas, set indexes, and seed default watch symbols locally.
                  </p>
                </div>
                <button
                  onClick={copySchemaToClipboard}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 self-start sm:self-center"
                >
                  <Copy className="w-4 h-4" />
                  {copiedText ? "Copied Script!" : "Copy SQL Script"}
                </button>
              </div>

              {/* Code viewer block */}
              <div className="bg-slate-950 rounded-xl p-4.5 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto relative">
                <div className="absolute top-2.5 right-2.5 px-2 py-1 bg-slate-800 text-slate-400 font-bold rounded text-[9px] uppercase tracking-wider">
                  mysql / mariadb
                </div>
                <pre className="whitespace-pre">{SQL_MIGRATION_SCRIPT}</pre>
              </div>

              {/* Migration explanation checklist */}
              <div className="space-y-3 pt-2 text-xs">
                <h4 className="font-bold text-slate-900 text-sm">Execution & Setup Instructions:</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 space-y-2">
                    <strong className="text-blue-700 font-extrabold text-sm block">1. Prepare Host</strong>
                    <p className="text-slate-600 leading-normal">
                      Ensure MySQL or MariaDB is running locally on port **3306**. Connect via terminal or tools like DBeaver, MySQL Workbench, or phpMyAdmin.
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 space-y-2">
                    <strong className="text-blue-700 font-extrabold text-sm block">2. Pipe SQL Schema</strong>
                    <p className="text-slate-600 leading-normal">
                      Copy the script above and run it in your query terminal. This creates the database `trademind_ai` and the default tables with optimal indices.
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 space-y-2">
                    <strong className="text-blue-700 font-extrabold text-sm block">3. backend/config/db.ts</strong>
                    <p className="text-slate-600 leading-normal">
                      Install `mysql2` and update the database file to load connection pool credentials directly from your `.env` variables.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* 4. Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400 mt-12">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p>
            <strong>TradeMind AI</strong> Paper Trading Intraday Platform — Phase 1 MVP
          </p>
          <p className="text-[10px] text-slate-400">
            For educational backtesting purposes only. No real funds or real trade broker order placements are simulated.
          </p>
        </div>
      </footer>
    </div>
  );
}
