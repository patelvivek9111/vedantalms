/**
 * ClamAV-compatible virus scan adapter (U25F).
 * Set CLAMAV_ENABLED=true and CLAMAV_HOST/CLAMAV_PORT to use a real daemon.
 * Falls back to no-op when disabled.
 */

const net = require('net');

function isEnabled() {
  return process.env.CLAMAV_ENABLED === 'true' || process.env.CLAMAV_ENABLED === '1';
}

function getConfig() {
  return {
    host: process.env.CLAMAV_HOST || '127.0.0.1',
    port: parseInt(process.env.CLAMAV_PORT || '3310', 10),
    timeoutMs: parseInt(process.env.CLAMAV_TIMEOUT_MS || '30000', 10),
  };
}

/**
 * Scan buffer via ClamAV INSTREAM protocol (zINSTREAM\0 + chunks + \0).
 */
function scanBuffer(buffer) {
  return new Promise((resolve, reject) => {
    if (!isEnabled()) {
      return resolve({ clean: true, engine: 'none', message: 'ClamAV disabled' });
    }
    const { host, port, timeoutMs } = getConfig();
    const socket = new net.Socket();
    let response = '';

    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('ClamAV scan timeout'));
    }, timeoutMs);

    socket.connect(port, host, () => {
      socket.write('zINSTREAM\0');
      const chunkSize = 64 * 1024;
      for (let offset = 0; offset < buffer.length; offset += chunkSize) {
        const chunk = buffer.slice(offset, offset + chunkSize);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(chunk.length, 0);
        socket.write(len);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
      socket.write('\0');
    });

    socket.on('data', (data) => {
      response += data.toString();
    });
    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    socket.on('close', () => {
      clearTimeout(timer);
      const clean = response.includes('OK') && !response.includes('FOUND');
      resolve({
        clean,
        engine: 'clamav',
        message: response.trim() || 'scan complete',
        signature: clean ? null : response,
      });
    });
  });
}

module.exports = {
  isEnabled,
  getConfig,
  scanBuffer,
};
