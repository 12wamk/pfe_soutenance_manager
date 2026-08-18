# UX & Use-Case Investigation — PFE Soutenance Manager

Audit de l'existant (frontend React, backend PHP, schéma SQL, service IA) :
20 pages lues, ~50 endpoints, `schema.sql` + migrations, `ai-service/app.py`.

---

## 1. Bugs fonctionnels bloquants (priorité 0)

| # | Problème | Fichiers | Impact |
|---|---|---|---|
| 1 | Participation inter-département → 500 : colonne `delai_expiration_participation_jours` absente de la BDD | `api/jury/demande-participation.php:21`, `api/jury/inviter-participation.php:45`, `api/admin/notifications-config.php:24` | Tout le flux (les 2 sens) casse |
| 2 | "Soutenances du jour" (Démarrer/Terminer) → 500 : colonnes `heure_debut_reelle` / `heure_fin_reelle` absentes | `api/soutenances/demarrer.php:20`, `api/soutenances/terminer.php:21-22` | Fonction du jour de soutenance morte |
| 3 | IA "Assigner complet" cassée : le backend renvoie `{date, heure_debut, salle, president_id…}` mais le frontend lit `{date, heure, salle, rapporteur, president}` | `ai-service/app.py:703-722` vs `pages/SoutenancesPage.jsx:160,229` | Toujours "Aucune combinaison valide" même si Flask tourne |
| 4 | Bouton "Envoyer l'invitation calendrier" mort : `soutenancesApi.envoyerAgenda` absent de `api.js` | `pages/MonPlanningPage.jsx:32` | TypeError silencieux, rien ne se passe |
| 5 | Ajustement réciprocité → fatal PHP : `erreur()` n'existe pas (seuls `ok()`/`fail()` existent) | `api/jury/ajustement-reciprocite.php:20,32,41`, `config/cors.php:35-43` | Admin reçoit un 500 au lieu d'un 403/400 |
| 6 | Cron rappels/expiration meurt à la partie 3 : colonne `rappel_24h_envoye` absente | `api/jury/cron-rappels-expiration.php:173,214` | Rappels 24h jamais envoyés |

**Cause racine** : `schema.sql` + migrations ne correspondent pas au code. Des
fonctionnalités ont été ajoutées en code sans que les colonnes SQL correspondantes
n'atteignent le script d'installation.

---

## 2. Manques vs. processus universitaire réel

L'app couvre bien la phase *planification*. La vraie vie commence avant et finit après.

### Étapes absentes
1. **Portail étudiant** — aucun compte étudiant. Les étudiants ne peuvent pas voir
   leur date/jury/convocation ni leurs notes. Or ce sont les utilisateurs les plus actifs.
2. **Cycle des sujets PFE** — réel : les enseignants publient des sujets → les
   étudiants postulent → affectation validée. Ici `titre_sujet` est une colonne,
   `encadrant_id` est posé par l'import admin. Étape "proposition/affectation" absente.
3. **Délibération & notes** — après la soutenance : note, délibération, PV. L'app
   s'arrête à `terminer()` (durée réelle). Pas de note, pas de grille, pas de PV.
4. **Fiche d'évaluation (grille jury)** — le jury remplit une grille par étudiant.
   La "Fiche PDF" existante n'est qu'une fiche d'information.
5. **Salles** — table `salles` utilisée en code mais absente du schéma et sans UI.
   Champ texte libre → fautes de frappe → C4 (pas de conflit) non fiable.
6. **Binômes** — supportés en BDD (`etudiant2_id`) mais créables uniquement via import
   CSV. Aucune UI pour former un binôme.
7. **Archives / historique** — pas de séparation par `annee_universitaire`. À la
   rentrée suivante, impossible d'interroger l'année passée.
8. **Documents officiels** — pas de convocation, attestation de soutenance, ni PV
   exportable.
9. **Affichage des résultats** — pas de vue "résultats" pour quiconque.
10. **Dépôt de rapport** — les étudiants déposent le rapport ; le jury le lit avant.
    Non modélisé.

