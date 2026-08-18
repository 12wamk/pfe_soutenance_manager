# ============================================================
# Stage 1 — Build du frontend React (Vite)
# ============================================================
FROM node:20-alpine AS frontend
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

# En production (conteneur), le backend PHP est servi sur le même domaine
# sous /pfe_soutenance_manager/backend : les URLs de photos doivent être relatives
# à ce chemin. Ne pas mettre l'hôte/port ici (l'ami peut changer WEB_PORT).
ARG VITE_BACKEND_STATIC_URL=/pfe_soutenance_manager/backend
ENV VITE_BACKEND_STATIC_URL=$VITE_BACKEND_STATIC_URL
RUN npm run build

# ============================================================
# Stage 2 — PHP 8.2 + Apache + frontend compilé + backend PHP
# ============================================================
FROM php:8.2-apache

# Extensions PHP nécessaires : MySQL (PDO + mysqli), curl (proxys Flask),
# gd (traitement images), fileinfo (détection type upload)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       libcurl4-openssl-dev \
       libpng-dev libjpeg-dev libfreetype6-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql mysqli curl gd fileinfo \
    && rm -rf /var/lib/apt/lists/*

RUN a2enmod rewrite

# Évite le warning "could not reliably determine the server's fully qualified domain name"
RUN echo "ServerName localhost" > /etc/apache2/conf-available/servername.conf \
    && a2enconf servername

# Config du VirtualHost (SPA + Alias /api + uploads)
COPY docker/apache/000-default.conf /etc/apache2/sites-available/000-default.conf

# Frontend compilé → racine web
COPY --from=frontend /app/dist /var/www/html/

# Backend PHP → reproduit la hiérarchie XAMPP : /pfe_soutenance_manager/backend
COPY backend /var/www/html/pfe_soutenance_manager/backend/

# Le dossier uploads + mail_log.txt doivent être écrits par www-data.
# uploads/ est gitignoré (peut être vide/absent du clone) : on le recrée dans l'image.
RUN mkdir -p /var/www/html/pfe_soutenance_manager/backend/uploads \
    && chown -R www-data:www-data /var/www/html/pfe_soutenance_manager/backend \
    && chmod -R 775 /var/www/html/pfe_soutenance_manager/backend/uploads

EXPOSE 80
