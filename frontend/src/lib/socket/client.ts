import { io, Socket } from 'socket.io-client';
import { create } from 'zustand';

function formatSocketUrl(rawUrl?: string): string {
  if (!rawUrl) return 'http://localhost:3000';
  let url = rawUrl.trim();
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('ws://') && !url.startsWith('wss://')) {
    url = `https://${url}`;
  }
  return url;
}

const SOCKET_URL = formatSocketUrl(process.env.NEXT_PUBLIC_SOCKET_URL);

interface SocketStore {
  connected: boolean;
  setConnected: (connected: boolean) => void;
}

export const useSocketStore = create<SocketStore>((set) => ({
  connected: false,
  setConnected: (connected) => set({ connected }),
}));

let socket: Socket | null = null;
let currentOrgId: string | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) {
    useSocketStore.getState().setConnected(true);
    return socket;
  }

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    timeout: 20_000,
  });

  socket.on('connect', () => {
    console.debug('[Socket] Connected:', socket?.id);
    useSocketStore.getState().setConnected(true);
    if (currentOrgId) {
      joinOrgRoom(currentOrgId);
    }
  });

  socket.on('disconnect', (reason) => {
    console.debug('[Socket] Disconnected:', reason);
    useSocketStore.getState().setConnected(false);
  });

  socket.on('auth_error', (data: { message: string }) => {
    console.warn('[Socket] Auth error:', data.message);
    disconnectSocket();
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection warning:', err.message);
    useSocketStore.getState().setConnected(false);
    if (err.message?.includes('unauthorized') || err.message?.includes('jwt')) {
      disconnectSocket();
    }
  });

  return socket;
}

export function updateToken(token: string): void {
  if (!socket) return;
  socket.auth = { token };
  socket.disconnect().connect();
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  currentOrgId = null;
  useSocketStore.getState().setConnected(false);
}

export function joinOrgRoom(orgId: string): void {
  currentOrgId = orgId;
  socket?.emit('join-org', { orgId });
}

export function leaveOrgRoom(orgId: string): void {
  if (currentOrgId === orgId) {
    currentOrgId = null;
  }
  socket?.emit('leave-org', { orgId });
}
