import React, { useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { adminApi, departementsApi } from '../services/api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Users, GraduationCap, Calendar, CheckCircle, Clock, XCircle, CalendarDays,
  Upload, Settings, ArrowRight, ClipboardList, UserCheck, BookOpen,
  Inbox, Building2, Send, Scale, TrendingUp, AlertTriangle, MinusCircle, RotateCcw
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

/* Petite carte stat blanche avec icône carrée colorée, façon MagPro (124 Clients, 38 Fournisseurs...) */
function StatTile({ value, label, icon: Icon, gradient }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0 ${gradient}`}>
        <Icon size={22} />
      </div>
      <div>
        <div className="text-2xl font-extrabold text-slate-800 dark:text-white leading-none" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {value ?? 0}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</div>
      </div>
    </div>
  );
}

/* Carte module cliquable, façon "Gestion des Clients" / "Gestion des Fournisseurs" */
function ModuleCard({ to, icon: Icon, gradient, title, desc }) {
  return (
    <Link to={to} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 flex items-start gap-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-blue-300 transition-all group">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0 ${gradient}`}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-2">{desc}</p>
        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 inline-flex items-center gap-1.5">
          Accéder <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
        </span>
      </div>
    </Link>
  );
}

function AdminDashboard({ stats }) {
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    if (!window.confirm('Réinitialiser TOUTES les données de démonstration ? Cette action supprime toutes les modifications actuelles.')) return;
    if (!window.confirm('Dernière confirmation : la base sera entièrement recréée (étudiants, soutenances, invitations, notifications).')) return;
    setResetting(true);
    try {
      const r = await adminApi.resetData();
      toast.success(r.data?.message || 'Données réinitialisées');
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Erreur pendant la réinitialisation');
    } finally {
      setResetting(false);
    }
  };

  const parJourData = (stats.par_jour || []).map(d => ({
    date: format(new Date(d.date_soutenance), 'dd/MM', { locale: fr }),
    total: parseInt(d.total),
  }));

  const pieData = [
    { name: 'Validées', value: parseInt(stats.soutenances_validees || 0) },
    { name: 'En attente', value: parseInt(stats.soutenances_en_attente || 0) },
    { name: 'Refusées', value: parseInt(stats.soutenances_refusees || 0) },
    { name: 'Sans date', value: parseInt(stats.sans_date || 0) },
  ].filter(d => d.value > 0);

  const pieDataSpecialite = (stats.par_specialite || [])
    .map(s => ({ name: s.nom, value: parseInt(s.total || 0) }))
    .filter(d => d.value > 0);

  return (
    <div className="space-y-7">

      {/* HERO bleu façon "Administration du Magasin" */}
      <div className="rounded-2xl p-7 flex flex-wrap items-center justify-between gap-5 shadow-md"
        style={{ background: 'linear-gradient(135deg, #1a5276 0%, #2471a3 60%, #2980d9 100%)' }}>
        <div>
          <h1 className="text-2xl font-extrabold text-white mb-1.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Administration des Soutenances
          </h1>
          <p className="text-white/80 text-sm">Gérez vos étudiants, enseignants et soutenances en toute simplicité</p>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <Link to="/etudiants" className="flex flex-col items-center gap-1.5 bg-white/15 border border-white/25 hover:bg-white/25 transition-colors rounded-xl px-4 py-3 text-white text-xs font-semibold min-w-[72px]">
            <GraduationCap size={20} /> Étudiants
          </Link>
          <Link to="/enseignants" className="flex flex-col items-center gap-1.5 bg-white/15 border border-white/25 hover:bg-white/25 transition-colors rounded-xl px-4 py-3 text-white text-xs font-semibold min-w-[72px]">
            <Users size={20} /> Enseignants
          </Link>
          <Link to="/soutenances" className="flex flex-col items-center gap-1.5 bg-white/15 border border-white/25 hover:bg-white/25 transition-colors rounded-xl px-4 py-3 text-white text-xs font-semibold min-w-[72px]">
            <Calendar size={20} /> Soutenances
          </Link>
          <Link to="/import" className="flex flex-col items-center gap-1.5 bg-white/15 border border-white/25 hover:bg-white/25 transition-colors rounded-xl px-4 py-3 text-white text-xs font-semibold min-w-[72px]">
            <Upload size={20} /> Import
          </Link>
          <Link to="/periode" className="flex flex-col items-center gap-1.5 bg-white/15 border border-white/25 hover:bg-white/25 transition-colors rounded-xl px-4 py-3 text-white text-xs font-semibold min-w-[72px]">
            <Settings size={20} /> Période
          </Link>
        </div>
      </div>

      {/* Stats principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile value={stats.total_etudiants} label="Étudiants" icon={GraduationCap} gradient="bg-gradient-to-br from-blue-500 to-blue-600" />
        <StatTile value={stats.total_enseignants} label="Enseignants" icon={Users} gradient="bg-gradient-to-br from-purple-500 to-purple-600" />
        <StatTile value={stats.total_soutenances} label="Soutenances" icon={Calendar} gradient="bg-gradient-to-br from-sky-500 to-sky-600" />
        <StatTile value={stats.soutenances_validees} label="Validées" icon={CheckCircle} gradient="bg-gradient-to-br from-green-500 to-green-600" />
      </div>

      {/* Stats secondaires : en attente / refusées / sans date */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-yellow-200 dark:border-yellow-900/40 p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600 flex-shrink-0">
            <Clock size={18} />
          </div>
          <div>
            <p className="text-[11px] text-yellow-700 dark:text-yellow-400 font-bold uppercase tracking-wide">En attente</p>
            <p className="text-xl font-extrabold text-slate-800 dark:text-white">{stats.soutenances_en_attente}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-900/40 p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 flex-shrink-0">
            <XCircle size={18} />
          </div>
          <div>
            <p className="text-[11px] text-red-600 dark:text-red-400 font-bold uppercase tracking-wide">Refusées</p>
            <p className="text-xl font-extrabold text-slate-800 dark:text-white">{stats.soutenances_refusees}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 flex-shrink-0">
            <CalendarDays size={18} />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Sans date</p>
            <p className="text-xl font-extrabold text-slate-800 dark:text-white">{stats.sans_date}</p>
          </div>
        </div>
      </div>

      {/* Taux de validation + Invitations jury + Départements + Demandes en attente */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-green-500" />
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Taux de validation</p>
          </div>
          <p className="text-2xl font-extrabold text-slate-800 dark:text-white">
            {stats.taux_validation !== null ? `${stats.taux_validation}%` : '—'}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">sur soutenances traitées</p>
        </div>
        <Link to="/invitations" className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:border-blue-300 transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <Inbox size={14} className="text-orange-500" />
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Invitations en attente</p>
          </div>
          <p className="text-2xl font-extrabold text-slate-800 dark:text-white">{stats.invitations_en_attente}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{stats.invitations_expirees} expirée(s)</p>
        </Link>
        <Link to="/options" className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:border-blue-300 transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={14} className="text-teal-500" />
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Départements</p>
          </div>
          <p className="text-2xl font-extrabold text-slate-800 dark:text-white">{stats.total_departements}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{stats.total_options} option(s)</p>
        </Link>
        <Link to="/participation" className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:border-blue-300 transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <Send size={14} className="text-indigo-500" />
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide">Demandes participation</p>
          </div>
          <p className="text-2xl font-extrabold text-slate-800 dark:text-white">{stats.demandes_participation_attente}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">en attente</p>
        </Link>
      </div>

      {/* Réciprocité jury globale */}
      <div>
        <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-2">
          <Scale size={15} className="text-pink-500" /> Réciprocité Jury — vue d'ensemble
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-green-200 dark:border-green-900/40 p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 flex-shrink-0">
              <CheckCircle size={18} />
            </div>
            <div>
              <p className="text-[11px] text-green-700 dark:text-green-400 font-bold uppercase tracking-wide">Équilibrés</p>
              <p className="text-xl font-extrabold text-slate-800 dark:text-white">{stats.jury_equilibres}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-orange-200 dark:border-orange-900/40 p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 flex-shrink-0">
              <MinusCircle size={18} />
            </div>
            <div>
              <p className="text-[11px] text-orange-700 dark:text-orange-400 font-bold uppercase tracking-wide">Sous-sollicités</p>
              <p className="text-xl font-extrabold text-slate-800 dark:text-white">{stats.jury_sous_sollicites}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-900/40 p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 flex-shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="text-[11px] text-red-700 dark:text-red-400 font-bold uppercase tracking-wide">Sur-sollicités</p>
              <p className="text-xl font-extrabold text-slate-800 dark:text-white">{stats.jury_sur_sollicites}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {parJourData.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-4 text-sm">Soutenances par jour</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={parJourData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }} />
                <Bar dataKey="total" fill="#2980d9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {pieData.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-4 text-sm">Répartition par statut</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {pieDataSpecialite.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm lg:col-span-2">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-4 text-sm">Répartition par spécialité</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieDataSpecialite} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                  {pieDataSpecialite.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Prochaines soutenances */}
      {stats.prochaines?.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Prochaines soutenances</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {stats.prochaines.map(s => (
              <div key={s.id} className="px-5 py-3 flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                  {s.heure?.substring(0, 5)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">{s.etudiant}</p>
                  <p className="text-xs text-slate-500 truncate max-w-xs">{s.titre_sujet}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {format(new Date(s.date_soutenance), 'dd MMM', { locale: fr })}
                  </p>
                  <p className="text-xs text-slate-400">{s.salle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mode développeur — réinitialisation des données de démonstration */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-amber-300 dark:border-amber-900/40 p-5 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 flex-shrink-0">
              <RotateCcw size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-white">Mode développeur</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Réinitialise la base avec le jeu de données de démonstration (schema + migrations).
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={resetting}
            onClick={handleReset}
            className="px-4 py-2.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-60 flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
          >
            {resetting ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <RotateCcw size={14} />}
            {resetting ? 'Réinitialisation...' : 'Réinitialiser les données de démo'}
          </button>
        </div>
      </div>

    </div>
  );
}

function EncadrantDashboard({ user }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-7 text-white shadow-md"
        style={{ background: 'linear-gradient(135deg, #1a5276 0%, #2471a3 60%, #2980d9 100%)' }}>
        <p className="text-white/75 text-sm mb-1">Bienvenue,</p>
        <h2 className="text-2xl font-extrabold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{user.prenom} {user.nom}</h2>
        <p className="text-white/75 text-sm mt-2">Encadrant PFE – ENETCOM Sfax</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ModuleCard to="/mes-etudiants" icon={BookOpen} gradient="bg-gradient-to-br from-blue-500 to-blue-600"
          title="Mes Étudiants" desc="Planifier des soutenances pour vos étudiants" />
        <ModuleCard to="/mon-planning" icon={ClipboardList} gradient="bg-gradient-to-br from-sky-500 to-sky-600"
          title="Mon Planning" desc="Voir mes soutenances à venir" />
        <ModuleCard to="/disponibilites" icon={UserCheck} gradient="bg-gradient-to-br from-purple-500 to-purple-600"
          title="Disponibilités" desc="Gérer mes absences et créneaux" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [departements, setDepartements] = useState([]);
  const [deptSelectionne, setDeptSelectionne] = useState('');

  useEffect(() => {
    if (user?.role !== 'encadrant') {
      setLoading(true);
      adminApi.getStats(deptSelectionne ? { departement_id: deptSelectionne } : {})
        .then(r => setStats(r.data.data)).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user, deptSelectionne]);

  useEffect(() => {
    if (user?.role === 'admin') {
      departementsApi.getAll().then((r) => setDepartements(r.data.data || []));
    }
  }, [user]);

  return (
    <Layout title="Tableau de bord">
      {user?.role === 'admin' && departements.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Vue :</label>
          <select value={deptSelectionne} onChange={(e) => setDeptSelectionne(e.target.value)}
            className="px-3.5 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-800 dark:text-white">
            <option value="">🌐 Tous les départements</option>
            {departements.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
          </select>
        </div>
      )}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : user?.role === 'encadrant' ? (
        <EncadrantDashboard user={user} />
      ) : stats ? (
        <AdminDashboard stats={stats} />
      ) : null}
    </Layout>
  );
}
