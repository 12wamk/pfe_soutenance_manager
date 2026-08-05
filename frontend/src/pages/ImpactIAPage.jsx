import React, { useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import { adminApi } from '../services/api';
import { Brain, Target, Clock, TrendingDown, Database, RefreshCw } from 'lucide-react';

function CarteKPI({ icon: Icon, titre, valeur, sousTitre, couleur }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${couleur}`}>
          <Icon size={19} />
        </div>
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{titre}</span>
      </div>
      <p className="text-3xl font-black text-slate-800 dark:text-white">{valeur}</p>
      {sousTitre && <p className="text-xs text-slate-400 mt-1">{sousTitre}</p>}
    </div>
  );
}

export default function ImpactIAPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);

  const charger = () => {
    setLoading(true);
    setErreur(null);
    adminApi.getImpactStats()
      .then((r) => setStats(r.data.data ?? r.data))
      .catch((e) => setErreur(e.response?.data?.error || "Erreur lors du chargement des statistiques"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { charger(); }, []);

  return (
    <Layout title="Impact IA + RO" requiredRoles={['admin', 'chef_dept']}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-bold text-2xl text-blue-600 dark:text-blue-400 flex items-center gap-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <Brain size={22} /> Impact IA + Recherche Opérationnelle
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Indicateurs mesurant la valeur apportée par le module IA/RO au système de planification
          </p>
        </div>
        <button onClick={charger} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Recalculer
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : erreur ? (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl p-6 text-sm">{erreur}</div>
      ) : stats ? (
        <div className="space-y-8">

          {/* ============ SECTION 1 : Précision du modèle ============ */}
          <div>
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
              <Target size={16} className="text-blue-500" /> Précision du modèle de prédiction de durée
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CarteKPI
                icon={Target}
                titre="Écart moyen (MAE)"
                valeur={stats.precision_modele.mae_minutes !== null ? `${stats.precision_modele.mae_minutes} min` : '—'}
                sousTitre="Différence moyenne entre durée prédite et durée réelle observée"
                couleur="bg-blue-500"
              />
              <CarteKPI
                icon={Database}
                titre="Exemples utilisés"
                valeur={stats.precision_modele.nb_exemples}
                sousTitre="Soutenances avec durée réelle enregistrée, servant à mesurer la précision"
                couleur="bg-indigo-500"
              />
            </div>
            {stats.precision_modele.nb_exemples === 0 && (
              <p className="text-xs text-orange-500 mt-2">
                Aucune donnée réelle disponible pour l'instant — utilisez les boutons Démarrer/Terminer
                sur les soutenances pour commencer à collecter des données.
              </p>
            )}
          </div>

          {/* ============ SECTION 2 : Gain d'optimisation ============ */}
          <div>
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
              <Clock size={16} className="text-blue-500" /> Réduction du temps d'attente (Recherche Opérationnelle)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <CarteKPI
                icon={Clock}
                titre="Temps d'attente actuel"
                valeur={`${stats.optimisation_planning.temps_attente_reel_min} min`}
                sousTitre="Cumulé, tous enseignants et dates confondus"
                couleur="bg-orange-500"
              />
              <CarteKPI
                icon={Target}
                titre="Temps d'attente optimal"
                valeur={`${stats.optimisation_planning.temps_attente_optimal_min} min`}
                sousTitre="Si le planning optimisé était appliqué"
                couleur="bg-green-500"
              />
              <CarteKPI
                icon={TrendingDown}
                titre="Gain potentiel"
                valeur={`${stats.optimisation_planning.gain_min} min`}
                sousTitre={`Soit ${stats.optimisation_planning.gain_pourcentage}% de réduction`}
                couleur="bg-emerald-500"
              />
              <CarteKPI
                icon={Database}
                titre="Dates analysées"
                valeur={stats.optimisation_planning.nb_dates_analysees}
                sousTitre="Journées avec au moins 2 soutenances comparées"
                couleur="bg-slate-500"
              />
            </div>
            {stats.optimisation_planning.nb_dates_analysees === 0 && (
              <p className="text-xs text-orange-500 mt-2">
                Aucune date avec plusieurs soutenances planifiées à comparer pour l'instant.
              </p>
            )}
          </div>

          {/* ============ SECTION 3 : Collecte de données ============ */}
          <div>
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
              <Database size={16} className="text-blue-500" /> Progression de la collecte de données réelles
            </h2>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  {stats.collecte_donnees.nb_soutenances_avec_duree_reelle} / {stats.collecte_donnees.seuil_reentrainement} soutenances réelles collectées
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  Seuil de réentraînement automatique
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{
                    width: `${Math.min(100, (stats.collecte_donnees.nb_soutenances_avec_duree_reelle / stats.collecte_donnees.seuil_reentrainement) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {stats.collecte_donnees.nb_soutenances_avec_duree_reelle >= stats.collecte_donnees.seuil_reentrainement
                  ? "Le seuil est atteint : le modèle peut se réentraîner sur de vraies données."
                  : "En dessous de ce seuil, le modèle conserve ses données actuelles pour rester fiable."}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </Layout>
  );
}
