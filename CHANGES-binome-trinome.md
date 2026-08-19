# Binôme / Trinôme — N étudiants par soutenance

Une soutenance peut désormais concerner 1, 2 ou 3 étudiants (solo, binôme, trinôme)
via une **table de liaison** `soutenance_etudiants`.

## Base de données

- **Nouvelle table** `soutenance_etudiants` (`soutenance_id`, `etudiant_id`, `ordre`)
  — source de vérité de l'appartenance au groupe.
- `soutenances.etudiant_id` reste le membre principal (compat) ;
  `etudiant2_id` est conservé mais plus écrit (NULL) par le nouveau code.
- Migration + backfill : `backend/database/migrations/add_soutenance_etudiants.sql`
  (déjà appliquée à la base locale).
- `backend/database/schema.sql` et `docker/db/init.sql` mis à jour.

## Backend (PHP)

- **Nouveau** `backend/config/soutenance_etudiants.php` :
  - `remplacerMembresSoutenance()` — réécrit le groupe d'une soutenance,
  - `membresSoutenance()` — lit les membres (repli sur `etudiant2_id` si hérité),
  - `soutenancesPourEtudiants()` — soutenances concernant un étudiant donné.
- `backend/api/soutenances/planifier.php` : accepte `etudiants[]` (liste ordonnée),
  vérifications R4/R5/R3 étendues au groupe, création/mise à jour via la liaison.
- `backend/api/soutenances/toutes.php` : renvoie `etudiants[]`, `etudiant_affiche`
  (« A & B & C ») + champs legacy (`etudiant`, `etudiant2`, …).
- `backend/api/admin/etudiants.php` : `soutenance_id` retrouvé via la liaison.
- `backend/api/admin/import.php` : regroupement en groupes de 2+ (au lieu de
  uniquement 2) via `fusionnerGroupe()`.
- `backend/config/mailer.php` : noms de tous les membres dans l'invitation agenda.
- `backend/api/chatbot/index.php` : noms du groupe via `GROUP_CONCAT`.

## Backend (IA — Flask)

- `backend/ai-service/app.py` : fusion des mots-clés de **tous** les membres du
  groupe pour le matching jury (`etudiant_effectif`) — l'IA ne regarde plus que
  le 1er étudiant.

## Frontend (React)

- `SoutenancesPage.jsx` : case « groupe (binôme ou trinôme) », 3e étudiant
  facultatif, envoi de `etudiants[]`, affichage « A & B & C » + icône Binôme/Trinôme,
  recherche sur tous les membres.
- `EtudiantsPage.jsx` : regroupement N membres (rowSpan), badge Binôme/Trinôme,
  fiche PDF multi-membres.
- `exportSoutenances.js` : Excel, PDF et fiche individuelle avec les N membres.

## Vérifications

- `php -l` OK sur tous les fichiers PHP modifiés.
- `npm run build` OK.
- `python -m py_compile` OK.
- Migration appliquée (7 membres backfillés).
- Flask redémarré (port 5001).