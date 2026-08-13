import { Fragment, useState } from 'react';
import { adminApi } from '../services/api';
import {
  Brain, Eye, CheckCircle, AlertCircle, Loader2, Sparkles,
  ChevronDown, ChevronUp, UserX, ShieldCheck, Tag, Percent,
  GitMerge, ListChecks, Maximize2, Minimize2,
} from 'lucide-react';

const getPertinenceColor = (score) => {
  if (score >= 0.5) return 'text-green-600';
  if (score >= 0.3) return 'text-yellow-600';
  return 'text-red-500';
};

const getPertinenceBar = (score) => {
  if (score >= 0.5) return 'bg-green-500';
  if (score >= 0.3) return 'bg-yellow-500';
  return 'bg-red-400';
};

const getPertinenceLabel = (score) => {
  if (score >= 0.5) return 'Excellente';
  if (score >= 0.3) return 'Bonne';
  if (score >= 0.15) return 'Moyenne';
  return 'Faible';
};

function Chip({ label, active = false, dim = false }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
        active
          ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
          : dim
            ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
      }`}
    >
      {active && <CheckCircle size={10} className="text-blue-500" />}
      {label}
    </span>
  );
}

function BlocMatching({ role, donnees, couleurTexte, couleurBarre }) {
  if (!donnees) return null;
  const correspondants = donnees.tags_correspondants || [];
  const cours = donnees.cours_correspondants || [];
  const score = donnees.score || 0;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className={`text-sm font-bold ${couleurTexte}`}>{role}</span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] uppercase tracking-wide text-slate-400`}>{getPertinenceLabel(score)}</span>
          <span className={`text-lg font-black ${getPertinenceColor(score)}`}>{Math.round(score * 100)}%</span>
        </div>
      </div>

      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mb-3">
        <div className={`h-full rounded-full ${getPertinenceBar(score)} transition-all`} style={{ width: `${Math.min(100, score * 100)}%` }} />
      </div>

      {correspondants.length > 0 ? (
        <div className="mb-3">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400 mb-1.5">
            <GitMerge size={11} className="text-blue-500" /> Correspondances détectées ({correspondants.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {correspondants.map((t) => (
              <Chip key={t} label={t} active />
            ))}
          </div>
          {cours.length > 0 && (
            <div className="mt-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Cours liés enseignés</div>
              <div className="flex flex-wrap gap-1.5">
                {cours.map((c) => (
                  <Chip key={c} label={c} active />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 mb-3 flex items-center gap-1.5">
          <AlertCircle size={12} />
          Aucune correspondance directe — score minimal appliqué (professeur sans expertise renseignée).
        </p>
      )}

      <div>
        <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1.5">
          Expertise de l'enseignant ({donnees.tags_enseignant?.length || 0})
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(donnees.tags_enseignant || []).slice(0, 14).map((t) => (
            <Chip key={t} label={t} dim={!correspondants.includes(t)} />
          ))}
          {(donnees.tags_enseignant || []).length > 14 && (
            <span className="text-[10px] text-slate-400 self-center">+{(donnees.tags_enseignant || []).length - 14}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function LigneExplication({ s }) {
  const expl = s.expl;
  if (!expl) {
    return (
      <div className="text-xs text-slate-500 p-4">Aucune explication disponible pour cette soutenance.</div>
    );
  }
  const projet = expl.projet || {};
  const encadrant = expl.encadrant || {};
  const contraintes = expl.contraintes || [];

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Colonne gauche : projet, encadrant, contraintes */}
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-400 mb-2">
              <Tag size={11} className="text-blue-500" /> Projet de l'étudiant
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">{projet.titre || s.etudiant}</p>
            <div className="flex flex-wrap gap-1.5">
              {(projet.tags || []).map((t) => (
                <Chip key={t} label={t} />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/10 p-4 shadow-sm">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white shrink-0 mt-0.5">
                <UserX size={16} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400 font-semibold mb-0.5">
                  Encadrant exclu du jury
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{encadrant.nom || '—'}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{encadrant.regle}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-900/10 p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400 font-semibold mb-2.5">
              <ListChecks size={12} /> Règles métier vérifiées
            </div>
            <div className="space-y-1.5">
              {contraintes.map((c) => (
                <div key={c.id} className="flex items-start gap-2 text-[11.5px]">
                  <CheckCircle size={14} className="text-green-500 shrink-0 mt-0.5" />
                  <div className="text-slate-700 dark:text-slate-300">
                    <span className="font-bold">{c.id}</span>
                    <span className="mx-1 font-semibold">— {c.label} :</span>
                    <span className="text-slate-500 dark:text-slate-400">{c.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Colonne droite : matching président + rapporteur */}
        <div className="space-y-3">
          <BlocMatching role="Président" donnees={expl.president} couleurTexte="text-blue-700 dark:text-blue-400" />
          <BlocMatching role="Rapporteur" donnees={expl.rapporteur} couleurTexte="text-indigo-700 dark:text-indigo-400" />
        </div>
      </div>
    </div>
  );
}

export default function AutoPlanningButton() {
  const [loading, setLoading] = useState(false);
  const [apercu, setApercu] = useState(null);
  const [meta, setMeta] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [detailles, setDetailles] = useState(() => new Set());

  const toggleDetail = (id) => {
    setDetailles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toutAfficher = () => {
    setDetailles((prev) => {
      if (apercu && apercu.length === prev.size) return new Set();
      return new Set(apercu.map((s) => s.id));
    });
  };

  const previsualiser = async () => {
    setLoading(true);
    setErreur(null);
    setApercu(null);
    setDetailles(new Set());
    try {
      const res = await adminApi.autoPlanningComplet(null, false);
      const payload = res.data.data ?? res.data;
      setApercu(payload.planning || []);
      setMeta({
        mode: payload.mode,
        nbSoutenances: payload.nb_soutenances,
        nbDates: payload.nb_dates,
        scorePertinence: payload.score_pertinence_moyen,
        status: payload.status,
      });
    } catch (err) {
      setErreur(err.response?.data?.error || "Erreur lors de l'auto-planning");
    } finally {
      setLoading(false);
    }
  };

  const appliquer = async () => {
    if (!confirm('Appliquer ce planning ? Les enseignants seront notifiés.')) return;
    setLoading(true);
    setErreur(null);
    try {
      const res = await adminApi.autoPlanningComplet(null, true);
      const payload = res.data.data ?? res.data;
      const nbNotifies = payload.notifications_envoyees ?? 0;
      alert(`Planning appliqué avec succès !\n${nbNotifies} enseignant(s) notifié(s).`);
      setApercu(null);
      setMeta(null);
      window.location.reload();
    } catch (err) {
      setErreur(err.response?.data?.error || "Erreur lors de l'application");
    } finally {
      setLoading(false);
    }
  };

  const nbOuverts = detailles.size;

  return (
    <div className="border-2 border-blue-100 dark:border-blue-900/30 rounded-xl p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white">
          <Brain size={20} />
        </div>
        <div>
          <h2 className="font-bold text-blue-800 dark:text-blue-300">Auto-Planning IA</h2>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            Attribution intelligente : jury + date + heure + salle
          </p>
        </div>
      </div>

      <div className="bg-white/60 dark:bg-slate-800/60 rounded-lg p-3 mb-4 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={12} className="text-blue-500" />
          <span className="font-medium">Comment ça marche :</span>
        </div>
        <ul className="list-disc list-inside space-y-0.5 ml-4">
          <li>Analyse les projets et les expertises des enseignants</li>
          <li>Calcule la pertinence thématique (Jaccard similarity)</li>
          <li>Optimise avec CP-SAT (OR-Tools) pour minimiser les conflits</li>
          <li>Respecte quotas, disponibilités et réciprocité</li>
        </ul>
      </div>

      <div className="flex gap-2 mb-3">
        <button
          onClick={previsualiser}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Eye size={16} />
          )}
          {loading ? 'Calcul en cours...' : 'Prévisualiser'}
        </button>
      </div>

      {erreur && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm mb-3">
          <AlertCircle size={16} />
          {erreur}
        </div>
      )}

      {apercu && apercu.length > 0 && (
        <div className="space-y-3">
          {meta && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-white dark:bg-slate-800 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-blue-600">{meta.nbSoutenances}</div>
                <div className="text-[10px] text-slate-500">Soutenances</div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-green-600">{meta.nbDates}</div>
                <div className="text-[10px] text-slate-500">Jours</div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg p-2 text-center">
                <div className={`text-lg font-bold ${getPertinenceColor(meta.scorePertinence)}`}>
                  {meta.scorePertinence ? `${(meta.scorePertinence * 100).toFixed(0)}%` : '—'}
                </div>
                <div className="text-[10px] text-slate-500">Pertinence</div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-blue-500" />
              Cliquez sur <span className="font-semibold">▾</span> pour afficher le détail du choix IA
            </p>
            <button
              onClick={toutAfficher}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 transition-colors"
            >
              {nbOuverts === (apercu?.length || 0) && apercu?.length > 0 ? (
                <><Minimize2 size={13} /> Tout masquer</>
              ) : (
                <><Maximize2 size={13} /> Tout afficher</>
              )}
            </button>
          </div>

          <div className="overflow-x-auto max-h-[32rem] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                <tr>
                  <th className="px-2 py-2 text-left">Date</th>
                  <th className="px-2 py-2 text-left">Étudiant</th>
                  <th className="px-2 py-2 text-left">Président</th>
                  <th className="px-2 py-2 text-center">Score</th>
                  <th className="px-2 py-2 text-left">Rapporteur</th>
                  <th className="px-2 py-2 text-center">Score</th>
                  <th className="px-2 py-2 text-left">Salle</th>
                  <th className="px-2 py-2 text-center">Détails</th>
                </tr>
              </thead>
              <tbody>
                {apercu.map((s) => {
                  const ouvert = detailles.has(s.id);
                  return (
                    <Fragment key={s.id}>
                      <tr className={`border-b border-slate-100 dark:border-slate-800 ${ouvert ? 'bg-blue-50/70 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                        <td className="px-2 py-2 whitespace-nowrap text-slate-500">{s.date}</td>
                        <td className="px-2 py-2 font-medium">{s.etudiant}</td>
                        <td className="px-2 py-2 text-slate-700 dark:text-slate-300">{s.president_nom}</td>
                        <td className="px-2 py-2 text-center">
                          <span className={`font-medium ${getPertinenceColor(s.president_pertinence)}`}>
                            {s.president_pertinence ? `${(s.president_pertinence * 100).toFixed(0)}%` : '—'}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-slate-700 dark:text-slate-300">{s.rapporteur_nom}</td>
                        <td className="px-2 py-2 text-center">
                          <span className={`font-medium ${getPertinenceColor(s.rapporteur_pertinence)}`}>
                            {s.rapporteur_pertinence ? `${(s.rapporteur_pertinence * 100).toFixed(0)}%` : '—'}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-slate-500">{s.salle}</td>
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => toggleDetail(s.id)}
                            title={ouvert ? 'Masquer le détail' : 'Afficher le détail du choix IA'}
                            className={`w-7 h-7 inline-flex items-center justify-center rounded-lg border transition-colors ${
                              ouvert
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-600'
                            }`}
                          >
                            {ouvert ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                      </tr>
                      {ouvert && (
                        <tr className="bg-blue-50/40 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                          <td colSpan={8} className="px-3 py-1">
                            <LigneExplication s={s} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mb-2">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span> Excellente (&gt;50%)
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Bonne (30-50%)
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500"></span> Faible (&lt;30%)
            </div>
            <div className="flex items-center gap-1">
              <Percent size={12} className="text-blue-500" />
              Score = similarité Jaccard entre mots-clés du projet et expertise de l'enseignant
            </div>
          </div>

          <button
            onClick={appliquer}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle size={16} />
            )}
            {loading ? 'Application...' : 'Appliquer ce planning'}
          </button>
        </div>
      )}

      {apercu && apercu.length === 0 && !erreur && (
        <div className="text-center py-6 text-slate-500 text-sm">
          <AlertCircle size={24} className="mx-auto mb-2 opacity-50" />
          Aucune soutenance à planifier. Toutes les soutenances sont déjà assignées.
        </div>
      )}
    </div>
  );
}