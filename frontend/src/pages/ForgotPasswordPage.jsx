import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '../services/api';
import { Mail, ArrowLeft, ShieldCheck, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [envoye, setEnvoye] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) { toast.error('Email requis'); return; }
    setSubmitting(true);
    try {
      await authApi.forgotPassword({ email });
      setEnvoye(true);
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
            <span className="text-2xl">🎓</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Mot de passe oublié</h1>
            <p className="text-sm text-slate-500">ENET'COM – Gestion des Soutenances</p>
          </div>
        </div>

        {envoye ? (
          <div className="text-center py-6">
            <CheckCircle size={44} className="mx-auto text-green-500 mb-4" />
            <p className="text-slate-700 text-sm leading-relaxed">
              Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.
              Il est valable 1 heure. Vérifiez votre boîte mail.
            </p>
            <Link to="/login" className="inline-flex items-center gap-2 mt-6 text-sm text-blue-600 hover:underline">
              <ArrowLeft size={15} /> Retour à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-slate-500 mb-4">
              Saisissez votre adresse email : nous vous enverrons un lien pour réinitialiser votre mot de passe.
            </p>
            <div className="flex items-center gap-3 border border-slate-200 rounded-lg px-4 py-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all bg-white">
              <Mail size={18} className="text-slate-400 flex-shrink-0" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre.email@enetcom.tn"
                className="flex-1 text-sm text-slate-700 placeholder-slate-400 outline-none bg-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-lg text-white font-semibold text-sm transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(90deg, #1a3a8f 0%, #1e4db7 100%)' }}
            >
              {submitting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Envoyer le lien'}
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