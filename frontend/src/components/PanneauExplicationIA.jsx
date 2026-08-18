import { CheckCircle, AlertCircle, Sparkles, UserX, Tag, ListChecks, GitMerge } from 'lucide-react';

const barreCouleur = (valeur) => {
  if (valeur >= 80) return 'bg-green-500';
  if (valeur >= 60) return 'bg-yellow-500';
  return 'bg-red-400';
};

const barreTexte = (valeur) => {
  if (valeur >= 80) return 'text-green-600';
  if (valeur >= 60) return 'text-yellow-600';
  return 'text-red-500';
};

const couleurBanniere = (score) => {
  if (score >= 80) return 'border-green-200 dark:border-green-900/40 bg-green-50/60 dark:bg-green-900/10';
  if (score >= 60) return 'border-yellow-200 dark:border-yellow-900/40 bg-yellow-50/60 dark:bg-yellow-900/10';
  return 'border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-900/10';
};

const etiqueteScore = (score) => {
  if (score >= 80) return 'Excellent choix';
  if (score >= 60) return 'Bon choix';
  if (score >= 40) return 'Choix moyen';
  return 'Choix par défaut';
};

/** Carte de score d'un membre du jury (pourquoi l'IA l'a choisi). */
function CarteMembre({ role, nom, couleur, scoreComp }) {
  if (!scoreComp) return null;
  const { score, composantes } = scoreComp;
  const c = composantes || {};
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${couleurBanniere(score)}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className={`text-[10px] uppercase tracking-wide font-bold ${couleur}`}>{role}</span>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{nom}</p>
        </div>
        <div className="text-right">
          <span className={`text-lg font-black ${barreTexte(score)}`}>{score}/100</span>
          <p className="text-[10px] text-slate-500">{etiqueteScore(score)}</p>
        </div>
      </div>

      <div className="space-y-2">
        {Object.entries(c).map(([cle, comp]) => (
          <div key={cle} className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 w-3 font-semibold">{comp.poids}%</span>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{comp.label}</span>
                <span className={`text-[11px] font-bold ${barreTexte(comp.valeur)}`}>{comp.valeur}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                <div className={`h-full rounded-full ${barreCouleur(comp.valeur)}`} style={{ width: `${Math.min(100, comp.valeur)}%` }} />
              </div>
            </div>
            {comp.ok === false ? (
              <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
            ) : (
              <CheckCircle size={13} className="text-green-500 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>

      {c.pertinence && c.pertinence.detail && (
        <p className="text-[11px] text-slate-500 mt-2">{c.pertinence.detail}</p>
      )}
      {c.disponibilite && c.disponibilite.detail && (
        <p className="text-[11px] text-slate-500">{c.disponibilite.detail}</p>
      )}
      {c.quota && c.quota.detail && (
        <p className="text-[11px] text-slate-500">{c.quota.detail}</p>
      )}
    </div>
  );
}

/** Panneau complet : projet, encadrant exclu, contraintes vérifiées + score des 2 membres. */
export default function PanneauExplicationIA({ expl }) {
  if (!expl) return null;
  const projet = expl.projet || {};
  const encadrant = expl.encadrant || {};
  const contraintes = expl.contraintes || [];
  const pres = expl.president;
  const rap = expl.rapporteur;

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/10 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-indigo-500" />
        <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
          Pourquoi ce jury ? — décision IA
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="space-y-3">
          <CarteMembre role="Président" nom={pres?.nom} couleur="text-blue-700 dark:text-blue-400" scoreComp={pres?.score_composite} />
          <CarteMembre role="Rapporteur" nom={rap?.nom} couleur="text-indigo-700 dark:text-indigo-400" scoreComp={rap?.score_composite} />
        </div>

        <div className="space-y-3">
          {projet.tags && projet.tags.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-400 mb-1.5">
                <Tag size={11} className="text-blue-500" /> Projet de l'étudiant
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1.5">{projet.titre}</p>
              <div className="flex flex-wrap gap-1">
                {projet.tags.slice(0, 10).map((t) => (
                  <span key={t} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/10 p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-white shrink-0">
                <UserX size={14} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400 font-semibold">Encadrant exclu</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{encadrant.nom || '—'}</p>
              </div>
            </div>
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1.5">{encadrant.regle}</p>
          </div>

          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-900/10 p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400 font-semibold mb-2">
              <ListChecks size={11} /> Règles vérifiées
            </div>
            <div className="space-y-1.5">
              {contraintes.map((c) => (
                <div key={c.id} className="flex items-start gap-2 text-[11px]">
                  {c.respectee === false ? (
                    <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle size={13} className="text-green-500 shrink-0 mt-0.5" />
                  )}
                  <span className="text-slate-700 dark:text-slate-300">
                    <span className="font-bold">{c.id}</span>
                    <span className="mx-1 font-semibold">— {c.label} :</span>
                    <span className="text-slate-500 dark:text-slate-400">{c.detail}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {pres?.tags_correspondants && pres.tags_correspondants.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-400 mb-1.5">
                <GitMerge size={11} className="text-blue-500" /> Tags en commun avec le projet
              </div>
              <div className="flex flex-wrap gap-1">
                {pres.tags_correspondants.slice(0, 8).map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300">
                    <CheckCircle size={10} /> {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}