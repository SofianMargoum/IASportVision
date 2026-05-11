import React from 'react';
import { Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import PrivacyPage from './pages/PrivacyPage';
import DashboardPage from './pages/DashboardPage';
import ClubsPage from './pages/ClubsPage';
import VideosPage from './pages/VideosPage';
import VideoPlayerPage from './pages/VideoPlayerPage';
import UsersPage from './pages/UsersPage';
import CamerasPage from './pages/CamerasPage';
import CoachPage from './pages/CoachPage';
import PlayerPage from './pages/PlayerPage';
import SupporterPage from './pages/SupporterPage';
import AdminPage from './pages/AdminPage';
import AnnotationPage from './pages/AnnotationPage';
import GCPPage from './pages/GCPPage';
import NotFoundPage from './pages/NotFoundPage';
import { PAGES } from './utils/permissions';

export default function App() {
  return (
    <Routes>
      {/* Site vitrine public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/index.php/politique-de-confidentialite-ia-sport-vision/" element={<PrivacyPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<ProtectedRoute page={PAGES.DASHBOARD}><DashboardPage /></ProtectedRoute>} />
        <Route path="/clubs" element={<ProtectedRoute page={PAGES.CLUBS}><ClubsPage /></ProtectedRoute>} />
        <Route path="/videos" element={<ProtectedRoute page={PAGES.VIDEOS}><VideosPage /></ProtectedRoute>} />
        <Route path="/videos/play" element={<ProtectedRoute page={PAGES.VIDEOS}><VideoPlayerPage /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute page={PAGES.USERS}><UsersPage /></ProtectedRoute>} />
        <Route path="/cameras" element={<ProtectedRoute page={PAGES.CAMERAS}><CamerasPage /></ProtectedRoute>} />
        <Route path="/coach" element={<ProtectedRoute page={PAGES.COACH}><CoachPage /></ProtectedRoute>} />
        <Route path="/player" element={<ProtectedRoute page={PAGES.PLAYER}><PlayerPage /></ProtectedRoute>} />
        <Route path="/supporter" element={<ProtectedRoute page={PAGES.SUPPORTER}><SupporterPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute page={PAGES.ADMIN}><AdminPage /></ProtectedRoute>} />
        <Route path="/annotation" element={<ProtectedRoute page={PAGES.ANNOTATION}><AnnotationPage /></ProtectedRoute>} />
        <Route path="/gcp" element={<ProtectedRoute page={PAGES.GCP}><GCPPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
