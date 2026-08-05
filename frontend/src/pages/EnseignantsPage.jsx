import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { Badge, Button, Modal, Input, Select, EmptyState, ConfirmDialog } from '../components/ui';
import { adminApi, departementsApi, juryApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Search, UserCheck, UserX, UserPlus, Upload, Info, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import DetailEnseignantModal from '../components/DetailEnseignantModal';

const emptyForm = { nom: '', prenom: '', email: '', role: 'encadrant', password: '', is_active: 1, departement_id: '' };

const roleLabels = { admin: '👑 Admin', chef_dept: '🎓 Chef Dépt.', encadrant: '👨‍🏫 Encadrant' };
const roleColors = { admin: 'bg-purple-100 text-purple-700', chef_dept: 'bg-blue-100 text-blue-700', encadrant: 'bg-green-100 text-green-700' };

// Cellule du mini-calendrier : couleur selon le statut (normal / max atteint / dépassement)
function CelluleJour({ jour }) {
  const styles = {
    normal: 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400',
    max_atteint: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 font-semibold',
    depassement: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-bold',
  };
  const restant = Math.max(0, jour.max - jour.nb);
  return (
    <td className={`px-2 py-2 text-center text-xs border-b border-r border-slate-100 dark:border-slate-800/60 ${styles[jour.statut] || styles.normal}`}
      title={`${jour.nb} / ${jour.max} max — reste ${restant} ce jour-là`}>
      {jour.nb}
    </td>
  );
}

// v1.7 — boutons +/- pour l'ajustement manuel de la réciprocité (admin uniquement).
// Applique un delta (pas une valeur absolue) pour ne jamais écraser un ajustement existant.
// stopPropagation est indispensable ici : la ligne entière ouvre le modal détail au clic.
function AjustementControls({ enseignantId, role, valeur, onChange }) {
  const [busy, setBusy] = useState(false);

  const appliquer = async (e, delta) => {
    e.stopPropagation();
    const motif = window.prompt('Motif de cet ajustement (optionnel) :') || '';
    setBusy(true);
    try {
      await juryApi.ajusterReciprocite(enseignantId, role, delta, motif);
      onChange(delta);
    } catch (err) {
      toast.error("Échec de l'ajustement.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-center gap-1 mt-0.5" onClick={(e) => e.stopPropagation()}>
      <button
        disabled={busy}
        onClick={(e) => appliquer(e, -1)}
        className="w-4 h-4 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 text-[10px] font-bold disabled:opacity-50"
        title="Diminuer d'un point"
      >
        −
      </button>
      {valeur !== 0 && (
        <span className="text-[9px] text-slate-400" title="Ajustement manuel cumulé">
          {valeur > 0 ? `+${valeur}` : valeur}
        </span>
      )}
      <button
        disabled={busy}
        onClick={(e) => appliquer(e, 1)}
        className="w-4 h-4 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 text-[10px] font-bold disabled:opacity-50"
        title="Augmenter d'un point"
      >
        +
      </button>
    </div>
  );
}

export default function EnseignantsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [vue, setVue] = useState('liste'); // 'liste' | 'jour'
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtre, setFiltre] = useState('tous'); // 'mes_encadrants' | 'tous'
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [departements, setDepartements] = useState([]);
  const [editingMax, setEditingMax] = useState(null); // id de l'enseignant en cours d'édition du max
  const [detailId, setDetailId] = useState(null); // id de l'enseignant dont on affiche le détail

  // Vue par jour
  const [dates, setDates] = useState([]);
  const [enseignantsJour, setEnseignantsJour] = useState([]);
  const [loadingJour, setLoadingJour] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.getEnseignants({ search, filtre });
      setList(r.data.data || []);
    } finally { setLoading(false); }
  }, [search, filtre]);

  const loadJour = useCallback(async () => {
    setLoadingJour(true);
    try {
      const r = await juryApi.getChargeParJour({ filtre });
      const payload = r.data.data ?? r.data;
      setDates(payload.dates || []);
      setEnseignantsJour(payload.enseignants || []);
    } finally { setLoadingJour(false); }
  }, [filtre]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { departementsApi.getAll().then((r) => setDepartements(r.data.data || [])); }, []);

  useEffect(() => {
    if (vue === 'jour') loadJour();
  }, [vue, loadJour]);

  const openCreate = () => { setForm(emptyForm); setModal('create'); };
  const openEdit = (e) => { setForm({ ...e, password: '' }); setModal(e); };
  const set = (k) => (ev) => setForm((f) => ({ ...f, [k]: ev.target.value }));

  const handleSave = async () => {
    if (!form.nom || !form.prenom || !form.email) { toast.error('Champs requis manquants'); return; }
    setSaving(true);
    const payload = { ...form, departement_id: form.departement_id || null };
    try {
      if (modal === 'create') { await adminApi.createEnseignant(payload); toast.success('Enseignant créé'); }
      else { await adminApi.updateEnseignant(modal.id, payload); toast.success('Enseignant mis à jour'); }
      setModal(null); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try { await adminApi.deleteEnseignant(id); toast.success('Enseignant supprimé'); load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Erreur'); }
  };

  const handleMaxChange = async (id, valeur) => {
    try {
      await adminApi.updateMaxEnseignant(id, valeur === '' ? null : parseInt(valeur));
      setList((l) => l.map((e) => (e.id === id ? { ...e, max_soutenances_jour: valeur === '' ? null : parseInt(valeur) } : e)));
      toast.success('Maximum mis à jour');
    } catch (e) { toast.error(e.response?.data?.message || 'Erreur'); }
    setEditingMax(null);
  };

  // v1.7 — applique localement le delta déjà validé côté serveur, sans recharger toute la liste.
  const appliquerDeltaLocal = (id, role, delta) => {
    setList((l) => l.map((e) => {
      if (e.id !== id) return e;
      if (role === 'rapporteur') {
        return { ...e, nb_rapporteur: e.nb_rapporteur + delta, ajustement_rapporteur: (e.ajustement_rapporteur || 0) + delta };
      }
      return { ...e, nb_president: e.nb_president + delta, ajustement_president: (e.ajustement_president || 0) + delta };
    }));
  };

  const showFiltre = user?.role === 'admin' || user?.role === 'chef_dept';
  const isAdmin = user?.role === 'admin';

  return (
    <Layout title="Enseignants" requiredRoles={['admin', 'chef_dept']}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-bold text-2xl text-blue-600 dark:text-blue-400" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Gestion des Enseignants
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Liste de tous vos enseignants enregistrés</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={Upload} onClick={() => navigate('/import-enseignants')}>Importer</Button>
          <Button variant="primary" icon={UserPlus} onClick={openCreate}
            className="!bg-blue-600 hover:!bg-blue-700 !rounded-lg !px-5 !py-2.5 !font-semibold">
            Nouvel enseignant
          </Button>
        </div>
      </div>

      {/* Onglets Vue liste / Vue par jour */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setVue('liste')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            vue === 'liste'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Vue liste
        </button>
        <button
          onClick={() => setVue('jour')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors ${
            vue === 'jour'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <CalendarDays size={15} /> Vue par jour
        </button>
      </div>

      {/* Toolbar (commune aux deux vues) */}
      <div className="flex flex-wrap gap-3 mb-4">
        {vue === 'liste' && (
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..."
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-800 dark:text-white" />
          </div>
        )}
        {showFiltre && (
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button onClick={() => setFiltre('mes_encadrants')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${filtre === 'mes_encadrants' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}>
              Mes encadrants
            </button>
            <button onClick={() => setFiltre('tous')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${filtre === 'tous' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}>
              Tous les enseignants
            </button>
          </div>
        )}
      </div>

      {/* ============ VUE LISTE ============ */}
      {vue === 'liste' && (
        <>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-3">
            <Info size={12} /> Dans/Hors dépt. = répartition des soutenances selon le département — Max/jour = plafond journalier (personnalisé ou par défaut de la Période). Pour la capacité restante d'un jour précis, voir la « Vue par jour ». Cliquez sur un enseignant pour voir le détail.
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : list.length === 0 ? (
            <EmptyState emoji="👥" title="Aucun enseignant" desc="Commencez par créer un enseignant." action={
              <Button variant="primary" icon={Plus} onClick={openCreate}>Créer un enseignant</Button>
            } />
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50">
                      {['Enseignant', 'Rôle', 'Encadrant', 'Président', 'Rapporteur', 'Dans dépt.', 'Hors dépt.', 'Total', 'Max/jour', 'Statut', 'Actions'].map((h) => (
                        <th key={h} className="px-3 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((e) => (
                      <tr key={e.id}
                        onClick={() => setDetailId(e.id)}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer">
                        <td className="px-3 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-400 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                              {e.prenom?.[0]}{e.nom?.[0]}
                            </div>
                            <div>
                              <div className="font-medium text-slate-800 dark:text-white text-sm">{e.prenom} {e.nom}</div>
                              <div className="text-[11px] text-slate-400">{e.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${roleColors[e.role]}`}>{roleLabels[e.role]}</span>
                        </td>
                        <td className="px-3 py-3 text-center text-sm text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800/60">{e.nb_encadrant}</td>
                        <td className="px-3 py-3 text-center text-sm text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800/60">
                          {e.nb_president}
                          {isAdmin && (
                            <AjustementControls
                              enseignantId={e.id}
                              role="president"
                              valeur={e.ajustement_president || 0}
                              onChange={(delta) => appliquerDeltaLocal(e.id, 'president', delta)}
                            />
                          )}
                        </td>
                        <td className="px-3 py-3 text-center text-sm text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800/60">
                          {e.nb_rapporteur}
                          {isAdmin && (
                            <AjustementControls
                              enseignantId={e.id}
                              role="rapporteur"
                              valeur={e.ajustement_rapporteur || 0}
                              onChange={(delta) => appliquerDeltaLocal(e.id, 'rapporteur', delta)}
                            />
                          )}
                        </td>
                        <td className="px-3 py-3 text-center text-sm text-teal-600 dark:text-teal-400 font-semibold border-b border-slate-100 dark:border-slate-800/60">{e.nb_dans_departement}</td>
                        <td className="px-3 py-3 text-center text-sm text-orange-600 dark:text-orange-400 font-semibold border-b border-slate-100 dark:border-slate-800/60">{e.nb_hors_departement}</td>
                        <td className="px-3 py-3 text-center text-sm font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800/60">{e.total_soutenances}</td>
                        <td className="px-3 py-3 text-center border-b border-slate-100 dark:border-slate-800/60">
                          {editingMax === e.id ? (
                            <input type="number" min={0} autoFocus defaultValue={e.max_soutenances_jour ?? ''}
                              placeholder={String(e.max_effectif)}
                              onClick={(ev) => ev.stopPropagation()}
                              onBlur={(ev) => handleMaxChange(e.id, ev.target.value)}
                              onKeyDown={(ev) => { if (ev.key === 'Enter') ev.target.blur(); }}
                              className="w-16 text-center text-xs px-1.5 py-1 border border-blue-300 rounded-md" />
                          ) : (
                            <button onClick={(ev) => { ev.stopPropagation(); setEditingMax(e.id); }}
                              className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 underline decoration-dotted">
                              {e.max_soutenances_jour ?? `${e.max_effectif} (défaut)`}
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                          {e.is_active ? (
                            <span className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400"><UserCheck size={13} /> Actif</span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs text-red-500"><UserX size={13} /> Inactif</span>
                          )}
                        </td>
                        <td className="px-3 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button onClick={(ev) => { ev.stopPropagation(); openEdit(e); }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-600 hover:opacity-80 transition-opacity dark:bg-blue-900/20 dark:text-blue-400">
                              <Edit2 size={13} />
                            </button>
                            <button onClick={(ev) => { ev.stopPropagation(); setDeleteConfirm(e.id); }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-red-50 text-red-600 hover:opacity-80 transition-opacity dark:bg-red-900/20 dark:text-red-400">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ============ VUE PAR JOUR (mini-calendrier) ============ */}
      {vue === 'jour' && (
        loadingJour ? (
          <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : dates.length === 0 ? (
          <EmptyState emoji="📅" title="Aucune soutenance planifiée" desc="Aucune date à afficher pour le moment." />
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300 inline-block" /> Maximum atteint</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" /> Dépassement</span>
            </div>
            <div className="overflow-x-auto">
              <table className="border-collapse text-sm min-w-full">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-r border-slate-200 dark:border-slate-800 whitespace-nowrap z-10">
                      Enseignant
                    </th>
                    {dates.map((d) => (
                      <th key={d} className="px-2 py-2.5 text-center text-xs font-bold text-slate-500 border-b border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                        {format(new Date(d), 'dd MMM', { locale: fr })}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-center text-xs font-bold text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {enseignantsJour.map((ens) => (
                    <tr key={ens.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="sticky left-0 bg-white dark:bg-slate-900 px-4 py-2 border-b border-r border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800 dark:text-white text-sm">{ens.prenom} {ens.nom}</span>
                          {ens.max_personnalise !== null && (
                            <span className="text-[10px] text-slate-400" title="Maximum personnalisé">
                              (max {ens.max_personnalise}/j)
                            </span>
                          )}
                        </div>
                      </td>
                      {ens.jours.map((j) => (
                        <CelluleJour key={j.date} jour={j} />
                      ))}
                      <td className="px-3 py-2 text-center text-sm font-bold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800/60">
                        {ens.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'create' ? 'Nouvel enseignant' : "Modifier l'enseignant"}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Prénom *" value={form.prenom} onChange={set('prenom')} placeholder="Mohamed" />
            <Input label="Nom *" value={form.nom} onChange={set('nom')} placeholder="Ben Ali" />
          </div>
          <Input label="Email *" type="email" value={form.email} onChange={set('email')} placeholder="m.benali@enetcom.tn" />
          <Select label="Rôle" value={form.role} onChange={set('role')}>
            <option value="encadrant">Encadrant</option>
            <option value="chef_dept">Chef de département</option>
            <option value="admin">Administrateur</option>
          </Select>
          <Select label="Département" value={form.departement_id || ''} onChange={set('departement_id')}>
            <option value="">— Aucun —</option>
            {departements.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
          </Select>
          <Input label={modal === 'create' ? 'Mot de passe' : 'Nouveau mot de passe (laisser vide pour ne pas changer)'}
            type="password" value={form.password} onChange={set('password')} placeholder="password123" />
          {modal !== 'create' && (
            <Select label="Statut" value={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: parseInt(e.target.value) }))}>
              <option value={1}>Actif</option>
              <option value={0}>Inactif</option>
            </Select>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setModal(null)}>Annuler</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>{modal === 'create' ? 'Créer' : 'Enregistrer'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={() => handleDelete(deleteConfirm)}
        title="Supprimer l'enseignant ?" message="Cette action est irréversible. Si l'enseignant a des soutenances, il sera désactivé." />

      <DetailEnseignantModal enseignantId={detailId} onClose={() => setDetailId(null)} />
    </Layout>
  );
}