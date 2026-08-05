import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const statutValidationLabel = { planifiee: 'En attente', validee: 'Validée', refusee: 'Refusée', sans_date: 'Sans date' };

/** Code(s) étudiant affiché(s) : "CODE1" ou "CODE1 / CODE2" si binôme. */
function codeAffiche(s) {
  return s.code_etudiant2 ? `${s.code_etudiant} / ${s.code_etudiant2}` : (s.code_etudiant || '');
}

/** Nom(s) étudiant(s) affiché(s) : "Nom1" ou "Nom1 & Nom2" si binôme. */
function etudiantAffiche(s) {
  return s.etudiant2 ? `${s.etudiant} & ${s.etudiant2}` : (s.etudiant || '');
}

/** Aplati une liste de soutenances (planifiées + sans date) en lignes exportables. */
function toRows(soutenances) {
  return soutenances.map((s) => ({
    'Code': codeAffiche(s),
    'Étudiant': etudiantAffiche(s),
    'Niveau': s.niveau || '',
    'Titre': s.titre_sujet || '',
    'Date': s.date ? format(new Date(s.date), 'dd/MM/yyyy') : '',
    'Heure': s.heure ? s.heure.substring(0, 5) : '',
    'Salle': s.salle || '',
    'Encadrant': s.encadrant || '',
    'Président': s.president || '',
    'Rapporteur': s.rapporteur || '',
    'Statut': statutValidationLabel[s.statut] || s.statut,
  }));
}

