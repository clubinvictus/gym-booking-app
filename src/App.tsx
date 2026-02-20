import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './components/LoginPage';
import { Dashboard } from './components/Dashboard';
import { AuthProvider, useAuth } from './AuthContext';

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
      <p style={{ fontWeight: 800, fontSize: '1.2rem' }}>LOADING INVICTUS CALENDAR...</p>
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    // If user tries to access unauthorized pages, redirect to their home
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Admin/Trainer/Client Routes */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard view="dashboard" /></ProtectedRoute>} />
          <Route path="/team" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Dashboard view="team" /></ProtectedRoute>} />
          <Route path="/services" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Dashboard view="services" /></ProtectedRoute>} />
          <Route path="/clients" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Dashboard view="clients" /></ProtectedRoute>} />
          <Route path="/activity" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Dashboard view="activity" /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Dashboard view="settings" /></ProtectedRoute>} />

          {/* Client/General Routes */}
          <Route path="/calendar" element={<ProtectedRoute><Dashboard view="calendar" /></ProtectedRoute>} />

          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
