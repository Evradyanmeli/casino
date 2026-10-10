import { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/chatStore';
import { connectChat, disconnectChat, sendMessage, onNewMessage, onChatError } from '@/services/chatSocket';
import { useState } from 'react';

export default function ChatWidget() {
  const { messages, isOpen, error, toggle, addMessage, setError } = useChatStore();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = connectChat();
    const connected = () => {
      setError(null);
      socket.emit('chat:get-messages', (response: any) => {
        if (response?.success) response.messages.forEach(addMessage);
        else setError(response?.error || 'Historique du chat indisponible');
      });
    };
    const failed = () => setError('Chat deconnecte. Nouvelle connexion en cours.');
    socket.on('connect', connected);
    socket.on('connect_error', failed);
    socket.on('disconnect', failed);
    if (socket.connected) connected();

    const unsubMessage = onNewMessage((msg) => {
      addMessage(msg);
    });

    const unsubError = onChatError((err) => {
      setError(err.message);
    });

    return () => {
      unsubMessage();
      unsubError();
      socket.off('connect', connected);
      socket.off('connect_error', failed);
      socket.off('disconnect', failed);
    };
  }, []);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try { await sendMessage(trimmed); setInput(''); setError(null); }
    catch (err: any) { setError(err.message); }
    finally { setSending(false); }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen && (
        <div className="mb-2 w-80 bg-[#1A1A2E] border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-slide-in-right">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-[#0D0D1A]">
            <h3 className="text-sm font-display text-gold">Chat</h3>
            <button onClick={toggle} className="text-gray-400 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          <div ref={listRef} className="h-64 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 && (
              <p className="text-gray-500 text-xs text-center py-8">Aucun message</p>
            )}
            {messages.map((msg, i) => (
              <div key={msg.id} className="text-sm">
                <span className="text-gold font-semibold">{msg.username}</span>
                <span className="text-gray-500 text-xs ml-2">
                  {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <p className="text-gray-200 break-words">{msg.message}</p>
              </div>
            ))}
            {error && (
              <div role="alert" className="text-error text-xs text-center">{error}</div>
            )}
          </div>

          <div className="border-t border-gray-700 p-2 flex gap-2">
            <input
              type="text"
              aria-label="Message du chat"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Votre message..."
              className="flex-1 bg-[#0D0D1A] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gold transition-colors"
              maxLength={200}
            />
            <button
              onClick={handleSend}
               aria-label="Envoyer le message"
               disabled={sending || !input.trim()}
              className="bg-gold text-[#0D0D1A] rounded-lg px-3 py-2 font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <button
        onClick={toggle}
        aria-label={isOpen ? 'Fermer le chat' : 'Ouvrir le chat'}
        className="w-12 h-12 rounded-full bg-gold text-[#0D0D1A] shadow-lg hover:brightness-110 transition-all flex items-center justify-center"
      >
        {isOpen ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>
    </div>
  );
}
