import React, { useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import { Button, Badge, EmptyState } from '../components/ui';
import { juryApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Inbox, CheckCircle, XCircle, Clock, AlertTriangle, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const statutConfig = {
  en_attente: { label: 'En attente', color: 'yellow', icon: Clock },
  acceptee: { label: 'Acceptée', color: 'green', icon: CheckCircle },
  refusee: { label: 'Refusée', color: 'red', icon: XCircle },
  expiree: { label: 'Expirée', color: 'slate', icon: AlertTriangle },
};

export default function InvitationsPage() {
  const { user } = useAuth();
  const peutVoirDepartement = user?.role === 'chef_dept' || user?.role === 'admin';
  const [vue, setVue] = useState(peutVoirDepartement ? 'departement' : 'mes_invitations');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async (vueActuelle = vue) => {
    setLoading(true);
    try {
      const r = await juryApi.getInvitations(vueActuelle);
      setList(r.data.data || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(vue); /* eslint-disable-next-line */ }, [vue]);

  const repondre = async (id, reponse) => {
    try {
      await juryApi.repondre({ id, reponse });
      toast.success(reponse === 'acceptee' ? 'Invitation acceptée' : 'Invitation refusée');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Erreur'); }
  };

  const validerExpiration = async (id, reponse) => {
    try {
      await juryApi.validerExpiration({ id, reponse });
      toast.success('Expiration levée');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Erreur'); }
  };

  return (
    <Layout title="Invitations Jury" requiredRoles={['encadrant', 'admin', 'chef_dept']}>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-blue-600 dark:text-blue-400" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Invitations Jury
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {peutVoirDepartement
            ? "Invitations à siéger — les vôtres, et celles de votre département si besoin de valider à leur place"
            : "Vos invitations à siéger en tant que rapporteur ou président"}
        </p>
      </div>

      {peutVoirDepartement && (
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mb-5 w-fit">
          <button onClick={() => setVue('mes_invitations')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${vue === 'mes_invitations' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}>
            Mes invitations
          </button>
          <button onClick={() => setVue('departement')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${vue === 'departement' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}>
            {user?.role === 'admin' ? 'Toutes' : 'Mon département'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : list.length === 0 ? (
        <EmptyState emoji="📬" title="Aucune invitation" desc="Aucune invitation à afficher pour le moment." />
      ) : (
        <div className="space-y-3">
          {list.map((inv) => {
            const st = statutConfig[inv.statut] || statutConfig.en_attente;
            const StIcon = st.icon;
            const estPourAutrui = String(inv.enseignant_id) !== String(user?.id);
            // Le poste (rapporteur/président) de cette soutenance a-t-il déjà été
            // pourvu par un AUTRE enseignant pendant que l'invitation était expirée ?
            const posteDejaPourvu = !!Number(inv.poste_deja_pourvu);

            return (
              <div key={inv.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-wrap items-center gap-4">
                <div className="w-11 h-11 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
                  <Inbox size={18} />
                </div>
                <div className="flex-1 min-w-[220px]">
                  <p className="font-semibold text-slate-800 dark:text-white text-sm">
                    Soutenance de {inv.etudiant} — rôle : <span className="capitalize">{inv.role}</span>
                  </p>
                  <p className="text-xs text-slate-500 truncate max-w-md">{inv.titre_sujet}</p>
                  {estPourAutrui && (
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mt-1">
                      <User size={11} /> Concerne : <strong>{inv.enseignant_nom}</strong> (vous pouvez valider en son nom)
                    </p>
                  )}
                  {inv.statut === 'expiree' && posteDejaPourvu && (
                    <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                      <AlertTriangle size={11} /> Poste déjà pourvu par <strong>{inv.titulaire_actuel_nom || 'un autre enseignant'}</strong>
                    </p>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 min-w-[150px]">
                  <div className="flex items-center gap-1"><Calendar size={11} />
                    {inv.date_soutenance ? format(new Date(inv.date_soutenance), 'dd MMM yyyy', { locale: fr }) : 'Date non fixée'}
                  </div>
                  <div className="mt-0.5">Limite de réponse : {format(new Date(inv.date_limite), 'dd MMM yyyy à HH:mm', { locale: fr })}</div>
                </div>
                <Badge color={st.color}><StIcon size={11} className="inline mr-1" />{st.label}</Badge>

                {inv.statut === 'en_attente' && (
                  <div className="flex gap-2">
                    <Button size="xs" variant="primary" icon={CheckCircle} onClick={() => repondre(inv.id, 'acceptee')}>Accepter</Button>
                    <Button size="xs" variant="danger" icon={XCircle} onClick={() => repondre(inv.id, 'refusee')}>Refuser</Button>
                  </div>
                )}
                {inv.statut === 'expiree' && !posteDejaPourvu && (
                  <div className="flex gap-2">
                    <Button size="xs" variant="outline" onClick={() => validerExpiration(inv.id, 'acceptee')}>Lever l'expiration → Accepter</Button>
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