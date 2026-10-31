import { Navigate, Route, Routes, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import PatientListPage from './pages/PatientListPage';
import PatientDetailPage from './pages/PatientDetailPage';
import SchedulePage from './pages/SchedulePage';
import CheckInPage from './pages/CheckInPage';
import AppLayout from './components/AppLayout';
import ReportsShell from './pages/reports/ReportsShell';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import OperationalReportPage from './pages/reports/OperationalReportPage';
import ClinicalReportPage from './pages/reports/ClinicalReportPage';
import CohortReportPage from './pages/reports/CohortReportPage';
import { CardSkeleton } from './components/feedback';
import { canViewPopulationReports } from './pages/reports/reportDisplay';

function ReportsGate() {
  const { user } = useAuth();
  if (!canViewPopulationReports(user?.role)) {
    return (
      <div className="max-w-xl" role="status">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Reports</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          Population reports are available to clinicians, nurses, and administrators. Your sign-in role does not include them.
        </p>
        <Link
          to="/dashboard"
          className="mt-4 inline-flex rounded-xl bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }
  return <ReportsShell />;
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <CardSkeleton rows={4} label="Checking your session" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route path="dashboard" element={<DashboardPage />} />
        <Route index element={<PatientListPage />} />
        <Route path="patients/:id" element={<PatientDetailPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="check-in" element={<CheckInPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="reports" element={<ReportsGate />}>
          <Route index element={<OperationalReportPage />} />
          <Route path="clinical" element={<ClinicalReportPage />} />
          <Route path="cohorts" element={<CohortReportPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