### Problèmes de réalisme dans l'existant
- **Jury auto-suggéré par IA** : dans un département tunisien, le **président est
  désigné par le chef**, pas par le solveur ni l'encadrant. Or l'UI laisse un
  *encadrant* choisir n'importe quel président — irréaliste.
- **R7** (validée = figée) : correct, mais aucune raison affichée ni chemin de
  "demande de changement" ; en réalité le changement de date validée passe par le chef.

---

## 3. Frictions UX

### Navigation / rôles
- Filtrage du menu **incohérent** : `ImpactIAPage` autorise chef sans être dans son
  menu ; `Disponibilités` & `Invitations` autorisent admin/chef mais ne s'affichent
  que pour encadrant ; le menu encadrant masque Étudiants/Soutenances (pages pourtant
  autorisées).
- **Chef = impasse sur le Dashboard** : boutons vers `/options` et `/periode`
  (admin only) le renvoient silencieusement au dashboard.
- Pas de page 404 — toute URL inconnue redirige vers `/dashboard`.
- `/parametres` et `/profil` sans lien de menu ; **Paramètres sans garde de rôle** :
  les encadrants ouvrent une page dont l'API renvoie des erreurs.

### Liens morts / fausses affordances
- Login : "Mot de passe oublié ?" → `/forgot-password` et "Créer un compte encadrant"
  → `/register` — **aucune route n'existe**.
- Bouton mort "Envoyer l'invitation calendrier" (§1, #4).
- Code mort : `sallesApi`, `ExpertiseSelector`, endpoints `suggestions` — les
  expertises ne peuvent être éditées depuis aucune UI alors que le matching IA en dépend.

### Qualité d'interaction
- `alert()`/`confirm()`/`window.prompt()` natifs en 5+ endroits (ajustements,
  application auto-planning, erreurs "du jour") — incohérent avec toasts/modales.
- Recherches par API **à chaque frappe** (pas de debounce) : Enseignants, Étudiants,
  Mes Étudiants.
- Couleurs de statut confondues : "Sans date" et "En attente (planifiée)" toutes deux
  jaunes.
- Éditions inline "Max/jour" et quota qui sauvegardent au blur / à chaque frappe sans
  confirmation.
- États vides/erreur manquants (Dashboard vide sur échec API, notifications avalées
  en silence).
- Duplications : statuts (`statutConfig`) ×7, contrôle réciprocité ×3, "Vue par jour"
  ×2, calendrier mensuel ×3, logique IA ×2.

---

## 4. Priorités recommandées

### P0 — Corriger les 6 bugs fonctionnels (§1)
Quelques lignes de SQL + corrections de contrats front/back. Bloquent les vrais
utilisateurs quotidiennement.

### P1 — Rendre le processus réel
1. **Rôle étudiant + login** + page "Ma soutenance" (date, salle, jury, convocation).
2. **Gestion des salles** — table + CRUD admin + dropdown à la planification.
3. **Résultat de soutenance** — note + verdict après `terminer()`, visible sur la
   page étudiant et la fiche PDF.
4. **Grille d'évaluation jury** par soutenance, imprimable.
5. **Archives par année** — scoper les écrans sur `annee_universitaire` active.

### P2 — Correctifs UX rapides
- Garde de routes centralisée + cohérence du menu + masquer les boutons morts au chef.
- Implémenter `/forgot-password` & `/register` ou supprimer les liens.
- Debounce des recherches, remplacer les boîtes natives, différencier les couleurs
  de statut, ajouter états vides/erreur.
- Rétablir `envoyerAgenda` côté client ; purger les clients API inutilisés.

### P3 — Conforme à la spec
- Le président suggéré par l'IA doit être proposé au **chef** (pas à l'encadrant).
- Réunifier `schema.sql` + migrations en un script canonique pour éviter la dérive
  (cause racine du §1).

---

*Document créé suite à l'investigation UX/use-case. Voir aussi `AUTO_PLANNING_SPEC.md` et `README.md`.*