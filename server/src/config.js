const path = require('path');

const dev = (process.env.NODE_ENV || 'development') !== 'production';

module.exports = {
	PORT: Number(process.env.PORT || 3000),
	DEV: dev,
	ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || '')
		.split(',')
		.map(s => s.trim())
		.filter(Boolean),
	DATA_DIR: path.join(__dirname, '..', 'data'),
	LOGS_DIR: path.join(__dirname, '..', 'logs')
};
