my expo app
Dashboard.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  ScrollView, 
  Text, 
  Dimensions, 
  View, 
  TouchableOpacity, 
  ActivityIndicator,
  StyleSheet,
  Alert,
  RefreshControl,
  AppState
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';

// Environment configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:3000';

// Thresholds for alerts
const thresholds = {
  cpuLoad: 90, // %
  gpuTemp: 85, // °C
  memUsage: 90, // %
  fanSpeed: 500, // RPM (min)
  netRx: 100, // MB/s
  netTx: 100, // MB/s
  diskUsage: 95, // %
  diskReadMBps: 500, // MB/s
  diskWriteMBps: 500 // MB/s
};

// Error boundary component using hooks
const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState(null);

  const handleCatchError = useCallback((error, errorInfo) => {
    console.error('Dashboard Error:', error, errorInfo);
    setHasError(true);
    setError(error);
  }, []);

  if (hasError) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={64} color="#ff6b6b" />
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>
          {error?.message || 'An unexpected error occurred'}
        </Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => setHasError(false)}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return children;
};

// Custom hook for WebSocket connection
const useWebSocket = (url, onMessage, onError) => {
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return;
      }

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          onMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError(error);
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        
        // Attempt to reconnect after a delay
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 3000);
        }
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      onError(error);
    }
  }, [url, onMessage, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return { connect, disconnect, isConnected };
};

