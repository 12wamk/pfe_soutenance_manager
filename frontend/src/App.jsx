import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EnseignantsPage from './pages/EnseignantsPage';
import EtudiantsPage from './pages/EtudiantsPage';
import SoutenancesPage from './pages/SoutenancesPage';
import ImportPage from './pages/ImportPage';
import ImportEnseignantsPage from './pages/ImportEnseignantsPage';
import PeriodePage from './pages/PeriodePage';
import ProfilPage from './pages/ProfilPage';
import MesEtudiantsPage from './pages/MesEtudiantsPage';
import MonPlanningPage from './pages/MonPlanningPage';
import DisponibilitesPage from './pages/DisponibilitesPage';
import InvitationsPage from './pages/InvitationsPage';
import ParametresPage from './pages/ParametresPage';
import OptionsPage from './pages/OptionsPage';
import DemandesParticipationPage from './pages/DemandesParticipationPage';
import ChargeJuryPage from './pages/ChargeJuryPage';
import SoutenancesDuJourPage from './pages/SoutenancesDuJour';
import ImpactIAPage from './pages/ImpactIAPage';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" toastOptions={{ style: { fontSize: 14 } }} />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/enseignants" element={<EnseignantsPage />} />
            <Route path="/etudiants" element={<EtudiantsPage />} />
            <Route path="/soutenances" element={<SoutenancesPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/import-enseignants" element={<ImportEnseignantsPage />} />
            <Route path="/periode" element={<PeriodePage />} />
            <Route path="/profil" element={<ProfilPage />} />
            <Route path="/mes-etudiants" element={<MesEtudiantsPage />} />
            <Route path="/mon-planning" element={<MonPlanningPage />} />
            <Route path="/soutenances-du-jour" element={<SoutenancesDuJourPage />} />
            <Route path="/disponibilites" element={<DisponibilitesPage />} />
            <Route path="/invitations" element={<InvitationsPage />} />
            <Route path="/parametres" element={<ParametresPage />} />
            <Route path="/options" element={<OptionsPage />} />
            <Route path="/participation" element={<DemandesParticipationPage />} />
            <Route path="/charge-jury" element={<ChargeJuryPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
            <Route path="/impact-ia" element={<ImpactIAPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
