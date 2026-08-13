# AUTO-PLANNING AI — Specification Technique

## 1. Contraintes Métier (Celles qui comptent)

| ID | Contrainte | Priorité |
|----|-----------|----------|
| C1 | Un président ≠ un rapporteur (même personne impossible) | BLOQUANTE |
| C2 | L'encadrant ne peut PAS être président/rapporteur de son étudiant | BLOQUANTE |
| C3 | Un enseignant ne peut pas dépasser son quota max/jour | BLOQUANTE |
| C4 | Une salle ne peut pas avoir 2 soutenances au même créneau | BLOQUANTE |
| C5 | Un enseignant ne peut pas être à 2 soutenances au même créneau | BLOQUANTE |
| C6 | Une soutenance ne peut être que sur un jour actif du calendrier | BLOQUANTE |
| C7 | Un enseignant marqué "absent" ne peut pas être assigné ce jour | BLOQUANTE |
| C8 | Les jours fériés et weekends sont exclus | BLOQUANTE |
| C11 | Le jury doit avoir une **pertinence thématique** par rapport au projet | IMPORTANTE |
| C12 | Éviter de surcharger le même expert avec tous les projets de son domaine | IMPORTANTE |
| C13 | Diversité du jury : deux expertises complémentaires > deux expertises identiques | SOUPLE |
| C14 | Conflit d'intérêts : co-auteurs de publication avec l'encadrant → exclusion | BLOQUANTE |
| C9 | Durée de pause minimale entre 2 soutenances du même enseignant (ex: 10 min) | SOUPLE |
| C10 | Certains enseignants préfèrent le matin ou l'après-midi | SOUPLE |

---

## 2. Objectifs d'Optimisation

L'IA résout un problème **multi-objectif** avec pondération :

### Objectif 1 — Minimiser le temps d'attente total
```
min Σ (temps_attente_enseignant_jour)
```
Regroupe les soutenances d'un même enseignant sur des créneaux consécutifs.

### Objectif 2 — Minimiser le nombre de jours utilisés
```
min Σ (jours_activés)
```
Compresse le planning sur le moins de jours possible.

### Objectif 3 — Équilibrer la charge entre enseignants
```
min Σ (ecart_charge_enseignant - moyenne)²
```
Évite qu'un enseignant ait 5 soutenances et un autre 0.

### Objectif 4 — Maximiser la pertinence thématique du jury ⭐ NOUVEAU
```
max Σ similarite(projet_i, president_i) + similarite(projet_i, rapporteur_i)
```
Le président et le rapporteur doivent être experts du domaine du projet.

### Objectif 5 — Respecter les préférences (pondération faible)
```
min Σ (pénalité_préférences_non_respectées)
```
Matin/après-midi, jours préférés, etc.

### Pondération totale
```
Score = 0.3 × Obj1 + 0.25 × Obj2 + 0.2 × Obj3 + 0.2 × Obj4 + 0.05 × Obj5
```

### Détail de l'Objectif 4 (Matching Thématique)

```python
def score_pertinence(projet, enseignant):
    """Calcule la similarité entre un projet et un enseignant."""
    
    # Score de base : Jaccard similarity sur les mots-clés
    mots_projet = set(projet['mots_cles'])
    expertises = set(enseignant['expertises'])
    
    intersection = len(mots_projet & expertises)
    union = len(mots_projet | expertises)
    
    if union == 0:
        return 0.0
    
    score = intersection / union  # Jaccard index
    
    # Bonus : historique d'évaluation similaire
    if a_evalue_projet_similaire(enseignant, projet):
        score += 0.2
    
    # Bonus : enseigne un cours lié
    if cours_lie(enseignant, projet['domaine']):
        score += 0.1
    
    # Malus : conflit d'intérêts (co-auteur avec encadrant)
    if co_auteur(enseignant, projet['encadrant_id']):
        score -= 0.5  # Pénalité forte
    
    # Malus : surcharge d'expertise (déjà trop de projets dans ce domaine)
    projets_assignes = nombre_projets_domaine(enseignant, projet['domaine'])
    score -= 0.1 * max(0, projets_assignes - 2)
    
    return max(0.0, score)
```

### Intégration dans le modèle CP-SAT

