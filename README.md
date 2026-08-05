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
Copier backend/  ->  C:\xampp\htdocs\pfe-soutenance-manager\backend\
```

Démarrer Apache + MySQL via le panneau XAMPP, puis importer
`backend/database/schema.sql` dans phpMyAdmin (crée la base `pfe_soutenance_manager`
et insère un jeu de données de démonstration).

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
