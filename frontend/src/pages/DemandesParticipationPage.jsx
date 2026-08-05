import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import { Button, Modal, Select, Input, Badge, EmptyState } from '../components/ui';
import { juryApi, departementsApi, adminApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Send, CheckCircle, XCircle, Clock, Building2, UserPlus, Inbox, FileOutput } from 'lucide-react';

const statutConfig = {
  en_attente: { label: 'En attente', color: 'yellow', icon: Clock },
  acceptee: { label: 'Acceptée', color: 'green', icon: CheckCircle },
  refusee: { label: 'Refusée', color: 'red', icon: XCircle },
};
const roleLabels = { rapporteur: 'Rapporteur', president: 'Président', les_deux: 'Rapporteur & Président' };

// Formate l'affichage du nombre de fois envisagé/souhaité, séparément par rôle
const formatNombres = (d) => {
  const parts = [];
  if (d.nombre_rapporteur > 0) parts.push(`${d.nombre_rapporteur}× rapporteur`);
  if (d.nombre_president > 0) parts.push(`${d.nombre_president}× président`);
  return parts.join(' · ') || '—';
};

export default function DemandesParticipationPage() {
  const { user } = useAuth();
  const isChef = user?.role === 'chef_dept' || user?.role === 'admin';

  const [onglet, setOnglet] = useState(isChef ? 'recues' : 'invitations');
  const [liste, setListe] = useState([]);
  const [departements, setDepartements] = useState([]);
  const [enseignants, setEnseignants] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalDemande, setModalDemande] = useState(false);
  const [formDemande, setFormDemande] = useState({
    departement_cible_id: '',
    role_souhaite: 'les_deux',
    nombre_rapporteur: 1,
    nombre_president: 1,
    disponibilites_preferees: '',
  });

  const [modalInviter, setModalInviter] = useState(false);
  const [formInviter, setFormInviter] = useState({
    enseignant_id: '',
    departement_id: '',
    role_souhaite: 'les_deux',
    nombre_rapporteur: 1,
    nombre_president: 1,
  });

  const [saving, setSaving] = useState(false);

  const load = useCallback(async (vue) => {
    setLoading(true);
    try {
      const r = await juryApi.getDemandes(vue);
      setListe(r.data.data || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(onglet); }, [onglet, load]);
  useEffect(() => {
    departementsApi.getAll().then((r) => setDepartements(r.data.data || []));
    if (isChef) adminApi.getEnseignants({ filtre: 'tous' }).then((r) => setEnseignants(r.data.data || []));
  }, [isChef]);

  const submitDemande = async () => {
    if (!formDemande.departement_cible_id) { toast.error('Département cible requis'); return; }
    const nbRap = Number(formDemande.nombre_rapporteur) || 0;
    const nbPres = Number(formDemande.nombre_president) || 0;
    if (nbRap < 1 && nbPres < 1) { toast.error('Indiquez au moins un nombre de fois (rapporteur ou président)'); return; }
    setSaving(true);
    try {
      await juryApi.demandeParticipation({
        ...formDemande,
        nombre_rapporteur: formDemande.role_souhaite === 'president' ? 0 : nbRap,
        nombre_president: formDemande.role_souhaite === 'rapporteur' ? 0 : nbPres,
      });
      toast.success('Demande de participation envoyée');
      setModalDemande(false); load(onglet);
    } catch (e) { toast.error(e.response?.data?.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const submitInviter = async () => {
    if (!formInviter.enseignant_id || (user?.role === 'admin' && !formInviter.departement_id)) {
      toast.error('Enseignant' + (user?.role === 'admin' ? ' et département cible ' : ' ') + 'requis'); return;
    }
    const nbRap = Number(formInviter.nombre_rapporteur) || 0;
    const nbPres = Number(formInviter.nombre_president) || 0;
    if (nbRap < 1 && nbPres < 1) { toast.error('Indiquez au moins un nombre de fois (rapporteur ou président)'); return; }
    setSaving(true);
    try {
      await juryApi.inviterParticipation({
        ...formInviter,
        nombre_rapporteur: formInviter.role_souhaite === 'president' ? 0 : nbRap,
        nombre_president: formInviter.role_souhaite === 'rapporteur' ? 0 : nbPres,
      });
      toast.success('Invitation envoyée à l\'enseignant');
      setModalInviter(false); load(onglet);
    } catch (e) { toast.error(e.response?.data?.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const traiter = async (id, statut) => {
    try {
      await juryApi.traiterDemande(id, { statut });
      toast.success('Mis à jour');
      load(onglet);
    } catch (e) { toast.error(e.response?.data?.message || 'Erreur'); }
  };

  // CORRIGÉ : l'onglet du chef utilise maintenant 'envoyees' (au lieu de 'invitations',
  // qui désignait en réalité les invitations reçues par l'utilisateur connecté et
  // provoquait une collision de sens avec cet onglet).
  const onglets = isChef
    ? [{ id: 'recues', label: 'Demandes reçues', icon: Inbox }, { id: 'envoyees', label: 'Mes invitations envoyées', icon: FileOutput }]
    : [{ id: 'invitations', label: 'Invitations reçues', icon: Inbox }, { id: 'mes_demandes', label: 'Mes demandes envoyées', icon: FileOutput }];

  return (
    <Layout title="Participation inter-département" requiredRoles={['admin', 'chef_dept', 'encadrant']}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-bold text-2xl text-blue-600 dark:text-blue-400" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Participation inter-département
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isChef ? "Gérez les demandes reçues et invitez proactivement des enseignants d'autres départements"
              : "Sollicitez un département, ou répondez aux invitations que vous recevez"}
          </p>
        </div>
        <div className="flex gap-2">
          {isChef && (
            <Button
              variant="primary"
              icon={UserPlus}
              onClick={() => {
                setFormInviter({ enseignant_id: '', departement_id: '', role_souhaite: 'les_deux', nombre_rapporteur: 1, nombre_president: 1 });
                setModalInviter(true);
              }}
            >
              Inviter un enseignant
            </Button>
          )}
          {!isChef && <Button variant="outline" icon={Send} onClick={() => setModalDemande(true)}>Nouvelle demande</Button>}
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mb-5 w-fit">
        {onglets.map((o) => (
          <button key={o.id} onClick={() => setOnglet(o.id)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${onglet === o.id ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}>
            <o.icon size={13} /> {o.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : liste.length === 0 ? (
        <EmptyState emoji="📨" title="Aucun élément" desc="Rien à afficher pour cet onglet actuellement." />
      ) : (
        <div className="space-y-3">
          {liste.map((d) => {
            const st = statutConfig[d.statut] || statutConfig.en_attente;
            const StIcon = st.icon;
            // Puis-je répondre à cette ligne (accepter/refuser) ?
            const jePeuxRepondre =
              (onglet === 'recues' && isChef && d.statut === 'en_attente') ||
              (onglet === 'invitations' && !isChef && d.statut === 'en_attente');

            return (
              <div key={d.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-wrap items-center gap-4">
                <div className="w-11 h-11 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
                  <Building2 size={18} />
                </div>
                <div className="flex-1 min-w-[220px]">
                  <p className="font-semibold text-slate-800 dark:text-white text-sm">
                    {d.enseignant || (isChef ? 'Enseignant invité' : 'Vous')}
                  </p>
                  <p className="text-xs text-slate-500">
                    {roleLabels[d.role_souhaite]} — {formatNombres(d)} — {d.initiateur === 'departement' ? 'Invitation du' : 'Demande vers le'} département : {d.departement_cible}
                  </p>
                  {d.disponibilites_preferees && <p className="text-[11px] text-slate-400 mt-0.5">Disponibilités préférées : {d.disponibilites_preferees}</p>}
                </div>
                <Badge color={st.color}><StIcon size={11} className="inline mr-1" />{st.label}</Badge>
                {jePeuxRepondre && (
                  <div className="flex gap-2">
                    <Button size="xs" variant="primary" icon={CheckCircle} onClick={() => traiter(d.id, 'acceptee')}>Accepter</Button>
                    <Button size="xs" variant="danger" icon={XCircle} onClick={() => traiter(d.id, 'refusee')}>Refuser</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal : ma propre demande (encadrant sollicite un département) */}
      <Modal open={modalDemande} onClose={() => setModalDemande(false)} title="Demande de participation">
        <div className="space-y-4">
          <Select label="Département cible *" value={formDemande.departement_cible_id} onChange={(e) => setFormDemande((f) => ({ ...f, departement_cible_id: e.target.value }))}>
            <option value="">— Choisir —</option>
            {departements.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
          </Select>
          <Select label="Rôle souhaité" value={formDemande.role_souhaite} onChange={(e) => setFormDemande((f) => ({ ...f, role_souhaite: e.target.value }))}>
            <option value="les_deux">Rapporteur & Président</option>
            <option value="rapporteur">Rapporteur uniquement</option>
            <option value="president">Président uniquement</option>
          </Select>
          {formDemande.role_souhaite !== 'president' && (
            <Input
              label="Nombre de fois souhaité — Rapporteur *"
              type="number"
              min={0}
              value={formDemande.nombre_rapporteur}
              onChange={(e) => setFormDemande((f) => ({ ...f, nombre_rapporteur: e.target.value }))}
            />
          )}
          {formDemande.role_souhaite !== 'rapporteur' && (
            <Input
              label="Nombre de fois souhaité — Président *"
              type="number"
              min={0}
              value={formDemande.nombre_president}
              onChange={(e) => setFormDemande((f) => ({ ...f, nombre_president: e.target.value }))}
            />
          )}
          <Input label="Disponibilités préférées (facultatif)" value={formDemande.disponibilites_preferees}
            onChange={(e) => setFormDemande((f) => ({ ...f, disponibilites_preferees: e.target.value }))}
            placeholder="Ex : lundis et mercredis après-midi" />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setModalDemande(false)}>Annuler</Button>
            <Button variant="primary" onClick={submitDemande} loading={saving}>Envoyer la demande</Button>
          </div>
        </div>
      </Modal>

      {/* Modal : inviter proactivement (admin/chef choisit un enseignant, même d'un autre département) */}
      <Modal open={modalInviter} onClose={() => setModalInviter(false)} title="Inviter un enseignant à participer">
        <div className="space-y-4">
          <Select label="Enseignant *" value={formInviter.enseignant_id} onChange={(e) => setFormInviter((f) => ({ ...f, enseignant_id: e.target.value }))}>
            <option value="">— Choisir (tous départements) —</option>
            {enseignants.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
          </Select>
          {user?.role === 'admin' && (
            <Select label="Département cible *" value={formInviter.departement_id} onChange={(e) => setFormInviter((f) => ({ ...f, departement_id: e.target.value }))}>
              <option value="">— Choisir —</option>
              {departements.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
            </Select>
          )}
          <Select label="Rôle souhaité" value={formInviter.role_souhaite} onChange={(e) => setFormInviter((f) => ({ ...f, role_souhaite: e.target.value }))}>
            <option value="les_deux">Rapporteur & Président</option>
            <option value="rapporteur">Rapporteur uniquement</option>
            <option value="president">Président uniquement</option>
          </Select>
          {formInviter.role_souhaite !== 'president' && (
            <Input
              label="Nombre de fois envisagé — Rapporteur"
              type="number"
              min={0}
              value={formInviter.nombre_rapporteur}
              onChange={(e) => setFormInviter((f) => ({ ...f, nombre_rapporteur: e.target.value }))}
            />
          )}
          {formInviter.role_souhaite !== 'rapporteur' && (
            <Input
              label="Nombre de fois envisagé — Président"
              type="number"
              min={0}
              value={formInviter.nombre_president}
              onChange={(e) => setFormInviter((f) => ({ ...f, nombre_president: e.target.value }))}
            />
          )}
          <p className="text-xs text-slate-400">L'enseignant recevra une notification et un email ; il devra accepter ou refuser lui-même cette invitation.</p>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setModalInviter(false)}>Annuler</Button>
            <Button variant="primary" onClick={submitInviter} loading={saving}>Envoyer l'invitation</Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}