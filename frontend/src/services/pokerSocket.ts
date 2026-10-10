import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const SOCKET_URL = import.meta.env.VITE_API_URL || '';

export function getPokerSocket(): Socket {
  if (!socket) {
    socket = io(`${SOCKET_URL}/poker`, {
      auth: callback => callback({ token: localStorage.getItem('accessToken') }),
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function disconnectPokerSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
