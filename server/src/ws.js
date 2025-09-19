const WebSocket = require('ws');
const logger = require('./logger');
const { sampleMetrics } = require('./metrics');
const db = require('./db');

const clients = new Map();

function attachWebSocket(httpServer) {
	const wss = new WebSocket.Server({
		server: httpServer,
		perMessageDeflate: {
			zlibDeflateOptions: { chunkSize: 1024, memLevel: 7, level: 3 },
			zlibInflateOptions: { chunkSize: 10 * 1024 },
			clientNoContextTakeover: true,
			serverNoContextTakeover: true,
			serverMaxWindowBits: 10,
			concurrencyLimit: 10,
			threshold: 1024
		}
	});

	wss.on('connection', (ws, req) => {
		const clientId = Date.now() + Math.random().toString(36).slice(2, 9);
		logger.info(`WS client connected: ${clientId}`);

		const url = new URL(req.url, `http://${req.headers.host}`);
		const intervalMs = Math.max(500, Math.min(parseInt(url.searchParams.get('interval')) || 1000, 10000));

		clients.set(ws, { id: clientId, interval: null });

		const tick = async () => {
			if (ws.readyState !== WebSocket.OPEN) {
				const c = clients.get(ws);
				if (c?.interval) clearInterval(c.interval);
				clients.delete(ws);
				return;
			}
			try {
				const { dto, persist } = await sampleMetrics();

				ws.send(JSON.stringify({
					type: 'metrics',
					version: 1,
					timestamp: Date.now(),
					data: dto
				}));

				await db.insertMetrics({
					...persist,
					full_data: dto
				});
			} catch (err) {
				logger.error('WS tick error: ' + err.message);
				try {
					ws.send(JSON.stringify({ type: 'error', message: 'Failed to retrieve system metrics' }));
				} catch (_) {}
			}
		};

		const intervalId = setInterval(tick, intervalMs);
		clients.get(ws).interval = intervalId;
		tick();

		ws.on('close', () => {
			logger.info(`WS client disconnected: ${clientId}`);
			clearInterval(clients.get(ws)?.interval);
			clients.delete(ws);
		});

		ws.on('error', (error) => {
			logger.error(`WS client error ${clientId}: ${error.message}`);
			clearInterval(clients.get(ws)?.interval);
			clients.delete(ws);
		});
	});

	return {
		server: wss,
		closeAll: () => {
			clients.forEach((c, ws) => {
				clearInterval(c.interval);
				try { ws.close(); } catch(_) {}
			});
			wss.close(() => logger.info('WS server closed.'));
		},
		getClientCount: () => clients.size
	};
}

module.exports = { attachWebSocket };
