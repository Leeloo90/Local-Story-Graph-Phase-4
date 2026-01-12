import React, { useState } from 'react';
import HomeView from './components/HomeView';
import DashboardView from './components/DashboardView';
import CanvasView from './components/CanvasView';

type View = 'home' | 'dashboard' | 'canvas';

interface AppState {
  currentView: View;
  currentProjectId: string | null;
  currentCanvasId: string | null;
}

function App() {
  const [appState, setAppState] = useState<AppState>({
    currentView: 'home',
    currentProjectId: null,
    currentCanvasId: null,
  });

  const handleOpenProject = (projectId: string) => {
    setAppState({
      currentView: 'dashboard',
      currentProjectId: projectId,
      currentCanvasId: null,
    });
  };

  const handleOpenCanvas = (canvasId: string) => {
    setAppState({
      ...appState,
      currentView: 'canvas',
      currentCanvasId: canvasId,
    });
  };

  const handleBackToHome = () => {
    setAppState({
      currentView: 'home',
      currentProjectId: null,
      currentCanvasId: null,
    });
  };

  const handleBackToDashboard = () => {
    setAppState({
      ...appState,
      currentView: 'dashboard',
      currentCanvasId: null,
    });
  };

  // Render current view
  switch (appState.currentView) {
    case 'home':
      return <HomeView onOpenProject={handleOpenProject} />;

    case 'dashboard':
      return (
        <DashboardView
          projectId={appState.currentProjectId!}
          onBack={handleBackToHome}
          onOpenCanvas={handleOpenCanvas}
        />
      );

    case 'canvas':
      return (
        <CanvasView
          projectId={appState.currentProjectId!}
          canvasId={appState.currentCanvasId!}
          onBack={handleBackToDashboard}
        />
      );

    default:
      return <HomeView onOpenProject={handleOpenProject} />;
  }
}

export default App;
