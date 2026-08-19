import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { Button, Modal, Input, Select, Badge, EmptyState, ConfirmDialog } from '../components/ui';
import { adminApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Search, Upload, Clock, CheckCircle, XCircle, AlertCircle, FileText, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ouvrirFicheIndividuelle } from '../utils/exportSoutenances';

const emptyForm = { code_etudiant: '', nom: '', prenom: '', niveau: '', encadrant_id: '', titre_sujet: '', date_debut: '', date_fin: '' };

const statutConfig = {
  sans_date: { label: 'Sans date', color: 'yellow', icon: AlertCircle },
  planifiee: { label: 'En attente', color: 'yellow', icon: Clock },
  validee: { label: 'Validée', color: 'green', icon: CheckCircle },
  refusee: { label: 'Refusée', color: 'red', icon: XCircle },
};

/**
 * Regroupe la liste plate (1 ligne par étudiant) en lignes d'affichage : les 2
 * membres d'un binôme partagent le même soutenance_id (etudiants.php les relie
 * via etudiant_id OU etudiant2_id sur la même soutenance) — on les fusionne en
 * une seule ligne de tableau, les colonnes communes (niveau, encadrant, date,
 * statut) n'étant affichées qu'une fois.
 */
function regrouperParSoutenance(list) {
  const parSoutenance = new Map(); // soutenance_id -> [étudiants]
  const solos = [];
  list.forEach((e) => {
    if (e.soutenance_id) {
      if (!parSoutenance.has(e.soutenance_id)) parSoutenance.set(e.soutenance_id, []);
      parSoutenance.get(e.soutenance_id).push(e);
    } else {
      solos.push({ membres: [e] });
    }
  });
  const groupes = [...parSoutenance.values()].map((membres) => ({ membres }));
  return [...groupes, ...solos].sort((a, b) => a.membres[0].nom.localeCompare(b.membres[0].nom));
}

