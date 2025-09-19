import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const ErrorBoundary = ({ children }) => {
	const [hasError, setHasError] = useState(false);
	const [error, setError] = useState(null);

	const handleCatchError = useCallback((err) => {
		console.error('UI Error:', err);
		setHasError(true);
		setError(err);
	}, []);

	if (hasError) {
		return (
			<View style={styles.errorContainer}>
				<MaterialIcons name="error-outline" size={64} color="#ff6b6b" />
				<Text style={styles.errorTitle}>Something went wrong</Text>
				<Text style={styles.errorText}>{error?.message || 'Unexpected error'}</Text>
				<TouchableOpacity style={styles.retryButton} onPress={() => setHasError(false)}>
					<Text style={styles.retryButtonText}>Try Again</Text>
				</TouchableOpacity>
			</View>
		);
	}

	return children;
};

const styles = StyleSheet.create({
	errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f5f5f5' },
	errorTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 16, marginBottom: 8, color: '#333' },
	errorText: { fontSize: 16, textAlign: 'center', color: '#666', marginBottom: 24 },
	retryButton: { backgroundColor: '#4CAF50', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
	retryButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});

export default ErrorBoundary;
