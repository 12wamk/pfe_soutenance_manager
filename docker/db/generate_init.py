"""Génère docker/db/init.sql en concaténant schema.sql + les migrations.

Le conteneur MySQL exécute init.sql à la première création du volume.
L'ordre est important : schema.sql (tables + seeds) → add_auto_planning_fields.sql
(champs IA + données expertise) → demo_donnees_planning.sql (période + soutenances).
Chaque fichier est précédé d'un USE pour être autonome.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "backend" / "database"
FICHIERS = [
    ("schema.sql", False),
    ("migrations/add_auto_planning_fields.sql", False),
    ("migrations/demo_donnees_planning.sql", False),
    ("migrations/demo_donnees_elaborees.sql", False),
]

en_tete = """-- ============================================================
-- FICHIER GÉNÉRÉ — ne pas éditer à la main.
-- Source : docker/db/generate_init.py
-- Regroupe : schema.sql + migrations + données de démonstration
-- pour l'initialisation automatique du conteneur MySQL (initdb).
-- ============================================================

SET NAMES utf8mb4;
SET character_set_server = utf8mb4;
CREATE DATABASE IF NOT EXISTS pfe_soutenance_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pfe_soutenance_manager;
"""

blocs = [en_tete]
for rel, avec_use in FICHIERS:
    chemin = SRC / rel
    contenu = chemin.read_text(encoding="utf-8")
    blocs.append("-- ---------------- Début : " + rel + " ----------------\n")
    if avec_use:
        blocs.append("USE pfe_soutenance_manager;\n\n")
    blocs.append(contenu.strip() + "\n\n")

out = ROOT / "docker" / "db" / "init.sql"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text("\n".join(blocs), encoding="utf-8")
print(f"OK -> {out} ({out.stat().st_size} octets)")
