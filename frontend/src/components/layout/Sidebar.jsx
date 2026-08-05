import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, GraduationCap, Calendar, Upload, Settings,
  LogOut, Moon, Sun, BookOpen, ClipboardList, UserCheck, Inbox,
  Building2, Send, Scale,Clock,Brain
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { urlPhoto } from '../../services/api';


const iconColors = {
  '/dashboard': 'bg-slate-500', '/enseignants': 'bg-purple-500', '/etudiants': 'bg-blue-500',
  '/soutenances': 'bg-sky-500', '/import': 'bg-green-500', '/periode': 'bg-orange-500',
  '/mes-etudiants': 'bg-blue-500', '/mon-planning': 'bg-sky-500', '/disponibilites': 'bg-purple-500',
  '/invitations': 'bg-red-500', '/options': 'bg-teal-500', '/participation': 'bg-indigo-500',
  '/charge-jury': 'bg-pink-500', '/import-enseignants': 'bg-violet-500',
  '/soutenances-du-jour': 'bg-amber-500',
  '/impact-ia': 'bg-purple-600',
};

const navConfig = {
  admin: [
    { section: 'Principal', items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
      { to: '/enseignants', icon: Users, label: 'Enseignants' },
      { to: '/etudiants', icon: GraduationCap, label: 'Étudiants' },
      { to: '/soutenances', icon: Calendar, label: 'Soutenances' },
      { to: '/charge-jury', icon: Scale, label: 'Charge Jury' },
      { to: '/impact-ia', icon: Brain, label: 'Impact IA + RO' },
    ]},
    { section: 'Administration', items: [
      { to: '/options', icon: Building2, label: 'Départements & Spécialités' },
      { to: '/participation', icon: Send, label: 'Participation inter-dépt.' },
      { to: '/import-enseignants', icon: Users, label: 'Import Enseignants' },
      { to: '/import', icon: Upload, label: 'Import Étudiants (CSV)' },
      { to: '/periode', icon: Settings, label: 'Période' },
    ]},
  ],
  chef_dept: [
    { section: 'Principal', items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
      { to: '/soutenances', icon: Calendar, label: 'Soutenances' },
      { to: '/etudiants', icon: GraduationCap, label: 'Étudiants' },
      { to: '/enseignants', icon: Users, label: 'Enseignants' },
      { to: '/charge-jury', icon: Scale, label: 'Charge Jury' },
    ]},
    { section: 'Outils', items: [
      { to: '/participation', icon: Send, label: 'Participation inter-dépt.' },
      { to: '/import', icon: Upload, label: 'Import CSV' },
    ]},
  ],
  encadrant: [
    { section: 'Principal', items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
      { to: '/mes-etudiants', icon: BookOpen, label: 'Mes Étudiants' },
      { to: '/mon-planning', icon: ClipboardList, label: 'Mon Planning' },
      { to: '/soutenances-du-jour', icon: Clock, label: 'Soutenances du jour' }, 
      { to: '/invitations', icon: Inbox, label: 'Invitations Jury' },
      { to: '/charge-jury', icon: Scale, label: 'Ma Charge Jury' },
      { to: '/disponibilites', icon: UserCheck, label: 'Disponibilités' },
      { to: '/participation', icon: Send, label: 'Participation inter-dépt.' },
    ]},
  ],
};

export default function Sidebar({ collapsed = false }) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();

  const sections = navConfig[user?.role] || [];
  const initials = user ? `${user.prenom?.[0]}${user.nom?.[0]}`.toUpperCase() : 'U';
  const roleLabel = { admin: 'Administrateur', chef_dept: 'Chef de département', encadrant: 'Encadrant' };

  return (
    <aside className={`flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-1">
        {sections.map(({ section, items }) => (
          <div key={section} className="mb-5">
            {!collapsed && <div className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold px-3 mb-2">{section}</div>}
            {items.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) => `flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-all mb-1 ${
                  isActive ? 'bg-blue-50 text-blue-600 font-semibold dark:bg-blue-900/20 dark:text-blue-400' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}>
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0 ${iconColors[to] || 'bg-slate-400'}`}>
                  <Icon size={16} />
                </span>
                {!collapsed && <span className="flex-1">{label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 dark:border-slate-800 p-3 space-y-1">
        <button onClick={toggle} className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-slate-500 hover:text-blue-600 hover:bg-blue-50/60 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors ${collapsed ? 'justify-center' : ''}`}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
          {!collapsed && <span>{dark ? 'Mode clair' : 'Mode sombre'}</span>}
        </button>
        <button onClick={() => navigate('/profil')} className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-slate-500 hover:text-blue-600 hover:bg-blue-50/60 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
            {user?.photo_url ? <img src={urlPhoto(user.photo_url)} alt="" className="w-full h-full object-cover" /> : initials}
          </div>
          {!collapsed && (
            <div className="flex-1 text-left">
              <div className="text-slate-700 dark:text-white text-xs font-medium">{user?.prenom} {user?.nom}</div>
              <div className="text-slate-400 text-[10px]">{roleLabel[user?.role]}</div>
            </div>
          )}
        </button>
        <button onClick={() => { logout(); navigate('/login'); }} className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-red-500/80 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ${collapsed ? 'justify-center' : ''}`}>
          <LogOut size={18} />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  );
}