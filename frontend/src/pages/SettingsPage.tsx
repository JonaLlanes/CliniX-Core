import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../context/OnboardingContext';
import { accountRoleLabel, onboardingRoleLabel } from '../onboarding/content';

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { record, restart } = useOnboarding();
  const navigate = useNavigate();
  const [confirmRestart, setConfirmRestart] = useState(false);
  const selectedRole = onboardingRoleLabel(record?.role);

  function signOut() {
    logout();
    navigate('/login');
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">Account details and the product tour saved in this browser.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Account</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-600">Name</dt>
            <dd className="mt-1 text-sm text-slate-800">{user?.displayName}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-600">Email</dt>
            <dd className="mt-1 text-sm text-slate-800">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-600">Sign-in role</dt>
            <dd className="mt-1 text-sm text-slate-800">{accountRoleLabel(user?.role)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-600">Clinic day</dt>
            <dd className="mt-1 text-sm text-slate-800">America/Toronto</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Sign-in permissions are set on the account. The tour role below does not change them.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Onboarding</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-600">Selected role</dt>
            <dd className="mt-1 text-sm text-slate-800">{selectedRole ?? 'Not selected'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-600">Status</dt>
            <dd className="mt-1 text-sm text-slate-800">
              {record?.completed
                ? record.skippedTour
                  ? 'Completed, tour skipped'
                  : 'Completed'
                : 'Not finished'}
            </dd>
          </div>
          {record?.completedAt && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-600">Saved</dt>
              <dd className="mt-1 text-sm text-slate-800">{formatWhen(record.completedAt)}</dd>
            </div>
          )}
        </dl>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Restart walks through the welcome, role, and product tour again. This clears the saved setup for your account in this browser only.
        </p>
        {confirmRestart ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={restart}
              className="rounded-xl bg-clinical-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-clinical-teal-dark"
            >
              Start again
            </button>
            <button
              type="button"
              onClick={() => setConfirmRestart(false)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmRestart(true)}
            className="mt-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-800 hover:bg-teal-100"
          >
            Restart onboarding
          </button>
        )}
      </section>

      <div className="flex justify-end">
        <button type="button" onClick={signOut} className="text-sm font-medium text-rose-700 hover:text-rose-800">
          Sign out
        </button>
      </div>
    </div>
  );
}
