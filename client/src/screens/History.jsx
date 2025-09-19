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

	const fetchData = useCallback(async () => {
		if (!metricKey) return;
		setLoading(true);
		setError(null);
		try {
			const networkState = await Network.getNetworkStateAsync();
			if (!networkState.isConnected) throw new Error('No network connection');

			const since = startDate.getTime();
			const until = endDate.getTime();
			const column = metricKeyToColumn(metricKey);

			const res = await fetch(`${API_BASE_URL}/history?since=${since}&until=${until}&limit=1000&column=${column}`);
			if (!res.ok) throw new Error(`Server returned ${res.status}: ${res.statusText}`);
			const data = await res.json();
			setRows(data);
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

	const values = rows ? rows.map((r) => normalizeValueForKey(metricKey, r.value)) : [];
	const labels = rows
		? rows.map((r, i) => {
				const d = new Date(r.timestamp);
				return i % Math.ceil((rows.length || 1) / 6) === 0 ? d.toLocaleString([], getLabelFormat()) : '';
		  })
		: [];

	return (
		<ErrorBoundary>
			<ScrollView
				style={styles.container}
				refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#4CAF50']} tintColor="#4CAF50" />}
			>
				<Text style={styles.title}>{label} - History</Text>

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
										{values[values.length - 1].toFixed(2)}
										{getYAxisSuffix(metricKey)}
									</Text>
								</View>
								<View style={styles.statisticsRow}>
                                    <Text style={styles.statisticsLabel}>Average:</Text>
									<Text style={styles.statisticsValue}>
										{(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)}
										{getYAxisSuffix(metricKey)}
									</Text>
								</View>
								<View style={styles.statisticsRow}>
									<Text style={styles.statisticsLabel}>Maximum:</Text>
									<Text style={styles.statisticsValue}>
										{Math.max(...values).toFixed(2)}
										{getYAxisSuffix(metricKey)}
									</Text>
								</View>
								<View style={styles.statisticsRow}>
									<Text style={styles.statisticsLabel}>Minimum:</Text>
									<Text style={styles.statisticsValue}>
										{Math.min(...values).toFixed(2)}
										{getYAxisSuffix(metricKey)}
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
	errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f5f5f5' },
	errorTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 16, marginBottom: 8, color: '#333' },
	errorText: { fontSize: 16, textAlign: 'center', color: '#666', marginBottom: 24 }
});

export default HistoryScreen;
