# Plateforme de Gestion des Soutenances PFE — ENET'COM

Application complète (backend PHP natif + frontend React/Tailwind) pour la gestion
des soutenances de Projets de Fin d'Études, conforme au cahier des charges fourni.

## Structure du projet

```
pfe-soutenance-manager/
  backend/     API PHP natif + PDO MySQL, JWT maison, endpoints REST
  frontend/    Application React + Tailwind CSS
```

## Démarrage rapide (environnement XAMPP)

### 1. Backend

```
Copier backend/  ->  C:\xampp\htdocs\pfe_soutenance_manager\backend\
```

Démarrer Apache + MySQL via le panneau XAMPP, puis importer
`backend/database/schema.sql` dans phpMyAdmin (crée la base `pfe_soutenance_manager`
et insère un jeu de données de démonstration).

Pour reconstruire la base **complète** (schéma + toutes les migrations + gros jeu de
données de test), connectez-vous en admin puis appelez :
`POST http://localhost/pfe_soutenance_manager/backend/api/dev/reset-data.php`
(voir la section « Réinitialisation de la base » ci-dessous).

Voir `backend/README.md` pour le détail des endpoints et les points d'attention
(CORS, JWT_SECRET, PHPMailer, tâche CRON d'expiration).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Ouvrir `http://localhost:3000/login`.

### Comptes de démonstration (mot de passe : `password123`)

| Email | Rôle |
|---|---|
| admin@enetcom.tn | Administrateur |
| chef@enetcom.tn | Chef de département |
| mounir.bennacer@enetcom.usf.tn | Encadrant |

## Ce qui est implémenté

- **Photo de profil enregistrée réellement** (upload + redimensionnement automatique
  200x200 si l'extension PHP GD est active, suppression de l'ancienne photo) —
  visible immédiatement dans le Header, la Sidebar et la page Profil
- **Correction** : les listes déroulantes Président/Rapporteur étaient vides pour
  les encadrants lors de la planification (l'API enseignants refusait l'accès en
  lecture aux non-admin/chef) — corrigé, la lecture est désormais ouverte à tout
  utilisateur connecté
- **Page Enseignants** : ajout des colonnes "Dans dépt." / "Hors dépt." / "Total"
  en plus de la répartition par rôle (encadrant/président/rapporteur)
- **Page Étudiants** repensée en tableau avec statut de soutenance, statut de
  validation et lien Fiche PDF (même format que "Mes Étudiants")
- **Colonne "Date début"** ajoutée à la section "Soutenances Sans Date"

- Authentification JWT (PHP pur, sans Composer), rôles admin / chef_dept / encadrant
- CRUD Enseignants (avec département) et Étudiants, avec permissions par rôle
- Gestion des départements et des options/filières, avec affectation obligatoire
  d'une option à un département (page "Départements & Options", admin)
- Import CSV des étudiants **et des enseignants** (mise à jour sans duplication par
  email, mot de passe généré pour les nouveaux comptes enseignants — envoi email non
  branché, voir plus bas)
- **Calendrier interactif de période** : plage de dates → génération automatique,
  jours fériés tunisiens et weekends non sélectionnables par défaut, admin peut
  cocher/décocher chaque jour ouvré et fixer un quota individuel par jour, aperçu
  live des créneaux calculés (heure de départ + durée + pause)
- **Créneaux horaires calculés automatiquement** à la planification ; si l'heure
  n'est pas saisie, le système assigne automatiquement le prochain créneau libre (R10)
- **Import étudiants enrichi** : chaque nouvel étudiant importé génère automatiquement
  une soutenance au statut `sans_date`, immédiatement visible par son encadrant
- **Multi-départements avancé** :
  - Départements avec code court + chef de département désigné (page "Départements
    & Spécialités"), spécialités (= options) avec code court affecté à un département
  - **Déduction automatique** département + spécialité à l'import CSV depuis la
    colonne "niveau" (ex: "3 GII-SII" → département GII, spécialité SII)
  - Le chef de département ne voit **que** les soutenances de son département
    (règle stricte, non contournable) ; l'**admin** peut switcher entre tous les
    départements via un sélecteur (Dashboard + page Soutenances)
  - Dashboard adapté : stats globales + répartition par département pour l'admin,
    stats automatiquement scopées à son département pour le chef, graphique
    camembert par spécialité
- **Gestion enrichie des enseignants et du jury** :
  - Page Enseignants : filtre "Mes encadrants" / "Tous les enseignants", et pour
    chacun : nb soutenances comme encadrant/président/rapporteur, total pondéré
    ×3, maximum personnalisé éditable directement dans le tableau, capacité
    restante calculée automatiquement
  - **Annulation d'affectation jury** par le chef de département (bouton ⊘ à côté
    du nom) : la soutenance repasse en attente de validation, l'enseignant retiré
    et l'encadrant sont notifiés
  - **Réaffectation directe** d'un nouveau président/rapporteur sur une soutenance
    existante, avec nouvelle invitation envoyée automatiquement
  - **Annulation complète** d'une soutenance planifiée : elle repasse "sans date",
    toutes les parties prenantes sont notifiées
  une soutenance au statut `sans_date`, immédiatement visible par son encadrant
- **Page Soutenances entièrement repensée** :
  - Section "Soutenances Planifiées" groupée par date, avec badge coloré selon la
    charge du jour (vert / jaune / rouge selon le quota réel de ce jour précis)
  - Section "Soutenances Sans Date" séparée, avec action "Planifier" directe par ligne
  - Filtres complets : date, section, statut de validation, niveau, salle, recherche
    texte (étudiant/encadrant), avec bouton de réinitialisation
  - Export Excel (.xlsx, via SheetJS, respecte les filtres actifs)
  - Export PDF (page HTML imprimable aux couleurs ENET'COM, respecte les filtres actifs)
  - Fiche individuelle imprimable par soutenance (bouton 📄 dans chaque ligne)
  - Planification pré-remplie automatiquement depuis "Mes Étudiants" (paramètre d'URL)
- **Calendrier interactif de disponibilités** (encadrant) : jours fériés non
  modifiables, weekends non sélectionnables, indicateur de charge (point coloré)
  par jour
- **Règles métier bloquantes appliquées à la planification** :
  - R1 — Président ≠ Rapporteur
  - R2 — Encadrant ≠ Président et ≠ Rapporteur
  - R3 — Quota jour + charge cumulée par enseignant (département + hors département)
  - R4 — Pas de conflit de salle
  - R5 — Pas de conflit de planning enseignant (même créneau)
  - R6 — Date dans la période autorisée
  - R10 — Créneau auto-assigné si heure non précisée, ou validé si saisie manuellement
- Invitations jury avec délai d'expiration paramétrable et expiration automatique (R8) ;
  le chef de département peut désormais répondre à la place de l'enseignant à tout moment
- Demandes de participation inter-département (avec disponibilités préférées),
  écran de soumission et de validation par le chef de département, notifications
  complètes (demande → chef, décision → enseignant)
- Suivi de la réciprocité jury (R9) : page "Charge Jury" avec indicateurs
  Sur-sollicité / Objectif atteint / Sous-sollicité
- Notification au chef de département à chaque nouvelle planification de soutenance
- Validation / refus des soutenances par le chef de département, avec notification
  in-app à l'encadrant
- Script cron dédié (`api/jury/cron-rappels-expiration.php`) pour les rappels avant
  expiration et l'expiration effective, indépendamment de toute consultation
- Tableau de bord avec statistiques et graphiques
- **Envoi d'emails réel** : client SMTP natif PHP (sans Composer, sans fichier
  tiers à télécharger), compatible Gmail SMTP. Emails envoyés automatiquement pour :
  invitation jury, rappel avant expiration, expiration effective, validation/refus
  de soutenance, annulation/réaffectation de jury, compte enseignant créé par import.
  Activation en une ligne dans `backend/config/mailer.php` (voir section Emails ci-dessous).
- **Tâche planifiée automatisée** : script PowerShell (`backend/scripts/installer-tache-planifiee.ps1`)
  qui installe en une commande une tâche Windows exécutant les rappels/expirations
  toutes les heures — plus besoin de configuration manuelle du Planificateur de tâches.
- **Suggestion automatique du jury** respectant la réciprocité (R9) : bouton
  "Suggérer automatiquement le jury" dans le modal de planification, qui pré-remplit
  rapporteur et président avec les enseignants les plus sous-sollicités (en excluant
  l'encadrant et ceux déjà au maximum ce jour-là) — reste entièrement modifiable
  avant validation, aucune affectation n'est forcée.
- **Participation inter-département dans les deux sens** :
  - Flux existant : un enseignant sollicite un département (onglet "Mes demandes envoyées")
  - **Nouveau flux inverse** : l'admin ou le chef de département **invite proactivement**
    un enseignant de n'importe quel département (bouton "Inviter un enseignant"),
    qui reçoit une notification + un email et doit accepter/refuser lui-même
    (onglet "Invitations reçues")
- **Page "Mes Étudiants" repensée en tableau** : affiche pour chaque étudiant encadré
  son statut de soutenance (Sans date / En attente / Validée / Refusée) et permet de
  planifier ou consulter la fiche PDF directement depuis la liste
- **Chatbot intelligent intégré** (bulle flottante visible sur toutes les pages) :
  répond à partir des données réelles de l'utilisateur connecté (étudiants encadrés,
  prochaine soutenance, invitations en attente, charge jury...) et explique le
  fonctionnement de l'application. Fonctionne 100% hors-ligne par défaut (aucune clé
  requise, "Mode local" affiché dans l'en-tête du chat).

  **Pour activer les réponses IA sur des questions ouvertes** (recommandé) :
  1. Créez un compte sur [console.anthropic.com](https://console.anthropic.com/) (ou
     [platform.openai.com](https://platform.openai.com/api-keys) si vous préférez GPT)
  2. Générez une clé API
  3. Ouvrez `backend/config/chatbot.php` et collez la clé dans `ANTHROPIC_API_KEY`
     (ou `OPENAI_API_KEY`)
  4. Rechargez l'application — l'en-tête du chatbot affichera alors "Mode IA activé"

  Le modèle reçoit automatiquement une description complète de l'application et de
  toutes les règles métier (R1 à R10), pour répondre avec précision même aux
  questions générales sans jamais inventer de données personnelles de l'utilisateur.
- Design bleu ENET'COM cohérent sur toute l'application
- **Soutenances en binôme ou trinôme (N étudiants)** : une soutenance peut concerner
  1, 2 ou 3 étudiants via la table de liaison `soutenance_etudiants` (le membre
  principal reste `soutenances.etudiant_id` pour compat). Le matching IA du jury
  fusionne les mots-clés de tous les membres ; les exports (Excel / PDF / fiche), le
  chatbot, les invitations agenda et la page Étudiants affichent « A & B & C ».
- **Jeu de données de test étoffé** (`demo_donnees_grandes.sql`) : 40 étudiants,
  17 enseignants, 25 soutenances (dont 2 binômes et 2 trinômes), invitations jury,
  disponibilités/absences et publications (détection de conflits d'intérêts) — idéal
  pour tester l'auto-planning IA.
- **Réinitialisation de la base corrigée** : l'endpoint de reset exécute désormais
  **toutes** les migrations (`explication_ia`, `soutenance_etudiants`) avant le gros
  jeu de démo, pour que l'application soit pleinement fonctionnelle après un reset
  (voir section « Réinitialisation de la base »).

## Correctifs de sécurité & robustesse (v1.16)

Cette version apporte 19 correctifs ciblés (sécurité, autorisations, binômes et
déploiement) couvrant :

### Sécurité & authentification
- **Rate limiting des points d'entrée** (`backend/config/ratelimit.php`, limiteur
  sur fichiers dans `backend/data/ratelimit/`) :
  - `login.php` : 10 tentatives / IP / 15 min, + 5 tentatives / email / 15 min
  - `register.php` : 10 tentatives / IP / heure
- **Création de comptes verrouillée** (`register.php`) : requiert un JWT avec le rôle
  `admin` ou `chef_dept`, ne crée que des comptes `encadrant`, et un chef de département
  ne peut créer que dans son département. Le lien « Créer un compte » a été retiré de
  l'écran de connexion.
- **Révocation de session (JWT)** : les jetons portent un `jwt_version` (colonne
  `users.jwt_version`), vérifié à chaque requête authentifiée. Le changement de mot de
  passe, la réinitialisation de mot de passe et la désactivation d'un enseignant
  incrémentent ce compteur : les anciens jetons sont immédiatement invalides
  (réponse « Session révoquée »).
- **Protection contre l'IDOR** sur `enseignant-detail.php` : un encadrant ne peut lire
  que ses propres données ; un chef de département ne lit que son département ;
  seul l'admin lit tout.
- **Limite d'exposition** sur `enseignants.php` : la lecture (pour pré-remplir les
  listes Président/Rapporteur) est ouverte aux rôles `admin`, `chef_dept` et
  `encadrant`.
- **`mailer.php`** : `MAIL_ENABLED` est `false` par défaut (les emails sont journalisés
  dans `backend/mail_log.txt` tant qu'aucun SMTP n'est configuré).

### Mots de passe & récupération de compte
- **Mot de passe oublié** : nouvel endpoint `forgot-password.php` qui génère un jeton
  à usage unique (table `password_resets`, expiration 1 h) et envoie le lien de
  réinitialisation par email. Réponse générique (« Si un compte existe pour cet email... »)
  pour ne pas révéler les adresses enregistrées.
- **Réinitialisation** : nouvel endpoint `reset-password.php` (jeton + nouveau mot de
  passe), invalide le jeton après usage et révoque les sessions actives.
- Pages frontend `ForgotPasswordPage.jsx` et `ResetPasswordPage.jsx`, routes dans
  `App.jsx`, méthodes `forgotPassword` / `resetPassword` dans `api.js`.

### Injection CSV
- **`sanitizeFormula()`** ajoutée dans `config/cors.php` : neutralise les valeurs
  commençant par `=`, `+`, `-`, `@`, tab ou CR en les préfixant d'une apostrophe,
  pour bloquer l'exécution de formules Excel/LibreOffice.
- Appliquée dans `import.php` (code, nom, prénom, niveau, titre, encadrant) et
  `import-enseignants.php` (nom, prénom, email, grade).

### Binômes & soutenances (N étudiants)
- **Notifications & .ics corrects** (`annuler.php`, `valider.php`) : le nom affiché
  devient « Étudiant A & Étudiant B » pour un binôme (jointure `e2` sur
  `soutenances.etudiant2_id`).
- **Nettoyage des orphelins** (`annuler.php`) : à l'annulation, l'éventuelle
  soutenance « sans date » orpheline du partenaire (2e étudiant) est supprimée pour
  éviter une ligne en double.
- **Modification du binôme** : nouvel endpoint `modifier-binome.php` pour ajouter /
  retirer le 2e membre d'une soutenance depuis le modal d'édition (même option
  exigée, pas de soutenance active déjà existante pour le 2e étudiant, chef de
  département restreint à son département).
- **Suppression d'étudiant protégée** (`etudiants.php` DELETE) : si l'étudiant est
  membre d'une soutenance active (`planifiee` / `validee`, via `etudiant2_id` ou la
  table `soutenance_etudiants`), la suppression est refusée (HTTP 409,
  `binome_detected: true`) avec un message explicatif — l'étudiant n'est jamais
  supprimé tant que la soutenance existe.

### Correctifs de données & frontend
- **`etudiants.php` (lecture)** : réécrit en deux requêtes séparées (membre principal
  via `soutenances.etudiant_id`, autres membres via `soutenance_etudiants`) fusionnées
  **sans doublons** — plus aucun étudiant apparaissant deux fois dans la liste.
- **`ajustement-reciprocite.php`** : les erreurs utilisent désormais `fail()` au lieu
  de `erreur()` (réponse JSON cohérente).
- **`EnseignantsPage.jsx`** : le filtre « Mes encadrants / Tous les enseignants »
  n'est visible que pour le chef de département.
- **`Sidebar.jsx`** : lien « Impact IA + RO » et section basse (thème / profil /
  déconnexion) retirés, imports nettoyés.
- **Configuration de déploiement corrigée** : le proxy Vite (`vite.config.js`),
  l'URL statique frontend (`api.js`, `BACKEND_STATIC_URL`) et le proxy
  `webpack.config.cjs` pointent sur `http://localhost/pfe-soutenance-manager/backend`
  (chemin avec tirets, cohérent avec le déploiement de référence).
- **Migration** `database/migrations/add_jwt_version_password_resets.sql` :
  ajoute `users.jwt_version` et crée la table `password_resets`.

> ℹ️ Le projet `Documents/pfe-soutenance-manager` est la source de référence ; les
> déploiements sous `C:\xampp\htdocs\pfe_soutenance_manager\backend` et
> `C:\xampp\htdocs\pfe-soutenance-manager\backend` doivent être resynchronisés avec
> celui-ci (les correctifs ci-dessus y ont été copiés).

## Réinitialisation de la base (développeur)

L'endpoint `POST /api/dev/reset-data.php` (réservé au rôle admin, JWT requis)
supprime puis reconstruit entièrement la base de démonstration dans cet ordre :

1. `schema.sql` (tables + données de base)
2. `migrations/add_auto_planning_fields.sql` (champs IA / expertises)
3. `migrations/add_explication_ia.sql` (colonne `explication_ia`)
4. `migrations/demo_donnees_planning.sql` (période + jours ouverts)
5. `migrations/demo_donnees_elaborees.sql`
6. `migrations/add_soutenance_etudiants.sql` (table de liaison + backfill)
7. `migrations/demo_donnees_grandes.sql` (gros jeu de test : 40 étudiants, 25 soutenances)
8. `migrations/add_jwt_version_password_resets.sql` (révocation de session + `password_resets`)

> ⚠️ Destructif : supprime toutes les données courantes. À n'utiliser qu'en
> développement / démonstration.

## Ce qui reste à brancher / affiner

- **Configuration SMTP à renseigner** : `MAIL_ENABLED` est à `false` par défaut dans
  `backend/config/mailer.php` (les emails sont journalisés dans `backend/mail_log.txt`
  sans envoi réel). Voir la section "Emails" ci-dessous pour l'activer avec Gmail.
- **Installer la tâche planifiée** : le script est prêt (`backend/scripts/installer-tache-planifiee.ps1`),
  il suffit de l'exécuter une fois en PowerShell administrateur (voir section "Tâche
  planifiée" ci-dessous) — non fait automatiquement pour éviter de modifier votre
  Planificateur de tâches sans action explicite de votre part.
- **R7** (soutenance validée non modifiable) : aucune fonctionnalité de modification
  de soutenance n'existe encore côté frontend, donc la règle n'a pas d'endpoint à
  bloquer pour l'instant — à ajouter si une fonctionnalité d'édition est introduite.
- **Vérification temps réel des conflits côté frontend** : actuellement les conflits
  (salle, créneau, charge) sont détectés côté serveur et remontés par message d'erreur
  au moment de la soumission, plutôt que vérifiés en direct pendant la saisie.

## Système IA de suggestions, assignation du jury & auto-planning

La « partie intelligente » de la plateforme est un **microservice Flask** séparé
(`backend/ai-service/app.py`) qui propose, optimise et explique l'affectation du jury
(président / rapporteur), l'horaire et la salle des soutenances. Il s'agit d'**optimisation
sous contraintes** (OR-Tools CP-SAT) + **correspondance thématique par mots-clés** —
et non d'un LLM : aucun modèle d'apprentissage n'est utilisé pour les suggestions.

### Architecture

```
Frontend React (frontend/src)
        │  appels API REST
        ▼
API PHP (backend/api/*.php)  ── JWT + rôles + validation + effets de bord (notifs/emails/.ics)
        │  proxy cURL
        ▼
Flask (backend/ai-service/app.py, port 5001)  ── accès direct MySQL (mysql.connector)
```

- Le frontend n'appelle **jamais** Flask directement : tout passe par le proxy PHP qui
  ajoute l'authentification JWT, les contrôles de rôle/département et les effets de bord
  (invitations jury, notifications, emails avec invitation `.ics`).
- `FLASK_API_URL` est défini dans `backend/config/cors.php` (défaut local
  `http://127.0.0.1:5001`, remplacé par `http://ai:5001` en Docker via `docker-compose.yml`).

### Endpoints du service Flask (`backend/ai-service/app.py`)

| Route | Méthode | Rôle | Description |
|---|---|---|---|
| `/auto-planning-complet` | POST | admin / chef_dept | **Planification complète de zéro** : jury + date + heure + salle pour toutes les soutenances sans date (filtrable par `etudiant_ids`) |
| `/optimiser-planning` | POST | admin / chef_dept | **Re-planification** : ré-optimise les créneaux/salles/jury des soutenances déjà planifiées (toutes dates ou une date) |
| `/assigner-complet` | POST | encadrant / admin / chef_dept | Assignation IA complète d'**une seule** soutenance ; toutes les autres soutenances planifiées sont traitées comme **fixes** (verrouillées) pour éviter tout double-book |
| `/impact-stats` | GET | admin / chef_dept | Tableau de bord Impact IA : précision de la durée, gain de temps d'attente, progression de la collecte de données |
| `/predire-duree` | POST | — | Prédiction de durée de soutenance (moyenne glissante + ajustement par niveau). Implémenté mais **non branché** côté PHP/frontend |
| `/retrain-duree` | POST | — | Recalcule les statistiques de durée (`duree_reelle_min`). Appelé automatiquement (non bloquant) par `terminer.php` à chaque fin de soutenance |
| `/health` | GET | — | Statut du service + version OR-Tools |

### Endpoints PHP (couche d'accès)

| Endpoint | Description |
|---|---|
| `api/admin/auto-planning-complet.php` | Proxy → `/auto-planning-complet`. Si `sauvegarder=true` : écrit le planning, crée les invitations jury (`en_attente`), notifie (in-app + email avec `.ics`) |
| `api/admin/optimiser-planning.php` | Proxy → `/optimiser-planning`. Si sauvegardé : notifie chaque membre du jury dont l'heure change |
| `api/jury/assigner-complet.php` | Proxy → `/assigner-complet` (timeout 60 s), normalise la réponse pour pré-remplir le formulaire |
| `api/admin/impact-stats.php` | Proxy → `/impact-stats` |
| `api/jury/suggestions.php` | **100 % règles métier (sans Flask)** : suggestion simple rapporteur/président par réciprocité (R9) — conservé en compatibilité |
| `api/jury/charge.php`, `api/jury/charge-jour.php` | Charge jury et matrice par jour (règles, sans Flask) |
| `api/soutenances/enseignants-disponibles.php` | Liste des enseignants assignables à un créneau (règles, sans Flask) |
| `api/soutenances/terminer.php` | À la fin d'une soutenance : calcule `duree_reelle_min` puis déclenche `/retrain-duree` (fire-and-forget) |

### Algorithmes

- **Correspondance thématique (pertinence)** : pure **intersection de mots-clés
  normalisés (score de Jaccard)** — pas d'embeddings ni de TF-IDF. Les tags de
  l'enseignant (`expertises`, `enseignements`, `domaines_recherche`, texte libre de
  `bio_courte`) sont comparés aux mots-clés du projet (fusionnés pour tous les membres
  d'un binôme/trinôme via `soutenance_etudiants`). Bonus de +0.15 si un jury passé
  partageait des mots-clés, +0.08 si un cours enseigné contient un tag du projet.
- **Contraintes dures** (déjà en place côté PHP, ré-appliquées dans le solveur) :
  R1 président ≠ rapporteur, R2 encadrant exclu, C3 quota journalier,
  C4 pas de double salle, C5 pas de conflit d'enseignant par créneau,
  C7 indisponibilités déclarées respectées, C14 conflit d'intérêts (co-auteurs de
  publications) = exclusion dure.
- **Optimisation** : OR-Tools **CP-SAT** (si importable, sinon repli **glouton**
  pur-Python). L'objectif maximise la **pertinence** et minimise le **temps d'attente**
  (regroupement des créneaux consécutifs d'un même enseignant). Résolution limitée à
  30 s, 4 workers. La réponse inclut `status: 'optimal' | 'faisable'` (ou `erreur` si
  infaisable).
- **Explicabilité** : chaque affectation embarque une **explication auditable**
  (`explication_ia`, stockée dans `soutenances` et affichée via `PanneauExplicationIA.jsx`) :
  score composite par membre (pertinence 45 + disponibilité 25 + quota 20 + réciprocité 10),
  tags du projet / de l'enseignant, cours correspondants, et la liste des contraintes
  vérifiées (C1…C14), « encadrant exclu » (R2) compris.
- **Prédiction de durée** : moyenne arithmétique des durées réelles enregistrées +
  ajustement par niveau (Licence −5, Master 0, Ingénierie +5, Doctorat +15 min), plancher
  15 min. `confiance: 'moyenne'`. Pas de modèle persistant : « retrain » = recalcul des
  statistiques.

### Déroulé côté frontend

1. **Auto-planning IA** (page Soutenances, bouton « IA Auto-Planning ») : « Prévisualiser »
   appelle `/auto-planning-complet` (sans sauvegarder), affiche le planning avec % de
   pertinence et explications par ligne ; « Appliquer ce planning » sauvegarde et envoie
   invitations + emails `.ics`.
2. **Optimiser le planning** (bouton « Optimiser ») : ré-optimise les dates existantes
   (optionnellement une date), compare `heure_actuelle` vs `heure_debut` (orange = modifié).
3. **Assignation IA d'une soutenance** (modaux Planifier / Modifier) : bouton « Assignation
   IA complète » → `/assigner-complet` pré-remplit jury + horaire + salle, avec panneau
   « Pourquoi ce jury ? ».
4. **Saisie des données d'entrée** : chaque enseignant renseigne ses `expertises`,
   `enseignements`, `domaines_recherche` et `bio_courte` (page Profil, sélecteur
   `ExpertiseSelector.jsx`) — ce sont exactement les champs lus par le matching.
5. **Impact IA + RO** (page Impact IA) : « Recalculer » → `/impact-stats` : précision de
   la durée, gain de temps d'attente estimé, progression vers le seuil de 20 exemples.

### Gestion d'erreur (IA indisponible)

- Si Flask est arrêté, les endpoints de planification/optimisation/impact répondent
  **HTTP 503** « API IA injoignable. Vérifiez qu'elle est bien lancée (`python app.py`). »
- Les flux **manuels** (planifier, replanifier, réaffecter le jury, suggestions par
  règles, charge jury, disponibilités) restent **100 % fonctionnels sans Flask** : le
  système dégrade proprement, seul l'IA (auto-planning, optimisation, assignation
  complète, impact) est indisponible.

### Lancer le service IA

```bash
cd backend/ai-service
pip install -r requirements.txt
python app.py        # écoute sur http://127.0.0.1:5001 (PORT=5001, DB via .env)
```

Variables d'environnement (`backend/ai-service/.env`) : `DB_HOST`, `DB_USER`,
`DB_PASS`, `DB_NAME`, `DB_PORT`, `PORT`, et (pour le chatbot) `OLLAMA_URL`,
`OLLAMA_MODEL`.

### Limites connues de l'implémentation actuelle

- Le matching est **par mots-clés (Jaccard)** : pas d'embeddings, pas de TF-IDF.
- Les 5 objectifs pondérés décrits dans `AUTO_PLANNING_SPEC.md`
  (`WEIGHT_*`) sont déclaratifs ; le solveur implémenté maximise réellement
  `pertinence − temps d'attente`.
- `impact-stats` : `mae_minutes` et le gain de 40 % sont des **estimations**
  simplifiées, pas des mesures du solveur.
- `/predire-duree` existe mais n'est pas relié à une page.

## Emails (SMTP)

1. Ouvrez `backend/config/mailer.php`.
2. Activez la validation en 2 étapes sur le compte Gmail expéditeur, puis générez
   un mot de passe d'application : https://myaccount.google.com/apppasswords
3. Renseignez `SMTP_USER` (votre adresse Gmail) et `SMTP_PASS` (le mot de passe
   d'application généré, PAS le mot de passe normal du compte).
4. Passez `MAIL_ENABLED` à `true`.
5. Testez : déclenchez une action qui envoie un email (ex: planifier une soutenance)
   et vérifiez `backend/mail_log.txt` pour confirmer le statut d'envoi.

## Tâche planifiée (rappels + expiration des invitations)

Dans un PowerShell **lancé en tant qu'administrateur** :
```powershell
cd C:\xampp\htdocs\pfe-soutenance-manager\backend\scripts
.\installer-tache-planifiee.ps1
```
Cela installe une tâche Windows qui exécute `cron-rappels-expiration.php` toutes
les heures. Sans cette tâche, l'expiration reste vérifiée "à la volée" à chaque
consultation de la page Invitations (comportement de secours déjà en place),
mais les rappels avant échéance ne seront jamais déclenchés sans exécution
régulière du script.

## Design

Le thème visuel (bandeau de navigation bleu marine pleine largeur, sidebar claire
avec icônes colorées par module, cartes et boutons bleus) a été élaboré itérativement
et est appliqué de façon cohérente sur l'ensemble des pages.
