export const thresholds = {
	cpuLoad: 90,
	gpuTemp: 85,
	memUsage: 90,
	fanSpeed: 0, // server defaults fan RPM to 0
	netRx: 100, // MB/s
	netTx: 100, // MB/s
	diskUsage: 95,
	diskReadMBps: 500,
	diskWriteMBps: 500
};

export const getYAxisSuffix = (metricKey) => {
	const k = (metricKey || '').toLowerCase();
	if (k.includes('load') || k.includes('usage') || k.includes('percent')) return '%';
	if (k.includes('temp')) return '°C';
	if (k.includes('netrx') || k.includes('nettx') || k.includes('diskread') || k.includes('diskwrite')) return ' MB/s';
	if (k.includes('fan')) return ' RPM';
	return '';
};

// Map app metric keys -> DB columns (HistoryScreen)
export const metricKeyToColumn = (key) => {
	const k = (key || '').toLowerCase();
	if (k.startsWith('cpucore')) return 'cpu_load';
	const map = {
		memusage: 'mem_usage',
		fanspeed: 'fan_speed',
		netrx: 'net_rx',
		nettx: 'net_tx',
		diskusage: 'disk_usage',
		diskreadmbps: 'disk_read',
		diskwritembps: 'disk_write',
		gputemp: 'gpu_temp'
	};
	return map[k] || 'cpu_load';
};

// Convert DB units -> UI units
export const normalizeValueForKey = (metricKey, raw) => {
	const k = (metricKey || '').toLowerCase();
	if (k === 'netrx' || k === 'nettx' || k === 'diskreadmbps' || k === 'diskwritembps') {
		return (Number(raw) || 0) / (1024 * 1024); // bytes/s -> MB/s
	}
	return Number(raw) || 0;
};