// Main Dashboard component
const Dashboard = () => {
  const navigation = useNavigation();
  const [metrics, setMetrics] = useState(null);
  const [history, setHistory] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [lastUpdate, setLastUpdate] = useState(null);
  const appState = useRef(AppState.currentState);

  // WebSocket error handler
  const handleWebSocketError = useCallback((error) => {
    console.error('WebSocket error:', error);
    setConnectionStatus('error');
    Alert.alert(
      'Connection Error',
      'Unable to connect to the monitoring server. Please check your connection and try again.',
      [{ text: 'OK', onPress: () => {} }]
    );
  }, []);

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((msg) => {
    if (msg.type === 'metrics') {
      setMetrics(msg.data);
      setConnectionStatus('connected');
      setLastUpdate(new Date());
      
      const newHistory = { ...history };
      const newAlerts = [];

      try {
        // CPU cores
        if (msg.data.cpu?.perCore) {
          msg.data.cpu.perCore.forEach((core) => {
            const key = `cpuCore${core.core}Load`;
            const val = parseFloat(core.loadPercent);
            newHistory[key] = [...(newHistory[key] || []).slice(-29), val];
            if (val > thresholds.cpuLoad) {
              newAlerts.push(`CPU Core ${core.core} high load: ${val}%`);
            }
          });
        }

        // GPUs
        if (msg.data.gpus) {
          msg.data.gpus.forEach((gpu, idx) => {
            const key = `gpu${idx}Temp`;
            const val = gpu.temperature ?? 0;
            newHistory[key] = [...(newHistory[key] || []).slice(-29), val];
            if (val > thresholds.gpuTemp) {
              newAlerts.push(`GPU ${idx} high temp: ${val}°C`);
            }
          });
        }

        // Memory
        if (msg.data.memory) {
          const memVal = parseFloat(msg.data.memory.usagePercent) || 0;
          newHistory.memUsage = [...(newHistory.memUsage || []).slice(-29), memVal];
          if (memVal > thresholds.memUsage) {
            newAlerts.push(`Memory usage high: ${memVal}%`);
          }
        }

        // Fan speed
        if (msg.data.sensors?.fans) {
          const fanVal = msg.data.sensors.fans[0]?.rpm || 0;
          newHistory.fanSpeed = [...(newHistory.fanSpeed || []).slice(-29), fanVal];
          if (fanVal > 0 && fanVal < thresholds.fanSpeed) {
            newAlerts.push(`Fan speed low: ${fanVal} RPM`);
          }
        }

        // Network
        if (msg.data.network?.[0]) {
          const rxVal = msg.data.network[0].rxSec ? msg.data.network[0].rxSec / 1024 / 1024 : 0;
          const txVal = msg.data.network[0].txSec ? msg.data.network[0].txSec / 1024 / 1024 : 0;
          newHistory.netRx = [...(newHistory.netRx || []).slice(-29), rxVal];
          newHistory.netTx = [...(newHistory.netTx || []).slice(-29), txVal];
          if (rxVal > thresholds.netRx) newAlerts.push(`High download speed: ${rxVal.toFixed(2)} MB/s`);
          if (txVal > thresholds.netTx) newAlerts.push(`High upload speed: ${txVal.toFixed(2)} MB/s`);
        }

        // Disk
        if (msg.data.storage) {
          const diskUseVal = msg.data.storage.filesystems?.[0]?.use || 0;
          const diskReadVal = msg.data.storage.io?.readBytes ? msg.data.storage.io.readBytes / 1024 / 1024 : 0;
          const diskWriteVal = msg.data.storage.io?.writeBytes ? msg.data.storage.io.writeBytes / 1024 / 1024 : 0;
          
          newHistory.diskUsage = [...(newHistory.diskUsage || []).slice(-29), diskUseVal];
          newHistory.diskReadMBps = [...(newHistory.diskReadMBps || []).slice(-29), diskReadVal];
          newHistory.diskWriteMBps = [...(newHistory.diskWriteMBps || []).slice(-29), diskWriteVal];
          
          if (diskUseVal > thresholds.diskUsage) newAlerts.push(`Disk usage high: ${diskUseVal}%`);
          if (diskReadVal > thresholds.diskReadMBps) newAlerts.push(`High disk read: ${diskReadVal.toFixed(2)} MB/s`);
          if (diskWriteVal > thresholds.diskWriteMBps) newAlerts.push(`High disk write: ${diskWriteVal.toFixed(2)} MB/s`);
        }

        setHistory(newHistory);
        setAlerts(newAlerts);
      } catch (error) {
        console.error('Error processing metrics:', error);
      }
    }
  }, [history]);

  // Initialize WebSocket connection
  const { connect, disconnect, isConnected } = useWebSocket(
    `${WS_URL}/stream?interval=1000`,
    handleWebSocketMessage,
    handleWebSocketError
  );

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground, reconnect
        connect();
      } else if (nextAppState.match(/inactive|background/)) {
        // App is going to background, disconnect to save battery
        disconnect();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [connect, disconnect]);

  // Connect when component mounts or focuses
  useFocusEffect(
    useCallback(() => {
      connect();
      return () => disconnect();
    }, [connect, disconnect])
  );

  // Refresh function
  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    disconnect();
    setTimeout(() => {
      connect();
      setIsRefreshing(false);
    }, 1000);
  }, [connect, disconnect]);

  // Get Y-axis suffix based on metric type
  const getYAxisSuffix = (metricKey) => {
    const key = metricKey.toLowerCase();
    if (key.includes('load') || key.includes('usage') || key.includes('percent')) return '%';
    if (key.includes('temp')) return '°C';
    if (key.includes('netrx') || key.includes('nettx')) return ' MB/s';
    if (key.includes('fan')) return ' RPM';
    if (key.includes('diskread') || key.includes('diskwrite')) return ' MB/s';
    return '';
  };

  // Render a chart component
  const renderChart = (label, data, metricKey) => {
    const isAlert = alerts.some(a => a.toLowerCase().includes(metricKey.toLowerCase()));
    return (
      <TouchableOpacity
        key={label}
        onPress={() => navigation.navigate('History', { metricKey, label })}
        activeOpacity={0.7}
      >
        <View style={[
          styles.chartContainer,
          isAlert && styles.alertChartContainer
        ]}>
          <Text style={styles.chartTitle}>{label}</Text>
          {data && data.length > 0 ? (
            <LineChart
              data={{
                labels: Array(data.length).fill(''),
                datasets: [{ data }]
              }}
              width={Dimensions.get('window').width - 32}
              height={200}
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

  // Render connection status
  const renderConnectionStatus = () => {
    let statusText, statusColor, iconName;
    
    switch (connectionStatus) {
      case 'connected':
        statusText = 'Connected';
        statusColor = '#4CAF50';
        iconName = 'wifi';
        break;
      case 'error':
        statusText = 'Connection Error';
        statusColor = '#F44336';
        iconName = 'wifi-off';
        break;
      default:
        statusText = 'Connecting...';
        statusColor = '#FF9800';
        iconName = 'wifi';
        break;
    }
    
    return (
      <View style={styles.statusContainer}>
        <MaterialIcons name={iconName} size={16} color={statusColor} />
        <Text style={[styles.statusText, { color: statusColor }]}>
          {statusText}
        </Text>
        {lastUpdate && (
          <Text style={styles.lastUpdateText}>
            Last update: {lastUpdate.toLocaleTimeString()}
          </Text>
        )}
      </View>
    );
  };

  if (!metrics && connectionStatus === 'connecting') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Connecting to monitoring server...</Text>
        {renderConnectionStatus()}
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
      >
        {/* Connection Status */}
        {renderConnectionStatus()}

        {/* Alerts */}
        {alerts.length > 0 && (
          <View style={styles.alertContainer}>
            <MaterialIcons name="warning" size={20} color="white" />
            <ScrollView style={styles.alertScrollView}>
              {alerts.map((alert, idx) => (
                <Text key={idx} style={styles.alertText}>
                  {alert}
                </Text>
              ))}
            </ScrollView>
          </View>
        )}

        {/* CPU Section */}
        <Text style={styles.sectionTitle}>CPU Info</Text>
        {metrics?.cpu?.info ? (
          <>
            <Text style={styles.infoText}>
              {metrics.cpu.info.brand} — {metrics.cpu.info.cores} cores ({metrics.cpu.info.physicalCores} physical)
            </Text>
            {metrics.cpu.perCore?.map((core) =>
              renderChart(`CPU Core ${core.core} Load %`, history[`cpuCore${core.core}Load`] || [], `cpuCore${core.core}Load`)
            )}
          </>
        ) : (
          <Text style={styles.noDataText}>No CPU data available</Text>
        )}

        {/* GPUs Section */}
        <Text style={styles.sectionTitle}>GPUs</Text>
        {metrics?.gpus?.length > 0 ? (
          metrics.gpus.map((gpu, idx) => (
            <View key={idx} style={styles.gpuContainer}>
              <Text style={styles.infoText}>
                {gpu.model} ({gpu.vendor}) — {gpu.vramTotalMB} MB VRAM
              </Text>
              {renderChart(`GPU ${idx} Temp °C`, history[`gpu${idx}Temp`] || [], `gpu${idx}Temp`)}
            </View>
          ))
        ) : (
          <Text style={styles.noDataText}>No GPU data available</Text>
        )}

        {/* Memory Section */}
        <Text style={styles.sectionTitle}>Memory</Text>
        {renderChart(`Memory Usage (%)`, history.memUsage || [], 'memUsage')}

        {/* Cooling Section */}
        <Text style={styles.sectionTitle}>Cooling</Text>
        {renderChart(`Fan Speed (RPM)`, history.fanSpeed || [], 'fanSpeed')}

        {/* Network Section */}
        <Text style={styles.sectionTitle}>Network</Text>
        {renderChart(`Download Speed (MB/s)`, history.netRx || [], 'netRx')}
        {renderChart(`Upload Speed (MB/s)`, history.netTx || [], 'netTx')}

        {/* Storage Section */}
        <Text style={styles.sectionTitle}>Storage</Text>
        {renderChart(`Disk Usage (%)`, history.diskUsage || [], 'diskUsage')}
        {renderChart(`Disk Read Speed (MB/s)`, history.diskReadMBps || [], 'diskReadMBps')}
        {renderChart(`Disk Write Speed (MB/s)`, history.diskWriteMBps || [], 'diskWriteMBps')}
      </ScrollView>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
  },
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
  statusText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  lastUpdateText: {
    marginLeft: 'auto',
    fontSize: 12,
    color: '#666',
  },
  alertContainer: {
    flexDirection: 'row',
    backgroundColor: '#F44336',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  alertScrollView: {
    maxHeight: 100,
  },
  alertText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  alertChartContainer: {
    borderWidth: 2,
    borderColor: 'red',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
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
  chartTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  chart: {
    borderRadius: 8,
  },
  noDataContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  gpuContainer: {
    marginBottom: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#333',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default Dashboard;

HistoryScreen.tsx
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Network from 'expo-network';

// Environment configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// Error boundary component using hooks
const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState(null);

  const handleCatchError = useCallback((error, errorInfo) => {
    console.error('HistoryScreen Error:', error, errorInfo);
    setHasError(true);
    setError(error);
  }, []);

  if (hasError) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={64} color="#ff6b6b" />
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>
          {error?.message || 'Failed to load historical data'}
        </Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => setHasError(false)}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return children;
};

// Custom hook for fetching historical data
const useHistoryData = (metricKey, startDate, endDate) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!metricKey) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Check network connection first
      const networkState = await Network.getNetworkStateAsync();
      if (!networkState.isConnected) {
        throw new Error('No network connection');
      }

      const since = startDate.getTime();
      const until = endDate.getTime();
      
      const response = await fetch(
        `${API_BASE_URL}/history?since=${since}&until=${until}&limit=500&column=${metricKey}`
      );
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching history:', err);
      setError(err.message);
      Alert.alert(
        'Data Load Error',
        `Failed to load historical data: ${err.message}`,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  }, [metricKey, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};

// Main HistoryScreen component
const HistoryScreen = ({ route }) => {
  const navigation = useNavigation();
  const { metricKey, label } = route.params || {};
  const [startDate, setStartDate] = useState(new Date(Date.now() - 3600 * 1000)); // default: last 1 hour
  const [endDate, setEndDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState({ type: null, show: false });
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Validate params
  if (!metricKey || !label) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={64} color="#ff6b6b" />
        <Text style={styles.errorTitle}>Invalid parameters</Text>
        <Text style={styles.errorText}>
          Missing metricKey or label parameters
        </Text>
        <Button 
          title="Go Back" 
          onPress={() => navigation.goBack()} 
        />
      </View>
    );
  }

  // Fetch historical data
  const { data: rows, loading, error, refetch } = useHistoryData(
    metricKey, 
    startDate, 
    endDate
  );

  // Handle date picker changes
  const onDateChange = (event, selectedDate) => {
    setShowPicker({ type: null, show: false });
    
    if (!selectedDate) return;
    
    if (showPicker.type === 'start') {
      setStartDate(selectedDate);
    } else if (showPicker.type === 'end') {
      setEndDate(selectedDate);
    }
  };

  // Quick time range selection
  const quickSelect = useCallback((hours) => {
    const now = new Date();
    const start = new Date(now.getTime() - hours * 3600 * 1000);
    setStartDate(start);
    setEndDate(now);
  }, []);

  // Refresh data
  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    refetch().finally(() => setIsRefreshing(false));
  }, [refetch]);

  // Decide label format based on range length
  const getLabelFormat = useCallback(() => {
    const rangeHours = (endDate - startDate) / (1000 * 60 * 60);
    if (rangeHours <= 24) {
      return { hour: '2-digit', minute: '2-digit' }; // time only
    }
    return { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }; // date + time
  }, [startDate, endDate]);

  // Decide Y-axis suffix based on metric type
  const getYAxisSuffix = useCallback(() => {
    const key = metricKey.toLowerCase();
    if (key.includes('load') || key.includes('usage') || key.includes('percent')) return '%';
    if (key.includes('temp')) return '°C';
    if (key.includes('netrx') || key.includes('nettx') || key.includes('diskread') || key.includes('diskwrite')) return ' MB/s';
    if (key.includes('fan')) return ' RPM';
    return '';
  }, [metricKey]);

  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Show date picker
  const showDatePicker = (type) => {
    setShowPicker({ type, show: true });
  };

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
        <Button 
          title="Retry" 
          onPress={refetch} 
        />
        <Button 
          title="Go Back" 
          onPress={() => navigation.goBack()} 
          color="#666"
        />
      </View>
    );
  }

  const values = rows ? rows.map((r) => r[metricKey] ?? 0) : [];
  const labels = rows ? rows.map((r, i) => {
    const date = new Date(r.timestamp);
    return i % Math.ceil(rows.length / 6) === 0
      ? date.toLocaleString([], getLabelFormat())
      : '';
  }) : [];

  return (
    <ErrorBoundary>
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
      >
        <Text style={styles.title}>
          {label} - History
        </Text>

        {/* Quick-select buttons */}
        <View style={styles.quickSelectContainer}>
          <TouchableOpacity 
            style={styles.quickSelectButton}
            onPress={() => quickSelect(1)}
          >
            <Text style={styles.quickSelectText}>Last 1h</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.quickSelectButton}
            onPress={() => quickSelect(24)}
          >
            <Text style={styles.quickSelectText}>Last 24h</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.quickSelectButton}
            onPress={() => quickSelect(24 * 7)}
          >
            <Text style={styles.quickSelectText}>Last 7d</Text>
          </TouchableOpacity>
        </View>

        {/* Manual date pickers */}
        <View style={styles.datePickerContainer}>
          <TouchableOpacity 
            style={styles.dateButton}
            onPress={() => showDatePicker('start')}
          >
            <MaterialIcons name="calendar-today" size={20} color="#4CAF50" />
            <Text style={styles.dateButtonText}>
              Start: {formatDate(startDate)}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.dateButton}
            onPress={() => showDatePicker('end')}
          >
            <MaterialIcons name="calendar-today" size={20} color="#4CAF50" />
            <Text style={styles.dateButtonText}>
              End: {formatDate(endDate)}
            </Text>
          </TouchableOpacity>
        </View>

        {showPicker.show && (
          <DateTimePicker
            value={showPicker.type === 'start' ? startDate : endDate}
            mode="datetime"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
            maximumDate={new Date()}
            minimumDate={new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)} // 1 year ago
          />
        )}

        {rows && rows.length > 0 ? (
          <>
            <View style={styles.statsContainer}>
              <Text style={styles.statsText}>
                Data points: {rows.length}
              </Text>
              <Text style={styles.statsText}>
                Time range: {formatDate(startDate)} to {formatDate(endDate)}
              </Text>
            </View>

            <LineChart
              data={{
                labels,
                datasets: [{ data: values }]
              }}
              width={Dimensions.get('window').width - 32}
              height={220}
              yAxisSuffix={getYAxisSuffix()}
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

            {/* Statistics */}
            {values.length > 0 && (
              <View style={styles.statisticsContainer}>
                <Text style={styles.statisticsTitle}>Statistics</Text>
                <View style={styles.statisticsRow}>
                  <Text style={styles.statisticsLabel}>Current:</Text>
                  <Text style={styles.statisticsValue}>
                    {values[values.length - 1].toFixed(2)}{getYAxisSuffix()}
                  </Text>
                </View>
                <View style={styles.statisticsRow}>
                  <Text style={styles.statisticsLabel}>Average:</Text>
                  <Text style={styles.statisticsValue}>
                    {(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)}{getYAxisSuffix()}
                  </Text>
                </View>
                <View style={styles.statisticsRow}>
                  <Text style={styles.statisticsLabel}>Maximum:</Text>
                  <Text style={styles.statisticsValue}>
                    {Math.max(...values).toFixed(2)}{getYAxisSuffix()}
                  </Text>
                </View>
                <View style={styles.statisticsRow}>
                  <Text style={styles.statisticsLabel}>Minimum:</Text>
                  <Text style={styles.statisticsValue}>
                    {Math.min(...values).toFixed(2)}{getYAxisSuffix()}
                  </Text>
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={styles.noDataContainer}>
            <MaterialIcons name="history" size={64} color="#ccc" />
            <Text style={styles.noDataText}>No historical data available</Text>
            <Text style={styles.noDataSubtext}>
              Try selecting a different time range
            </Text>
          </View>
        )}
      </ScrollView>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
  },
  title: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 16,
    color: '#333',
    textAlign: 'center',
  },
  quickSelectContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  quickSelectButton: {
    flex: 1,
    marginHorizontal: 4,
    padding: 10,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    alignItems: 'center',
  },
  quickSelectText: {
    color: 'white',
    fontWeight: 'bold',
  },
  datePickerContainer: {
    marginBottom: 16,
  },
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
    elevation: 2,
  },
  dateButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  chart: {
    borderRadius: 8,
    marginBottom: 16,
  },
  statsContainer: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  statsText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statisticsContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  statisticsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  statisticsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statisticsLabel: {
    fontSize: 14,
    color: '#666',
  },
  statisticsValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noDataText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#333',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default HistoryScreen;

