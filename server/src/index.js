const http = require('http');
const { PORT } = require('./config');
const logger = require('./logger');
const db = require('./db');
const { attachWebSocket } = require('./ws');

(async () => {
	try {
		await db.init();

		// create a dummy HTTP server for WS attach first (wss needs it)
		const server = http.createServer();

		// attach WS (returns helpers)
		const wssHandle = attachWebSocket(server);

		// create app after we have wss handle (health needs client count)
		const { createApp } = require('./app');
		const app = createApp(wssHandle);

		// connect express app to same HTTP server
		server.on('request', app);

		// start server
		server.listen(PORT, '0.0.0.0', () => {
			logger.info(`Server running on port ${PORT}`);
			logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
		});

		// graceful shutdown
		function shutdown() {
			logger.info('Shutting down...');
			try { wssHandle.closeAll(); } catch (_) {}
			server.close(() => logger.info('HTTP server closed.'));
			db.close().then(() => process.exit(0));
			// force exit if something hangs
			setTimeout(() => process.exit(0), 5000).unref();
		}
		process.on('SIGINT', shutdown);
		process.on('SIGTERM', shutdown);
	} catch (err) {
		logger.error('Fatal init error: ' + err.message);
		process.exit(1);
	}
})();
