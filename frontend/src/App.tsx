import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import Navbar from './components/Navbar';

const isAuthenticated = () => {
  return !!localStorage.getItem('access_token');
};

export default function App() {
  const location = useLocation();
  const isOnDashboard = location.pathname.startsWith('/dashboard');

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Show layout only on /dashboard */}
      {isOnDashboard && (
        <>
          <Navbar />
        </>
      )}

      <main className="pt-6">
        <Routes>
          <Route
            path="/"
            element={
              isAuthenticated() ? <Navigate to="/dashboard" /> : <LoginPage />
            }
          />
          <Route
            path="/dashboard"
            element={
              isAuthenticated() ? <DashboardPage /> : <Navigate to="/" />
            }
          />
        </Routes>
      </main>
    </div>
  );
}
