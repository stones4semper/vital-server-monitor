// src/screens/HistoryScreen.jsx
import React, { useEffect, useState, useCallback } from 'react';
import {
	View,
	Text,
	Dimensions,
	ActivityIndicator,
	Button,
	Platform,
	ScrollView,
	StyleSheet,
	TouchableOpacity,
	Alert,
	RefreshControl
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Network from 'expo-network';

import ErrorBoundary from '../components/ErrorBoundary';
import { getYAxisSuffix, metricKeyToColumn, normalizeValueForKey } from '../utils/formatters';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000';
const API_BASE_URL = API;

// ---------- helpers ----------
function parseTimestamp(t) {
	if (typeof t === 'number') return t;
	const ms = Date.parse(t);
	return Number.isFinite(ms) ? ms : 0;
}
function extractValue(row, metricKey) {
	// server A: { timestamp, value }
	if (row && typeof row.value !== 'undefined') return row.value;
	// server B: { timestamp, <column>: number }
	const col = metricKeyToColumn(metricKey);
	if (row && typeof row[col] !== 'undefined') return row[col];
	// last resort fallbacks
	if (row && typeof row[metricKey] !== 'undefined') return row[metricKey];
	const lc = (metricKey || '').toLowerCase();
	if (row && typeof row[lc] !== 'undefined') return row[lc];
	return 0;
}
function coerceNumber(n) {
	const v = Number(n);
	return Number.isFinite(v) ? v : 0;
}

const HistoryScreen = ({ route }) => {
	const navigation = useNavigation();
	const { metricKey, label } = route.params || {};
	const [startDate, setStartDate] = useState(new Date(Date.now() - 3600 * 1000));
	const [endDate, setEndDate] = useState(new Date());
	const [showPicker, setShowPicker] = useState({ type: null, show: false });
	const [isRefreshing, setIsRefreshing] = useState(false);

	const [rows, setRows] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);

	// debug
	const [debugInfo, setDebugInfo] = useState({ url: '', sample: [] });

	const fetchData = useCallback(async () => {
		if (!metricKey) return;
		setLoading(true);
		setError(null);

		try {
			// network check (don’t hard-fail on false positives)
			let isConnected = true;
			try {
				const ns = await Network.getNetworkStateAsync();
				isConnected = !!ns.isConnected;
			} catch { /* ignore */ }
			if (!isConnected) console.warn('[History] Network reports offline, attempting fetch anyway');

			const since = startDate.getTime();
			const until = endDate.getTime();
			const column = metricKeyToColumn(metricKey);
			const url = `${API_BASE_URL}/history?since=${since}&until=${until}&limit=1000&column=${column}`;
			setDebugInfo((d) => ({ ...d, url }));

			const res = await fetch(url);
			if (!res.ok) {
				let details = '';
				try { details = JSON.stringify(await res.json()); } catch {}
				throw new Error(`HTTP ${res.status} ${res.statusText}${details ? ` - ${details}` : ''}`);
			}

			const data = await res.json();
			const arr = Array.isArray(data) ? data : [];
			setRows(arr);
			setDebugInfo((d) => ({ ...d, sample: arr.slice(0, 3) }));
			console.log('[History] fetched rows:', arr.length);
		} catch (err) {
			console.error('Error fetching history:', err);
			setError(err.message);
			Alert.alert('Data Load Error', `Failed to load historical data: ${err.message}`, [{ text: 'OK' }]);
		} finally {
			setLoading(false);
		}
	}, [metricKey, startDate, endDate]);

	useEffect(() => { fetchData(); }, [fetchData]);

	const onDateChange = (event, selectedDate) => {
		setShowPicker({ type: null, show: false });
		if (!selectedDate) return;
		if (showPicker.type === 'start') setStartDate(selectedDate);
		if (showPicker.type === 'end') setEndDate(selectedDate);
	};
	const quickSelect = useCallback((hours) => {
		const now = new Date();
		setStartDate(new Date(now.getTime() - hours * 3600 * 1000));
		setEndDate(now);
	}, []);
	const onRefresh = useCallback(() => {
		setIsRefreshing(true);
		fetchData().finally(() => setIsRefreshing(false));
	}, [fetchData]);

	const getLabelFormat = useCallback(() => {
		const rangeHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
		if (rangeHours <= 24) return { hour: '2-digit', minute: '2-digit' };
		return { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
	}, [startDate, endDate]);

	const formatDate = (date) =>
		date.toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

	// ---------- guards ----------
	if (!metricKey || !label) {
		return (
			<View style={styles.errorContainer}>
				<MaterialIcons name="error-outline" size={64} color="#ff6b6b" />
				<Text style={styles.errorTitle}>Invalid parameters</Text>
				<Text style={styles.errorText}>Missing metricKey or label</Text>
				<Button title="Go Back" onPress={() => navigation.goBack()} />
			</View>
		);
	}
	if (loading && !rows) {
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size="large" color="#4CAF50" />
				<Text style={styles.loadingText}>Loading historical data...</Text>
			</View>
		);
	}
	if (error && !rows) {
		return (
			<View style={styles.errorContainer}>
				<MaterialIcons name="error-outline" size={64} color="#ff6b6b" />
				<Text style={styles.errorTitle}>Data Load Failed</Text>
				<Text style={styles.errorText}>{error}</Text>
				<Button title="Retry" onPress={fetchData} />
				<Button title="Go Back" onPress={() => navigation.goBack()} color="#666" />
			</View>
		);
	}

	// ---------- build series (robust) ----------
	let values = rows
		? rows.map((r) => {
			const raw = extractValue(r, metricKey);
			const coerced = coerceNumber(raw);
			return normalizeValueForKey(metricKey, coerced);
		})
		: [];

	let labels = rows
		? rows.map((r, i) => {
			const t = parseTimestamp(r.timestamp);
			const d = new Date(t);
			return i % Math.ceil((rows.length || 1) / 6) === 0 ? d.toLocaleString([], getLabelFormat()) : '';
		})
		: [];

	// Ensure pure numbers (no NaN) & at least 2 points so ChartKit draws a line
	values = values.map((v) => (Number.isFinite(v) ? v : 0));
	if (values.length === 1) {
		values = [values[0], values[0]];
		labels = [labels[0] || '', labels[0] || ''];
	}

	return (
		<ErrorBoundary>
			<ScrollView
				style={styles.container}
				refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#4CAF50']} tintColor="#4CAF50" />}
			>
				<Text style={styles.title}>{label} - History</Text>

				{/* Debug card (helps verify server response) */}
				{/* {Boolean(debugInfo.url) && (
					<View style={styles.debugCard}>
						<Text style={styles.debugTitle}>Debug</Text>
						<Text selectable style={styles.debugMono}>GET {debugInfo.url}</Text>
						<Text style={styles.debugMono}>
							rows={rows ? rows.length : 0} sample={JSON.stringify(debugInfo.sample)}
						</Text>
					</View>
				)} */}

				{(metricKey || '').toLowerCase().startsWith('cpucore') && (
					<Text style={{ textAlign: 'center', color: '#888', marginBottom: 8 }}>
						Showing overall CPU load (per-core history not stored).
					</Text>
				)}

				<View style={styles.quickSelectContainer}>
					<TouchableOpacity style={styles.quickSelectButton} onPress={() => quickSelect(1)}>
						<Text style={styles.quickSelectText}>Last 1h</Text>
					</TouchableOpacity>
					<TouchableOpacity style={styles.quickSelectButton} onPress={() => quickSelect(24)}>
						<Text style={styles.quickSelectText}>Last 24h</Text>
					</TouchableOpacity>
					<TouchableOpacity style={styles.quickSelectButton} onPress={() => quickSelect(24 * 7)}>
						<Text style={styles.quickSelectText}>Last 7d</Text>
					</TouchableOpacity>
				</View>

				<View style={styles.datePickerContainer}>
					<TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker({ type: 'start', show: true })}>
						<MaterialIcons name="calendar-today" size={20} color="#4CAF50" />
						<Text style={styles.dateButtonText}>Start: {formatDate(startDate)}</Text>
					</TouchableOpacity>
					<TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker({ type: 'end', show: true })}>
						<MaterialIcons name="calendar-today" size={20} color="#4CAF50" />
						<Text style={styles.dateButtonText}>End: {formatDate(endDate)}</Text>
					</TouchableOpacity>
				</View>

				{showPicker.show && (
					<DateTimePicker
						value={showPicker.type === 'start' ? startDate : endDate}
						mode="datetime"
						display={Platform.OS === 'ios' ? 'spinner' : 'default'}
						onChange={onDateChange}
						maximumDate={new Date()}
						minimumDate={new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)}
					/>
				)}

				{rows && rows.length > 0 ? (
					<>
						<View style={styles.statsContainer}>
							<Text style={styles.statsText}>Data points: {rows.length}</Text>
							<Text style={styles.statsText}>
								Time range: {formatDate(startDate)} to {formatDate(endDate)}
							</Text>
						</View>

						<LineChart
							data={{ labels, datasets: [{ data: values }] }}
							width={Dimensions.get('window').width - 32}
							height={220}
							yAxisSuffix={getYAxisSuffix(metricKey)}
							chartConfig={{
								backgroundColor: '#1E2923',
								backgroundGradientFrom: '#08130D',
								backgroundGradientTo: '#1F4037',
								decimalPlaces: 2,
								color: (opacity = 1) => `rgba(26, 255, 146, ${opacity})`,
								labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
								propsForDots: { r: '2', strokeWidth: '1', stroke: '#ffa726' }
							}}
							bezier
							style={styles.chart}
						/>

						{values.length > 0 && (
							<View style={styles.statisticsContainer}>
								<Text style={styles.statisticsTitle}>Statistics</Text>
								<View style={styles.statisticsRow}>
									<Text style={styles.statisticsLabel}>Current:</Text>
									<Text style={styles.statisticsValue}>
										{values[values.length - 1].toFixed(2)}{getYAxisSuffix(metricKey)}
									</Text>
								</View>
								<View style={styles.statisticsRow}>
									<Text style={styles.statisticsLabel}>Average:</Text>
									<Text style={styles.statisticsValue}>
										{(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)}{getYAxisSuffix(metricKey)}
									</Text>
								</View>
								<View style={styles.statisticsRow}>
									<Text style={styles.statisticsLabel}>Maximum:</Text>
									<Text style={styles.statisticsValue}>
										{Math.max(...values).toFixed(2)}{getYAxisSuffix(metricKey)}
									</Text>
								</View>
								<View style={styles.statisticsRow}>
									<Text style={styles.statisticsLabel}>Minimum:</Text>
									<Text style={styles.statisticsValue}>
										{Math.min(...values).toFixed(2)}{getYAxisSuffix(metricKey)}
									</Text>
								</View>
							</View>
						)}
					</>
				) : (
					<View style={styles.noDataContainer}>
						<MaterialIcons name="history" size={64} color="#ccc" />
						<Text style={styles.noDataText}>No historical data available</Text>
						<Text style={styles.noDataSubtext}>Try selecting a different time range</Text>
					</View>
				)}
			</ScrollView>
		</ErrorBoundary>
	);
};

