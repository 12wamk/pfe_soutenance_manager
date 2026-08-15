import React, { useState, useRef, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { Button, Input } from '../components/ui';
import ExpertiseSelector from '../components/ExpertiseSelector';
import { useAuth } from '../context/AuthContext';
import { authApi, urlPhoto } from '../services/api';
import toast from 'react-hot-toast';
import { Lock, Camera, User as UserIcon, Save, GraduationCap, Plus, X } from 'lucide-react';

function ChipInput({ value, onChange, placeholder, accent }) {
  const [newTag, setNewTag] = useState('');
  const add = () => {
    const v = newTag.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setNewTag('');
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map(tag => (
          <span key={tag} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${accent}`}>
            {tag}
            <button onClick={() => onChange(value.filter(t => t !== tag))} className="opacity-70 hover:opacity-100">
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="flex-1 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button onClick={add} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700">
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

export default function ProfilPage() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(urlPhoto(user?.photo_url));
  const [savingExpertise, setSavingExpertise] = useState(false);
  const [expertise, setExpertise] = useState({
    expertises: user?.expertises || [],
    enseignements: user?.enseignements || [],
    domaines_recherche: user?.domaines_recherche || [],
    bio_courte: user?.bio_courte || '',
  });
  const fileInputRef = useRef(null);

  // Recharge le profil complet (expertises, enseignements, bio) au montage
  useEffect(() => {
    authApi.me()
      .then((r) => {
        const u = r.data.data;
        setExpertise({
          expertises: u.expertises || [],
          enseignements: u.enseignements || [],
          domaines_recherche: u.domaines_recherche || [],
          bio_courte: u.bio_courte || '',
        });
      })
      .catch(() => {});
  }, []);

  const saveExpertise = async () => {
    setSavingExpertise(true);
    try {
      await authApi.updateProfileExpertise({
        expertises: expertise.expertises,
        enseignements: expertise.enseignements,
        domaines_recherche: expertise.domaines_recherche,
        bio_courte: expertise.bio_courte,
      });
      updateUser({
        expertises: expertise.expertises,
        enseignements: expertise.enseignements,
        domaines_recherche: expertise.domaines_recherche,
        bio_courte: expertise.bio_courte,
      });
      toast.success("Description enregistrée — l'IA l'utilisera pour suggérer les jurys");
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement");
    } finally {
      setSavingExpertise(false);
    }
  };

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

          {/* Mon expertise & mes enseignements — alimentent l'IA de suggestion de planning */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2">
              <GraduationCap size={16} /> Mon expertise & mes enseignements
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              L'intelligence artificielle s'appuie sur cette description pour suggérer les jurys et le planning (matching thématique).
            </p>

            <ExpertiseSelector
              expertises={expertise.expertises}
              enseignements={expertise.enseignements}
              onChange={(patch) => setExpertise(prev => ({ ...prev, ...patch }))}
            />

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Domaines de recherche
              </label>
              <p className="text-xs text-slate-500 mb-2">Thématiques de vos travaux (renforcent le matching)</p>
              <ChipInput
                value={expertise.domaines_recherche}
                onChange={(v) => setExpertise(prev => ({ ...prev, domaines_recherche: v }))}
                placeholder="Ajouter un domaine..."
                accent="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Décrivez ce que vous connaissez et ce que vous enseignez
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Texte libre analysé par l'IA pour la suggestion des jurys (ex : « Je supervise des projets en intelligence
                artificielle et big data. J'enseigne les bases de données et l'algorithmique. »)
              </p>
              <textarea
                value={expertise.bio_courte}
                onChange={(e) => setExpertise(prev => ({ ...prev, bio_courte: e.target.value }))}
                rows={4}
                placeholder="Votre description..."
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button variant="primary" icon={Save} loading={savingExpertise} onClick={saveExpertise} className="!bg-blue-600 hover:!bg-blue-700">
                Enregistrer la description
              </Button>
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