```python
# Variables de décision
jury[soutenance_id]['president'] = model.NewIntVar(...)
jury[soutenance_id]['rapporteur'] = model.NewIntVar(...)

# Matrice de scores pré-calculée
score[soutenance][enseignant] = calculer_pertinence(projet, enseignant)

# Objectif : maximiser la somme des scores de pertinence
model.Maximize(
    Sum(score[s][jury[s]['president']] + score[s][jury[s]['rapporteur']]
        for s in soutenances)
)
```

---

## 3. Ce que l'IA fait automatiquement

```
┌─────────────────────────────────────────────────────────────┐
│                 AUTO-PLANNING PIPELINE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  INPUT: Liste d'étudiants (sans planning)                   │
│         + Période calendrier                                │
│         + Enseignants + disponibilités + expertises         │
│         + Salles disponibles                                │
│         + Réciprocité actuelle                              │
│         + Projets (titre, résumé, mots-clés)                │
│                        │                                    │
│                        ▼                                    │
│  ┌──────────────────────────────────────────┐              │
│  │    ÉTAPE 1 : EXTRACTION DE MOTS-CLÉS     │              │
│  │    (si non fournis manuellement)         │              │
│  │                                          │              │
│  │    - Analyse du titre + résumé           │              │
│  │    - Extraction automatique des tags     │              │
│  │    - Catégorisation du domaine           │              │
│  └──────────────────────────────────────────┘              │
│                        │                                    │
│                        ▼                                    │
│  ┌──────────────────────────────────────────┐              │
│  │    ÉTAPE 2 : CALCUL MATRICE DE           │              │
│  │    PERTINENCE (projet × enseignant)      │              │
│  │                                          │              │
│  │    Pour chaque (projet, enseignant):     │              │
│  │    - Score Jaccard sur mots-clés         │              │
│  │    - Bonus/malus (historique, conflit)   │              │
│  └──────────────────────────────────────────┘              │
│                        │                                    │
│                        ▼                                    │
│  ┌──────────────────────────────────────────┐              │
│  │    ÉTAPE 3 : CP-SAT SOLVER (OR-Tools)   │              │
│  │                                          │              │
│  │    Variables:                            │              │
│  │    - x[i,j,k] = soutenance i,           │              │
│  │      jour j, créneau k                   │              │
│  │    - jury[i] = {président, rapporteur}   │              │
│  │    - salle[i] = salle assignée           │              │
│  │                                          │              │
│  │    Contraintes: C1-C8, C14 (dures)       │              │
│  │                 C9-C13 (douces)          │              │
│  │                                          │              │
│  │    Objectifs: O1-O5 pondérés             │              │
│  │    (O4 = maximiser pertinence jury)      │              │
│  └──────────────────────────────────────────┘              │
│                        │                                    │
│                        ▼                                    │
│  OUTPUT: Planning complet                                   │
│          - Date + Heure + Salle par étudiant                │
│          - Jury assigné (expertise-matched)                 │
│          - Score d'optimisation                             │
│          - Score de pertinence moyen                        │
│          - Alertes si contraintes non satisfaites           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Deux Modes de Fonctionnement

### Mode A — Optimisation (replanifier l'existant)
- Prend les soutenances déjà planifiées
- Réoptimise les créneaux et salles
- Ne change PAS le jury (sauf conflit détecté)
- Utilise quand l'admin veut améliorer le planning actuel

### Mode B — Auto-planning complet (from scratch)
- Prend une liste d'étudiants non planifiés
- Assigne automatiquement : jury + date + heure + salle
- Garantit le respect de toutes les contraintes dures
- Résout en une seule passe CP-SAT

---

## 5. Données Nécessaires pour le Solver

### Tables SQL existantes :
```
├── users (id, nom, role, max_soutenances_jour)
├── etudiants (id, nom, encadrant_id, titre_sujet)
├── soutenances (id, etudiant_id, date, heure, salle, jury...)
├── jours_calendrier (date, actif, max_soutenances)
├── disponibilites (enseignant_id, date, statut)
├── invitations_jury (enseignant_id, role, statut)
├── salles (id, nom, capacite)
├── parametres_creneaux (heure_depart, duree, pause)
└── periode (date_debut, date_fin, max_par_jour)
```

### Nouveaux champs/à ajouter pour le matching thématique :

**Table `users`** (enseignants) :
```sql
ALTER TABLE users ADD COLUMN expertises JSON;
-- Exemple : ["mobile", "android", "flutter", "firebase", "react-native"]

ALTER TABLE users ADD COLUMN enseignements JSON;
-- Exemple : ["Développement Mobile", "Génie Logiciel", "BDD"]

