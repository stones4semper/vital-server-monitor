import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const ConnectionStatus = ({ status, lastUpdate }) => {
	let statusText = 'Connecting...';
	let statusColor = '#FF9800';
	let iconName = 'wifi';

	if (status === 'connected') {
		statusText = 'Connected';
		statusColor = '#4CAF50';
		iconName = 'wifi';
	} else if (status === 'error') {
		statusText = 'Connection Error';
		statusColor = '#F44336';
		iconName = 'wifi-off';
	}

	return (
		<View style={styles.statusContainer}>
			<MaterialIcons name={iconName} size={16} color={statusColor} />
			<Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
			{lastUpdate && <Text style={styles.lastUpdateText}>Last update: {lastUpdate.toLocaleTimeString()}</Text>}
		</View>
	);
};

const styles = StyleSheet.create({
	statusContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 16,
		padding: 8,
		backgroundColor: 'white',
		borderRadius: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.2,
		shadowRadius: 1,
		elevation: 2,
	},
	statusText: { marginLeft: 8, fontSize: 14, fontWeight: '500' },
	lastUpdateText: { marginLeft: 'auto', fontSize: 12, color: '#666' },
});

export default ConnectionStatus;
