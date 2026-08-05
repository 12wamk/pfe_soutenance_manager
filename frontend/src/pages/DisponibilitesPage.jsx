import React, { useEffect, useState, useMemo } from 'react';
import Layout from '../components/layout/Layout';
import { adminApi, soutenancesApi } from '../services/api';
import toast from 'react-hot-toast';
import { UserCheck, UserX, Calendar as CalendarIcon } from 'lucide-react';
import { format, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function DisponibilitesPage() {
  const [jours, setJours] = useState([]);
  const [dispos, setDispos] = useState({});
  const [charge, setCharge] = useState({});
  const [maxParJour, setMaxParJour] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [periodeRes, dispoRes] = await Promise.all([adminApi.getPeriode(), soutenancesApi.getDisponibilites()]);
      const joursCalendrier = periodeRes.data.data?.jours || [];
      setJours(joursCalendrier);

      const maxMap = {};
      joursCalendrier.forEach((j) => { maxMap[j.date] = j.max_soutenances; });
      setMaxParJour(maxMap);

      const dispoMap = {};
      (dispoRes.data.data.disponibilites || []).forEach((d) => { dispoMap[d.date] = d.statut; });
      setDispos(dispoMap);

      const chargeMap = {};
      (dispoRes.data.data.charge || []).forEach((c) => { chargeMap[c.date] = c.total; });
      setCharge(chargeMap);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (dateStr, statut) => {
    setSaving(dateStr);
    try {
      await soutenancesApi.setDisponibilite({ date: dateStr, statut });
      setDispos((d) => ({ ...d, [dateStr]: statut }));
      toast.success(`Marqué comme ${statut === 'disponible' ? 'disponible' : 'absent'}`);
    } catch (e) { toast.error(e.response?.data?.message || 'Erreur'); }
    finally { setSaving(null); }
  };

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

  const chargeColor = (nb, max) => {
    if (!nb) return null;
    const ratio = nb / max;
    if (ratio >= 1) return 'bg-red-500'; // 🔴 maximum
    if (ratio >= 0.6) return 'bg-orange-400'; // 🟡 chargé
    return 'bg-green-500'; // 🟢 disponible
  };

  return (
    <Layout title="Disponibilités" requiredRoles={['encadrant', 'admin', 'chef_dept']}>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-blue-600 dark:text-blue-400 flex items-center gap-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <CalendarIcon size={22} /> Mes Disponibilités
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Cliquez sur un jour ouvré pour basculer Disponible / Absent — jours fériés et weekends non modifiables
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : jours.length === 0 ? (
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-6 text-sm text-orange-700 dark:text-orange-300">
          Aucune période de soutenances n'a encore été configurée par l'administrateur.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex items-center gap-4 text-xs text-slate-500 mb-4 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Disponible</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-300 inline-block" /> Non renseigné</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-500 inline-block" /> Absent</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-200 inline-block" /> Férié / Weekend</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Point = charge du jour</span>
          </div>

          <div className="space-y-6">
            {moisGroupes.map(([moisKey, joursDuMois]) => {
              const premierJour = new Date(joursDuMois[0].date);
              const decalage = (getDay(premierJour) + 6) % 7;
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
                      const nonModifiable = j.est_ferie || dow === 0 || dow === 6 || !j.actif;
                      const statut = dispos[j.date];
                      const nbCharge = charge[j.date] || 0;
                      const isSaving = saving === j.date;
                      const dot = chargeColor(nbCharge, maxParJour[j.date] || 5);

                      let bg = 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
                      if (nonModifiable) bg = 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20';
                      else if (statut === 'disponible') bg = 'bg-green-500 border-green-500 text-white';
                      else if (statut === 'absent') bg = 'bg-slate-500 border-slate-500 text-white';

                      return (
                        <div key={j.id} className={`relative rounded-lg p-1.5 text-center border ${bg} ${!nonModifiable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                          title={nonModifiable ? 'Non modifiable (férié / weekend / jour fermé)' : 'Cliquer pour changer le statut'}
                          onClick={() => {
                            if (nonModifiable) return;
                            const next = statut === 'disponible' ? 'absent' : 'disponible';
                            toggle(j.date, next);
                          }}>
                          <div className={`text-xs font-bold ${nonModifiable ? 'text-red-400' : ''}`}>{format(new Date(j.date), 'd')}</div>
                          {dot && <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${dot}`} title={`${nbCharge} soutenance(s) ce jour`} />}
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
        </div>
      )}
    </Layout>
  );
}
