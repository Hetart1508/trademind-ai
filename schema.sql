-- ====================================================================
-- TRADEMIND AI PAPER TRADING MVP - MYSQL DATABASE SCHEMA (PHASE 1)
-- ====================================================================

CREATE DATABASE IF NOT EXISTS trademind_ai;
USE trademind_ai;

-- 1. WATCHLIST TABLE
CREATE TABLE IF NOT EXISTS watchlist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. MARKET TICKS TABLE
CREATE TABLE IF NOT EXISTS market_ticks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  price DECIMAL(12, 2) NOT NULL,
  volume INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_symbol_time (symbol, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. STRATEGY SIGNALS TABLE
CREATE TABLE IF NOT EXISTS signals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  signal_type VARCHAR(10) NOT NULL, -- 'BUY', 'SELL', 'HOLD'
  price DECIMAL(12, 2) NOT NULL,
  confidence_score INT NOT NULL,     -- 0 to 100
  reason TEXT NOT NULL,
  strategy_name VARCHAR(100) DEFAULT 'EMA-RSI-VWAP-Intraday',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_symbol_created (symbol, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. PAPER TRADING ENGINE TABLE
CREATE TABLE IF NOT EXISTS paper_trades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  entry_price DECIMAL(12, 2) NOT NULL,
  quantity INT NOT NULL,
  target_price DECIMAL(12, 2) NOT NULL,
  stop_loss_price DECIMAL(12, 2) NOT NULL,
  exit_price DECIMAL(12, 2) DEFAULT NULL,
  pnl DECIMAL(12, 2) DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'CLOSED'
  entry_time TIMESTAMP NOT NULL,
  exit_time TIMESTAMP NULL DEFAULT NULL,
  exit_reason VARCHAR(50) DEFAULT NULL,       -- 'TARGET_HIT', 'STOP_LOSS_HIT', 'MANUAL_EXIT', 'MARKET_CLOSE'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_symbol (symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. RISK REJECTION LOGS TABLE
CREATE TABLE IF NOT EXISTS risk_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. DAILY PERFORMANCE SUMMARY TABLE
CREATE TABLE IF NOT EXISTS daily_summary (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_trades INT DEFAULT 0,
  winning_trades INT DEFAULT 0,
  losing_trades INT DEFAULT 0,
  daily_pnl DECIMAL(12, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ====================================================================
-- SEED INITIAL DATA (DEFAULT WATCHLIST)
-- ====================================================================
INSERT INTO watchlist (symbol) VALUES 
('RELIANCE'),
('TCS'),
('INFY'),
('HDFCBANK'),
('ICICIBANK')
ON DUPLICATE KEY UPDATE symbol=symbol;
