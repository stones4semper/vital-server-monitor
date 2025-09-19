const express = require('express');
const db = require('../db');

const ALLOWED_COLUMNS = [
	'cpu_load',
	'cpu_temp',
	'mem_usage',
	'gpu_temp',
	'gpu_load',
	'fan_speed',
	'net_rx',
	'net_tx',
	'disk_usage',
	'disk_read',
	'disk_write'
];

module.exports = function createHistoryRouter() {
	const router = express.Router();

	router.get('/history', async (req, res) => {
		try {
			const sinceMs = Math.max(0, parseInt(req.query.since) || Date.now() - 3600000);
			const untilMs = Math.min(Date.now(), parseInt(req.query.until) || Date.now());
			const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 500, 2000));
			const column = (req.query.column || 'cpu_load').toLowerCase();

			if (!ALLOWED_COLUMNS.includes(column)) {
				return res.status(400).json({ error: 'Invalid column parameter', allowedColumns: ALLOWED_COLUMNS });
			}

			const rows = await db.history({ sinceMs, untilMs, limit, column });
			res.json(rows);
		} catch (err) {
			res.status(500).json({ error: 'Database query failed' });
		}
	});

	return router;
};
