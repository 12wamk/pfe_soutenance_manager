# Frontend — Plateforme de Gestion des Soutenances PFE

React + Tailwind CSS, avec Vite comme outil de build.

## Installation

```bash
cd frontend
npm install
npm run dev
```

L'application démarre sur `http://localhost:3000`.

## Connexion au backend

Le fichier `vite.config.js` proxy automatiquement toutes les requêtes `/api/...`
vers `http://localhost/pfe-soutenance-manager/backend`. Assurez-vous que :

1. XAMPP (Apache + MySQL) est démarré.
2. Le dossier `backend/` de ce projet est copié dans `C:\xampp\htdocs\pfe-soutenance-manager\backend\`.
3. La base de données a été importée (voir `backend/README.md`).

Si votre backend est ailleurs, modifiez `target` dans `vite.config.js`,
ou définissez `VITE_API_BASE_URL` dans un fichier `.env` (copiez `.env.example`).

## Comptes de démonstration

| Email | Mot de passe | Rôle |
|---|---|---|
| admin@enetcom.tn | password123 | Administrateur |
| chef@enetcom.tn | password123 | Chef de département |
| mounir.bennacer@enetcom.usf.tn | password123 | Encadrant |

## Build de production

```bash
npm run build
```

Génère un dossier `dist/` prêt à être déployé (à servir via Apache ou tout serveur statique,
en configurant les réécritures d'URL pour le routing côté client — React Router).

## Structure

```
src/
  components/layout/   Layout, Header (bandeau bleu pleine largeur), Sidebar (icônes colorées)
  components/ui/       Bibliothèque de composants (Button, Input, Modal, Badge, StatCard...)
  context/              AuthContext (JWT), ThemeContext (clair/sombre)
  services/api.js       Client Axios centralisé, un objet par domaine (authApi, adminApi, ...)
  pages/                Une page par route
```

## Design

Thème bleu ENET'COM cohérent sur toute l'application (bandeau de navigation,
boutons primaires, éléments actifs de la sidebar). Police d'accent : "Plus Jakarta Sans"
pour les titres, "Inter" pour le texte courant.
