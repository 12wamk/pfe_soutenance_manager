import { useEffect, useState } from 'react';
import { Modal } from '../components/ui';
import { adminApi } from '../services/api';
import { juryApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Calendar, Clock, MapPin, CheckCircle2, AlertCircle, Scale } from 'lucide-react';

const roleLabels = { encadrant: 'Encadrant', rapporteur: 'Rapporteur', president: 'Président' };
const roleColors = {
  encadrant: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  rapporteur: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
  president: 'bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400',
};
const statutColors = {
  planifiee: 'bg-yellow-50 text-yellow-700', validee: 'bg-green-50 text-green-700',
  sans_date: 'bg-slate-100 text-slate-500', refusee: 'bg-red-50 text-red-700',
};

function EcartBadge({ ecart, label }) {
  const cls = ecart < 0
    ? 'text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400'
    : ecart === 0
    ? 'text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400'
    : 'text-orange-700 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400';
  const Icon = ecart <= 0 ? CheckCircle2 : AlertCircle;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>
      <Icon size={11} /> {label} : {ecart <= 0 ? 'OK' : `manque ${ecart}`}
    </span>
  );
}

// v1.7 — boutons +/- pour l'ajustement manuel de la réciprocité (admin uniquement).
// Applique un delta (pas une valeur absolue) pour ne jamais écraser un ajustement existant.
function AjustementControls({ enseignantId, role, valeur, onChange }) {
  const [busy, setBusy] = useState(false);

  const appliquer = async (delta) => {
    const motif = window.prompt('Motif de cet ajustement (optionnel) :') || '';
    setBusy(true);
    try {
      await juryApi.ajusterReciprocite(enseignantId, role, delta, motif);
      onChange(delta);
    } catch (e) {
      alert("Échec de l'ajustement.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-center gap-1 mt-1">
      <button
        disabled={busy}
        onClick={() => appliquer(-1)}
        className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-bold disabled:opacity-50"
        title="Diminuer d'un point"
      >
        −
      </button>
      {valeur !== 0 && (
        <span className="text-[10px] text-slate-400" title="Ajustement manuel cumulé">
          {valeur > 0 ? `+${valeur}` : valeur}
        </span>
      )}
      <button
        disabled={busy}
        onClick={() => appliquer(1)}
        className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-bold disabled:opacity-50"
        title="Augmenter d'un point"
      >
        +
      </button>
    </div>
  );
}

/**
 * Modal de détail : statistiques (réciprocité, charge, dans/hors dept) +
 * liste de toutes les soutenances d'un enseignant (tous rôles), ouverte
 * au clic sur une ligne de la page Enseignants.
 *
 * Usage : <DetailEnseignantModal enseignantId={id} onClose={() => setId(null)} />
 * (passer null pour fermer, un id pour ouvrir)
 */
export default function DetailEnseignantModal({ enseignantId, onClose }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enseignantId) { setData(null); return; }
    setLoading(true);
    adminApi.getEnseignantDetail(enseignantId)
      .then((r) => setData(r.data.data ?? r.data))
      .finally(() => setLoading(false));
  }, [enseignantId]);

  const isAdmin = user?.role === 'admin';

  // Applique localement le delta déjà validé côté serveur, sans recharger toute la fiche.
  const appliquerDeltaLocal = (role, delta) => {
    setData((prev) => {
      if (!prev) return prev;
      const rec = { ...prev.reciprocite };
      if (role === 'rapporteur') {
        rec.nb_rapporteur += delta;
        rec.ecart_rapporteur -= delta;
      } else {
        rec.nb_president += delta;
        rec.ecart_president -= delta;
      }
      return { ...prev, reciprocite: rec };
    });
  };

  return (
    <Modal
      open={!!enseignantId}
      onClose={onClose}
      title={data ? `${data.enseignant.prenom} ${data.enseignant.nom}` : 'Détail'}
    >
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data ? null : (
        <div className="space-y-5">

          {/* ---- Réciprocité ---- */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Scale size={13} /> Réciprocité
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center mb-2">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2.5">
                <p className="text-lg font-bold text-slate-800 dark:text-white">{data.reciprocite.objectif}</p>
                <p className="text-[10px] text-slate-400">Étudiants encadrés</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2.5">
                <p className="text-lg font-bold text-slate-800 dark:text-white">{data.reciprocite.nb_rapporteur}</p>
                <p className="text-[10px] text-slate-400">Fois rapporteur</p>
                {isAdmin && (
                  <AjustementControls
                    enseignantId={enseignantId}
                    role="rapporteur"
                    valeur={data.reciprocite.ajustement_rapporteur || 0}
                    onChange={(delta) => appliquerDeltaLocal('rapporteur', delta)}
                  />
                )}
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2.5">
                <p className="text-lg font-bold text-slate-800 dark:text-white">{data.reciprocite.nb_president}</p>
                <p className="text-[10px] text-slate-400">Fois président</p>
                {isAdmin && (
                  <AjustementControls
                    enseignantId={enseignantId}
                    role="president"
                    valeur={data.reciprocite.ajustement_president || 0}
                    onChange={(delta) => appliquerDeltaLocal('president', delta)}
                  />
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <EcartBadge ecart={data.reciprocite.ecart_rapporteur} label="Rapporteur" />
              <EcartBadge ecart={data.reciprocite.ecart_president} label="Président" />
            </div>
          </div>

          {/* ---- Charge & répartition ---- */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Charge & répartition</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2.5">
                <p className="text-sm font-bold text-teal-600 dark:text-teal-400">{data.charge.nb_dans_departement}</p>
                <p className="text-[10px] text-slate-400">Dans dépt.</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2.5">
                <p className="text-sm font-bold text-orange-600 dark:text-orange-400">{data.charge.nb_hors_departement}</p>
                <p className="text-[10px] text-slate-400">Hors dépt.</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2.5">
                <p className={`text-sm font-bold ${data.charge.capacite_restante === 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {data.charge.capacite_restante}
                </p>
                <p className="text-[10px] text-slate-400">Restant (max {data.charge.max_effectif}/j)</p>
              </div>
            </div>
          </div>

          {/* ---- Liste des soutenances ---- */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
              Soutenances ({data.total})
            </h3>
            {data.soutenances.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Aucune soutenance associée à cet enseignant.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {data.soutenances.map((s) => (
                  <div key={`${s.id}-${s.role_joue}`} className="border border-slate-200 dark:border-slate-800 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="font-semibold text-slate-800 dark:text-white text-sm">{s.etudiant}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${roleColors[s.role_joue]}`}>
                        {roleLabels[s.role_joue]}
                      </span>
                    </div>
                    {s.titre_sujet && <p className="text-xs text-slate-500 mb-1.5 line-clamp-1">{s.titre_sujet}</p>}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Calendar size={11} /> {s.date || 'Sans date'}</span>
                      {s.heure && <span className="flex items-center gap-1"><Clock size={11} /> {s.heure.slice(0, 5)}</span>}
                      {s.salle && <span className="flex items-center gap-1"><MapPin size={11} /> {s.salle}</span>}
                      <span className={`px-2 py-0.5 rounded-full font-medium ${statutColors[s.statut] || ''}`}>{s.statut}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}