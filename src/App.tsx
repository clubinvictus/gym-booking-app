import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { ConfirmProvider } from './ConfirmContext';
import ErrorBoundary from './components/ErrorBoundary';

// Split the authenticated app shell from the public-facing pages: a visitor
// hitting /login or /book-trial shouldn't pay for the entire Dashboard bundle.
const CalendarRetiredPage = lazy(() => import('./components/CalendarRetiredPage').then(m => ({ default: m.CalendarRetiredPage })));
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const TrialBookingPage = lazy(() => import('./TrialBookingPage').then(m => ({ default: m.TrialBookingPage })));

const RouteFallback = () => (
  <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
    <p style={{ fontWeight: 800, fontSize: '1.2rem' }}>LOADING...</p>
  </div>
);

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
    <ErrorBoundary>
      <ConfirmProvider>
        <AuthProvider>
          <Router>
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={<CalendarRetiredPage />} />
              <Route path="/book-trial" element={<TrialBookingPage />} />

              {/* Admin/Trainer/Client Routes */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard view="dashboard" /></ProtectedRoute>} />
              <Route path="/team" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Dashboard view="team" /></ProtectedRoute>} />
              <Route path="/services" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Dashboard view="services" /></ProtectedRoute>} />
              <Route path="/clients" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Dashboard view="clients" /></ProtectedRoute>} />
              <Route path="/activity" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Dashboard view="activity" /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Dashboard view="settings" /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Dashboard view="dashboard" /></ProtectedRoute>} />

              {/* Client/General Routes */}
              <Route path="/calendar" element={<ProtectedRoute><Dashboard view="calendar" /></ProtectedRoute>} />

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            </Suspense>
          </Router>
        </AuthProvider>
      </ConfirmProvider>
    </ErrorBoundary>
  );
}

export default App;
