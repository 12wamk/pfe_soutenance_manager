import React, { useState, useRef } from 'react';
import Layout from '../components/layout/Layout';
import { Button, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { authApi, urlPhoto } from '../services/api';
import toast from 'react-hot-toast';
import { Lock, Camera, User as UserIcon, Save } from 'lucide-react';

export default function ProfilPage() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(urlPhoto(user?.photo_url));
  const fileInputRef = useRef(null);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Veuillez sélectionner une image'); return; }
    if (file.size > 3 * 1024 * 1024) { toast.error('Image trop volumineuse (max 3 Mo)'); return; }

    // Aperçu immédiat pendant l'upload
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);

    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append('photo', file);
    try {
      const r = await authApi.updatePhoto(formData);
      const nouvelleUrl = urlPhoto(r.data.data.photo_url) + '?t=' + Date.now(); // cache-busting
      setPhotoPreview(nouvelleUrl);
      updateUser({ photo_url: r.data.data.photo_url });
      toast.success('Photo de profil mise à jour');
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'envoi de la photo");
      setPhotoPreview(urlPhoto(user?.photo_url)); // revert en cas d'échec
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleChange = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm) { toast.error('Les nouveaux mots de passe ne correspondent pas'); return; }
    if (form.new_password.length < 6) { toast.error('Mot de passe trop court (min 6 caractères)'); return; }
    setLoading(true);
    try {
      await authApi.updatePassword(form);
      toast.success('Mot de passe mis à jour avec succès !');
      setForm({ current_password: '', new_password: '', confirm: '' });
    } catch (e) {
      toast.error(e.response?.data?.message || 'Erreur');
    } finally { setLoading(false); }
  };

  const roleLabels = { admin: 'Administrateur', chef_dept: 'Chef de département', encadrant: 'Encadrant' };
  const initials = user ? `${user.prenom?.[0] || ''}${user.nom?.[0] || ''}`.toUpperCase() : '';

  return (
    <Layout title="Mon Profil">
      <div className="flex justify-center">
        <div className="w-full max-w-xl space-y-6 py-4">

          {/* Carte principale : photo + infos, façon modal centrée */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">

            {/* En-tête dégradé bleu */}
            <div className="px-6 py-5 text-white flex items-center gap-2.5"
              style={{ background: 'linear-gradient(135deg, #1a5276 0%, #2980d9 100%)' }}>
              <UserIcon size={19} />
              <h2 className="font-bold text-base" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Mon Profil</h2>
            </div>

            <div className="p-6">
              {/* Avatar centré */}
              <div className="flex flex-col items-center text-center pb-6 mb-6 border-b border-slate-100 dark:border-slate-800">
                <div className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold overflow-hidden mb-4 flex-shrink-0"
                  style={{ background: photoPreview ? 'transparent' : 'linear-gradient(135deg, #2980d9, #1a5276)' }}>
                  {photoPreview ? (
                    <img src={photoPreview} alt="Photo de profil" className="w-full h-full object-cover" />
                  ) : (
                    initials || <UserIcon size={32} />
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  {uploadingPhoto ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Camera size={15} />}
                  {uploadingPhoto ? 'Envoi en cours...' : 'Changer la photo'}
                </button>

                <h3 className="text-lg font-bold text-slate-800 dark:text-white mt-4">{user?.prenom} {user?.nom}</h3>
                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-0.5 rounded-full font-semibold mt-1.5 inline-block">
                  {roleLabels[user?.role]}
                </span>
              </div>

              {/* Champs infos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Prénom</label>
                  <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-sm">
                    {user?.prenom}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nom</label>
                  <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-sm">
                    {user?.nom}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Email</label>
                  <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-sm">
                    {user?.email}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Changer le mot de passe */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-5 flex items-center gap-2">
              <Lock size={16} /> Changer le mot de passe
            </h3>
            <form onSubmit={handleChange} className="space-y-4">
              <Input label="Mot de passe actuel *" type="password" value={form.current_password} onChange={set('current_password')} placeholder="••••••••" />
              <Input label="Nouveau mot de passe *" type="password" value={form.new_password} onChange={set('new_password')} placeholder="Min. 6 caractères" />
              <Input label="Confirmer le nouveau mot de passe *" type="password" value={form.confirm} onChange={set('confirm')} placeholder="••••••••" />
              <div className="flex justify-end pt-2">
                <Button type="submit" variant="primary" icon={Save} loading={loading} className="!bg-blue-600 hover:!bg-blue-700">
                  Mettre à jour le mot de passe
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
