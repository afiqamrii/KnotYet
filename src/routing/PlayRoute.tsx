import { Suspense, lazy } from 'react';
import { FriendsProvider } from '../store/FriendsContext';
import { MultiplayerProvider } from '../store/MultiplayerContext';
import { LoadingScreen } from '../components/LoadingScreen';

const PlayScreen = lazy(() => import('../screens/PlayScreen').then((module) => ({ default: module.PlayScreen })));

export const PlayRoute = () => (
  <MultiplayerProvider>
    <FriendsProvider>
      <Suspense fallback={<LoadingScreen />}>
        <PlayScreen />
      </Suspense>
    </FriendsProvider>
  </MultiplayerProvider>
);