import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const SOCKET_URL = import.meta.env.VITE_API_URL || '';

export function getBingoSocket(): Socket {
  if (!socket) {
    socket = io(`${SOCKET_URL}/bingo`, {
      auth: callback => callback({ token: localStorage.getItem('accessToken') }),
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function disconnectBingoSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
