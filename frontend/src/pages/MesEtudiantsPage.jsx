import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import { Badge, EmptyState } from '../components/ui';
import { adminApi } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, FileText, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ouvrirFicheIndividuelle } from '../utils/exportSoutenances';

const statutConfig = {
  sans_date: { label: 'Sans date', color: 'yellow', icon: AlertCircle },
  planifiee: { label: 'En attente', color: 'yellow', icon: Clock },
  validee: { label: 'Validée', color: 'green', icon: CheckCircle },
  refusee: { label: 'Refusée', color: 'red', icon: XCircle },
};

export default function MesEtudiantsPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.getEtudiants({ search });
      setList(r.data.data || []);
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const ouvrirFiche = (e) => {
    ouvrirFicheIndividuelle({
      code_etudiant: e.code_etudiant, etudiant: `${e.prenom} ${e.nom}`, niveau: e.niveau,
      titre_sujet: e.titre_sujet, date: e.soutenance_date, heure: e.soutenance_heure,
      salle: e.salle, encadrant: e.encadrant_nom, president: e.president, rapporteur: e.rapporteur,
      statut: e.soutenance_statut,
    });
  };

  return (
    <Layout title="Mes Étudiants" requiredRoles={['encadrant']}>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-blue-600 dark:text-blue-400" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Mes Étudiants
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Étudiants dont vous êtes l'encadrant — planifiez leur soutenance en un clic</p>
      </div>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..."
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-800 dark:text-white" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : list.length === 0 ? (
        <EmptyState emoji="🎓" title="Aucun étudiant" desc="Vous n'encadrez actuellement aucun étudiant." />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  {['Étudiant', 'Code', 'Niveau', 'Sujet', 'Soutenance', 'Validation', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((e) => {
                  const st = statutConfig[e.soutenance_statut] || statutConfig.sans_date;
                  const StIcon = st.icon;
                  return (
                    <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-400 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                            {e.prenom?.[0]}{e.nom?.[0]}
                          </div>
                          <span className="font-medium text-slate-800 dark:text-white text-sm">{e.prenom} {e.nom}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">{e.code_etudiant}</td>
                      <td className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 font-medium">{e.niveau}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800/60 max-w-[220px] truncate" title={e.titre_sujet}>{e.titre_sujet || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                        {e.soutenance_date ? format(new Date(e.soutenance_date), 'dd/MM/yyyy') : 'Sans date'}
                      </td>
                      <td className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                        <Badge color={st.color}><StIcon size={11} className="inline mr-1" />{st.label}</Badge>
                      </td>
                      <td className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button onClick={() => navigate(`/soutenances?etudiant=${e.id}`)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-600 hover:opacity-80 transition-opacity dark:bg-blue-900/20 dark:text-blue-400">
                            <Calendar size={13} /> Planifier
                          </button>
                          {e.soutenance_date && (
                            <button onClick={() => ouvrirFiche(e)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 hover:opacity-80 transition-opacity dark:bg-slate-800 dark:text-slate-300">
                              <FileText size={13} />
                            </button>
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
      )}
    </Layout>
  );
}
