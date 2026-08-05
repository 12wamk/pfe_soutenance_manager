import { useState } from "react";
import { adminApi } from "../services/api";

/**
 * Bouton "Optimiser le planning" pour l'espace Admin.
 * Deux modes :
 *   - Une date précise (champ rempli)
 *   - Toutes les dates ayant des soutenances planifiées (champ vide)
 * Affichage clair : nom de l'étudiant, encadrant, salle, et comparaison
 * heure actuelle -> heure proposée, pour que l'admin comprenne ce qui
 * va changer avant de confirmer.
 */
export default function OptimiserPlanningButton() {
  const [date, setDate] = useState("");
  const [apercu, setApercu] = useState(null);
  const [meta, setMeta] = useState(null); // { mode, nb_dates, nb_soutenances }
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState(null);

  const previsualiser = async () => {
    setLoading(true);
    setErreur(null);
    setApercu(null);
    setMeta(null);
    try {
      // date vide -> l'API optimise automatiquement toutes les dates planifiées
      const res = await adminApi.optimiserPlanning(date || null, false);
      const payload = res.data.data ?? res.data;
      setApercu(payload.planning);
      setMeta({
        mode: payload.mode || "une_date",
        nbDates: payload.nb_dates,
        nbSoutenances: payload.nb_soutenances,
      });
    } catch (err) {
      setErreur(err.response?.data?.error || "Erreur lors de l'optimisation");
    } finally {
      setLoading(false);
    }
  };

  const appliquer = async () => {
    setLoading(true);
    setErreur(null);
    try {
      const res = await adminApi.optimiserPlanning(date || null, true);
      const payload = res.data.data ?? res.data;
      const nbNotifies = payload.notifications_envoyees ?? 0;
      alert(`Planning appliqué avec succès !\n${nbNotifies} enseignant(s) notifié(s) par email et notification in-app.`);
      setApercu(null);
      setMeta(null);
      setDate("");
    } catch (err) {
      setErreur(err.response?.data?.error || "Erreur lors de l'application");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <h2 className="font-semibold mb-1">Optimiser le planning</h2>
      <p className="text-xs text-gray-500 mb-3">
        Recalcule les heures pour regrouper les soutenances de chaque enseignant
        (encadrant/rapporteur/président), sans temps mort dans son emploi du temps,
        et sans conflit de salle. Laisse la date vide pour optimiser
        <strong> toutes les dates</strong> ayant des soutenances planifiées.
      </p>

      <div className="flex gap-2 mb-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          placeholder="Toutes les dates"
          className="border rounded-md px-3 py-2 text-sm flex-1"
        />
        {date && (
          <button
            onClick={() => setDate("")}
            title="Effacer pour optimiser toutes les dates"
            className="px-2 text-xs text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
        <button
          onClick={previsualiser}
          disabled={loading}
          className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Calcul..." : "Prévisualiser"}
        </button>
      </div>

      {!date && (
        <p className="text-xs text-blue-600 mb-3">
          Mode : toutes les dates planifiées seront optimisées en une fois.
        </p>
      )}

      {erreur && <p className="text-sm text-red-600 mb-3">{erreur}</p>}

      {apercu && (
        <div>
          <p className="text-sm text-gray-600 mb-2">
            {meta?.mode === "toutes_dates"
              ? `Planning proposé sur ${meta.nbDates} date(s) — ${meta.nbSoutenances} soutenance(s) au total :`
              : `Planning proposé pour le ${date} — ${apercu.length} soutenance(s) :`}
          </p>

          <div className="overflow-x-auto mb-3 max-h-96 overflow-y-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase sticky top-0">
                  {meta?.mode === "toutes_dates" && <th className="px-2 py-2">Date</th>}
                  <th className="px-2 py-2">Étudiant</th>
                  <th className="px-2 py-2">Encadrant</th>
                  <th className="px-2 py-2">Salle</th>
                  <th className="px-2 py-2">Heure actuelle</th>
                  <th className="px-2 py-2">Heure proposée</th>
                  <th className="px-2 py-2">Durée estimée</th>
                </tr>
              </thead>
              <tbody>
                {apercu.map((s) => {
                  const changement = s.heure_actuelle && s.heure_actuelle !== s.heure_debut.slice(0, 5);
                  return (
                    <tr key={s.id} className="border-b">
                      {meta?.mode === "toutes_dates" && (
                        <td className="px-2 py-2 text-gray-500 whitespace-nowrap">{s.date}</td>
                      )}
                      <td className="px-2 py-2 font-medium">{s.etudiant || `Soutenance #${s.id}`}</td>
                      <td className="px-2 py-2 text-gray-600">{s.encadrant_nom || "—"}</td>
                      <td className="px-2 py-2 text-gray-600">{s.salle || "—"}</td>
                      <td className="px-2 py-2 text-gray-400">
                        {s.heure_actuelle || "non planifiée"}
                      </td>
                      <td className={`px-2 py-2 font-semibold ${changement ? "text-orange-600" : "text-green-600"}`}>
                        {s.heure_debut.slice(0, 5)}
                        {changement && <span className="ml-1 text-xs font-normal">(modifiée)</span>}
                      </td>
                      <td className="px-2 py-2 text-gray-600">{s.duree_min} min</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-500 mb-3">
            Les heures en <span className="text-orange-600 font-semibold">orange</span> seront modifiées
            par rapport au planning actuel. En vert : déjà à la bonne heure.
          </p>

          <button
            onClick={appliquer}
            disabled={loading}
            className="px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Application..." : "Appliquer ce planning"}
          </button>
        </div>
      )}
    </div>
  );
}