const fs = require('fs');
const path = require('path');
const { LOGS_DIR } = require('./config');

if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

function write(tag, msg) {
	const line = `[${tag}] ${new Date().toISOString()}: ${msg}\n`;
	fs.appendFileSync(path.join(LOGS_DIR, 'server.log'), line);
	return line.trim();
}

module.exports = {
	info: (m) => console.log(write('INFO', m)),
	warn: (m) => console.warn(write('WARN', m)),
	error: (m) => console.error(write('ERROR', m))
};
