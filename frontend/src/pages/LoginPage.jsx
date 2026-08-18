import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, User, Lock, LogIn, ShieldCheck, Zap } from 'lucide-react';
import bgImage from './img/image_1e50e3d2.png';

const COMPTES_DEMO = [
  { role: 'Admin', email: 'admin@enetcom.tn', color: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' },
  { role: 'Chef dépt', email: 'chef@enetcom.tn', color: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100' },
  { role: 'Encadrant', email: 'chokri.abdelmoula@enetcom.usf.tn', color: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100' },
  { role: 'Encadrant', email: 'mohamed.ghorbel@enetcom.usf.tn', color: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100' },
  { role: 'Encadrant', email: 'soufien.hajji@enetcom.usf.tn', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
];

const MDP_DEMO = 'password123';

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [show, setShow] = useState(false);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error('Email et mot de passe requis'); return; }
    setSubmitting(true);
    try {
      await login(form.email, form.password);
      toast.success('Connexion réussie');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Email ou mot de passe incorrect');
    } finally {
      setSubmitting(false);
    }
  };

  const loginRapide = async (email) => {
    setForm({ email, password: MDP_DEMO });
    setSubmitting(true);
    try {
      await login(email, MDP_DEMO);
      toast.success(`Connexion : ${email.split('@')[0]}`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Email ou mot de passe incorrect');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #dde8f8 0%, #c8d8f0 40%, #e8eef8 100%)' }}>

      <div className="w-full max-w-4xl mx-4 rounded-2xl shadow-2xl overflow-hidden flex"
        style={{ minHeight: '520px', background: 'white' }}>

        {/* ── LEFT PANEL – Form ── */}
        <div className="flex flex-col justify-between w-[55%] px-12 py-10 bg-white relative z-10">
          <div>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <span className="text-3xl">🎓</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Bienvenue</h1>
                <p className="text-sm text-slate-500">Connexion à votre espace</p>
                <p className="text-sm text-slate-500">
                  Gestion des Soutenances Universitaires –{' '}
                  <span className="text-blue-600 font-medium">ENET'COM</span>
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-3 border border-slate-200 rounded-lg px-4 py-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all bg-white">
                <User size={18} className="text-slate-400 flex-shrink-0" />
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="Nom d'utilisateur ou email"
                  className="flex-1 text-sm text-slate-700 placeholder-slate-400 outline-none bg-transparent"
                />
              </div>

              <div className="flex items-center gap-3 border border-slate-200 rounded-lg px-4 py-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all bg-white">
                <Lock size={18} className="text-slate-400 flex-shrink-0" />
                <input
                  type={show ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Mot de passe"
                  className="flex-1 text-sm text-slate-700 placeholder-slate-400 outline-none bg-transparent"
                />
                <button type="button" onClick={() => setShow(s => !s)} className="text-slate-400 hover:text-slate-600">
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-lg text-white font-semibold text-sm transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(90deg, #1a3a8f 0%, #1e4db7 100%)' }}
              >
                {submitting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <LogIn size={17} />}
                {submitting ? 'Connexion...' : 'Se connecter'}
              </button>

              <div className="text-center">
                <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline">
                  Mot de passe oublié?
                </Link>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">ou</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <p className="text-center text-sm text-slate-500">
                Pas de compte ?{' '}
                <Link to="/register" className="text-blue-600 font-medium hover:underline">
                  Créer un compte encadrant
                </Link>
              </p>
            </form>

            <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
              <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                <Zap size={13} className="text-amber-500" /> Connexion rapide (démo)
              </p>
              <div className="flex flex-wrap gap-2">
                {COMPTES_DEMO.map((c) => (
                  <button
                    key={c.email}
                    type="button"
                    disabled={submitting}
                    onClick={() => loginRapide(c.email)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors disabled:opacity-50 ${c.color}`}
                  >
                    {c.role}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck size={14} className="text-blue-600" />
            <span>Accès sécurisé | <span className="text-blue-600">ENET'COM</span> © 2026 - Tous droits réservés</span>
          </div>
        </div>

        {/* ── DIAGONAL DIVIDER ── */}
        <div className="relative w-0">
          <div className="absolute inset-y-0 -left-8 w-16 z-20"
            style={{ background: 'white', clipPath: 'polygon(0 0, 0% 100%, 100% 100%)' }}
          />
        </div>

        {/* ── RIGHT PANEL – Image only ── */}
        <div className="flex-1 relative overflow-hidden"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}>
        </div>

      </div>
    </div>
  );
}