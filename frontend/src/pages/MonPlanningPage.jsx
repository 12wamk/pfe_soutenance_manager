import React, { useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import { Badge, EmptyState, Button } from '../components/ui';
import { soutenancesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Calendar, MapPin, Clock, CheckCircle, XCircle, Send } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const statutConfig = {
  planifiee: { label: 'En attente', color: 'yellow', icon: Clock },
  validee: { label: 'Validée', color: 'green', icon: CheckCircle },
  refusee: { label: 'Refusée', color: 'red', icon: XCircle },
};

export default function MonPlanningPage() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  // Clé "soutenanceId-role" en cours d'envoi, pour désactiver le bon bouton uniquement
  const [envoiEnCours, setEnvoiEnCours] = useState(null);

  useEffect(() => {
    soutenancesApi.getAll().then((r) => setList(r.data.data || [])).finally(() => setLoading(false));
  }, []);

  const envoyerAgenda = async (soutenanceId, role) => {
    const cle = `${soutenanceId}-${role}`;
    setEnvoiEnCours(cle);
    try {
      const r = await soutenancesApi.envoyerAgenda({ soutenance_id: soutenanceId, role });
      toast.success(r.data.message || 'Invitation calendrier envoyée');
    } catch (e) {
      toast.error(e.response?.data?.message || "Échec de l'envoi");
    } finally {
      setEnvoiEnCours(null);
    }
  };

  return (
    <Layout title="Mon Planning" requiredRoles={['encadrant']}>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-blue-600 dark:text-blue-400" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Mon Planning
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Vos soutenances en tant qu'encadrant, rapporteur ou président</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : list.length === 0 ? (
        <EmptyState emoji="📅" title="Aucune soutenance planifiée" desc="Votre planning est vide pour le moment." />
      ) : (
        <div className="space-y-3">
          {list.map((s) => {
            const st = statutConfig[s.statut] || statutConfig.planifiee;
            const StIcon = st.icon;
            // Seul l'encadrant de CETTE soutenance peut envoyer l'agenda au jury
            // (l'API refuse sinon) ; et il faut une date+heure pour générer un événement.
            const estMonEncadrement = String(s.encadrant_id) === String(user?.id);
            const peutEnvoyerAgenda = estMonEncadrement && s.date && s.heure;

            return (
              <div key={s.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="w-11 h-11 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                    <Calendar size={18} />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-semibold text-slate-800 dark:text-white text-sm">{s.etudiant_affiche || s.etudiant}</p>
                    <p className="text-xs text-slate-500 truncate max-w-md">{s.titre_sujet}</p>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5 min-w-[160px]">
                    <div>{s.date ? format(new Date(s.date), 'dd MMM yyyy', { locale: fr }) : 'Date non fixée'} {s.heure ? `à ${s.heure.substring(0, 5)}` : ''}</div>
                    {s.salle && <div className="flex items-center gap-1"><MapPin size={11} /> {s.salle}</div>}
                  </div>
                  <Badge color={st.color}><StIcon size={11} className="inline mr-1" />{st.label}</Badge>
                </div>

                {peutEnvoyerAgenda && (s.rapporteur || s.president) && (
                  <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-400 mr-1">Envoyer l'invitation calendrier :</span>
                    {s.rapporteur && (
                      <Button
                        size="xs"
                        variant="outline"
                        icon={Send}
                        loading={envoiEnCours === `${s.id}-rapporteur`}
                        onClick={() => envoyerAgenda(s.id, 'rapporteur')}
                      >
                        Rapporteur ({s.rapporteur})
                      </Button>
                    )}
                    {s.president && (
                      <Button
                        size="xs"
                        variant="outline"
                        icon={Send}
                        loading={envoiEnCours === `${s.id}-president`}
                        onClick={() => envoyerAgenda(s.id, 'president')}
                      >
                        Président ({s.president})
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}