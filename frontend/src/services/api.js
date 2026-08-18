import axios from 'axios';

// En développement, vite.config.js proxy les requêtes commençant par /api
// vers le backend PHP XAMPP (voir server.proxy dans vite.config.js).
// En production, servez ce build derrière le même domaine que le backend,
// ou définissez VITE_API_BASE_URL dans un fichier .env pour pointer
// vers l'URL complète du backend.
const BASE = import.meta.env.VITE_API_BASE_URL || '';

// Les fichiers statiques (photos de profil) sont servis directement par Apache,
// pas via le proxy Vite (qui ne couvre que /api). Il faut donc l'URL complète
// du backend pour construire un <img src>. Ajustez VITE_BACKEND_STATIC_URL dans
// .env si votre backend n'est pas à l'emplacement XAMPP standard.
const BACKEND_STATIC_URL = import.meta.env.VITE_BACKEND_STATIC_URL || 'http://localhost/pfe_soutenance_manager/backend';

/** Construit l'URL complète d'une photo de profil à partir du chemin relatif renvoyé par l'API. */
export function urlPhoto(photoUrl) {
  return photoUrl ? `${BACKEND_STATIC_URL}/${photoUrl}` : null;
}

const client = axios.create({ baseURL: BASE });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      if (!window.location.pathname.includes('/login')) window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (data) => client.post('/api/auth/login.php', data),
  register: (data) => client.post('/api/auth/register.php', data),
  me: () => client.get('/api/auth/me.php'),
  updatePassword: (data) => client.post('/api/auth/update-password.php', data),
  updatePhoto: (formData) => client.post('/api/auth/update-photo.php', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateProfileExpertise: (data) => client.put('/api/auth/me.php', data),
};