const styles = StyleSheet.create({
	container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
	loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
	loadingText: { marginTop: 16, fontSize: 16, color: '#333' },
	title: { fontWeight: 'bold', fontSize: 18, marginBottom: 16, color: '#333', textAlign: 'center' },

	quickSelectContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
	quickSelectButton: { flex: 1, marginHorizontal: 4, padding: 10, backgroundColor: '#4CAF50', borderRadius: 8, alignItems: 'center' },
	quickSelectText: { color: 'white', fontWeight: 'bold' },

	datePickerContainer: { marginBottom: 16 },
	dateButton: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 12,
		backgroundColor: 'white',
		borderRadius: 8,
		marginBottom: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.2,
		shadowRadius: 1,
		elevation: 2
	},
	dateButtonText: { marginLeft: 8, fontSize: 14, color: '#333' },

	chart: { borderRadius: 8, marginBottom: 16 },
	statsContainer: {
		backgroundColor: 'white',
		padding: 12,
		borderRadius: 8,
		marginBottom: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.2,
		shadowRadius: 1,
		elevation: 2
	},
	statsText: { fontSize: 12, color: '#666', marginBottom: 4 },

	statisticsContainer: {
		backgroundColor: 'white',
		padding: 16,
		borderRadius: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.2,
		shadowRadius: 1,
		elevation: 2
	},
	statisticsTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: '#333' },
	statisticsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
	statisticsLabel: { fontSize: 14, color: '#666' },
	statisticsValue: { fontSize: 14, fontWeight: '500', color: '#333' },

	noDataContainer: { alignItems: 'center', justifyContent: 'center', padding: 40 },
	noDataText: { fontSize: 18, fontWeight: 'bold', color: '#666', marginTop: 16, marginBottom: 8 },
	noDataSubtext: { fontSize: 14, color: '#999', textAlign: 'center' },

	// debug styles
	debugCard: {
		backgroundColor: '#0b1020',
		padding: 12,
		borderRadius: 8,
		marginBottom: 12
	},
	debugTitle: { color: '#9ad6ff', fontWeight: '700', marginBottom: 6 },
	debugMono: { color: '#d8e6f2', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 12 }
});

export default HistoryScreen;
