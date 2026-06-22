import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { auth, AppUser } from './firebase';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { Annotate } from './pages/Annotate';
import { AdminTasks } from './pages/AdminTasks';
import { Calibration } from './pages/Calibration';
import { Export } from './pages/Export';

// Create TanStack Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false
    }
  }
});

const App: React.FC = () => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Subscribe to Authentication state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser: AppUser | null) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-4 border-accentA border-t-transparent rounded-full animate-spin"></div>
        <p className="font-mono text-xs text-textMuted uppercase tracking-wider">Verifying Session credentials...</p>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        {!user ? (
          <Login />
        ) : (
          <div className="min-h-screen bg-background text-textWarm flex flex-col">
            <Navbar user={user} />
            <main className="flex-1 bg-background geometric-bg">
              <Routes>
                <Route path="/" element={<Annotate />} />
                <Route path="/tasks" element={<AdminTasks />} />
                <Route path="/calibration" element={<Calibration />} />
                <Route path="/export" element={<Export />} />
                {/* Fallback route */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        )}
      </Router>
    </QueryClientProvider>
  );
};

export default App;
