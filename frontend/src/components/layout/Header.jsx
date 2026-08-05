import React, { useState, useEffect, useRef } from 'react';
import { Bell, Home, ChevronDown, User, Settings, LogOut, Calendar, Menu } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { notificationsApi, urlPhoto } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const typeIcon = { info: '💬', success: '✅', warning: '⚠️', error: '❌' };
const typeColor = {
  info: 'text-blue-600 bg-blue-50', success: 'text-green-600 bg-green-50',
  warning: 'text-orange-600 bg-orange-50', error: 'text-red-600 bg-red-50',
};

export default function Header({ title, onToggleSidebar }) {
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [today, setToday] = useState('');
  const notifRef = useRef(null);
  const userRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const fetchNotifs = async () => {
    try {
      const res = await notificationsApi.getAll();
      setNotifs(res.data.data.notifications || []);
      setUnread(res.data.data.unread_count || 0);
    } catch {}
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setToday(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setOpen(false);
      if (userRef.current && !userRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markAllRead = async () => { await notificationsApi.markRead(); fetchNotifs(); };
  const handleLogout = () => { setUserMenuOpen(false); logout(); navigate('/login'); };
  const initials = user ? `${user.prenom?.[0] || ''}${user.nom?.[0] || ''}`.toUpperCase() : '';

  return (
    <header className="h-14 flex items-center px-5 gap-4 sticky top-0 z-30 shadow-md flex-shrink-0"
      style={{ background: 'linear-gradient(135deg, #1a5276 0%, #1e6fb5 100%)' }}>

      <div className="flex items-center gap-4 flex-shrink-0">
        <button onClick={onToggleSidebar} className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2 text-white font-extrabold text-base" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <span className="text-yellow-400 text-lg">🎓</span>
          <span>ENET'COM</span>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-white/75 text-xs">
          <Calendar size={13} />
          <span className="capitalize">{today}</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center gap-2">
        <Link to="/dashboard" className="flex items-center gap-1.5 text-white/90 hover:text-white hover:bg-white/15 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors">
          <Home size={15} /> Accueil
        </Link>
        {title && (<><span className="text-white/40">/</span><span className="text-white font-semibold text-sm">{title}</span></>)}
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="relative" ref={notifRef}>
          <button onClick={() => { setOpen((o) => !o); if (!open) fetchNotifs(); }}
            className="relative p-2 rounded-lg text-white/85 hover:text-white hover:bg-white/15 transition-colors">
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-[#1a5276]">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          {open && (
            <div className="absolute right-0 top-12 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-slate-800 dark:text-white text-sm">Notifications</span>
                {unread > 0 && <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">Tout marquer lu</button>}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {notifs.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-sm">🔔 Aucune notification</div>
                ) : notifs.map((n) => (
                  <button key={n.id}
                    onClick={async () => { await notificationsApi.markRead(n.id); fetchNotifs(); if (n.lien) navigate(n.lien); setOpen(false); }}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${!n.lu ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                    <div className="flex gap-3 items-start">
                      <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${typeColor[n.type]}`}>{typeIcon[n.type]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-800 dark:text-white">{n.titre}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.message}</div>
                        <div className="text-[10px] text-slate-400 mt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}</div>
                      </div>
                      {!n.lu && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={userRef}>
          <button onClick={() => setUserMenuOpen((o) => !o)} className="flex items-center gap-2 text-white px-2.5 py-1.5 rounded-lg hover:bg-white/15 transition-colors">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden">
              {user?.photo_url ? <img src={urlPhoto(user.photo_url)} alt="" className="w-full h-full object-cover" /> : (initials || <User size={14} />)}
            </div>
            <span className="hidden sm:block text-sm font-medium">{user ? `${user.prenom} ${user.nom}` : 'Utilisateur'}</span>
            <ChevronDown size={14} className={`transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {userMenuOpen && (
            <div className="absolute right-0 top-12 w-52 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
              <Link to="/profil" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <User size={15} /> Profil
              </Link>
              <Link to="/parametres" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <Settings size={15} /> Paramètres
              </Link>
              <hr className="border-slate-100 dark:border-slate-800" />
              <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <LogOut size={15} /> Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
