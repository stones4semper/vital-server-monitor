const express = require('express');

module.exports = function createHealthRouter({ getClientCount }) {
	const router = express.Router();
	router.get('/health', (req, res) => {
		res.status(200).json({
			status: 'OK',
			timestamp: new Date().toISOString(),
			clients: getClientCount(),
			memory: process.memoryUsage()
		});
	});
	return router;
};
