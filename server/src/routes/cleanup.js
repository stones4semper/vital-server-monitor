const express = require('express');
const db = require('../db');

module.exports = function createCleanupRouter(logger) {
	const router = express.Router();

	router.delete('/metrics', async (req, res) => {
		try {
			const maxAge = parseInt(req.query.maxAge) || 30 * 24 * 60 * 60 * 1000;
			const cutoff = new Date(Date.now() - maxAge).toISOString();
			const deleted = await db.cleanup(cutoff);
			logger.info(`Cleaned ${deleted} rows older than ${cutoff}`);
			res.json({ deleted, before: cutoff });
		} catch (err) {
			logger.error('Cleanup failed: ' + err.message);
			res.status(500).json({ error: 'Cleanup failed' });
		}
	});

	return router;
};
