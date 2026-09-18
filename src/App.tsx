import React, { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LandingPage } from './screens/LandingPage';
import { GameProvider, useGame } from './store/GameContext';
import { useAuth } from './store/AuthContext';
import { LoadingScreen } from './components/LoadingScreen';
import { PrivacyPolicy } from './screens/PrivacyPolicy';

const WelcomeScreen = lazy(() => import('./screens/WelcomeScreen').then((module) => ({ default: module.WelcomeScreen })));
const InviteScreen = lazy(() => import('./screens/InviteScreen').then((module) => ({ default: module.InviteScreen })));
const PlayRoute = lazy(() => import('./routing/PlayRoute').then((module) => ({ default: module.PlayRoute })));

const ProtectedRoute = ({ children, requireProfile = true }: { children: React.ReactNode; requireProfile?: boolean }) => {
  const { user, isLoading } = useAuth();
  const { profile } = useGame();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;
  if (!user || user.id.startsWith('guest-')) return <Navigate to="/" state={{ from: location }} replace />;
  if (requireProfile && !profile) return <Navigate to="/setup" replace />;
  if (!requireProfile && profile) return <Navigate to="/play" replace />;
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  const { profile } = useGame();

  if (isLoading) return <LoadingScreen />;
  if (user && !user.id.startsWith('guest-')) return <Navigate to={profile ? '/play' : '/setup'} replace />;
  return <>{children}</>;
};

const AppRoutes = () => {
  const location = useLocation();

  React.useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const roomCode = searchParams.get('room');
    if (roomCode) sessionStorage.setItem('pendingRoomCode', roomCode);


  }, [location.search]);

  return (
    <Routes>
      <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
      <Route path="/setup" element={<ProtectedRoute requireProfile={false}><WelcomeScreen onComplete={() => undefined} /></ProtectedRoute>} />
      <Route path="/play" element={<ProtectedRoute><PlayRoute /></ProtectedRoute>} />
      <Route path="/invite" element={<InviteScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
      <Route path={'/privacy'} element={<PrivacyPolicy />} />
    </Routes>
  );
};

export const App = () => (
  <GameProvider>
    <Suspense fallback={<LoadingScreen />}>
      <AppRoutes />
    </Suspense>
  </GameProvider>
);
