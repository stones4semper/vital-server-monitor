const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { DEV, ALLOWED_ORIGINS } = require('./config');
const logger = require('./logger');

function createApp(wssHandle) {
	const app = express();

	app.use(helmet({
		contentSecurityPolicy: false,
		crossOriginEmbedderPolicy: false
	}));

	app.use(
		cors(
			DEV
				? { origin: true, credentials: true }
				: { origin: ALLOWED_ORIGINS, credentials: true }
		)
	);

	app.use(express.json({ limit: '10mb' }));

	app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

	// routes
	const createHealthRouter = require('./routes/health');
	const createHistoryRouter = require('./routes/history');
	const createCleanupRouter = require('./routes/cleanup');

	app.use(createHealthRouter({ getClientCount: wssHandle.getClientCount }));
	app.use(createHistoryRouter());
	app.use(createCleanupRouter(logger));

	// generic error handler
	app.use((err, req, res, next) => {
		logger.error('Unhandled error: ' + err.message);
		res.status(500).json({ error: 'Internal server error' });
	});

	// 404
	app.use((req, res) => {
		res.status(404).json({ error: 'Endpoint not found' });
	});

	return app;
}

module.exports = { createApp };
