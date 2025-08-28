import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import Navbar from './components/Navbar';
import ServerList from './pages/ServerList';
import MyConnections from './pages/MyConnections';
import SecurityPage from './pages/SecurityPage';
import SignupPage from './pages/SignupPage';
import { ConnectionProvider } from './context/ConnectionContext';

function ProtectedRoute({ children }: { children: ReactNode }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
}

const isAuthenticated = () => {
  return !!localStorage.getItem('access_token');
};

export default function App() {
  const location = useLocation();
  const showNavbar = (
    location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/servers') ||
    location.pathname.startsWith('/my-connections') ||
    location.pathname.startsWith('/security')
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <ConnectionProvider>
        {/* Show layout only on /dashboard */}
        {showNavbar && <Navbar />}

        <main className="pt-6">
          <Routes>
            <Route
              path="/"
              element={
                isAuthenticated() ? <Navigate to="/dashboard" replace /> : <LoginPage />
              }
            />
            <Route
              path="/login"
              element={
                isAuthenticated() ? <Navigate to="/dashboard" replace /> : <LoginPage />
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path='/servers'
              element={
                <ProtectedRoute>
                  <ServerList />
                </ProtectedRoute>
              }
            />
            <Route
              path='/my-connections'
              element={
                <ProtectedRoute>
                  <MyConnections />
                </ProtectedRoute>
              }
            />
            <Route
              path="/security"
              element={
                <ProtectedRoute>
                  <SecurityPage />
                </ProtectedRoute>
              }
            />
            <Route 
              path='/signup'
              element={<SignupPage />}
            />
            <Route
              path="*"
              element={
                isAuthenticated() ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
          </Routes>
        </main>
      </ConnectionProvider>
    </div>
  );
}
