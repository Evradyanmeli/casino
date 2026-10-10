import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: string;
}

export function connectChat(): Socket {
  if (socket) return socket;

  const token = localStorage.getItem('accessToken');
  socket = io('/chat', {
    auth: callback => callback({ token: localStorage.getItem('accessToken') }),
    transports: ['polling', 'websocket'],
  });

  return socket;
}

export function disconnectChat(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export async function sendMessage(message: string): Promise<void> {
  if (!socket?.connected) throw new Error('Chat deconnecte. Votre message est conserve.');
  await new Promise<void>((resolve, reject) => {
    socket!.timeout(10000).emit('chat:message', { message }, (err: Error | null, response: any) => {
      if (err || !response?.success) reject(new Error(response?.error || 'Envoi non confirme. Veuillez verifier le chat avant de reessayer.'));
      else resolve();
    });
  });
}

export function onNewMessage(callback: (msg: ChatMessage) => void): () => void {
  if (!socket) return () => {};
  socket.on('chat:new-message', callback);
  return () => { socket?.off('chat:new-message', callback); };
}

export function onChatError(callback: (err: { message: string }) => void): () => void {
  if (!socket) return () => {};
  socket.on('chat:error', callback);
  return () => { socket?.off('chat:error', callback); };
}

export function getChatSocket(): Socket | null {
  return socket;
}