export function exporterExcel(soutenances, nomFichier = 'soutenances') {
  const rows = toRows(soutenances);
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 10 }, { wch: 22 }, { wch: 14 }, { wch: 38 }, { wch: 12 },
    { wch: 8 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Soutenances');
  XLSX.writeFile(wb, `${nomFichier}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

const STYLE_IMPRESSION = `
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; color: #1e293b; }
  .entete { background: linear-gradient(135deg, #1a5276 0%, #2980d9 100%); color: white; padding: 24px 32px; }
  .entete h1 { margin: 0 0 4px; font-size: 20px; }
  .entete p { margin: 0; font-size: 12px; opacity: 0.85; }
  .contenu { padding: 24px 32px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 12px; }
  th { background: #f1f5f9; text-align: left; padding: 8px 6px; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; font-size: 9px; color: #64748b; }
  td { padding: 7px 6px; border-bottom: 1px solid #e2e8f0; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 700; }
  .badge-attente { background: #fef9c3; color: #854d0e; }
  .badge-validee { background: #dcfce7; color: #166534; }
  .badge-refusee { background: #fee2e2; color: #991b1b; }
  .badge-sansdate { background: #ffedd5; color: #9a3412; }
  .pied { margin-top: 24px; font-size: 10px; color: #94a3b8; text-align: center; }
  @media print { .entete { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

function badgeClasse(statut) {
  return { planifiee: 'badge-attente', validee: 'badge-validee', refusee: 'badge-refusee', sans_date: 'badge-sansdate' }[statut] || '';
}

export function exporterPDF(soutenances, titreListe = 'Liste des soutenances') {
  const rows = toRows(soutenances.map((s) => ({ ...s })));
  const lignesHtml = soutenances.map((s, i) => `
    <tr>
      <td>${rows[i]['Code']}</td>
      <td>${rows[i]['Étudiant']}</td>
      <td>${rows[i]['Niveau']}</td>
      <td>${rows[i]['Titre']}</td>
      <td>${rows[i]['Date']}</td>
      <td>${rows[i]['Heure']}</td>
      <td>${rows[i]['Salle']}</td>
      <td>${rows[i]['Encadrant']}</td>
      <td>${rows[i]['Président']}</td>
      <td>${rows[i]['Rapporteur']}</td>
      <td><span class="badge ${badgeClasse(s.statut)}">${statutValidationLabel[s.statut] || s.statut}</span></td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${titreListe}</title>
    <style>${STYLE_IMPRESSION}</style></head>
    <body>
      <div class="entete">
        <h1>🎓 ENET'COM — ${titreListe}</h1>
        <p>Généré le ${format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr })} — ${soutenances.length} soutenance(s)</p>
      </div>
      <div class="contenu">
        <table>
          <thead><tr>
            <th>Code</th><th>Étudiant</th><th>Niveau</th><th>Titre</th><th>Date</th><th>Heure</th>
            <th>Salle</th><th>Encadrant</th><th>Président</th><th>Rapporteur</th><th>Statut</th>
          </tr></thead>
          <tbody>${lignesHtml || '<tr><td colspan="11" style="text-align:center;color:#94a3b8;">Aucune donnée</td></tr>'}</tbody>
        </table>
        <p class="pied">Plateforme de Gestion des Soutenances PFE — ENET'COM</p>
      </div>
      <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
    </body></html>
  `;

  const fenetre = window.open('', '_blank');
  if (!fenetre) { alert("Veuillez autoriser les pop-ups pour exporter en PDF."); return; }
  fenetre.document.write(html);
  fenetre.document.close();
}

export function ouvrirFicheIndividuelle(s) {
  const nomAffiche = etudiantAffiche(s);
  const codeAff = codeAffiche(s);
  const html = `
    <!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Fiche soutenance — ${nomAffiche}</title>
    <style>
      ${STYLE_IMPRESSION}
      .fiche { max-width: 700px; margin: 0 auto; }
      .ligne { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
      .ligne span:first-child { font-weight: 700; color: #64748b; font-size: 12px; text-transform: uppercase; }
      .ligne span:last-child { font-size: 14px; color: #1e293b; }
      .titre-sujet { background: #eff6ff; border-radius: 8px; padding: 14px; margin: 16px 0; font-size: 13px; color: #1e40af; }
    </style></head>
    <body>
      <div class="entete">
        <h1>🎓 ENET'COM — Fiche de Soutenance</h1>
        <p>Généré le ${format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}</p>
      </div>
      <div class="contenu">
        <div class="fiche">
          <div class="titre-sujet"><strong>Sujet :</strong> ${s.titre_sujet || 'Non renseigné'}</div>
          <div class="ligne"><span>Code étudiant${s.code_etudiant2 ? 's (binôme)' : ''}</span><span>${codeAff || '—'}</span></div>
          <div class="ligne"><span>Étudiant${s.etudiant2 ? 's (binôme)' : ''}</span><span>${nomAffiche}</span></div>
          <div class="ligne"><span>Niveau</span><span>${s.niveau || '—'}</span></div>
          <div class="ligne"><span>Date</span><span>${s.date ? format(new Date(s.date), 'EEEE dd MMMM yyyy', { locale: fr }) : 'Non fixée'}</span></div>
          <div class="ligne"><span>Heure</span><span>${s.heure ? s.heure.substring(0, 5) : 'Non fixée'}</span></div>
          <div class="ligne"><span>Salle</span><span>${s.salle || '—'}</span></div>
          <div class="ligne"><span>Encadrant</span><span>${s.encadrant || '—'}</span></div>
          <div class="ligne"><span>Président</span><span>${s.president || '—'}</span></div>
          <div class="ligne"><span>Rapporteur</span><span>${s.rapporteur || '—'}</span></div>
          <div class="ligne"><span>Statut</span><span><span class="badge ${badgeClasse(s.statut)}">${statutValidationLabel[s.statut] || s.statut}</span></span></div>
        </div>
        <p class="pied">Plateforme de Gestion des Soutenances PFE — ENET'COM</p>
      </div>
      <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
    </body></html>
  `;

  const fenetre = window.open('', '_blank');
  if (!fenetre) { alert("Veuillez autoriser les pop-ups pour ouvrir la fiche."); return; }
  fenetre.document.write(html);
  fenetre.document.close();
}