export const adminApi = {
  getEnseignantDetail: (id) => client.get('/api/admin/enseignant-detail.php', { params: { id } }),
  getEnseignants: (params) => client.get('/api/admin/enseignants.php', { params }),
  createEnseignant: (data) => client.post('/api/admin/enseignants.php', data),
  updateEnseignant: (id, data) => client.put(`/api/admin/enseignants.php?id=${id}`, data),
  updateMaxEnseignant: (id, max) => client.put(`/api/admin/enseignants.php?id=${id}`, { max_soutenances_jour: max }),
  deleteEnseignant: (id) => client.delete(`/api/admin/enseignants.php?id=${id}`),

  // v3.0 — Auto-planning IA
  autoPlanningComplet: (etudiantIds, sauvegarder) =>
    client.post('/api/admin/auto-planning-complet.php', { etudiant_ids: etudiantIds, sauvegarder }),

  getEtudiants: (params) => client.get('/api/admin/etudiants.php', { params }),
  createEtudiant: (data) => client.post('/api/admin/etudiants.php', data),
  updateEtudiant: (id, data) => client.put(`/api/admin/etudiants.php?id=${id}`, data),
  deleteEtudiant: (id) => client.delete(`/api/admin/etudiants.php?id=${id}`),

  import: (formData) => client.post('/api/admin/import.php', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  importEnseignants: (formData) => client.post('/api/admin/import-enseignants.php', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  getPeriode: () => client.get('/api/admin/periode.php'),
  updatePeriode: (data) => client.post('/api/admin/periode.php', data),
  updateJour: (id, data) => client.put(`/api/admin/periode.php?jour=${id}`, data),

  getStats: (params) => client.get('/api/admin/stats.php', { params }),
   optimiserPlanning: (date, sauvegarder) =>
    client.post('/api/admin/optimiser-planning.php', { date, sauvegarder }),
    getParametresNotifications: () => client.get('/api/admin/notifications-config.php'),
  updateParametresNotifications: (data) => client.post('/api/admin/notifications-config.php',
     data),
      getImpactStats: () => client.get('/api/admin/impact-stats.php'),
      // Mode développeur — réinitialise la base de données de démonstration (admin uniquement)
      resetData: () => client.post('/api/dev/reset-data.php'),
};

export const soutenancesApi = {
  getAll: (params) => client.get('/api/soutenances/toutes.php', { params }),
  planifier: (data) => client.post('/api/soutenances/planifier.php', data),
  valider: (data) => client.post('/api/soutenances/valider.php', data),
  annulerJury: (data) => client.post('/api/soutenances/annuler-jury.php', data),
  reaffecterJury: (data) => client.post('/api/soutenances/reaffecter-jury.php', data),
  annuler: (data) => client.post('/api/soutenances/annuler.php', data),
  getDisponibilites: () => client.get('/api/soutenances/disponibilites.php'),
  setDisponibilite: (data) => client.post('/api/soutenances/disponibilites.php', data),
  getCreneaux: (date, excludeId) => client.get('/api/soutenances/creneaux.php', { params: excludeId ? { date, exclude_id: excludeId } : { date } }),
  // v1.8 — replanification (date/heure/salle) d'une soutenance existante, admin uniquement
  replanifier: (data) => client.post('/api/soutenances/replanifier.php', data),
  // v1.9 — liste des enseignants affectables avec statut de disponibilité, pour le modal unifié
  getEnseignantsDisponibles: (soutenanceId, role, date, heure) =>
    client.get('/api/soutenances/enseignants-disponibles.php', { params: { soutenance_id: soutenanceId, role, ...(date ? { date } : {}), ...(heure ? { heure } : {}) } }),

  getAujourdhui: () => client.get('/api/soutenances/aujourdhui.php'),
demarrer: (soutenanceId) => client.post('/api/soutenances/demarrer.php', { soutenance_id: soutenanceId }),
terminer: (soutenanceId) => client.post('/api/soutenances/terminer.php', { soutenance_id: soutenanceId }),
};

export const departementsApi = {
  getAll: (params) => client.get('/api/admin/departements.php', { params }),
  create: (data) => client.post('/api/admin/departements.php', data),
  update: (id, data) => client.put(`/api/admin/departements.php?id=${id}`, data),
  delete: (id, password) => client.delete(`/api/admin/departements.php?id=${id}`, { data: { password } }),
  restaurer: (id) => client.put(`/api/admin/departements.php?id=${id}`, { restaurer: true }),
};

export const optionsApi = {
  getAll: (params) => client.get('/api/admin/options.php', { params }),
  create: (data) => client.post('/api/admin/options.php', data),
  update: (id, data) => client.put(`/api/admin/options.php?id=${id}`, data),
  delete: (id, password) => client.delete(`/api/admin/options.php?id=${id}`, { data: { password } }),
  restaurer: (id) => client.put(`/api/admin/options.php?id=${id}`, { restaurer: true }),
};

export const sallesApi = {
  getAll: () => client.get('/api/admin/salles.php'),
  create: (data) => client.post('/api/admin/salles.php', data),
  update: (id, data) => client.put(`/api/admin/salles.php?id=${id}`, data),
  delete: (id) => client.delete(`/api/admin/salles.php?id=${id}`),
};

export const juryApi = {
  getInvitations: (vue) => client.get('/api/jury/invitations.php', { params: vue ? { vue } : {} }),
  repondre: (data) => client.post('/api/jury/repondre.php', data),
  validerExpiration: (data) => client.post('/api/jury/valider-expiration.php', data),
  demandeParticipation: (data) => client.post('/api/jury/demande-participation.php', data),
  getDemandes: (vue) => client.get('/api/jury/demande-participation.php', { params: vue ? { vue } : {} }),
  traiterDemande: (id, data) => client.put(`/api/jury/demande-participation.php?id=${id}`, data),
  inviterParticipation: (data) => client.post('/api/jury/inviter-participation.php', data),
  getCharge: () => client.get('/api/jury/charge.php'),
  getChargeParJour: (params) => client.get('/api/jury/charge-jour.php', { params }),
  getSuggestions: (etudiantId, date, heure) => client.get('/api/jury/suggestions.php', { params: { etudiant_id: etudiantId, date, heure } }),
  // v2.0 — suggestion IA de l'horaire (minimise l'attente du jury). params: { date, jury? , soutenance_id?, president_id?, rapporteur_id?, exclude_soutenance_id? }
  getSuggestionHoraire: (params) => client.post('/api/jury/suggerer-horaire.php', params),
  // v2.1 — suggestion IA de la salle disponible à une date/heure donnée
  getSuggestionSalle: (date, heure, excludeSoutenanceId) =>
    client.post('/api/jury/suggerer-salle.php', { date, heure, exclude_soutenance_id: excludeSoutenanceId }),
  // v1.7 — ajustement manuel de la réciprocité (admin uniquement)
  ajusterReciprocite: (enseignantId, role, delta, motif) =>
    client.post('/api/jury/ajustement-reciprocite.php', { enseignant_id: enseignantId, role, delta, motif }),
  // v2.2 — assignation IA complète : jury + horaire + salle en une seule résolution CP-SAT
  assignerComplet: (etudiantId, date, excludeSoutenanceId) =>
    client.post('/api/jury/assigner-complet.php', { etudiant_id: etudiantId, date, exclude_soutenance_id: excludeSoutenanceId }),
};

export const notificationsApi = {
  getAll: () => client.get('/api/notifications/index.php'),
  markRead: (id) => client.post('/api/notifications/index.php', id ? { id } : {}),
};

export const chatbotApi = {
  getHistory: () => client.get('/api/chatbot/index.php'),
  sendMessage: (message) => client.post('/api/chatbot/index.php', { message }),
  getStatus: () => client.get('/api/chatbot/status.php'),
};

export default client;