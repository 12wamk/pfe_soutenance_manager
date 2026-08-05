import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import { Button, Modal, Input, Select, EmptyState } from '../components/ui';
import { departementsApi, optionsApi, adminApi } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Building2, Layers, UserCog, Trash, RotateCcw, Lock } from 'lucide-react';

export default function OptionsPage() {
  const [vue, setVue] = useState('actifs'); // 'actifs' | 'corbeille'

  const [departements, setDepartements] = useState([]);
  const [options, setOptions] = useState([]);
  const [enseignants, setEnseignants] = useState([]);
  const [loading, setLoading] = useState(true);

  const [deptCorbeille, setDeptCorbeille] = useState([]);
  const [optCorbeille, setOptCorbeille] = useState([]);
  const [loadingCorbeille, setLoadingCorbeille] = useState(false);

  const [deptModal, setDeptModal] = useState(null);
  const [deptForm, setDeptForm] = useState({ nom: '', code: '', chef_dept_id: '' });
  const [optModal, setOptModal] = useState(null);
  const [optForm, setOptForm] = useState({ nom: '', code: '', departement_id: '' });
  const [saving, setSaving] = useState(false);

  // Suppression avec confirmation par mot de passe
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'dept'|'opt', id }
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, o, e] = await Promise.all([departementsApi.getAll(), optionsApi.getAll(), adminApi.getEnseignants({ filtre: 'tous' })]);
      setDepartements(d.data.data || []);
      setOptions(o.data.data || []);
      setEnseignants(e.data.data || []);
    } finally { setLoading(false); }
  }, []);

  const loadCorbeille = useCallback(async () => {
    setLoadingCorbeille(true);
    try {
      const [d, o] = await Promise.all([
        departementsApi.getAll({ corbeille: 1 }),
        optionsApi.getAll({ corbeille: 1 }),
      ]);
      setDeptCorbeille(d.data.data || []);
      setOptCorbeille(o.data.data || []);
    } finally { setLoadingCorbeille(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (vue === 'corbeille') loadCorbeille(); }, [vue, loadCorbeille]);

  const saveDept = async () => {
    if (!deptForm.nom) { toast.error('Nom requis'); return; }
    setSaving(true);
    try {
      const payload = { ...deptForm, chef_dept_id: deptForm.chef_dept_id || null };
      if (deptModal === 'create') await departementsApi.create(payload);
      else await departementsApi.update(deptModal.id, payload);
      toast.success('Département enregistré');
      setDeptModal(null); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const saveOpt = async () => {
    if (!optForm.nom || !optForm.departement_id) { toast.error("Nom et département requis"); return; }
    setSaving(true);
    try {
      if (optModal === 'create') await optionsApi.create(optForm);
      else await optionsApi.update(optModal.id, optForm);
      toast.success('Spécialité enregistrée');
      setOptModal(null); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletePassword) { toast.error('Mot de passe requis'); return; }
    setDeleting(true);
    try {
      if (deleteTarget.type === 'dept') await departementsApi.delete(deleteTarget.id, deletePassword);
      else await optionsApi.delete(deleteTarget.id, deletePassword);
      toast.success('Déplacé dans la corbeille');
      setDeleteTarget(null); setDeletePassword(''); load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Erreur — mot de passe incorrect ?');
    } finally { setDeleting(false); }
  };

  const handleRestaurer = async (type, id) => {
    try {
      if (type === 'dept') await departementsApi.restaurer(id);
      else await optionsApi.restaurer(id);
      toast.success('Restauré');
      loadCorbeille(); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Erreur'); }
  };

  return (
    <Layout title="Départements & Spécialités" requiredRoles={['admin']}>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-blue-600 dark:text-blue-400" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Départements & Spécialités
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Chaque spécialité est affectée à un département ; chaque département a un chef désigné
        </p>
      </div>

      {/* Onglets */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setVue('actifs')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            vue === 'actifs'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Actifs
        </button>
        <button
          onClick={() => setVue('corbeille')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors ${
            vue === 'corbeille'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <Trash size={15} /> Corbeille
        </button>
      </div>

      {/* ============ VUE ACTIFS ============ */}
      {vue === 'actifs' && (
        loading ? (
          <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Départements */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 text-sm">
                  <Building2 size={16} className="text-blue-500" /> Départements
                </h3>
                <Button size="xs" variant="primary" icon={Plus} onClick={() => { setDeptForm({ nom: '', code: '', chef_dept_id: '' }); setDeptModal('create'); }}>Ajouter</Button>
              </div>
              {departements.length === 0 ? (
                <EmptyState emoji="🏛️" title="Aucun département" desc="Créez votre premier département." />
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {departements.map((d) => (
                    <div key={d.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <div className="text-sm text-slate-700 dark:text-slate-200 font-medium flex items-center gap-2">
                          {d.nom} {d.code && <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-mono">{d.code}</span>}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <UserCog size={11} /> {d.chef_dept_nom || 'Aucun chef désigné'}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setDeptForm({ nom: d.nom, code: d.code || '', chef_dept_id: d.chef_dept_id || '' }); setDeptModal(d); }} className="p-1.5 rounded-md text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:opacity-80"><Edit2 size={13} /></button>
                        <button onClick={() => { setDeleteTarget({ type: 'dept', id: d.id }); setDeletePassword(''); }} className="p-1.5 rounded-md text-red-600 bg-red-50 dark:bg-red-900/20 hover:opacity-80"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Spécialités (options) */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 text-sm">
                  <Layers size={16} className="text-purple-500" /> Spécialités
                </h3>
                <Button size="xs" variant="primary" icon={Plus} onClick={() => { setOptForm({ nom: '', code: '', departement_id: '' }); setOptModal('create'); }} disabled={departements.length === 0}>Ajouter</Button>
              </div>
              {options.length === 0 ? (
                <EmptyState emoji="📚" title="Aucune spécialité" desc={departements.length === 0 ? "Créez d'abord un département." : "Créez votre première spécialité."} />
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {options.map((o) => (
                    <div key={o.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <div className="text-sm text-slate-700 dark:text-slate-200 font-medium flex items-center gap-2">
                          {o.nom} {o.code && <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-mono">{o.code}</span>}
                        </div>
                        <div className="text-xs text-slate-400">{o.departement_nom || 'Non affecté'}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setOptForm({ nom: o.nom, code: o.code || '', departement_id: o.departement_id }); setOptModal(o); }} className="p-1.5 rounded-md text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:opacity-80"><Edit2 size={13} /></button>
                        <button onClick={() => { setDeleteTarget({ type: 'opt', id: o.id }); setDeletePassword(''); }} className="p-1.5 rounded-md text-red-600 bg-red-50 dark:bg-red-900/20 hover:opacity-80"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* ============ VUE CORBEILLE ============ */}
      {vue === 'corbeille' && (
        loadingCorbeille ? (
          <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 text-sm">
                  <Building2 size={16} className="text-slate-400" /> Départements supprimés
                </h3>
              </div>
              {deptCorbeille.length === 0 ? (
                <EmptyState emoji="🗑️" title="Corbeille vide" desc="Aucun département supprimé." />
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {deptCorbeille.map((d) => (
                    <div key={d.id} className="flex items-center justify-between px-5 py-3">
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {d.nom} {d.code && <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">{d.code}</span>}
                      </div>
                      <Button size="xs" variant="outline" icon={RotateCcw} onClick={() => handleRestaurer('dept', d.id)}>Restaurer</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 text-sm">
                  <Layers size={16} className="text-slate-400" /> Spécialités supprimées
                </h3>
              </div>
              {optCorbeille.length === 0 ? (
                <EmptyState emoji="🗑️" title="Corbeille vide" desc="Aucune spécialité supprimée." />
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {optCorbeille.map((o) => (
                    <div key={o.id} className="flex items-center justify-between px-5 py-3">
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {o.nom} {o.code && <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">{o.code}</span>}
                      </div>
                      <Button size="xs" variant="outline" icon={RotateCcw} onClick={() => handleRestaurer('opt', o.id)}>Restaurer</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      )}

      <Modal open={!!deptModal} onClose={() => setDeptModal(null)} title={deptModal === 'create' ? 'Nouveau département' : 'Modifier le département'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nom *" value={deptForm.nom} onChange={(e) => setDeptForm((f) => ({ ...f, nom: e.target.value }))} placeholder="Génie Informatique" />
            <Input label="Code court" value={deptForm.code} onChange={(e) => setDeptForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="GII" />
          </div>
          <Select label="Chef de département" value={deptForm.chef_dept_id} onChange={(e) => setDeptForm((f) => ({ ...f, chef_dept_id: e.target.value }))}>
            <option value="">— Aucun —</option>
            {enseignants.map((en) => <option key={en.id} value={en.id}>{en.prenom} {en.nom}</option>)}
          </Select>
          <p className="text-[11px] text-slate-400">Le code sert à déduire automatiquement le département depuis la colonne "niveau" lors de l'import CSV (ex: "GII" dans "3 GII-SII").</p>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setDeptModal(null)}>Annuler</Button>
            <Button variant="primary" onClick={saveDept} loading={saving}>Enregistrer</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!optModal} onClose={() => setOptModal(null)} title={optModal === 'create' ? 'Nouvelle spécialité' : 'Modifier la spécialité'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nom *" value={optForm.nom} onChange={(e) => setOptForm((f) => ({ ...f, nom: e.target.value }))} placeholder="Sécurité Informatique" />
            <Input label="Code court" value={optForm.code} onChange={(e) => setOptForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="SII" />
          </div>
          <Select label="Département *" value={optForm.departement_id} onChange={(e) => setOptForm((f) => ({ ...f, departement_id: e.target.value }))}>
            <option value="">— Choisir —</option>
            {departements.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
          </Select>
          <p className="text-[11px] text-slate-400">Le code sert à déduire automatiquement la spécialité depuis "niveau" lors de l'import (ex: "SII" dans "3 GII-SII").</p>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setOptModal(null)}>Annuler</Button>
            <Button variant="primary" onClick={saveOpt} loading={saving}>Enregistrer</Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation de suppression avec mot de passe obligatoire */}
      <Modal open={!!deleteTarget} onClose={() => { setDeleteTarget(null); setDeletePassword(''); }} title="Confirmer la suppression">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Cet élément sera déplacé dans la corbeille (récupérable ensuite). Confirmez avec votre mot de passe.
          </p>
          <Input
            label="Votre mot de passe"
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder="••••••••"
            icon={Lock}
            autoFocus
          />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => { setDeleteTarget(null); setDeletePassword(''); }}>Annuler</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting} disabled={!deletePassword}>Supprimer</Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}