ALTER TABLE users ADD COLUMN domaines_recherche JSON;
-- Exemple : ["IoT", "Cloud Computing", "Sécurité Mobile"]

ALTER TABLE users ADD COLUMN bio_courte TEXT;
-- Exemple : "Professeur spécialisé en développement mobile et architectures cloud"
```

**Table `etudiants`** ou nouvelle table `projets` :
```sql
ALTER TABLE etudiants ADD COLUMN mots_cles_projet JSON;
-- Exemple : ["mobile", "flutter", "gestion", "firebase"]

ALTER TABLE etudiants ADD COLUMN resume_projet TEXT;
-- Exemple : "Application mobile de gestion de stock utilisant Flutter et Firebase"

-- OU séparer dans une table projets pour gérer les binômes :
CREATE TABLE projets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    etudiant_id INT,
    etudiant2_id INT NULL,
    titre VARCHAR(255),
    resume TEXT,
    mots_cles JSON,
    domaine_principal VARCHAR(100)
);
```

**Table `publications`** (pour détection conflits d'intérêts) :
```sql
CREATE TABLE publications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    titre VARCHAR(255),
    mots_cles JSON
);

CREATE TABLE publication_auteurs (
    publication_id INT,
    user_id INT (enseignant),
    -- Permet de détecter co-auteurs entre encadrant et jury
);
```

---

## 5.1 Algorithme de Matching Thématique

```
Pour chaque projet P avec mots_cles [k1, k2, ...]:
    Pour chaque enseignant E avec expertises [e1, e2, ...]:
    
        score_overlap = |P.mots_cles ∩ E.expertises|
        score_total   = |P.mots_cles ∪ E.expertises|
        
        similarite = score_overlap / score_total    (Jaccard)
        
        Bonus :
        + 0.2 si E a déjà évalué un projet similaire (historique)
        + 0.1 si E enseigne un cours lié au domaine
        
        Malus :
        - 0.3 si E est co-auteur de publication avec l'encadrant
        - 0.1 par projet déjà assigné à E ce jour (anti-surcharge)
        
    → Score final par paire (projet, enseignant)
```

### Intégration dans CP-SAT :
```
max Σ similarite(projet_i, president) + similarite(projet_i, rapporteur)
```

---

## 5.2 Exemple Concret

```
Projet : "Application mobile Flutter pour gestion de stock"
Mots-clés : [mobile, flutter, firebase, gestion, architecture]

Enseignants disponibles :
┌──────────┬─────────────────────────┬──────────┐
│ Enseignant │ Expertises              │ Score    │
├──────────┼─────────────────────────┼──────────┤
│ Prof. A  │ [mobile, android, kotlin] │ 0.33    │
│ Prof. B  │ [flutter, firebase, dart] │ 0.60 ★  │
│ Prof. C  │ [web, react, angular]    │ 0.00    │
│ Prof. D  │ [mobile, IoT, cloud]     │ 0.25    │
│ Prof. E  │ [architecture, backend]  │ 0.10    │
└──────────┴─────────────────────────┴──────────┘

Jury suggéré :
├── Président : Prof. B (meilleure correspondance)
└── Rapporteur : Prof. A ou D (domaine mobile complémentaire)
```

---

## 6. Architecture Technique Ciblée

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│  PHP Backend │────▶│ Flask :5001  │
│   (React)    │◀────│  (proxy)     │◀────│ (OR-Tools)   │
└──────────────┘     └──────────────┘     └──────────────┘
                           │
                           ▼
                     ┌──────────────┐
                     │  MySQL DB    │
                     └──────────────┘
```

### Nouveaux Endpoints Flask nécessaires:
```
POST /optimiser-planning     → Mode A (replanifier)
POST /auto-planning-complet  → Mode B (from scratch)
GET  /solver-status          → État du solveur
POST /predire-duree          → Prédire durée d'une soutenance
POST /retrain-duree          → Réentraîner le modèle durée
```

---

## 7. Ce qui va changer (par rapport à l'existant)