.env
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_WS_URL=ws://localhost:3000


my node server
server.js
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const sqlite3 = require('sqlite3').verbose();
const systeminformation = require('systeminformation');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Adjust for your specific needs
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:19006', 'exp://localhost:19000'],
  credentials: true
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:19006', 'exp://localhost:19000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Logging setup
const logger = {
  info: (message) => {
    const logMessage = `[INFO] ${new Date().toISOString()}: ${message}\n`;
    fs.appendFileSync(path.join(logsDir, 'server.log'), logMessage);
    console.log(logMessage.trim());
  },
  error: (message) => {
    const logMessage = `[ERROR] ${new Date().toISOString()}: ${message}\n`;
    fs.appendFileSync(path.join(logsDir, 'server.log'), logMessage);
    console.error(logMessage.trim());
  },
  warn: (message) => {
    const logMessage = `[WARN] ${new Date().toISOString()}: ${message}\n`;
    fs.appendFileSync(path.join(logsDir, 'server.log'), logMessage);
    console.warn(logMessage.trim());
  }
};

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Initialize SQLite database with error handling
let db;
try {
  db = new sqlite3.Database(path.join(dataDir, 'metrics.db'), (err) => {
    if (err) {
      logger.error('Error opening database: ' + err.message);
      throw err;
    }
    logger.info('Connected to the SQLite database.');
  });

  // Create metrics table if it doesn't exist
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      cpu_load REAL,
      cpu_temp REAL,
      mem_usage REAL,
      gpu_temp REAL,
      gpu_load REAL,
      fan_speed REAL,
      net_rx REAL,
      net_tx REAL,
      disk_usage REAL,
      disk_read REAL,
      disk_write REAL,
      full_data TEXT
    )`, (err) => {
      if (err) {
        logger.error('Error creating table: ' + err.message);
      } else {
        logger.info('Metrics table ready');
      }
    });

    // Create indexes for better query performance
    db.run('CREATE INDEX IF NOT EXISTS idx_timestamp ON metrics(timestamp)');
    db.run('CREATE INDEX IF NOT EXISTS idx_cpu_load ON metrics(cpu_load)');
    db.run('CREATE INDEX IF NOT EXISTS idx_mem_usage ON metrics(mem_usage)');
  });
} catch (dbError) {
  logger.error('Database initialization failed: ' + dbError.message);
  process.exit(1);
}

// WebSocket server setup
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ 
  server,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 10,
    concurrencyLimit: 10,
    threshold: 1024
  }
});

// Store connected clients and their intervals
const clients = new Map();

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const clientId = Date.now() + Math.random().toString(36).substr(2, 9);
  logger.info(`Client connected: ${clientId}`);
  
  // Parse query parameters for interval with validation
  const url = new URL(req.url, `http://${req.headers.host}`);
  let interval = Math.max(500, Math.min(parseInt(url.searchParams.get('interval')) || 1000, 10000));
  
  clients.set(ws, { id: clientId, interval: null });
  
  const sendMetrics = async () => {
    if (ws.readyState !== WebSocket.OPEN) {
      clearInterval(clients.get(ws).interval);
      clients.delete(ws);
      return;
    }
    
    try {
      const metrics = await systeminformation.getDynamicData();
      const message = JSON.stringify({ 
        type: 'metrics', 
        data: metrics,
        timestamp: Date.now()
      });
      
      ws.send(message);
      
      // Store in database with error handling
      const stmt = db.prepare(`INSERT INTO metrics (
        cpu_load, cpu_temp, mem_usage, gpu_temp, gpu_load, 
        fan_speed, net_rx, net_tx, disk_usage, disk_read, disk_write, full_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      
      const cpuLoad = metrics.cpu?.load || 0;
      const cpuTemp = metrics.cpu?.temperature?.main || 0;
      const memUsage = metrics.mem?.usage || 0;
      const gpuTemp = metrics.gpus?.[0]?.temperature || 0;
      const gpuLoad = metrics.gpus?.[0]?.load || 0;
      const fanSpeed = metrics.fans?.[0]?.speed || 0;
      const netRx = metrics.net?.[0]?.rx_sec || 0;
      const netTx = metrics.net?.[0]?.tx_sec || 0;
      const diskUsage = metrics.fsSize?.[0]?.use || 0;
      const diskRead = metrics.disksIO?.[0]?.rIO_sec || 0;
      const diskWrite = metrics.disksIO?.[0]?.wIO_sec || 0;
      
      stmt.run(
        cpuLoad, cpuTemp, memUsage, gpuTemp, gpuLoad,
        fanSpeed, netRx, netTx, diskUsage, diskRead, diskWrite,
        JSON.stringify(metrics),
        (err) => {
          if (err) {
            logger.error('Error inserting metrics: ' + err.message);
          }
        }
      );
      
      stmt.finalize();
    } catch (error) {
      logger.error('Error fetching/sending metrics: ' + error.message);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Failed to retrieve system metrics' 
      }));
    }
  };
  
  // Start sending metrics
  const intervalId = setInterval(sendMetrics, interval);
  clients.get(ws).interval = intervalId;
  sendMetrics(); // Send immediately on connection
  
  ws.on('close', () => {
    logger.info(`Client disconnected: ${clientId}`);
    clearInterval(clients.get(ws).interval);
    clients.delete(ws);
  });
  
  ws.on('error', (error) => {
    logger.error(`WebSocket error for client ${clientId}: ${error.message}`);
    clearInterval(clients.get(ws).interval);
    clients.delete(ws);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    clients: clients.size,
    memory: process.memoryUsage()
  });
});

// History endpoint with validation and error handling
app.get('/history', (req, res) => {
  try {
    // Validate and parse parameters
    const since = Math.max(0, parseInt(req.query.since) || Date.now() - 3600000);
    const until = Math.min(Date.now(), parseInt(req.query.until) || Date.now());
    const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 500, 1000));
    
    let column = req.query.column || 'cpu_load';
    // Prevent SQL injection by validating column name
    const allowedColumns = [
      'cpu_load', 'cpu_temp', 'mem_usage', 'gpu_temp', 'gpu_load',
      'fan_speed', 'net_rx', 'net_tx', 'disk_usage', 'disk_read', 'disk_write'
    ];
    
    if (!allowedColumns.includes(column)) {
      return res.status(400).json({ 
        error: 'Invalid column parameter',
        allowedColumns 
      });
    }
    
    // Query database with parameterized query
    db.all(
      `SELECT timestamp, ${column} as value 
       FROM metrics 
       WHERE timestamp BETWEEN datetime(?, 'unixepoch') AND datetime(?, 'unixepoch')
       ORDER BY timestamp ASC 
       LIMIT ?`,
      [since / 1000, until / 1000, limit],
      (err, rows) => {
        if (err) {
          logger.error('Database query error: ' + err.message);
          return res.status(500).json({ error: 'Database query failed' });
        }
        
        // Transform data for client
        const result = rows.map(row => ({
          timestamp: new Date(row.timestamp).getTime(),
          [column]: row.value
        }));
        
        res.json(result);
      }
    );
  } catch (error) {
    logger.error('History endpoint error: ' + error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Metrics cleanup endpoint (for removing old data)
app.delete('/metrics', (req, res) => {
  const maxAge = parseInt(req.query.maxAge) || 30 * 24 * 60 * 60 * 1000; // Default 30 days
  const deleteBefore = new Date(Date.now() - maxAge);
  
  db.run(
    'DELETE FROM metrics WHERE timestamp < ?',
    [deleteBefore.toISOString()],
    function(err) {
      if (err) {
        logger.error('Metrics cleanup error: ' + err.message);
        return res.status(500).json({ error: 'Cleanup failed' });
      }
      
      logger.info(`Cleaned up ${this.changes} metrics records older than ${deleteBefore.toISOString()}`);
      res.json({ 
        deleted: this.changes,
        before: deleteBefore.toISOString() 
      });
    }
  );
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error: ' + err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown handling
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

function gracefulShutdown() {
  logger.info('Received shutdown signal, shutting down gracefully...');
  
  // Close all WebSocket connections
  clients.forEach((client, ws) => {
    clearInterval(client.interval);
    ws.close();
  });
  
  // Close WebSocket server
  wss.close(() => {
    logger.info('WebSocket server closed.');
  });
  
  // Close database connection
  db.close((err) => {
    if (err) {
      logger.error('Error closing database: ' + err.message);
    } else {
      logger.info('Database connection closed.');
    }
    
    // Exit process
    process.exit(0);
  });
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, server };

.env
export NODE_ENV=production
export PORT=3000
export ALLOWED_ORIGINS=http://localhost:19006,https://localhost:19006,exp://localhost:19000




i am getting this error from the expo terminal
ERROR  WebSocket error: {"_bubbles": false, "_cancelable": false, "_composed": false, "_defaultPrevented": false, "_timeStamp": 1647115302.67356, "_type": "error", Symbol(composedPath): [{"CLOSED": 3, "CLOSING": 2, "CONNECTING": 0, "OPEN": 1, "_eventEmitter": [NativeEventEmitter], "_socketId": 51, "_subscriptions": [Array], "readyState": 3, "url": "ws://localhost:3000/stream?interval=1000", Symbol(bubblingListeners): [Map], Symbol(eventHandlerAttributeMap): [Map]}], Symbol(currentTarget): {"CLOSED": 3, "CLOSING": 2, "CONNECTING": 0, "OPEN": 1, "_eventEmitter": {}, "_socketId": 51, "_subscriptions": [[Object], [Object], [Object], [Object]], "readyState": 3, "url": "ws://localhost:3000/stream?interval=1000", Symbol(bubblingListeners): Map {"open" => [Map], "message" => [Map], "error" => [Map], "close" => [Map]}, Symbol(eventHandlerAttributeMap): Map {"open" => [Object], "message" => [Object], "error" => [Object], "close" => [Object]}}, Symbol(eventPhase): 2, Symbol(inPassiveListenerFlag): false, Symbol(isTrusted): false, Symbol(stopPropagationFlag): false, Symbol(stopPropagationFlag): false, Symbol(target): {"CLOSED": 3, "CLOSING": 2, "CONNECTING": 0, "OPEN": 1, "_eventEmitter": {}, "_socketId": 51, "_subscriptions": [[Object], [Object], [Object], [Object]], "readyState": 3, "url": "ws://localhost:3000/stream?interval=1000", Symbol(bubblingListeners): Map {"open" => [Map], "message" => [Map], "error" => [Map], "close" => [Map]}, Symbol(eventHandlerAttributeMap): Map {"open" => [Object], "message" => [Object], "error" => [Object], "close" => [Object]}}, Symbol(Event.dispatch): true}
 LOG  WebSocket disconnected
