-- Power Loss Calculator v1.2.0 Database Schema

CREATE TABLE IF NOT EXISTS device_library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    manufacturer TEXT DEFAULT '',
    device_type TEXT NOT NULL CHECK(device_type IN ('igbt_module','ipm_module','igbt_discrete','sic_module','sic_discrete')),
    config_json TEXT NOT NULL,
    vdc_rated REAL DEFAULT 0,
    ic_rated REAL DEFAULT 0,
    is_builtin INTEGER DEFAULT 0,
    source TEXT DEFAULT 'manual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calculation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER REFERENCES device_library(id) ON DELETE SET NULL,
    device_name TEXT DEFAULT '',
    device_type TEXT DEFAULT '',
    config_json TEXT NOT NULL DEFAULT '{}',
    conditions_json TEXT NOT NULL,
    result_json TEXT NOT NULL,
    calculation_time_ms REAL DEFAULT 0,
    converged INTEGER DEFAULT 1,
    t_j_max REAL DEFAULT 0,
    p_total_loss REAL DEFAULT 0,
    efficiency REAL DEFAULT 0,
    trust_score INTEGER CHECK(trust_score BETWEEN 1 AND 5),
    notes TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comparison_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT DEFAULT '',
    device_ids TEXT NOT NULL,
    calc_ids TEXT NOT NULL,
    analysis_json TEXT NOT NULL,
    anomalies_json TEXT DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS datasheet_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_hash TEXT UNIQUE NOT NULL,
    file_name TEXT DEFAULT '',
    device_type TEXT DEFAULT '',
    extracted_json TEXT NOT NULL,
    confidence_json TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS knowledge_base (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER REFERENCES device_library(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    original_value TEXT DEFAULT '',
    corrected_value TEXT DEFAULT '',
    correction_source TEXT DEFAULT 'manual',
    verified_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_history_device ON calculation_history(device_id);
CREATE INDEX IF NOT EXISTS idx_history_created ON calculation_history(created_at);
CREATE INDEX IF NOT EXISTS idx_devices_type ON device_library(device_type);
CREATE INDEX IF NOT EXISTS idx_devices_builtin ON device_library(is_builtin);
CREATE INDEX IF NOT EXISTS idx_cache_hash ON datasheet_cache(file_hash);
