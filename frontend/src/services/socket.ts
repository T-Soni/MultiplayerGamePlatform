import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getGameSocket(): Socket {
  if (!socket) {
    // Connects through API Gateway (proxied to port 5000 in dev, or origin in prod)
    socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected to Live Game Engine via API Gateway. Socket ID:', socket?.id);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected:', reason);
    });
  }

  return socket;
}

export function disconnectGameSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
