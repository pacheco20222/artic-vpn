import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import Navbar from './components/Navbar';
import ServerList from './pages/ServerList';
import Myconnections from './pages/MyConnections';

const isAuthenticated = () => {
  return !!localStorage.getItem('access_token');
};

export default function App() {
  const location = useLocation();
  const showNavbar = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/servers') || location.pathname.startsWith('/my-connections');

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Show layout only on /dashboard */}
      {showNavbar && <Navbar />}

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
          <Route
          path='/servers'
          element={
            isAuthenticated() ? <ServerList /> : <Navigate to="/" />
          }
          />
          <Route
          path='/my-connections'
          element={isAuthenticated() ? <Myconnections /> : <Navigate to="/" />}
          />
        </Routes>
      </main>
    </div>
  );
}