| Aspect | Actuel | Nouveau |
|--------|--------|---------|
| Jury assigné | Manuellement par encadrant | Auto-assigné par l'IA |
| Heure choisie | Par l'encadrant | Optimisée par l'IA |
| Salle choisie | Par l'encadrant | Optimisée par l'IA |
| Vérification contraintes | Côté PHP | Côté solveur CP-SAT |
| Optimisation | Simple regroupement | Multi-objectif pondéré |
| Gestion conflits | Manuelle | Automatique (solveur) |
| Prédiction durée | IA Flask (si dispo) | Modèle entraîné + fallback |
| Pertinence jury | Aucune | Matching thématique (Jaccard + bonus) |
| Conflits d'intérêts | Non détectés | Détectés via publications |
| Surcharge experts | Non gérée | Lissée automatiquement |

---

## 7.1 Interface Utilisateur pour les Expertises

### Formulaire Enseignant (nouveau/modifier) :
```
┌─────────────────────────────────────────────────────┐
│  Profil Enseignant                                   │
├─────────────────────────────────────────────────────┤
│  Nom : [___________]                                │
│  Grade : [___________]                              │
│                                                     │
│  Expertises :                                        │
│  [x] Mobile  [x] Web  [x] IA  [x] Sécurité         │
│  [ ] Cloud  [ ] IoT  [ ] BDD  [ ] Réseaux          │
│  [Autre: _________]                                 │
│                                                     │
│  Enseignements :                                     │
│  [x] Développement Mobile                           │
│  [x] Génie Logiciel                                 │
│  [ ] Intelligence Artificielle                       │
│  [Autre: _________]                                 │
│                                                     │
│  Domaines de recherche :                             │
│  [________________________________________]         │
│                                                     │
│  Bio courte :                                        │
│  [________________________________________]         │
└─────────────────────────────────────────────────────┘
```

### Formulaire Projet/Étudiant :
```
┌─────────────────────────────────────────────────────┐
│  Projet de Fin d'Études                              │
├─────────────────────────────────────────────────────┤
│  Titre : [___________]                              │
│  Étudiant(s) : [___________]                        │
│                                                     │
│  Résumé :                                            │
│  [________________________________________]         │
│                                                     │
│  Mots-clés (auto-extraits ou manuels) :              │
│  [mobile] [x]  [flutter] [x]  [firebase] [x]       │
│  [gestion] [x]  [+ Ajouter]                         │
│                                                     │
│  Domaine principal : [Mobile ▼]                     │
│                                                     │
│  [✓] Utiliser ces mots-clés pour le matching jury   │
└─────────────────────────────────────────────────────┘
```

---

## 7.2 Schéma Base de Données Complet

```
┌─────────────────┐     ┌──────────────────┐
│     users       │     │    etudiants      │
├─────────────────┤     ├──────────────────┤
│ id (PK)         │◄────│ encadrant_id (FK) │
│ nom             │     │ id (PK)           │
│ prenom          │     │ nom               │
│ role            │     │ prenom            │
│ email           │     │ titre_sujet       │
│ grade           │     │ resume_projet     │
│ max_sout_jour   │     │ mots_cles_projet  │  ← NEW
│ expertises      │  ← NEW (JSON)              │
│ enseignements   │  ← NEW (JSON)              │
│ domaines_recherche│← NEW (JSON)              │
│ bio_courte      │  ← NEW                      │
└─────────────────┘     └──────────────────┘
         │                       │
         │              ┌────────┘
         │              │
         ▼              ▼
┌─────────────────────────────────────┐
│           soutenances                │
├─────────────────────────────────────┤
│ id (PK)                             │
│ etudiant_id (FK)                    │
│ encadrant_id (FK)                   │
│ rapporteur_id (FK)                  │
│ president_id (FK)                   │
│ date, heure, salle                  │
│ statut                              │
│ duree_estimee                       │
│ duree_reelle_min                    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│         publications (NEW)           │
├─────────────────────────────────────┤
│ id (PK)                             │
│ titre                               │
│ mots_cles (JSON)                    │
│ annee                               │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│      publication_auteurs (NEW)       │
├─────────────────────────────────────┤
│ publication_id (FK)                 │
│ user_id (FK)                        │
└─────────────────────────────────────┘
```

---

## 8. Prochaines Étapes

1. **Créer le microservice Flask** (`app.py`) avec OR-Tools
2. **Implémenter le modèle CP-SAT** avec contraintes C1-C10
3. **Ajouter les nouveaux endpoints PHP** pour le proxy
4. **Mettre à jour le frontend** avec bouton "Auto-Planifier"
5. **Tester** sur un jeu de données réel
6. **Itérer** selon les retours

---

*Document créé pour discussion avant implémentation.*
