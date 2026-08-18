import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { Button, Modal, Input, Select, Badge } from '../components/ui';
import { adminApi, soutenancesApi, departementsApi, juryApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import OptimiserPlanningButton from '../components/OptimiserPlanningButton';
import AutoPlanningButton from '../components/AutoPlanningButton';
import PanneauExplicationIA from '../components/PanneauExplicationIA';
import {
  Plus, Calendar, CheckCircle, XCircle, Clock, MapPin, FileText,
  Download, FileSpreadsheet, Search, RotateCcw, AlertCircle, Ban, Sparkles, Users, CalendarClock, Pencil
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { exporterExcel, exporterPDF, ouvrirFicheIndividuelle } from '../utils/exportSoutenances';

const statutConfig = {
  planifiee: { label: 'En attente', color: 'yellow', icon: Clock },
  validee: { label: 'Validée', color: 'green', icon: CheckCircle },
  refusee: { label: 'Refusée', color: 'red', icon: XCircle },
};

const emptyForm = { etudiant_id: '', etudiant2_id: '', rapporteur_id: '', president_id: '', date: '', heure: '', salle: '' };
const emptyFilters = { date: '', section: 'toutes', statutValidation: '', niveau: '', recherche: '', salle: '' };
const emptyEditForm = { date: '', heure: '', salle: '', president_id: '', rapporteur_id: '' };

/** Affiche le(s) nom(s) étudiant(s) d'une soutenance : "Nom1" ou "Nom1 & Nom2" si binôme. */
function nomEtudiants(s) {
  return s.etudiant2 ? `${s.etudiant} & ${s.etudiant2}` : s.etudiant;
}

export default function SoutenancesPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [list, setList] = useState([]);
  const [etudiants, setEtudiants] = useState([]);
  const [enseignants, setEnseignants] = useState([]);
  const [departements, setDepartements] = useState([]);
  const [deptSelectionne, setDeptSelectionne] = useState('');
  const [joursActifs, setJoursActifs] = useState([]);
  const [maxParJourMap, setMaxParJourMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [avecBinome, setAvecBinome] = useState(false);
  const [saving, setSaving] = useState(false);
  const [motifModal, setMotifModal] = useState(null);
  const [motif, setMotif] = useState('');
  const [creneaux, setCreneaux] = useState([]);
  const [loadingCreneaux, setLoadingCreneaux] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);

  // ---- v1.10 : carte unique de modification (date/heure/salle + président/rapporteur) ----
  const [editSoutenance, setEditSoutenance] = useState(null); // la soutenance en cours de modification, ou null
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editCreneaux, setEditCreneaux] = useState([]);
  const [loadingEditCreneaux, setLoadingEditCreneaux] = useState(false);
  const [presidentsDispo, setPresidentsDispo] = useState([]);
  const [rapporteursDispo, setRapporteursDispo] = useState([]);
  const [loadingJuryDispo, setLoadingJuryDispo] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [assignationCompleteEdit, setAssignationCompleteEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await soutenancesApi.getAll(deptSelectionne ? { departement_id: deptSelectionne } : {});
      setList(r.data.data || []);
    } finally { setLoading(false); }
  }, [deptSelectionne]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const etudiantId = searchParams.get('etudiant');
    if (etudiantId) openPlanifier(etudiantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  useEffect(() => {
    adminApi.getEtudiants({}).then((r) => setEtudiants(r.data.data || []));
    adminApi.getEnseignants({}).then((r) => setEnseignants(r.data.data || []));
    adminApi.getPeriode().then((r) => {
      const jours = r.data.data?.jours || [];
      setJoursActifs(jours.filter((j) => j.actif));
      const map = {};
      jours.forEach((j) => { map[j.date] = j.max_soutenances; });
      setMaxParJourMap(map);
    });
    if (user?.role === 'admin') {
      departementsApi.getAll().then((r) => setDepartements(r.data.data || []));
    }
  }, [user]);

  const setF = (k) => (ev) => {
    const value = ev.target.value;
    setForm((f) => ({ ...f, [k]: value }));
    if (k === 'date' && value) {
      setLoadingCreneaux(true);
      soutenancesApi.getCreneaux(value)
        .then((r) => setCreneaux(r.data.data.creneaux || []))
        .catch(() => setCreneaux([]))
        .finally(() => setLoadingCreneaux(false));
    }
  };

  const openPlanifier = (etudiantId = '') => {
    setForm({ ...emptyForm, etudiant_id: etudiantId });
    setAvecBinome(false);
    setCreneaux([]);
    setExplicationIA(null);
    setModal(true);
  };

  const handlePlanifier = async () => {
    if (!form.etudiant_id || !form.rapporteur_id || !form.president_id) { toast.error('Étudiant, rapporteur et président sont requis'); return; }
    if (avecBinome && !form.etudiant2_id) { toast.error('Choisissez le 2e étudiant du binôme, ou décochez la case binôme'); return; }
    if (avecBinome && form.etudiant2_id === form.etudiant_id) { toast.error('Les deux étudiants du binôme doivent être différents'); return; }
    setSaving(true);
    try {
      const payload = { ...form, etudiant2_id: avecBinome ? form.etudiant2_id : null, explication_ia: explicationIA ? JSON.stringify(explicationIA) : undefined };
      await soutenancesApi.planifier(payload);
      toast.success('Soutenance planifiée, invitations envoyées au jury');
      setModal(false); setForm(emptyForm); setAvecBinome(false); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const handleValider = async (id, decision) => {
    if (decision === 'refusee' && motifModal !== id) { setMotifModal(id); return; }
    try {
      await soutenancesApi.valider({ id, decision, motif: decision === 'refusee' ? motif : null });
      toast.success('Décision enregistrée');
      setMotifModal(null); setMotif(''); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Erreur'); }
  };

  const handleAnnulerJury = async (soutenanceId, role) => {
    if (!window.confirm(`Annuler l'affectation ${role} pour cette soutenance ?`)) return;
    try {
      await soutenancesApi.annulerJury({ soutenance_id: soutenanceId, role });
      toast.success('Affectation annulée');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Erreur'); }
  };

  const handleAnnulerSoutenance = async (soutenanceId) => {
    if (!window.confirm('Annuler complètement cette soutenance ? Elle repassera "sans date".')) return;
    try {
      await soutenancesApi.annuler({ soutenance_id: soutenanceId });
      toast.success('Soutenance annulée');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Erreur'); }
  };

  const [assignationComplete, setAssignationComplete] = useState(false);
  const [explicationIA, setExplicationIA] = useState(null);
  const [explicationIAEdit, setExplicationIAEdit] = useState(null);
  const handleAssignationComplete = async () => {
    if (!form.etudiant_id) { toast.error("Choisissez d'abord un étudiant"); return; }
    setAssignationComplete(true);
    setExplicationIA(null);
    try {
      const data = (await juryApi.assignerComplet(form.etudiant_id, form.date || undefined)).data?.data;
      if (!data?.rapporteur?.id || !data?.president?.id) {
        toast.error(data?.erreur || "Aucune combinaison valide trouvée");
        return;
      }
      const date = data.date, heure = data.heure, salle = data.salle;
      const rapporteurId = String(data.rapporteur.id);
      const presidentId = String(data.president.id);
      setForm((f) => ({ ...f, date, heure, salle, rapporteur_id: rapporteurId, president_id: presidentId }));
      setExplicationIA(data.expl || null);
      toast.success(`Jury, horaire et salle assignés (${format(new Date(date), 'dd MMM', { locale: fr })} à ${heure})`);
    } catch (e) { toast.error(e.response?.data?.message || "Aucune combinaison valide trouvée"); }
    finally { setAssignationComplete(false); }
  };

  // ============ v1.10 : carte unique de modification ============
  const isAdmin = user?.role === 'admin';

  const chargerEditCreneaux = (date, soutenanceId) => {
    setLoadingEditCreneaux(true);
    soutenancesApi.getCreneaux(date, soutenanceId)
      .then((r) => setEditCreneaux(r.data.data.creneaux || []))
      .catch(() => setEditCreneaux([]))
      .finally(() => setLoadingEditCreneaux(false));
  };

  const chargerJuryDispo = (soutenanceId, date, heure) => {
    setLoadingJuryDispo(true);
    Promise.all([
      soutenancesApi.getEnseignantsDisponibles(soutenanceId, 'president', date, heure),
      soutenancesApi.getEnseignantsDisponibles(soutenanceId, 'rapporteur', date, heure),
    ])
      .then(([rp, rr]) => {
        setPresidentsDispo(rp.data.data || []);
        setRapporteursDispo(rr.data.data || []);
      })
      .catch(() => { setPresidentsDispo([]); setRapporteursDispo([]); })
      .finally(() => setLoadingJuryDispo(false));
  };

  const openEdit = (s) => {
    if (!isAdmin) return;
    setEditSoutenance(s);
    setExplicationIAEdit(null);
    const heureInit = s.heure ? s.heure.slice(0, 5) : '';
    setEditForm({ date: s.date || '', heure: heureInit, salle: s.salle || '', president_id: '', rapporteur_id: '' });
    setEditCreneaux([]);
    setPresidentsDispo([]);
    setRapporteursDispo([]);
    if (s.date) {
      chargerEditCreneaux(s.date, s.id);
      chargerJuryDispo(s.id, s.date, heureInit);
    }
  };

  const setEditF = (k) => (ev) => {
    const value = ev.target.value;
    setEditForm((f) => ({ ...f, [k]: value }));
    if (!editSoutenance) return;
    if (k === 'date' && value) {
      chargerEditCreneaux(value, editSoutenance.id);
      chargerJuryDispo(editSoutenance.id, value, editForm.heure);
    }
    if (k === 'heure') {
      chargerJuryDispo(editSoutenance.id, editForm.date, value);
    }
  };

  const handleAssignationCompleteEdit = async () => {
    if (!editSoutenance) return;
    setAssignationCompleteEdit(true);
    setExplicationIAEdit(null);
    try {
      const data = (await juryApi.assignerComplet(editSoutenance.etudiant_id, editForm.date || undefined, editSoutenance.id)).data?.data;
      if (!data?.rapporteur?.id || !data?.president?.id) {
        toast.error(data?.erreur || "Aucune combinaison valide trouvée");
        return;
      }
      const date = data.date, heure = data.heure, salle = data.salle;
      const rapporteurId = String(data.rapporteur.id);
      const presidentId = String(data.president.id);
      setEditForm((f) => ({ ...f, date, heure, salle, rapporteur_id: rapporteurId, president_id: presidentId }));
      setExplicationIAEdit(data.expl || null);
      toast.success(`Jury, horaire et salle réassignés (${format(new Date(date), 'dd MMM', { locale: fr })} à ${heure})`);
    } catch (e) { toast.error(e.response?.data?.message || 'Aucune combinaison valide trouvée'); }
    finally { setAssignationCompleteEdit(false); }
  };

  const handleEnregistrerEdit = async () => {
    if (!editSoutenance) return;
    if (!editForm.date) { toast.error('La date est requise'); return; }
    setEditSaving(true);
    try {
      const dateOuHeureChange = editForm.date !== (editSoutenance.date || '') || editForm.heure !== (editSoutenance.heure ? editSoutenance.heure.slice(0, 5) : '');
      const salleChange = editForm.salle !== (editSoutenance.salle || '');

      // 1) Replanification (date/heure/salle) en premier : les vérifications de
      // disponibilité du jury pour l'étape suivante se basent sur la date déjà à jour.
      if (dateOuHeureChange || salleChange) {
        await soutenancesApi.replanifier({
          soutenance_id: editSoutenance.id,
          date: editForm.date,
          heure: editForm.heure || null,
          salle: editForm.salle || null,
          explication_ia: explicationIAEdit ? JSON.stringify(explicationIAEdit) : undefined,
        });
      }

      // 2) Réaffectations jury, seulement si un nouveau nom a été choisi
      if (editForm.president_id) {
        await soutenancesApi.reaffecterJury({ soutenance_id: editSoutenance.id, role: 'president', enseignant_id: editForm.president_id });
      }
      if (editForm.rapporteur_id) {
        await soutenancesApi.reaffecterJury({ soutenance_id: editSoutenance.id, role: 'rapporteur', enseignant_id: editForm.rapporteur_id });
      }

      toast.success('Soutenance mise à jour');
      setEditSoutenance(null);
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Erreur'); }
    finally { setEditSaving(false); }
  };

  const canPlan = user?.role === 'encadrant' || user?.role === 'admin';
  const canValidate = user?.role === 'chef_dept' || user?.role === 'admin';
  const canManageJury = user?.role === 'chef_dept' || user?.role === 'admin';

  // ---- Filtrage ----
  const niveaux = useMemo(() => [...new Set(list.map((s) => s.niveau).filter(Boolean))].sort(), [list]);

  const listeFiltree = useMemo(() => {
    return list.filter((s) => {
      if (filters.section === 'planifiees' && s.statut === 'sans_date') return false;
      if (filters.section === 'sans_date' && s.statut !== 'sans_date') return false;
      if (filters.date && s.date !== filters.date) return false;
      if (filters.statutValidation && s.statut !== filters.statutValidation) return false;
      if (filters.niveau && s.niveau !== filters.niveau) return false;
      if (filters.salle && !(s.salle || '').toLowerCase().includes(filters.salle.toLowerCase())) return false;
      if (filters.recherche) {
        const r = filters.recherche.toLowerCase();
        const matchEtudiant = (s.etudiant || '').toLowerCase().includes(r);
        const matchEtudiant2 = (s.etudiant2 || '').toLowerCase().includes(r);
        const matchEncadrant = (s.encadrant || '').toLowerCase().includes(r);
        if (!matchEtudiant && !matchEtudiant2 && !matchEncadrant) return false;
      }
      return true;
    });
  }, [list, filters]);

  const planifiees = useMemo(
    () => listeFiltree.filter((s) => s.statut !== 'sans_date').sort((a, b) => (a.date + (a.heure || '')).localeCompare(b.date + (b.heure || ''))),
    [listeFiltree]
  );
  const sansDate = useMemo(() => listeFiltree.filter((s) => s.statut === 'sans_date'), [listeFiltree]);

  // Regroupement des soutenances planifiées par date
  const groupesParDate = useMemo(() => {
    const groupes = {};
    planifiees.forEach((s) => {
      if (!groupes[s.date]) groupes[s.date] = [];
      groupes[s.date].push(s);
    });
    return Object.entries(groupes);
  }, [planifiees]);

  const badgeJour = (nb, max) => {
    if (nb >= max) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    if (nb === max - 1) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  };

  const resetFilters = () => setFilters(emptyFilters);
  const filtresActifs = Object.entries(filters).some(([k, v]) => k !== 'section' && v) || filters.section !== 'toutes';

  return (
    <Layout title="Soutenances" requiredRoles={['admin', 'chef_dept', 'encadrant']}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-bold text-2xl text-blue-600 dark:text-blue-400" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Gestion des Soutenances
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Planification et validation des soutenances de PFE</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" icon={FileSpreadsheet} onClick={() => exporterExcel(listeFiltree, 'soutenances')}>Exporter Excel</Button>
          <Button variant="outline" icon={Download} onClick={() => exporterPDF(listeFiltree, 'Liste des Soutenances')}>Exporter PDF</Button>
          {canPlan && <Button variant="primary" icon={Plus} onClick={() => openPlanifier()}>Planifier une soutenance</Button>}
        </div>
      </div>

      {(user?.role === 'admin' || user?.role === 'chef_dept') && (
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <OptimiserPlanningButton />
          <AutoPlanningButton />
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm mb-6">
        {user?.role === 'admin' && departements.length > 0 && (
          <div className="mb-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Département (vue admin)</label>
            <select value={deptSelectionne} onChange={(e) => setDeptSelectionne(e.target.value)}
              className="w-full sm:w-64 px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-800 dark:text-white">
              <option value="">🌐 Tous les départements</option>
              {departements.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Input label="Date" type="date" value={filters.date} onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))} />
          <Select label="Section" value={filters.section} onChange={(e) => setFilters((f) => ({ ...f, section: e.target.value }))}>
            <option value="toutes">Toutes</option>
            <option value="planifiees">Planifiées uniquement</option>
            <option value="sans_date">Sans date uniquement</option>
          </Select>
          <Select label="Statut validation" value={filters.statutValidation} onChange={(e) => setFilters((f) => ({ ...f, statutValidation: e.target.value }))}>
            <option value="">Tous</option>
            <option value="planifiee">En attente</option>
            <option value="validee">Validée</option>
            <option value="refusee">Refusée</option>
          </Select>
          <Select label="Niveau" value={filters.niveau} onChange={(e) => setFilters((f) => ({ ...f, niveau: e.target.value }))}>
            <option value="">Tous</option>
            {niveaux.map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
          <Input label="Salle" value={filters.salle} onChange={(e) => setFilters((f) => ({ ...f, salle: e.target.value }))} placeholder="Ex: A12" />
          <div className="relative">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Recherche</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={filters.recherche} onChange={(e) => setFilters((f) => ({ ...f, recherche: e.target.value }))}
                placeholder="Étudiant, encadrant..."
                className="w-full pl-8 pr-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-800 dark:text-white" />
            </div>
          </div>
        </div>
        {filtresActifs && (
          <div className="flex justify-end mt-3">
            <Button variant="ghost" size="xs" icon={RotateCcw} onClick={resetFilters}>Réinitialiser les filtres</Button>
          </div>
        )}
      </div>

      {isAdmin && (
        <p className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-4 -mt-3">
          <CalendarClock size={12} /> Cliquez sur une ligne planifiée pour modifier son heure, sa salle et/ou son jury.
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-8">

          {/* ============ SECTION 1 : SOUTENANCES PLANIFIÉES ============ */}
          {filters.section !== 'sans_date' && (
            <div>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                <Calendar size={16} className="text-blue-500" /> Soutenances Planifiées
              </h2>

              {groupesParDate.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-400">
                  Aucune soutenance planifiée pour ces filtres.
                </div>
              ) : (
                <div className="space-y-5">
                  {groupesParDate.map(([date, items]) => {
                    const max = maxParJourMap[date] || 5;
                    return (
                      <div key={date} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 capitalize">
                            📅 {format(new Date(date), 'EEEE dd MMMM yyyy', { locale: fr })}
                          </span>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeJour(items.length, max)}`}>
                            {items.length} / {max} soutenance(s)
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-sm">
                            <thead>
                              <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                                {['Code', 'Étudiant(s)', 'Niveau', 'Titre', 'Heure', 'Salle', 'Encadrant', 'Président', 'Rapporteur', 'Statut', 'Actions'].map((h) => (
                                  <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 dark:border-slate-800 whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((s) => {
                                const st = statutConfig[s.statut] || statutConfig.planifiee;
                                const StIcon = st.icon;
                                return (
                                  <tr key={s.id}
                                    onClick={() => openEdit(s)}
                                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${isAdmin ? 'cursor-pointer' : ''}`}>
                                    <td className="px-3 py-2.5 text-xs text-slate-500 border-b border-slate-50 dark:border-slate-800/60 whitespace-nowrap">
                                      {s.code_etudiant}{s.code_etudiant2 ? ` / ${s.code_etudiant2}` : ''}
                                    </td>
                                    <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-white border-b border-slate-50 dark:border-slate-800/60 whitespace-nowrap">
                                      <div className="flex items-center gap-1.5">
                                        {s.etudiant2 && <Users size={13} className="text-purple-500 flex-shrink-0" titleAccess="Binôme" />}
                                        {nomEtudiants(s)}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-xs text-slate-500 border-b border-slate-50 dark:border-slate-800/60 whitespace-nowrap">{s.niveau}</td>
                                    <td className="px-3 py-2.5 text-xs text-slate-500 border-b border-slate-50 dark:border-slate-800/60 max-w-[200px] truncate" title={s.titre_sujet}>{s.titre_sujet}</td>
                                    <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300 border-b border-slate-50 dark:border-slate-800/60 whitespace-nowrap">{s.heure ? s.heure.substring(0, 5) : '—'}</td>
                                    <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300 border-b border-slate-50 dark:border-slate-800/60 whitespace-nowrap">{s.salle || '—'}</td>
                                    <td className="px-3 py-2.5 text-xs text-slate-500 border-b border-slate-50 dark:border-slate-800/60 whitespace-nowrap">{s.encadrant || '—'}</td>
                                    <td className="px-3 py-2.5 text-xs text-slate-500 border-b border-slate-50 dark:border-slate-800/60 whitespace-nowrap">
                                      <div className="flex items-center gap-1">
                                        {s.president || '—'}
                                        {canManageJury && s.president && (
                                          <button onClick={(ev) => { ev.stopPropagation(); handleAnnulerJury(s.id, 'president'); }} title="Annuler cette affectation"
                                            className="text-slate-300 hover:text-red-500 transition-colors"><Ban size={11} /></button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-xs text-slate-500 border-b border-slate-50 dark:border-slate-800/60 whitespace-nowrap">
                                      <div className="flex items-center gap-1">
                                        {s.rapporteur || '—'}
                                        {canManageJury && s.rapporteur && (
                                          <button onClick={(ev) => { ev.stopPropagation(); handleAnnulerJury(s.id, 'rapporteur'); }} title="Annuler cette affectation"
                                            className="text-slate-300 hover:text-red-500 transition-colors"><Ban size={11} /></button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5 border-b border-slate-50 dark:border-slate-800/60 whitespace-nowrap">
                                      <Badge color={st.color}><StIcon size={11} className="inline mr-1" />{st.label}</Badge>
                                    </td>
                                    <td className="px-3 py-2.5 border-b border-slate-50 dark:border-slate-800/60 whitespace-nowrap">
                                      <div className="flex items-center gap-1.5" onClick={(ev) => ev.stopPropagation()}>
                                        {canValidate && s.statut === 'planifiee' && (
                                          motifModal === s.id ? (
                                            <div className="flex items-center gap-1.5">
                                              <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif"
                                                className="text-xs px-2 py-1 border border-slate-200 rounded-lg w-24" />
                                              <Button size="xs" variant="danger" onClick={() => handleValider(s.id, 'refusee')}>OK</Button>
                                            </div>
                                          ) : (
                                            <>
                                              <button onClick={() => handleValider(s.id, 'validee')} title="Valider"
                                                className="p-1.5 rounded-md text-green-600 bg-green-50 dark:bg-green-900/20 hover:opacity-80"><CheckCircle size={14} /></button>
                                              <button onClick={() => handleValider(s.id, 'refusee')} title="Refuser"
                                                className="p-1.5 rounded-md text-red-600 bg-red-50 dark:bg-red-900/20 hover:opacity-80"><XCircle size={14} /></button>
                                            </>
                                          )
                                        )}
                                        {isAdmin && (
                                          <button onClick={() => openEdit(s)} title="Modifier (heure / salle / jury)"
                                            className="p-1.5 rounded-md text-purple-600 bg-purple-50 dark:bg-purple-900/20 hover:opacity-80"><Pencil size={14} /></button>
                                        )}
                                        <button onClick={() => ouvrirFicheIndividuelle(s)} title="Fiche PDF"
                                          className="p-1.5 rounded-md text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:opacity-80"><FileText size={14} /></button>
                                        {canManageJury && (
                                          <button onClick={() => handleAnnulerSoutenance(s.id)} title="Annuler complètement la soutenance"
                                            className="p-1.5 rounded-md text-slate-500 bg-slate-100 dark:bg-slate-800 hover:opacity-80"><Ban size={14} /></button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============ SECTION 2 : SOUTENANCES SANS DATE ============ */}
          {filters.section !== 'planifiees' && (
            <div>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                <AlertCircle size={16} className="text-orange-500" /> Soutenances Sans Date
              </h2>
              {sansDate.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-400">
                  Toutes les soutenances de cette sélection ont une date.
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50">
                          {['Code', 'Étudiant(s)', 'Niveau', 'Titre', 'Encadrant', 'Date début', 'Date fin', 'Statut', 'Actions'].map((h) => (
                            <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sansDate.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-3 py-2.5 text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                              {s.code_etudiant}{s.code_etudiant2 ? ` / ${s.code_etudiant2}` : ''}
                            </td>
                            <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                {s.etudiant2 && <Users size={13} className="text-purple-500 flex-shrink-0" titleAccess="Binôme" />}
                                {nomEtudiants(s)}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">{s.niveau}</td>
                            <td className="px-3 py-2.5 text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800/60 max-w-[220px] truncate" title={s.titre_sujet}>{s.titre_sujet}</td>
                            <td className="px-3 py-2.5 text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">{s.encadrant || '—'}</td>
                            <td className="px-3 py-2.5 text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                              {s.etudiant_date_debut ? format(new Date(s.etudiant_date_debut), 'dd/MM/yyyy') : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                              {s.etudiant_date_fin ? format(new Date(s.etudiant_date_fin), 'dd/MM/yyyy') : '—'}
                            </td>
                            <td className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Sans date</span>
                            </td>
                            <td className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                              {canPlan && (
                                <Button size="xs" variant="primary" icon={Calendar} onClick={() => openPlanifier(s.etudiant_id)}>Planifier</Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal de planification */}
      <Modal open={modal} onClose={() => setModal(false)} title="Planifier une soutenance">
        <div className="space-y-4">
          <Select label="Étudiant *" value={form.etudiant_id} onChange={setF('etudiant_id')}>
            <option value="">— Choisir —</option>
            {etudiants.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.nom} ({e.code_etudiant})</option>)}
          </Select>

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input type="checkbox" checked={avecBinome}
              onChange={(e) => { setAvecBinome(e.target.checked); if (!e.target.checked) setForm((f) => ({ ...f, etudiant2_id: '' })); }}
              className="rounded border-slate-300" />
            <Users size={14} className="text-purple-500" /> Soutenance en binôme (2 étudiants)
          </label>

          {avecBinome && (
            <Select label="2e étudiant du binôme *" value={form.etudiant2_id} onChange={setF('etudiant2_id')}>
              <option value="">— Choisir —</option>
              {etudiants.filter((e) => String(e.id) !== String(form.etudiant_id)).map((e) => (
                <option key={e.id} value={e.id}>{e.prenom} {e.nom} ({e.code_etudiant})</option>
              ))}
            </Select>
          )}

          <button type="button" onClick={handleAssignationComplete} disabled={!form.etudiant_id || assignationComplete}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 transition-opacity disabled:opacity-40">
            {assignationComplete ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Sparkles size={15} />}
            Assignation IA complète (jury + horaire + salle)
          </button>
          <p className="text-[11px] text-slate-400 -mt-2">
            Résout simultanément le jury, l'horaire et la salle par optimisation sous contraintes (réciprocité, domaine d'expertise, disponibilités). Vous pouvez ensuite ajuster manuellement chaque champ ci-dessous.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <Select label="Rapporteur *" value={form.rapporteur_id} onChange={setF('rapporteur_id')}>
              <option value="">— Choisir —</option>
              {enseignants.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
            </Select>
            <Select label="Président *" value={form.president_id} onChange={setF('president_id')}>
              <option value="">— Choisir —</option>
              {enseignants.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date (parmi les jours ouverts)</label>
              <select value={form.date} onChange={setF('date')}
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500">
                <option value="">— Date non fixée —</option>
                {joursActifs.map((j) => (
                  <option key={j.id} value={j.date}>
                    {format(new Date(j.date), 'EEEE dd MMMM yyyy', { locale: fr })} (max {j.max_soutenances})
                  </option>
                ))}
              </select>
              {joursActifs.length === 0 && <p className="text-[11px] text-orange-500 mt-1">Aucun jour ouvert — configurez la période (page Période).</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Créneau (facultatif — auto si vide)</label>
              <select value={form.heure} onChange={setF('heure')} disabled={!form.date || loadingCreneaux}
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:opacity-50">
                <option value="">— Auto (prochain créneau libre) —</option>
                {creneaux.map((c) => (
                  <option key={c.heure} value={c.heure} disabled={!c.disponible}>
                    {c.heure} {!c.disponible ? '(déjà pris)' : ''}
                  </option>
                ))}
              </select>
              {loadingCreneaux && <p className="text-[11px] text-slate-400 mt-1">Calcul des créneaux...</p>}
            </div>
          </div>
          <Input label="Salle" value={form.salle} onChange={setF('salle')} placeholder="Salle A12" />
          {explicationIA && <PanneauExplicationIA expl={explicationIA} />}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button variant="primary" onClick={handlePlanifier} loading={saving}>Planifier</Button>
          </div>
        </div>
      </Modal>

      {/* ============ v1.10 : carte unique de modification (date/heure/salle + président/rapporteur) — admin uniquement ============ */}
      <Modal
        open={!!editSoutenance}
        onClose={() => setEditSoutenance(null)}
        title={editSoutenance ? `Modifier — ${nomEtudiants(editSoutenance)}` : 'Modifier'}
      >
        {editSoutenance && (
          <div className="space-y-5">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-xs text-slate-500">
              <p><span className="font-semibold text-slate-600 dark:text-slate-300">Encadrant :</span> {editSoutenance.encadrant || '—'} <span className="text-[10px]">(non modifiable ici)</span></p>
            </div>

            <button type="button" onClick={handleAssignationCompleteEdit} disabled={assignationCompleteEdit}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 transition-opacity disabled:opacity-40">
              {assignationCompleteEdit ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Sparkles size={15} />}
              Réassignation IA complète (jury + horaire + salle)
            </button>
            <p className="text-[11px] text-slate-400 -mt-2">
              Recalcule simultanément le jury, l'horaire et la salle par optimisation sous contraintes. Vous pouvez ensuite ajuster manuellement chaque champ ci-dessous.
            </p>

            {/* ---- Date / heure / salle ---- */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <CalendarClock size={13} /> Date, heure, salle
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date (parmi les jours ouverts) *</label>
                  <select value={editForm.date} onChange={setEditF('date')}
                    className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500">
                    <option value="">— Choisir une date —</option>
                    {joursActifs.map((j) => (
                      <option key={j.id} value={j.date}>
                        {format(new Date(j.date), 'EEEE dd MMMM yyyy', { locale: fr })} (max {j.max_soutenances})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Créneau (facultatif — auto si vide)</label>
                  <select value={editForm.heure} onChange={setEditF('heure')} disabled={!editForm.date || loadingEditCreneaux}
                    className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:opacity-50">
                    <option value="">— Auto (prochain créneau libre) —</option>
                    {editCreneaux.map((c) => (
                      <option key={c.heure} value={c.heure} disabled={!c.disponible && c.heure !== (editSoutenance.heure || '').slice(0, 5)}>
                        {c.heure} {!c.disponible && c.heure !== (editSoutenance.heure || '').slice(0, 5) ? '(déjà pris)' : ''}
                      </option>
                    ))}
                  </select>
                  {loadingEditCreneaux && <p className="text-[11px] text-slate-400 mt-1">Calcul des créneaux disponibles...</p>}
                </div>

                <div>
                  <Input label="Salle" value={editForm.salle} onChange={setEditF('salle')} placeholder="Salle A12" />
                </div>
              </div>
            </div>

            {/* ---- Jury ---- */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Jury (facultatif — laisser sur « garder » pour ne pas changer)</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Président</label>
                  <select value={editForm.president_id} onChange={setEditF('president_id')} disabled={loadingJuryDispo}
                    className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:opacity-50">
                    <option value="">— Garder « {editSoutenance.president || 'Non assigné'} » —</option>
                    {presidentsDispo.map((e) => (
                      <option key={e.id} value={e.id} disabled={!e.disponible}>
                        {e.prenom} {e.nom} {!e.disponible ? `— ${e.raison}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Rapporteur</label>
                  <select value={editForm.rapporteur_id} onChange={setEditF('rapporteur_id')} disabled={loadingJuryDispo}
                    className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:opacity-50">
                    <option value="">— Garder « {editSoutenance.rapporteur || 'Non assigné'} » —</option>
                    {rapporteursDispo.map((e) => (
                      <option key={e.id} value={e.id} disabled={!e.disponible}>
                        {e.prenom} {e.nom} {!e.disponible ? `— ${e.raison}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {loadingJuryDispo && <p className="text-[11px] text-slate-400">Vérification des disponibilités...</p>}
                <p className="text-[11px] text-slate-400">Un enseignant grisé n'est pas disponible à la date/heure choisie (créneau déjà pris, quota du jour atteint, ou indisponibilité déclarée). Choisir un nouveau nom envoie une nouvelle invitation à accepter/refuser.</p>
              </div>
            </div>

            {explicationIAEdit && <PanneauExplicationIA expl={explicationIAEdit} />}

            <div className="flex gap-3 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="secondary" onClick={() => setEditSoutenance(null)}>Annuler</Button>
              <Button variant="primary" onClick={handleEnregistrerEdit} loading={editSaving}>Enregistrer</Button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
}