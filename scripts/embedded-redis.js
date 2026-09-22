/**
 * Embedded Lightweight Redis RESP Protocol Server (Pure Node.js net module)
 * Allows the entire microservice ecosystem to run locally out-of-the-box
 * with standard ioredis clients when a standalone Redis server or Docker is not available.
 */
const net = require('net');

class EmbeddedRedisServer {
  constructor(port = 6379, host = '127.0.0.1') {
    this.port = port;
    this.host = host;
    this.subscriptions = new Map(); // channel -> Set of sockets
    this.server = null;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        let buffer = '';

        socket.on('data', (chunk) => {
          buffer += chunk.toString('latin1');
          while (buffer.length > 0) {
            const parsed = this.parseRESP(buffer);
            if (!parsed) break;
            buffer = parsed.rest;
            this.handleCommand(socket, parsed.command);
          }
        });

        socket.on('close', () => {
          this.removeSocket(socket);
        });

        socket.on('error', () => {
          this.removeSocket(socket);
        });
      });

      this.server.on('error', (err) => {
        reject(err);
      });

      this.server.listen(this.port, this.host, () => {
        console.log(`[EmbeddedRedis] In-Memory Redis Server listening on ${this.host}:${this.port}`);
        resolve();
      });
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
  }

  removeSocket(socket) {
    for (const [, sockets] of this.subscriptions.entries()) {
      sockets.delete(socket);
    }
  }

  parseRESP(buf) {
    if (!buf.includes('\r\n')) return null;

    // RESP Array: *<count>\r\n...
    if (buf[0] === '*') {
      const firstLineEnd = buf.indexOf('\r\n');
      const count = parseInt(buf.substring(1, firstLineEnd), 10);
      let cursor = firstLineEnd + 2;
      const args = [];

      for (let i = 0; i < count; i++) {
        if (cursor >= buf.length || buf[cursor] !== '$') return null;
        const lineEnd = buf.indexOf('\r\n', cursor);
        if (lineEnd === -1) return null;
        const strLen = parseInt(buf.substring(cursor + 1, lineEnd), 10);
        cursor = lineEnd + 2;
        if (buf.length < cursor + strLen + 2) return null;
        const argVal = buf.substring(cursor, cursor + strLen);
        args.push(argVal);
        cursor += strLen + 2;
      }
      return { command: args, rest: buf.substring(cursor) };
    }

    // Inline command fallback
    const lineEnd = buf.indexOf('\r\n');
    const line = buf.substring(0, lineEnd).trim();
    if (!line) return { command: [], rest: buf.substring(lineEnd + 2) };
    const parts = line.split(/\s+/);
    return { command: parts, rest: buf.substring(lineEnd + 2) };
  }

  handleCommand(socket, cmdParts) {
    if (!cmdParts || cmdParts.length === 0) return;
    const cmd = cmdParts[0].toUpperCase();

    if (cmd === 'PING') {
      socket.write('+PONG\r\n');
    } else if (cmd === 'COMMAND' || cmd === 'CLIENT' || cmd === 'INFO') {
      socket.write('+OK\r\n');
    } else if (cmd === 'SUBSCRIBE') {
      const channels = cmdParts.slice(1);
      channels.forEach((ch, idx) => {
        if (!this.subscriptions.has(ch)) {
          this.subscriptions.set(ch, new Set());
        }
        this.subscriptions.get(ch).add(socket);
        const resp = `*3\r\n$9\r\nsubscribe\r\n$${Buffer.byteLength(ch)}\r\n${ch}\r\n:${idx + 1}\r\n`;
        socket.write(resp);
      });
    } else if (cmd === 'UNSUBSCRIBE') {
      const channels = cmdParts.slice(1);
      channels.forEach((ch) => {
        if (this.subscriptions.has(ch)) {
          this.subscriptions.get(ch).delete(socket);
        }
        const resp = `*3\r\n$11\r\nunsubscribe\r\n$${Buffer.byteLength(ch)}\r\n${ch}\r\n:0\r\n`;
        socket.write(resp);
      });
    } else if (cmd === 'PUBLISH') {
      const channel = cmdParts[1];
      const message = cmdParts[2] || '';
      let delivered = 0;
      if (this.subscriptions.has(channel)) {
        const subscribers = this.subscriptions.get(channel);
        const payload = `*3\r\n$7\r\nmessage\r\n$${Buffer.byteLength(channel)}\r\n${channel}\r\n$${Buffer.byteLength(message)}\r\n${message}\r\n`;
        for (const subSocket of subscribers) {
          if (!subSocket.destroyed) {
            subSocket.write(payload);
            delivered++;
          }
        }
      }
      socket.write(`:${delivered}\r\n`);
    } else if (cmd === 'QUIT') {
      socket.write('+OK\r\n');
      socket.end();
    } else {
      socket.write('+OK\r\n');
    }
  }
}

if (require.main === module) {
  const server = new EmbeddedRedisServer(6379, '127.0.0.1');
  server.start().catch((err) => {
    console.error('Failed to start embedded Redis server:', err.message);
  });
}

module.exports = { EmbeddedRedisServer };
