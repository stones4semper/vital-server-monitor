import React from 'react';
import { View, Text, TouchableOpacity, Dimensions, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { MaterialIcons } from '@expo/vector-icons';

const ChartCard = ({ label, data, metricKey, onPress, ySuffix }) => {
	return (
		<TouchableOpacity onPress={onPress} activeOpacity={0.7}>
			<View style={styles.chartContainer}>
				<Text style={styles.chartTitle}>{label}</Text>
				{data && data.length > 0 ? (
					<LineChart
						data={{ labels: Array(data.length).fill(''), datasets: [{ data }] }}
						width={Dimensions.get('window').width - 32}
						height={200}
						yAxisSuffix={ySuffix}
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
				) : (
					<View style={styles.noDataContainer}>
						<MaterialIcons name="show-chart" size={32} color="#666" />
						<Text style={styles.noDataText}>No data available</Text>
					</View>
				)}
			</View>
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	chartContainer: {
		marginBottom: 24,
		backgroundColor: 'white',
		borderRadius: 8,
		padding: 12,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.2,
		shadowRadius: 1,
		elevation: 2,
	},
	chartTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 8, color: '#333' },
	chart: { borderRadius: 8 },
	noDataContainer: { height: 200, justifyContent: 'center', alignItems: 'center' },
	noDataText: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 },
});

export default ChartCard;
