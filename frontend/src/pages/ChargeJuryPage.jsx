import React, { useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import { EmptyState } from '../components/ui';
import { juryApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Scale, CalendarDays, Building2, Globe2, CalendarCheck, Users } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Puce colorée pour le "Restant" (reste à faire par rapport à l'objectif de réciprocité).
// Convention : négatif = il manque des participations (rouge), 0 = objectif atteint (jaune),
// positif = surplus / sur-sollicité (vert).
function RestantChip({ ecart }) {
  const restant = -ecart; // ecart = objectif - total ; restant = total - objectif
  let cls = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  let label = 'Il manque des participations';
  if (restant === 0) { cls = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'; label = 'Objectif atteint'; }
  else if (restant > 0) { cls = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'; label = 'Surplus'; }
  return (
    <span className={`inline-flex items-center justify-center min-w-[2.75rem] h-6 px-2 rounded-md font-bold text-xs ${cls}`} title={label}>
      {restant > 0 ? `+${restant}` : restant}
    </span>
  );
}

// Une ligne claire "Dans le département" / "Hors département" / "Total" pour un rôle
// donné (Rapporteur ou Président), avec ajustement admin en dessous si applicable.
function RoleBlock({ titre, icon: Icon, intra, hors, ajustement, total, ecart, isAdmin, onAjuster }) {
  const [busy, setBusy] = useState(false);

  const appliquer = async (delta) => {
    const motif = window.prompt('Motif de cet ajustement (optionnel) :') || '';
    setBusy(true);
    try {
      await onAjuster(delta, motif);
    } catch (e) {
      alert("Échec de l'ajustement.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
          <Icon size={13} /> {titre}
        </span>
        <RestantChip ecart={ecart} />
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between text-slate-500 dark:text-slate-400">
          <span>Dans le département</span>
          <span className="font-semibold text-slate-700 dark:text-slate-200">{intra}</span>
        </div>
        <div className="flex justify-between text-slate-500 dark:text-slate-400">
          <span>Hors département</span>
          <span className="font-semibold text-slate-700 dark:text-slate-200">{hors}</span>
        </div>
        {ajustement !== 0 && (
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>Ajustement admin</span>
            <span className={`font-semibold ${ajustement > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {ajustement > 0 ? `+${ajustement}` : ajustement}
            </span>
          </div>
        )}
        <div className="flex justify-between pt-1.5 mt-1.5 border-t border-slate-200 dark:border-slate-700">
          <span className="font-bold text-slate-700 dark:text-slate-200">Total</span>
          <span className="font-extrabold text-lg text-slate-800 dark:text-white leading-none">{total}</span>
        </div>
      </div>
      {isAdmin && (
        <div className="flex items-center justify-center gap-2 mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-700">
          <button
            disabled={busy}
            onClick={() => appliquer(-1)}
            className="w-6 h-6 flex items-center justify-center rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold disabled:opacity-50"
            title="Diminuer d'un point (ajustement manuel du total)"
          >
            −
          </button>
          <span className="text-[11px] text-slate-400">Ajuster</span>
          <button
            disabled={busy}
            onClick={() => appliquer(1)}
            className="w-6 h-6 flex items-center justify-center rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold disabled:opacity-50"
            title="Augmenter d'un point (ajustement manuel du total)"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

// Mini-calendrier Disponible / Absent / Non renseigné pour un enseignant, sur toute la période.
// Regroupé par mois (avec un label de mois) pour éviter que les numéros de jour se
// répètent visuellement sans distinction lorsque la période dépasse un mois calendaire
// (ex: "15" de juillet et "15" d'août affichés côte à côte sans indication du mois).
function MiniCalendrierDispo({ jours }) {
  if (!jours || jours.length === 0) {
    return <p className="text-xs text-slate-400">Aucune période configurée</p>;
  }

  const moisGroupes = [];
  jours.forEach((j) => {
    const key = format(new Date(j.date), 'yyyy-MM');
    let groupe = moisGroupes.find((g) => g.key === key);
    if (!groupe) { groupe = { key, jours: [] }; moisGroupes.push(groupe); }
    groupe.jours.push(j);
  });

  return (
    <div className="max-h-[110px] overflow-y-auto pr-1 space-y-2">
      {moisGroupes.map((g) => (
        <div key={g.key}>
          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1 capitalize">
            {format(new Date(g.jours[0].date), 'MMMM yyyy', { locale: fr })}
          </div>
          <div className="flex gap-1 flex-wrap">
            {g.jours.map((j) => {
              const jourNum = format(new Date(j.date), 'd');
              let cls = 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600 border border-slate-200 dark:border-slate-700';
              let title = `${format(new Date(j.date), 'dd MMM yyyy', { locale: fr })} — non renseigné`;
              if (j.ferie || !j.actif) {
                cls = 'bg-red-50 text-red-300 dark:bg-red-900/10 dark:text-red-800 border border-red-100 dark:border-red-900/20';
                title = `${format(new Date(j.date), 'dd MMM yyyy', { locale: fr })} — férié / jour fermé`;
              } else if (j.statut === 'disponible') {
                cls = 'bg-green-500 text-white border border-green-500';
                title = `${format(new Date(j.date), 'dd MMM yyyy', { locale: fr })} — Disponible`;
              } else if (j.statut === 'absent') {
                cls = 'bg-slate-700 text-white dark:bg-slate-950 border border-slate-700';
                title = `${format(new Date(j.date), 'dd MMM yyyy', { locale: fr })} — Absent`;
              }
              return (
                <div key={j.date} className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${cls}`} title={title}>
                  {jourNum}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Cellule générique du mini-calendrier de charge par jour (une valeur + son statut de couleur)
function CelluleJour({ value, statut, max }) {
  const styles = {
    normal: 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400',
    max_atteint: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 font-semibold',
    depassement: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-bold',
  };
  return (
    <td className={`px-2 py-2 text-center text-xs border-b border-r border-slate-100 dark:border-slate-800/60 ${styles[statut] || styles.normal}`}
      title={`${value} / ${max} max ce jour (total tous départements confondus)`}>
      {value}
    </td>
  );
}

export default function ChargeJuryPage() {
  const { user } = useAuth();
  const [vue, setVue] = useState('reciprocite'); // 'reciprocite' | 'jour'

  // Vue réciprocité
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Vue par jour (charge des soutenances)
  const [dates, setDates] = useState([]);
  const [enseignantsJour, setEnseignantsJour] = useState([]);
  const [loadingJour, setLoadingJour] = useState(false);
  const [chargeJourChargee, setChargeJourChargee] = useState(false);

  useEffect(() => {
    juryApi.getCharge().then((r) => {
      const payload = r.data.data ?? r.data;
      setRows(payload.enseignants || []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (vue === 'jour' && !chargeJourChargee) {
      setLoadingJour(true);
      juryApi.getChargeParJour()
        .then((r) => {
          const payload = r.data.data ?? r.data;
          setDates(payload.dates || []);
          setEnseignantsJour(payload.enseignants || []);
          setChargeJourChargee(true);
        })
        .finally(() => setLoadingJour(false));
    }
  }, [vue, chargeJourChargee]);

  const isAdmin = user?.role === 'admin';

  const appliquerDeltaLocal = (enseignantId, role, delta) => {
    setRows((prev) => prev.map((row) => {
      if (row.id !== enseignantId) return row;
      if (role === 'rapporteur') {
        return {
          ...row,
          nb_rapporteur: row.nb_rapporteur + delta,
          ajustement_rapporteur: (row.ajustement_rapporteur || 0) + delta,
          ecart_rapporteur: row.ecart_rapporteur - delta,
        };
      }
      return {
        ...row,
        nb_president: row.nb_president + delta,
        ajustement_president: (row.ajustement_president || 0) + delta,
        ecart_president: row.ecart_president - delta,
      };
    }));
  };

  return (
    <Layout title="Charge Jury" requiredRoles={['admin', 'chef_dept', 'encadrant']}>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-blue-600 dark:text-blue-400 flex items-center gap-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <Scale size={22} /> Charge Jury — Réciprocité
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Règle : un encadrant de N étudiants doit être désigné N fois rapporteur et N fois président
        </p>
      </div>

      {/* Onglets */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setVue('reciprocite')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            vue === 'reciprocite'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Vue réciprocité
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

      {/* ============ VUE RÉCIPROCITÉ — cards, une par enseignant ============ */}
      {vue === 'reciprocite' && (
        loading ? (
          <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : rows.length === 0 ? (
          <EmptyState emoji="⚖️" title="Aucune donnée" desc="Aucun enseignant à afficher." />
        ) : (
          <div className="space-y-4">
            {/* Légende */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 px-4 py-2.5 flex items-center gap-4 text-xs text-slate-500 flex-wrap">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" /> Manque des participations</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300 inline-block" /> Objectif atteint</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block" /> Surplus</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" /> Disponible</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-700 inline-block" /> Absent</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-100 border border-slate-300 inline-block" /> Non renseigné</span>
            </div>

            {rows.map((r) => (
              <div key={r.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                {/* En-tête : identité + objectif */}
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-400 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {r.prenom?.[0]}{r.nom?.[0]}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 dark:text-white text-sm">{r.prenom} {r.nom}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-1">
                        <Users size={11} /> {r.objectif} étudiant{r.objectif !== 1 ? 's' : ''} encadré{r.objectif !== 1 ? 's' : ''} (objectif)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Corps : à gauche la participation jury (2 blocs), à droite les disponibilités */}
                <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <RoleBlock
                      titre="Rapporteur"
                      icon={Building2}
                      intra={r.nb_rapporteur_intra}
                      hors={r.nb_rapporteur_hors}
                      ajustement={r.ajustement_rapporteur || 0}
                      total={r.nb_rapporteur}
                      ecart={r.ecart_rapporteur}
                      isAdmin={isAdmin}
                      onAjuster={async (delta, motif) => {
                        await juryApi.ajusterReciprocite(r.id, 'rapporteur', delta, motif);
                        appliquerDeltaLocal(r.id, 'rapporteur', delta);
                      }}
                    />
                    <RoleBlock
                      titre="Président"
                      icon={Globe2}
                      intra={r.nb_president_intra}
                      hors={r.nb_president_hors}
                      ajustement={r.ajustement_president || 0}
                      total={r.nb_president}
                      ecart={r.ecart_president}
                      isAdmin={isAdmin}
                      onAjuster={async (delta, motif) => {
                        await juryApi.ajusterReciprocite(r.id, 'president', delta, motif);
                        appliquerDeltaLocal(r.id, 'president', delta);
                      }}
                    />
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-3.5">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                        <CalendarCheck size={13} /> Disponibilités
                      </span>
                      <span className="text-sm font-extrabold text-slate-800 dark:text-white">
                        {r.jours_disponibles} j.
                      </span>
                    </div>
                    <MiniCalendrierDispo jours={r.dispo_jours} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ============ VUE PAR JOUR (charge des soutenances, 2 tableaux séparés) ============ */}
      {vue === 'jour' && (
        loadingJour ? (
          <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : dates.length === 0 ? (
          <EmptyState emoji="📅" title="Aucune soutenance planifiée" desc="Aucune date à afficher pour le moment." />
        ) : (
          <div className="space-y-6">
            {[
              { titre: 'Dans le département', valeurKey: 'intra', totalKey: 'total_intra', couleur: 'blue' },
              { titre: 'Hors département', valeurKey: 'hors', totalKey: 'total_hors', couleur: 'purple' },
            ].map((section) => (
              <div key={section.valeurKey} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className={`px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between ${section.couleur === 'blue' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-purple-50 dark:bg-purple-900/20'}`}>
                  <h3 className={`text-sm font-bold ${section.couleur === 'blue' ? 'text-blue-700 dark:text-blue-300' : 'text-purple-700 dark:text-purple-300'}`}>
                    {section.titre}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300 inline-block" /> Max atteint</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" /> Dépassement</span>
                  </div>
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
                            <CelluleJour key={j.date} value={j[section.valeurKey]} statut={j.statut} max={j.max} />
                          ))}
                          <td className="px-3 py-2 text-center text-sm font-bold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800/60">
                            {ens[section.totalKey]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </Layout>
  );
}