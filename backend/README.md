# Backend — Plateforme de Gestion des Soutenances PFE

## Installation (XAMPP)

1. Copiez le dossier `backend/` dans `C:\xampp\htdocs\pfe-soutenance-manager\backend\`
2. Démarrez Apache et MySQL depuis le panneau XAMPP.
3. Ouvrez `http://localhost/phpmyadmin/`, créez la base en important `database/schema.sql`
   (onglet **Importer**, ou copiez-collez le contenu dans l'onglet **SQL**).
4. Vérifiez `config/database.php` : par défaut `root` sans mot de passe (config XAMPP standard).

## Comptes de démonstration

Tous les comptes ci-dessous utilisent le mot de passe : **password123**

| Email | Rôle |
|---|---|
| admin@enetcom.tn | Administrateur |
| chef@enetcom.tn | Chef de département |
| mounir.bennacer@enetcom.usf.tn | Encadrant |
| chokri.abdelmoula@enetcom.usf.tn | Encadrant |

## Structure des endpoints

```
api/auth/          login, register, me, update-password
api/admin/         enseignants (CRUD), etudiants (CRUD), import (CSV), periode, stats
api/soutenances/   toutes, planifier, valider, disponibilites
api/jury/          invitations, repondre, valider-expiration, demande-participation
api/notifications/ index (liste + marquer lu)
```

Tous les endpoints (sauf login/register) exigent un header :
`Authorization: Bearer <token>`

## Points d'attention avant mise en production

- **CORS** : `config/cors.php` définit les en-têtes une seule fois. Ne dupliquez pas
  ces en-têtes ailleurs (`.htaccess`, autre config) sous peine d'erreur navigateur
  "multiple values" sur `Access-Control-Allow-Origin`.
- **JWT_SECRET** (`config/jwt.php`) : changez la valeur par défaut avant mise en ligne.
- **Emails (PHPMailer)** : non branché dans cette version. Les points d'insertion sont
  marqués par des commentaires `NOTE:` dans `api/soutenances/valider.php` et
  `api/jury/invitations.php`. Ajoutez PHPMailer via Composer ou en l'incluant
  manuellement, puis complétez ces points avec vos identifiants SMTP Gmail.
- **Expiration automatique des invitations** : actuellement vérifiée à chaque appel
  de `api/jury/invitations.php` (lazy check). Pour une exécution garantie même sans
  consultation, planifiez une tâche CRON/planificateur Windows qui exécute la requête :
  `UPDATE invitations_jury SET statut='expiree' WHERE statut='en_attente' AND date_limite < NOW();`
- **Réciprocité jury (R4)** et **génération fine des créneaux (R8)** sont modélisées
  en base (tables `invitations_jury`, `parametres_creneaux`) mais l'algorithme
  d'auto-suggestion n'est pas encore implémenté — actuellement l'encadrant choisit
  librement rapporteur/président, le contrôle de quota (R3) est appliqué à la validation.
