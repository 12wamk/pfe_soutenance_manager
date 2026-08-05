import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Sparkles, Bot, User } from 'lucide-react';
import { chatbotApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

// Suggestions rapides affichées sous forme de boutons — reprennent les mêmes
// thèmes que la réponse "aide" du chatbot, pour cliquer au lieu de taper.
const SUGGESTIONS = [
  'Mes étudiants encadrés',
  'Ma prochaine soutenance',
  'Mes invitations en attente',
  'Ma charge jury',
  'Comment planifier une soutenance',
  'Mes disponibilités',
  'La période et le calendrier',
  'Participation inter-département',
];

export default function ChatbotWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [statut, setStatut] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (open && !statut) {
      chatbotApi.getStatus().then((r) => setStatut(r.data.data)).catch(() => {});
    }
  }, [open, statut]);

  useEffect(() => {
    if (open && !loadedOnce) {
      chatbotApi.getHistory().then((r) => {
        const hist = (r.data.data || []).map((m) => ({ role: m.role, text: m.message }));
        if (hist.length === 0) {
          hist.push({ role: 'bot', text: `Bonjour ${user?.prenom || ''} 👋 Je suis l'assistant de la plateforme. Posez-moi une question sur vos soutenances, invitations, disponibilités, ou choisissez un sujet ci-dessous.` });
        }
        setMessages(hist);
        setLoadedOnce(true);
      }).catch(() => setLoadedOnce(true));
    }
  }, [open, loadedOnce, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const send = async (texteOverride) => {
    const text = (texteOverride ?? input).trim();
    if (!text || sending) return;
    setShowSuggestions(false);
    setMessages((m) => [...m, { role: 'user', text }]);
    setInput('');
    setSending(true);
    try {
      const r = await chatbotApi.sendMessage(text);
      setMessages((m) => [...m, { role: 'bot', text: r.data.data.reponse }]);
    } catch {
      setMessages((m) => [...m, { role: 'bot', text: "Une erreur est survenue, veuillez réessayer." }]);
    } finally {
      setSending(false);
      setShowSuggestions(true); // les suggestions réapparaissent après chaque réponse du bot
    }
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  if (!user) return null;

  return (
    <>
      {/* Bulle flottante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white hover:scale-105 transition-transform"
          style={{ background: 'linear-gradient(135deg, #1a5276 0%, #2980d9 100%)' }}
          title="Assistant"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Panneau de conversation */}
      {open && (
        <div className="fixed bottom-6 right-6 z-40 w-[360px] max-w-[92vw] h-[520px] max-h-[80vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">

          {/* En-tête */}
          <div className="flex items-center justify-between px-4 py-3 text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #1a5276 0%, #2980d9 100%)' }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Sparkles size={16} />
              </div>
              <div>
                <div className="font-bold text-sm" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Assistant ENET'COM</div>
                <div className="text-[10px] text-white/70 flex items-center gap-1">
                  {statut?.mode === 'ia' ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                      Mode IA activé ({statut.provider})
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
                      Mode local
                    </>
                  )}
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-white/15 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-950/50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}>
                  {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
                </div>
                <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-line ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-tl-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <Bot size={13} className="text-slate-600 dark:text-slate-300" />
                </div>
                <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            {/* Boutons de suggestions rapides — grille 2 colonnes, style bleu, réapparaît après chaque réponse */}
            {showSuggestions && !sending && (
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="w-full px-2.5 py-2 text-[11px] leading-tight font-medium text-left rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Saisie */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 flex-shrink-0">
            <input
              value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder="Écrivez votre question..."
              className="flex-1 px-3.5 py-2.5 text-sm bg-slate-100 dark:bg-slate-800 border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-white transition-colors"
            />
            <button onClick={() => send()} disabled={!input.trim() || sending}
              className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center flex-shrink-0 transition-colors">
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}