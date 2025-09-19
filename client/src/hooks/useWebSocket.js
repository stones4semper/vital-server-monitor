import { useCallback, useEffect, useRef, useState } from 'react';

// Stable WebSocket hook (prevents reconnect loops)
export default function useWebSocket(url, onMessage, onError) {
	const wsRef = useRef(null);
	const reconnectTimeoutRef = useRef(null);
	const onMessageRef = useRef(onMessage);
	const onErrorRef = useRef(onError);
	const [isConnected, setIsConnected] = useState(false);

	useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
	useEffect(() => { onErrorRef.current = onError; }, [onError]);

	const connect = useCallback(() => {
		try {
			if (wsRef.current?.readyState === WebSocket.OPEN) return;

			const ws = new WebSocket(url);
			wsRef.current = ws;

			ws.onopen = () => {
				setIsConnected(true);
				if (reconnectTimeoutRef.current) {
					clearTimeout(reconnectTimeoutRef.current);
					reconnectTimeoutRef.current = null;
				}
			};

			ws.onmessage = (event) => {
				try {
					const message = JSON.parse(event.data);
					onMessageRef.current && onMessageRef.current(message);
				} catch (err) {
					console.error('WS parse error:', err);
				}
			};

			ws.onerror = (err) => {
				setIsConnected(false);
				onErrorRef.current && onErrorRef.current(err);
			};

			ws.onclose = () => {
				setIsConnected(false);
				if (!reconnectTimeoutRef.current) {
					reconnectTimeoutRef.current = setTimeout(() => {
						reconnectTimeoutRef.current = null;
						connect();
					}, 3000);
				}
			};
		} catch (err) {
			onErrorRef.current && onErrorRef.current(err);
		}
	}, [url]);

	const disconnect = useCallback(() => {
		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current);
			reconnectTimeoutRef.current = null;
		}
		if (wsRef.current) {
			try { wsRef.current.close(); } catch (_) {}
			wsRef.current = null;
		}
		setIsConnected(false);
	}, []);

	useEffect(() => () => disconnect(), [disconnect]);

	return { connect, disconnect, isConnected };
}
