import { create } from 'zustand';
import type { ChatMessage } from '@/services/chatSocket';

interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  error: string | null;
  addMessage: (msg: ChatMessage) => void;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setError: (err: string | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isOpen: false,
  error: null,
  addMessage: (msg) => set((state) => ({ messages: state.messages.some(m => m.id === msg.id) ? state.messages : [...state.messages, msg].slice(-100), error: null })),
  setOpen: (open) => set({ isOpen: open }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setError: (error) => set({ error }),
}));
