const si = require('systeminformation');

// numeric guards
function num(n) {
	const x = Number(n);
	return Number.isFinite(x) ? x : 0;
}
function round(n, dp = 2) {
	const x = num(n);
	const m = Math.pow(10, dp);
	return Math.round(x * m) / m;
}

// gather & normalize into DTO expected by the app
async function sampleMetrics() {
	const [
		currentLoad,
		cpuTemp,
		mem,
		graphics,
		netStats,
		fsSize,
		disksIO,
		cpuInfo
	] = await Promise.all([
		si.currentLoad(),
		si.cpuTemperature(),
		si.mem(),
		si.graphics(),
		si.networkStats(),
		si.fsSize(),
		si.disksIO(),
		si.cpu()
	]);

	const perCore = Array.isArray(currentLoad?.cpus)
		? currentLoad.cpus.map((c, i) => ({
				core: i,
				loadPercent: round(num(c?.load), 2)
		  }))
		: [];

	// fan RPM fallback (0 by default)
	const fanRpmApprox = 0;

	const dto = {
		cpu: {
			info: {
				brand: cpuInfo?.brand || 'CPU',
				cores: num(cpuInfo?.cores) || perCore.length || 0,
				physicalCores: num(cpuInfo?.physicalCores) || undefined
			},
			perCore
		},
		memory: {
			usagePercent: round((num(mem?.used) / Math.max(1, num(mem?.total))) * 100, 2)
		},
		gpus: Array.isArray(graphics?.controllers)
			? graphics.controllers.map((g) => ({
					temperature: num(g?.temperatureGpu),
					model: g?.model || 'GPU',
					vendor: g?.vendor || 'Unknown',
					vramTotalMB: num(g?.vramTotal)
			  }))
			: [],
		sensors: {
			fans: [{ rpm: num(fanRpmApprox) }]
		},
		network: [
			{
				rxSec: num(netStats?.[0]?.rx_sec), // bytes/s
				txSec: num(netStats?.[0]?.tx_sec)  // bytes/s
			}
		],
		storage: {
			filesystems: [
				{ use: num(fsSize?.[0]?.use) } // %
			],
			io: {
				readBytes: num(disksIO?.rIO_sec),  // bytes/s
				writeBytes: num(disksIO?.wIO_sec)  // bytes/s
			}
		}
	};

	// values persisted into DB (snake_case + same semantics)
	const persist = {
		cpu_load: round(currentLoad?.currentload, 2),
		cpu_temp: num(cpuTemp?.main),
		mem_usage: dto.memory.usagePercent,
		gpu_temp: num(graphics?.controllers?.[0]?.temperatureGpu),
		gpu_load: num(graphics?.controllers?.[0]?.utilizationGpu),
		fan_speed: num(fanRpmApprox),
		net_rx: num(dto.network?.[0]?.rxSec),
		net_tx: num(dto.network?.[0]?.txSec),
		disk_usage: num(dto.storage?.filesystems?.[0]?.use),
		disk_read: num(dto.storage?.io?.readBytes),
		disk_write: num(dto.storage?.io?.writeBytes)
	};

	return { dto, persist };
}

module.exports = { sampleMetrics, num, round };
