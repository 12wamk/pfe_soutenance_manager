/**
 * Construit le lien « Ajouter à Google Agenda » pré-rempli pour une soutenance.
 * Aucune clé API requise : ouvre la page Google Agenda de création d'événement,
 * l'utilisateur confirme d'un clic.
 *
 * Les heures sont stockées en Afrique/Tunis (UTC+1 fixe, pas de changement
 * d'heure depuis 2009) : on convertit donc l'heure locale Tunis en UTC en
 * soustrayant 1h, comme le fait l'ICS côté backend.
 */
export function construireLienGoogleAgenda(soutenance, dureeMinutes = 30) {
  if (!soutenance?.date || !soutenance?.heure) return null;

  const [y, m, d] = soutenance.date.split('-').map(Number);
  const [hh, mi] = soutenance.heure.split(':').map(Number);
  const debutMs = Date.UTC(y, m - 1, d, hh - 1, mi);
  const finMs = debutMs + dureeMinutes * 60000;

  const fmt = (ms) =>
    new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') + 'Z';

  const nom = soutenance.etudiant_affiche || soutenance.etudiant;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Soutenance PFE — ${nom}`,
    dates: `${fmt(debutMs)}/${fmt(finMs)}`,
    details: soutenance.titre_sujet ? `Soutenance de ${nom} — ${soutenance.titre_sujet}` : `Soutenance de ${nom}`,
    location: soutenance.salle || '',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}