const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { DATA_DIR } = require('./config');
const logger = require('./logger');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let db;

function init() {
	return new Promise((resolve, reject) => {
		db = new sqlite3.Database(path.join(DATA_DIR, 'metrics.db'), (err) => {
			if (err) {
				logger.error('Error opening DB: ' + err.message);
				return reject(err);
			}
			logger.info('Connected to SQLite.');
			db.serialize(() => {
				db.run(
					`CREATE TABLE IF NOT EXISTS metrics (
						id INTEGER PRIMARY KEY AUTOINCREMENT,
						timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
						cpu_load REAL,
						cpu_temp REAL,
						mem_usage REAL,
						gpu_temp REAL,
						gpu_load REAL,
						fan_speed REAL,
						net_rx REAL,     -- bytes/s
						net_tx REAL,     -- bytes/s
						disk_usage REAL, -- %
						disk_read REAL,  -- bytes/s
						disk_write REAL, -- bytes/s
						full_data TEXT
					)`
				);
				db.run('CREATE INDEX IF NOT EXISTS idx_timestamp ON metrics(timestamp)');
				db.run('CREATE INDEX IF NOT EXISTS idx_cpu_load ON metrics(cpu_load)');
				db.run('CREATE INDEX IF NOT EXISTS idx_mem_usage ON metrics(mem_usage)');
				resolve();
			});
		});
	});
}

function insertMetrics(payload) {
	return new Promise((resolve, reject) => {
		const stmt = db.prepare(
			`INSERT INTO metrics (
				cpu_load, cpu_temp, mem_usage, gpu_temp, gpu_load,
				fan_speed, net_rx, net_tx, disk_usage, disk_read, disk_write, full_data
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		);
		stmt.run(
			payload.cpu_load,
			payload.cpu_temp,
			payload.mem_usage,
			payload.gpu_temp,
			payload.gpu_load,
			payload.fan_speed,
			payload.net_rx,
			payload.net_tx,
			payload.disk_usage,
			payload.disk_read,
			payload.disk_write,
			JSON.stringify(payload.full_data || {}),
			(err) => {
				if (err) {
					logger.error('DB insert error: ' + err.message);
					reject(err);
				} else {
					resolve();
				}
			}
		);
		stmt.finalize();
	});
}

function history({ sinceMs, untilMs, limit, column }) {
	return new Promise((resolve, reject) => {
		db.all(
			`SELECT strftime('%s', timestamp) as ts_sec, ${column} as value
			 FROM metrics
			 WHERE timestamp BETWEEN datetime(?, 'unixepoch') AND datetime(?, 'unixepoch')
			 ORDER BY timestamp ASC
			 LIMIT ?`,
			[sinceMs / 1000, untilMs / 1000, limit],
			(err, rows) => {
				if (err) {
					logger.error('DB query error: ' + err.message);
					return reject(err);
				}
				resolve(
					rows.map(r => ({
						timestamp: Number(r.ts_sec) * 1000,
						value: Number(r.value ?? 0)
					}))
				);
			}
		);
	});
}

function cleanup(beforeISO) {
	return new Promise((resolve, reject) => {
		db.run('DELETE FROM metrics WHERE timestamp < ?', [beforeISO], function (err) {
			if (err) {
				logger.error('Cleanup error: ' + err.message);
				return reject(err);
			}
			resolve(this.changes);
		});
	});
}

function close() {
	return new Promise((resolve) => {
		if (!db) return resolve();
		db.close((err) => {
			if (err) logger.error('DB close error: ' + err.message);
			else logger.info('DB closed.');
			resolve();
		});
	});
}

module.exports = { init, insertMetrics, history, cleanup, close };