export default function EtudiantsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [enseignants, setEnseignants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.getEtudiants({ search });
      setList(r.data.data || []);
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (user?.role !== 'encadrant') {
      adminApi.getEnseignants({}).then((r) => setEnseignants(r.data.data || []));
    }
  }, [user]);

  const lignes = useMemo(() => regrouperParSoutenance(list), [list]);

  const openCreate = () => { setForm(emptyForm); setModal('create'); };
  const openEdit = (e) => { setForm({ ...e, date_debut: e.date_debut || '', date_fin: e.date_fin || '' }); setModal(e); };
  const set = (k) => (ev) => setForm((f) => ({ ...f, [k]: ev.target.value }));

  const handleSave = async () => {
    if (!form.code_etudiant || !form.nom || !form.prenom) { toast.error('Champs requis manquants'); return; }
    setSaving(true);
    try {
      if (modal === 'create') { await adminApi.createEtudiant(form); toast.success('Étudiant créé'); }
      else { await adminApi.updateEtudiant(modal.id, form); toast.success('Étudiant mis à jour'); }
      setModal(null); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await adminApi.deleteEtudiant(id);
      toast.success('Étudiant supprimé');
      load();
    } catch (e) {
      const data = e.response?.data;
      if (data?.data?.binome_detected) {
        toast.error(data.message || "Cet étudiant est membre d'un binôme actif", { duration: 6000 });
        return;
      }
      toast.error(data?.message || 'Erreur');
    }
  };

  const ouvrirFiche = (groupe) => {
    const [e1] = groupe.membres;
    ouvrirFicheIndividuelle({
      etudiants: groupe.membres.map((e) => ({ code_etudiant: e.code_etudiant, etudiant: `${e.prenom} ${e.nom}` })),
      code_etudiant: e1.code_etudiant, etudiant: `${e1.prenom} ${e1.nom}`,
      niveau: e1.niveau, titre_sujet: e1.titre_sujet, date: e1.soutenance_date, heure: e1.soutenance_heure,
      salle: e1.salle, encadrant: e1.encadrant_nom, president: e1.president, rapporteur: e1.rapporteur,
      statut: e1.soutenance_statut,
    });
  };

  const canEdit = user?.role === 'admin' || user?.role === 'chef_dept';

  return (
    <Layout title="Étudiants" requiredRoles={['admin', 'chef_dept', 'encadrant']}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-bold text-2xl text-blue-600 dark:text-blue-400" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Gestion des Étudiants
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Liste des étudiants, statut de soutenance et de validation</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" icon={Upload} onClick={() => navigate('/import')}>Importer</Button>
            <Button variant="primary" icon={Plus} onClick={openCreate}>Nouvel étudiant</Button>
          </div>
        )}
      </div>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un étudiant..."
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-800 dark:text-white" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : lignes.length === 0 ? (
        <EmptyState emoji="🎓" title="Aucun étudiant" desc="Importez ou créez un étudiant pour commencer." action={
          canEdit && <Button variant="primary" icon={Plus} onClick={openCreate}>Créer un étudiant</Button>
        } />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  {['Étudiant(s)', 'Code(s)', 'Niveau', 'Encadrant', 'Soutenance', 'Validation', 'Fiche', ...(canEdit ? ['Actions'] : [])].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.map((groupe) => {
                  const membres = groupe.membres;
                  const [e1] = membres;
                  const estGroupe = membres.length > 1;
                  const nb = membres.length;
                  const st = statutConfig[e1.soutenance_statut] || statutConfig.sans_date;
                  const StIcon = st.icon;
                  const rowSpan = membres.length;
                  const cleGroupe = e1.soutenance_id || e1.id;

                  const celluleEtudiant = (e) => (
                    <td key={`etu-${e.id}`} className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-400 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                          {e.prenom?.[0]}{e.nom?.[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <div className="font-semibold text-slate-800 dark:text-white text-sm">{e.prenom} {e.nom}</div>
                            {estGroupe && e === e1 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                                <Users size={10} /> {nb === 3 ? 'Trinôme' : 'Binôme'}
                              </span>
                            )}
                          </div>
                          {!estGroupe && <div className="text-xs text-slate-400 max-w-[240px] truncate">{e.titre_sujet || '—'}</div>}
                        </div>
                      </div>
                    </td>
                  );

                  const celluleCode = (e) => (
                    <td key={`code-${e.id}`} className="px-4 py-3 text-sm text-slate-500 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                      {e.code_etudiant}
                    </td>
                  );

                  const celluleActions = (e) => (
                    <td key={`actions-${e.id}`} className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(e)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-600 hover:opacity-80 transition-opacity dark:bg-blue-900/20 dark:text-blue-400">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => setDeleteConfirm(e.id)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-red-50 text-red-600 hover:opacity-80 transition-opacity dark:bg-red-900/20 dark:text-red-400">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  );

                  // Colonnes communes (niveau, encadrant, soutenance, validation, fiche) : rendues UNE fois,
                  // avec rowSpan = nombre de membres si groupe, à l'image des cellules Excel fusionnées du fichier source.
                  const cellulesCommunes = (
                    <React.Fragment key="communes">
                      <td rowSpan={rowSpan} className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap align-middle">
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 font-medium">{e1.niveau}</span>
                      </td>
                      <td rowSpan={rowSpan} className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap align-middle">
                        {e1.encadrant_nom || '—'}
                      </td>
                      <td rowSpan={rowSpan} className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap align-middle">
                        {e1.soutenance_date ? format(new Date(e1.soutenance_date), 'dd/MM/yyyy') : 'Sans date'}
                      </td>
                      <td rowSpan={rowSpan} className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap align-middle">
                        <Badge color={st.color}><StIcon size={11} className="inline mr-1" />{st.label}</Badge>
                      </td>
                      <td rowSpan={rowSpan} className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap align-middle">
                        <button onClick={() => ouvrirFiche(groupe)} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                          <FileText size={13} /> PDF
                        </button>
                      </td>
                    </React.Fragment>
                  );

                  return (
                    <React.Fragment key={cleGroupe}>
                      {membres.map((e, idx) => (
                        <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          {celluleEtudiant(e)}
                          {celluleCode(e)}
                          {idx === 0 && cellulesCommunes}
                          {canEdit && celluleActions(e)}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'create' ? 'Nouvel étudiant' : "Modifier l'étudiant"}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Code étudiant *" value={form.code_etudiant} onChange={set('code_etudiant')} placeholder="ET2024010" disabled={modal !== 'create'} />
            <Input label="Niveau" value={form.niveau} onChange={set('niveau')} placeholder="3 GII-SII" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Prénom *" value={form.prenom} onChange={set('prenom')} placeholder="Leila" />
            <Input label="Nom *" value={form.nom} onChange={set('nom')} placeholder="Saidi" />
          </div>
          <Select label="Encadrant" value={form.encadrant_id || ''} onChange={set('encadrant_id')}>
            <option value="">— Aucun —</option>
            {enseignants.map((en) => <option key={en.id} value={en.id}>{en.prenom} {en.nom}</option>)}
          </Select>
          <Input label="Titre du sujet" value={form.titre_sujet} onChange={set('titre_sujet')} placeholder="Développement d'une application..." />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Date début" type="date" value={form.date_debut} onChange={set('date_debut')} />
            <Input label="Date fin" type="date" value={form.date_fin} onChange={set('date_fin')} />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setModal(null)}>Annuler</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>{modal === 'create' ? 'Créer' : 'Enregistrer'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={() => handleDelete(deleteConfirm)}
        title="Supprimer l'étudiant ?" message="Cette action est irréversible." />
    </Layout>
  );
}