import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '../services/api';
import { Lock, ArrowLeft, ShieldCheck, CheckCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reinitialise, setReinitialise] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) { toast.error('Lien de réinitialisation invalide'); return; }
    if (!password || !confirm) { toast.error('Veuillez remplir tous les champs'); return; }
    if (password !== confirm) { toast.error('Les mots de passe ne correspondent pas'); return; }
    setSubmitting(true);
    try {
      await authApi.resetPassword({ token, password });
      setReinitialise(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #dde8f8 0%, #c8d8f0 40%, #e8eef8 100%)' }}>
      <div className="w-full max-w-md mx-4 rounded-2xl shadow-2xl overflow-hidden bg-white p-10">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">🔑</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Nouveau mot de passe</h1>
            <p className="text-sm text-slate-500">ENET'COM – Gestion des Soutenances</p>
          </div>
        </div>

        {!token ? (
          <div className="text-center py-6">
            <p className="text-slate-700 text-sm">Lien de réinitialisation invalide ou manquant.</p>
            <Link to="/forgot-password" className="inline-flex items-center gap-2 mt-6 text-sm text-blue-600 hover:underline">
              <ArrowLeft size={15} /> Refaire une demande
            </Link>
          </div>
        ) : reinitialise ? (
          <div className="text-center py-6">
            <CheckCircle size={44} className="mx-auto text-green-500 mb-4" />
            <p className="text-slate-700 text-sm">Mot de passe réinitialisé avec succès. Redirection vers la connexion...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-slate-500 mb-4">Choisissez un nouveau mot de passe (min. 6 caractères).</p>
            <div className="flex items-center gap-3 border border-slate-200 rounded-lg px-4 py-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all bg-white">
              <Lock size={18} className="text-slate-400 flex-shrink-0" />
              <input
                type={show ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nouveau mot de passe"
                className="flex-1 text-sm text-slate-700 placeholder-slate-400 outline-none bg-transparent"
              />
            </div>
            <div className="flex items-center gap-3 border border-slate-200 rounded-lg px-4 py-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all bg-white">
              <Lock size={18} className="text-slate-400 flex-shrink-0" />
              <input
                type={show ? 'text' : 'password'}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirmer le mot de passe"
                className="flex-1 text-sm text-slate-700 placeholder-slate-400 outline-none bg-transparent"
              />
              <button type="button" onClick={() => setShow((s) => !s)} className="text-slate-400 hover:text-slate-600 text-xs font-semibold">
                {show ? 'Masquer' : 'Voir'}
              </button>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-lg text-white font-semibold text-sm transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(90deg, #1a3a8f 0%, #1e4db7 100%)' }}
            >
              {submitting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Réinitialiser'}
            </button>
            <div className="text-center">
              <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                <ArrowLeft size={14} /> Retour à la connexion
              </Link>
            </div>
          </form>
        )}

        <div className="mt-8 flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck size={14} className="text-blue-600" />
          <span>Accès sécurisé | <span className="text-blue-600">ENET'COM</span> © 2026 - Tous droits réservés</span>
        </div>
      </div>
    </div>
  );
}