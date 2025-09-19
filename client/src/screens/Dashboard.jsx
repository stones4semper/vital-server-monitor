import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ScrollView, Text, View, ActivityIndicator, StyleSheet, Alert, RefreshControl, AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import useWebSocket from '../hooks/useWebSocket';
import ErrorBoundary from '../components/ErrorBoundary';
import ChartCard from '../components/ChartCard';
import ConnectionStatus from '../components/ConnectionStatus';
import { thresholds, getYAxisSuffix } from '../utils/formatters';

// URLs
const API = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000';
const WS = process.env.EXPO_PUBLIC_WS_URL || API.replace(/^http/, 'ws');
const WS_URL = WS;

const Dashboard = () => {
	const navigation = useNavigation();
	const [metrics, setMetrics] = useState(null);
	const [history, setHistory] = useState({});
	const [alerts, setAlerts] = useState([]);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [connectionStatus, setConnectionStatus] = useState('connecting');
	const [lastUpdate, setLastUpdate] = useState(null);
	const appState = useRef(AppState.currentState);

	const handleWebSocketError = useCallback((error) => {
		console.error('WebSocket error:', error);
		setConnectionStatus('error');
		Alert.alert('Connection Error', 'Unable to connect to the monitoring server. Please check your connection and try again.', [
			{ text: 'OK' }
		]);
	}, []);

	const handleWebSocketMessage = useCallback((msg) => {
		if (msg.type !== 'metrics') return;

		const d = msg.data;
		setMetrics(d);
		setConnectionStatus('connected');
		setLastUpdate(new Date());

		setHistory((prev) => {
			const h = { ...prev };
			const newAlerts = [];

			// CPU
			if (d.cpu?.perCore) {
				d.cpu.perCore.forEach((core) => {
					const key = `cpuCore${core.core}Load`;
					const val = Number(core.loadPercent) || 0;
					h[key] = [...(h[key] || []).slice(-29), val];
					if (val > thresholds.cpuLoad) newAlerts.push(`CPU Core ${core.core} high load: ${val}%`);
				});
			}

			// GPU
			if (d.gpus) {
				d.gpus.forEach((gpu, idx) => {
					const key = `gpu${idx}Temp`;
					const val = Number(gpu.temperature) || 0;
					h[key] = [...(h[key] || []).slice(-29), val];
					if (val > thresholds.gpuTemp) newAlerts.push(`GPU ${idx} high temp: ${val}°C`);
				});
			}

			// Memory
			if (d.memory) {
				const memVal = Number(d.memory.usagePercent) || 0;
				h.memUsage = [...(h.memUsage || []).slice(-29), memVal];
				if (memVal > thresholds.memUsage) newAlerts.push(`Memory usage high: ${memVal}%`);
			}

			// Fan
			const fanVal = Number(d.sensors?.fans?.[0]?.rpm || 0);
			h.fanSpeed = [...(h.fanSpeed || []).slice(-29), fanVal];
			if (fanVal > 0 && fanVal < thresholds.fanSpeed) newAlerts.push(`Fan speed low: ${fanVal} RPM`);

			// Network (bytes/s -> MB/s)
			if (d.network?.[0]) {
				const rxVal = (Number(d.network[0].rxSec) || 0) / 1024 / 1024;
				const txVal = (Number(d.network[0].txSec) || 0) / 1024 / 1024;
				h.netRx = [...(h.netRx || []).slice(-29), rxVal];
				h.netTx = [...(h.netTx || []).slice(-29), txVal];
				if (rxVal > thresholds.netRx) newAlerts.push(`High download speed: ${rxVal.toFixed(2)} MB/s`);
				if (txVal > thresholds.netTx) newAlerts.push(`High upload speed: ${txVal.toFixed(2)} MB/s`);
			}

			// Disk (bytes/s -> MB/s)
			if (d.storage) {
				const diskUseVal = Number(d.storage.filesystems?.[0]?.use) || 0;
				const diskReadVal = (Number(d.storage.io?.readBytes) || 0) / 1024 / 1024;
				const diskWriteVal = (Number(d.storage.io?.writeBytes) || 0) / 1024 / 1024;

				h.diskUsage = [...(h.diskUsage || []).slice(-29), diskUseVal];
				h.diskReadMBps = [...(h.diskReadMBps || []).slice(-29), diskReadVal];
				h.diskWriteMBps = [...(h.diskWriteMBps || []).slice(-29), diskWriteVal];

				if (diskUseVal > thresholds.diskUsage) newAlerts.push(`Disk usage high: ${diskUseVal}%`);
				if (diskReadVal > thresholds.diskReadMBps) newAlerts.push(`High disk read: ${diskReadVal.toFixed(2)} MB/s`);
				if (diskWriteVal > thresholds.diskWriteMBps) newAlerts.push(`High disk write: ${diskWriteVal.toFixed(2)} MB/s`);
			}

			setAlerts(newAlerts);
			return h;
		});
	}, []);

	const { connect, disconnect } = useWebSocket(`${WS_URL}/stream?interval=1000`, handleWebSocketMessage, handleWebSocketError);

	// connect once on mount
	useEffect(() => {
		connect();
		return () => disconnect();
	}, [connect, disconnect]);

	// pause/resume on app state
	useEffect(() => {
		const sub = AppState.addEventListener('change', (next) => {
			if (appState.current.match(/inactive|background/) && next === 'active') {
				connect();
			} else if (next.match(/inactive|background/)) {
				disconnect();
			}
			appState.current = next;
		});
		return () => sub.remove();
	}, [connect, disconnect]);

	const onRefresh = useCallback(() => {
		setIsRefreshing(true);
		disconnect();
		setTimeout(() => {
			connect();
			setIsRefreshing(false);
		}, 800);
	}, [connect, disconnect]);

	if (!metrics && connectionStatus === 'connecting') {
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size="large" color="#4CAF50" />
				<Text style={styles.loadingText}>Connecting to monitoring server...</Text>
				<ConnectionStatus status={connectionStatus} lastUpdate={lastUpdate} />
			</View>
		);
	}

	return (
		<SafeAreaView style={{flex: 1}} edges={['right', 'left']}>
			<ErrorBoundary>
				<ScrollView
					style={styles.container}
					contentContainerStyle={{ flexGrow: 1 }}
					scrollIndicatorInsets={{ right: 30 }}
					contentInsetAdjustmentBehavior="automatic"
					refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#4CAF50']} tintColor="#4CAF50" />}
				>
					<ConnectionStatus status={connectionStatus} lastUpdate={lastUpdate} />

					{alerts.length > 0 && (
						<View style={styles.alertContainer}>
							<MaterialIcons name="warning" size={20} color="white" />
							<View style={{ flex: 1 }}>
								{alerts.map((a, i) => (
									<Text key={i} style={styles.alertText}>{a}</Text>
								))}
							</View>
						</View>
					)}

					<Text style={styles.sectionTitle}>CPU Info</Text>
					{metrics?.cpu?.info ? (
						<>
							<Text style={styles.infoText}>
								{metrics.cpu.info.brand} — {metrics.cpu.info.cores} cores
								{metrics.cpu.info.physicalCores ? ` (${metrics.cpu.info.physicalCores} physical)` : ''}
							</Text>
							{metrics.cpu.perCore?.map((core) => (
								<ChartCard
									key={`cpu-${core.core}`}
									label={`CPU Core ${core.core} Load %`}
									data={history[`cpuCore${core.core}Load`] || []}
									metricKey={`cpuCore${core.core}Load`}
									onPress={() => navigation.navigate('History', { metricKey: `cpuCore${core.core}Load`, label: `CPU Core ${core.core} Load %` })}
									ySuffix={getYAxisSuffix('load')}
								/>
							))}
						</>
					) : (
						<Text style={styles.noDataText}>No CPU data available</Text>
					)}

					<Text style={styles.sectionTitle}>GPUs</Text>
					{metrics?.gpus?.length > 0 ? (
						metrics.gpus.map((gpu, idx) => (
							<View key={idx} style={{ marginBottom: 16 }}>
								<Text style={styles.infoText}>
									{gpu.model} ({gpu.vendor}) — {gpu.vramTotalMB} MB VRAM
								</Text>
								<ChartCard
									label={`GPU ${idx} Temp °C`}
									data={history[`gpu${idx}Temp`] || []}
									metricKey={`gpu${idx}Temp`}
									onPress={() => navigation.navigate('History', { metricKey: `gpu${idx}Temp`, label: `GPU ${idx} Temp °C` })}
									ySuffix={getYAxisSuffix('temp')}
								/>
							</View>
						))
					) : (
						<Text style={styles.noDataText}>No GPU data available</Text>
					)}

					<Text style={styles.sectionTitle}>Memory</Text>
					<ChartCard
						label="Memory Usage (%)"
						data={history.memUsage || []}
						metricKey="memUsage"
						onPress={() => navigation.navigate('History', { metricKey: 'memUsage', label: 'Memory Usage (%)' })}
						ySuffix={getYAxisSuffix('memUsage')}
					/>

					<Text style={styles.sectionTitle}>Cooling</Text>
					<ChartCard
						label="Fan Speed (RPM)"
						data={history.fanSpeed || []}
						metricKey="fanSpeed"
						onPress={() => navigation.navigate('History', { metricKey: 'fanSpeed', label: 'Fan Speed (RPM)' })}
						ySuffix={getYAxisSuffix('fanSpeed')}
					/>

					<Text style={styles.sectionTitle}>Network</Text>
					<ChartCard
						label="Download Speed (MB/s)"
						data={history.netRx || []}
						metricKey="netRx"
						onPress={() => navigation.navigate('History', { metricKey: 'netRx', label: 'Download Speed (MB/s)' })}
						ySuffix={getYAxisSuffix('netRx')}
					/>
					<ChartCard
						label="Upload Speed (MB/s)"
						data={history.netTx || []}
						metricKey="netTx"
						onPress={() => navigation.navigate('History', { metricKey: 'netTx', label: 'Upload Speed (MB/s)' })}
						ySuffix={getYAxisSuffix('netTx')}
					/>

					<Text style={styles.sectionTitle}>Storage</Text>
					<ChartCard
						label="Disk Usage (%)"
						data={history.diskUsage || []}
						metricKey="diskUsage"
						onPress={() => navigation.navigate('History', { metricKey: 'diskUsage', label: 'Disk Usage (%)' })}
						ySuffix={getYAxisSuffix('diskUsage')}
					/>
					<ChartCard
						label="Disk Read Speed (MB/s)"
						data={history.diskReadMBps || []}
						metricKey="diskReadMBps"
						onPress={() => navigation.navigate('History', { metricKey: 'diskReadMBps', label: 'Disk Read Speed (MB/s)' })}
						ySuffix={getYAxisSuffix('diskRead')}
					/>
					<ChartCard
						label="Disk Write Speed (MB/s)"
						data={history.diskWriteMBps || []}
						metricKey="diskWriteMBps"
						onPress={() => navigation.navigate('History', { metricKey: 'diskWriteMBps', label: 'Disk Write Speed (MB/s)' })}
						ySuffix={getYAxisSuffix('diskWrite')}
					/>
				</ScrollView>
			</ErrorBoundary>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
	loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
	loadingText: { marginTop: 16, fontSize: 16, color: '#333' },
	sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#333' },
	infoText: { fontSize: 14, color: '#666', marginBottom: 12 },
	alertContainer: {
		flexDirection: 'row',
		backgroundColor: '#F44336',
		padding: 12,
		borderRadius: 8,
		marginBottom: 16,
		alignItems: 'center'
	},
	alertText: { color: 'white', fontWeight: 'bold' },
	noDataText: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 }
});

export default Dashboard;
