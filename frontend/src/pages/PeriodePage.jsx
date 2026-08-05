import React, { useEffect, useState, useMemo } from 'react';
import Layout from '../components/layout/Layout';
import { Button, Input } from '../components/ui';
import { adminApi } from '../services/api';
import toast from 'react-hot-toast';
import { Calendar, Clock, Settings, Sparkles } from 'lucide-react';
import { format, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';

const initialForm = {
  date_debut: '', date_fin: '', annee_universitaire: '',
  heure_depart: '08:30', duree_soutenance: 45, duree_pause: 15, max_par_jour: 5,
};

/** Calcule un aperçu de créneaux (client-side) à partir des 3 paramètres, pour affichage immédiat. */
function calculerApercu(heureDepart, duree, pause, nb = 5) {
  if (!heureDepart) return [];
  const [h, m] = heureDepart.split(':').map(Number);
  let totalMinutes = h * 60 + m;
  const creneaux = [];
  for (let i = 0; i < nb; i++) {
    const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
    const mm = String(totalMinutes % 60).padStart(2, '0');
    creneaux.push(`${hh}:${mm}`);
    totalMinutes += Number(duree) + Number(pause);
  }
  return creneaux;
}

export default function PeriodePage() {
  const [periode, setPeriode] = useState(null);
  const [jours, setJours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(initialForm);
  const [generating, setGenerating] = useState(false);
  const [savingJour, setSavingJour] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await adminApi.getPeriode();
      const data = r.data.data;
      setPeriode(data);
      setJours(data?.jours || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const apercu = useMemo(
    () => calculerApercu(form.heure_depart, form.duree_soutenance, form.duree_pause, Math.min(form.max_par_jour || 5, 6)),
    [form.heure_depart, form.duree_soutenance, form.duree_pause, form.max_par_jour]
  );

  const handleGenerate = async () => {
    if (!form.date_debut || !form.date_fin) { toast.error('Dates de début et de fin requises'); return; }
    if (form.date_debut > form.date_fin) { toast.error('La date de début doit précéder la date de fin'); return; }
    setGenerating(true);
    try {
      await adminApi.updatePeriode(form);
      toast.success('Période créée, calendrier généré automatiquement');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Erreur'); }
    finally { setGenerating(false); }
  };

  const toggleJour = async (jour) => {
    if (jour.est_ferie) return; // jours fériés non modifiables
    const dow = new Date(jour.date).getDay();
    if (dow === 0 || dow === 6) return; // weekends non sélectionnables
    const nouveauActif = jour.actif ? 0 : 1;
    setSavingJour(jour.id);
    try {
      await adminApi.updateJour(jour.id, { actif: nouveauActif, max_soutenances: jour.max_soutenances });
      setJours((js) => js.map((j) => (j.id === jour.id ? { ...j, actif: nouveauActif } : j)));
    } catch (e) { toast.error('Erreur lors de la mise à jour du jour'); }
    finally { setSavingJour(null); }
  };

  const updateMax = async (jour, value) => {
    const val = Math.max(1, parseInt(value) || 1);
    setJours((js) => js.map((j) => (j.id === jour.id ? { ...j, max_soutenances: val } : j)));
    try {
      await adminApi.updateJour(jour.id, { actif: jour.actif, max_soutenances: val });
    } catch (e) { toast.error('Erreur lors de la mise à jour du quota'); }
  };

  // Regroupe les jours par mois pour l'affichage calendrier
  const moisGroupes = useMemo(() => {
    if (jours.length === 0) return [];
    const groupes = {};
    jours.forEach((j) => {
      const key = format(new Date(j.date), 'yyyy-MM');
      if (!groupes[key]) groupes[key] = [];
      groupes[key].push(j);
    });
    return Object.entries(groupes);
  }, [jours]);

  return (
    <Layout title="Période & Calendrier" requiredRoles={['admin']}>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-blue-600 dark:text-blue-400 flex items-center gap-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <Calendar size={22} /> Période & Calendrier des Soutenances
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Définissez la plage autorisée, les paramètres de créneaux, puis affinez jour par jour
        </p>
      </div>

      {/* Configuration initiale */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm mb-6">
        <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2 text-sm">
          <Settings size={16} className="text-blue-500" /> Configuration {periode ? '— générer une nouvelle période' : 'initiale'}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Input label="Date de début *" type="date" value={form.date_debut} onChange={set('date_debut')} />
          <Input label="Date de fin *" type="date" value={form.date_fin} onChange={set('date_fin')} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
          <Input label="Heure de départ" type="time" value={form.heure_depart} onChange={set('heure_depart')} />
          <Input label="Durée soutenance (min)" type="number" min={5} value={form.duree_soutenance} onChange={set('duree_soutenance')} />
          <Input label="Durée pause (min)" type="number" min={0} value={form.duree_pause} onChange={set('duree_pause')} />
          <Input label="Max / jour (défaut)" type="number" min={1} value={form.max_par_jour} onChange={set('max_par_jour')} />
        </div>
        <Input label="Année universitaire" value={form.annee_universitaire} onChange={set('annee_universitaire')} placeholder="2025-2026" />

        {/* Aperçu live des créneaux */}
        {apercu.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-start gap-2.5">
            <Sparkles size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Aperçu des créneaux calculés :</strong> {apercu.join(' / ')}...
              <div className="text-xs text-blue-500 mt-1">
                Départ {form.heure_depart}, durée {form.duree_soutenance} min, pause {form.duree_pause} min
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <Button variant="primary" icon={Calendar} onClick={handleGenerate} loading={generating}>
            Générer le calendrier
          </Button>
        </div>
      </div>

      {/* Calendrier interactif */}
      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : jours.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 text-sm">
              <Clock size={16} className="text-blue-500" /> Calendrier de la période active
            </h3>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Ouvert</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-200 dark:bg-slate-700 inline-block" /> Fermé</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-200 inline-block" /> Férié / Weekend</span>
            </div>
          </div>

          <div className="space-y-6">
            {moisGroupes.map(([moisKey, joursDuMois]) => {
              const premierJour = new Date(joursDuMois[0].date);
              const decalage = (getDay(premierJour) + 6) % 7; // grille lundi-first
              return (
                <div key={moisKey}>
                  <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 capitalize">
                    {format(premierJour, 'MMMM yyyy', { locale: fr })}
                  </h4>
                  <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] text-slate-400 uppercase font-semibold mb-1">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => <div key={d}>{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {Array.from({ length: decalage }).map((_, i) => <div key={`empty-${i}`} />)}
                    {joursDuMois.map((j) => {
                      const dow = new Date(j.date).getDay();
                      const nonModifiable = j.est_ferie || dow === 0 || dow === 6;
                      const isSaving = savingJour === j.id;
                      return (
                        <div key={j.id}
                          onClick={() => !nonModifiable && toggleJour(j)}
                          className={`relative rounded-lg p-1.5 text-center border transition-colors ${
                            nonModifiable ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20 cursor-not-allowed'
                            : j.actif ? 'bg-blue-500 border-blue-500 text-white cursor-pointer hover:bg-blue-600'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-300'
                          }`}
                          title={nonModifiable ? 'Jour férié ou weekend — non sélectionnable' : (j.actif ? 'Cliquer pour fermer ce jour' : 'Cliquer pour ouvrir ce jour')}
                        >
                          <div className={`text-xs font-bold ${nonModifiable ? 'text-red-400' : j.actif ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                            {format(new Date(j.date), 'd')}
                          </div>
                          {j.actif && !nonModifiable && (
                            <input
                              type="number" min={1} value={j.max_soutenances}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateMax(j, e.target.value)}
                              className="w-full mt-0.5 text-[10px] text-center bg-white/20 text-white rounded px-0.5 py-0.5 outline-none"
                            />
                          )}
                          {isSaving && <div className="absolute inset-0 bg-white/50 dark:bg-black/50 rounded-lg flex items-center justify-center">
                            <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          </div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-slate-400 mt-4">
            💡 Cliquez sur un jour ouvré pour l'activer/désactiver. Le chiffre affiché dans un jour actif est modifiable :
            c'est le nombre maximum de soutenances autorisées ce jour précis.
          </p>
        </div>
      )}
    </Layout>
  );
}
