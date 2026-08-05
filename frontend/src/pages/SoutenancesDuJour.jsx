import { useEffect, useState } from "react";
import Layout from "../components/layout/Layout";
import { EmptyState } from "../components/ui";
import { soutenancesApi } from "../services/api"; // api.js se trouve dans src/services/

/**
 * Page pour l'encadrant : liste ses soutenances du jour avec
 * 2 boutons par ligne : "Démarrer" et "Terminer".
 *
 * Utilise le client axios centralisé (api.js) du projet, qui gère
 * déjà automatiquement le token JWT via l'intercepteur.
 */
export default function SoutenancesDuJour() {
  const [soutenances, setSoutenances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionEnCours, setActionEnCours] = useState(null);

  const chargerSoutenances = async () => {
    setLoading(true);
    try {
      const res = await soutenancesApi.getAujourdhui();
      // Adapte cette ligne selon la forme exacte renvoyée par ta fonction ok() côté PHP
      // (ex: res.data direct, ou res.data.data si ok() enveloppe dans { success, data })
      setSoutenances(res.data.data ?? res.data);
    } catch (err) {
      console.error("Erreur chargement soutenances:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerSoutenances();
  }, []);

  const demarrer = async (id) => {
    setActionEnCours(id);
    try {
      await soutenancesApi.demarrer(id);
      await chargerSoutenances();
    } catch (err) {
      console.error("Erreur demarrage:", err);
      alert(err.response?.data?.error || "Erreur lors du démarrage");
    } finally {
      setActionEnCours(null);
    }
  };

  const terminer = async (id) => {
    setActionEnCours(id);
    try {
      const res = await soutenancesApi.terminer(id);
      const duree = res.data.data?.duree_reelle_min ?? res.data.duree_reelle_min;
      if (duree) {
        alert(`Soutenance terminée — durée réelle : ${duree} min`);
      }
      await chargerSoutenances();
    } catch (err) {
      console.error("Erreur fin soutenance:", err);
      alert(err.response?.data?.error || "Erreur lors de la fin de soutenance");
    } finally {
      setActionEnCours(null);
    }
  };

  return (
    <Layout title="Soutenances du jour" requiredRoles={['encadrant']}>
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : soutenances.length === 0 ? (
        <EmptyState emoji="📅" title="Aucune soutenance aujourd'hui" desc="Rien de prévu pour vous aujourd'hui." />
      ) : (
        <div className="max-w-3xl mx-auto">
          <h1 className="font-bold text-2xl text-blue-600 dark:text-blue-400 mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Mes soutenances du jour
          </h1>

          <div className="space-y-3">
            {soutenances.map((s) => (
              <div
                key={s.id}
                className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex items-center justify-between bg-white dark:bg-slate-900 shadow-sm"
              >
                <div>
                  <p className="font-medium text-slate-800 dark:text-white">{s.etudiant}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {s.titre_sujet} — {s.heure} — Salle {s.salle}
                  </p>
                  {s.heure_debut_reelle && !s.heure_fin_reelle && (
                    <p className="text-sm text-orange-600 mt-1">En cours...</p>
                  )}
                  {s.duree_reelle_min != null && (
                    <p className="text-sm text-green-600 mt-1">
                      Terminée — {s.duree_reelle_min} min
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  {!s.heure_debut_reelle && (
                    <button
                      onClick={() => demarrer(s.id)}
                      disabled={actionEnCours === s.id}
                      className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
                    >
                      Démarrer
                    </button>
                  )}

                  {s.heure_debut_reelle && !s.heure_fin_reelle && (
                    <button
                      onClick={() => terminer(s.id)}
                      disabled={actionEnCours === s.id}
                      className="px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium disabled:opacity-50"
                    >
                      Terminer
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}