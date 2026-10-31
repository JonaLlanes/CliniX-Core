import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthUser } from '../api/client';
import {
  TOUR_STEPS,
  suggestedOnboardingRole,
  type OnboardingRole,
} from '../onboarding/content';
import {
  clearOnboarding,
  readOnboarding,
  writeOnboarding,
  type OnboardingRecord,
} from '../onboarding/storage';

export type OnboardingStep = 'welcome' | 'role' | 'tour' | 'complete';

interface Session {
  active: boolean;
  step: OnboardingStep;
  tourIndex: number;
  role: OnboardingRole | null;
  skippedTour: boolean;
  record: OnboardingRecord | null;
}

interface OnboardingState {
  active: boolean;
  step: OnboardingStep;
  tourIndex: number;
  role: OnboardingRole | null;
  skippedTour: boolean;
  record: OnboardingRecord | null;
  setRole: (role: OnboardingRole) => void;
  next: () => void;
  back: () => void;
  skipSetup: () => void;
  skipTour: () => void;
  finish: (destination?: string) => void;
  restart: () => void;
}

const OnboardingContext = createContext<OnboardingState | null>(null);

function createSession(user: AuthUser): Session {
  const saved = readOnboarding(user.id);
  if (saved?.completed) {
    return {
      active: false,
      step: 'welcome',
      tourIndex: 0,
      role: saved.role,
      skippedTour: saved.skippedTour,
      record: saved,
    };
  }
  return {
    active: true,
    step: 'welcome',
    tourIndex: 0,
    role: suggestedOnboardingRole(user.role),
    skippedTour: false,
    record: null,
  };
}

function stamp(role: OnboardingRole | null, skippedTour: boolean, completedAt?: string): OnboardingRecord {
  return {
    completed: true,
    role,
    skippedTour,
    completedAt: completedAt ?? new Date().toISOString(),
  };
}

export function OnboardingProvider({ user, children }: { user: AuthUser; children: ReactNode }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session>(() => createSession(user));

  const setRole = useCallback((role: OnboardingRole) => {
    setSession((current) => ({ ...current, role }));
  }, []);

  const next = useCallback(() => {
    setSession((current) => {
      if (current.step === 'welcome') return { ...current, step: 'role' };
      if (current.step === 'role') {
        if (!current.role) return current;
        return { ...current, step: 'tour', tourIndex: 0 };
      }
      if (current.step === 'tour') {
        if (current.tourIndex < TOUR_STEPS.length - 1) {
          return { ...current, tourIndex: current.tourIndex + 1 };
        }
        const record = writeOnboarding(user.id, stamp(current.role, false, current.record?.completedAt));
        return { ...current, step: 'complete', skippedTour: false, record };
      }
      return current;
    });
  }, [user.id]);

  const back = useCallback(() => {
    setSession((current) => {
      if (current.step === 'role') return { ...current, step: 'welcome' };
      if (current.step === 'complete') {
        clearOnboarding(user.id);
        return {
          ...current,
          active: true,
          record: null,
          skippedTour: false,
          step: 'tour',
          tourIndex: TOUR_STEPS.length - 1,
        };
      }
      if (current.step === 'tour') {
        if (current.tourIndex === 0) return { ...current, step: 'role' };
        return { ...current, tourIndex: current.tourIndex - 1 };
      }
      return current;
    });
  }, [user.id]);

  const skipSetup = useCallback(() => {
    setSession((current) => {
      const role = current.step === 'welcome' ? null : current.role;
      const record = writeOnboarding(user.id, stamp(role, true));
      return { ...current, active: false, role, skippedTour: true, record };
    });
  }, [user.id]);

  const skipTour = useCallback(() => {
    setSession((current) => {
      const record = writeOnboarding(user.id, stamp(current.role, true, current.record?.completedAt));
      return { ...current, active: true, step: 'complete', skippedTour: true, record };
    });
  }, [user.id]);

  const finish = useCallback(
    (destination = '/dashboard') => {
      setSession((current) => {
        const record = writeOnboarding(
          user.id,
          stamp(current.role, current.skippedTour, current.record?.completedAt)
        );
        return { ...current, active: false, record };
      });
      navigate(destination, { replace: true });
    },
    [navigate, user.id]
  );

  const restart = useCallback(() => {
    clearOnboarding(user.id);
    setSession({
      active: true,
      step: 'welcome',
      tourIndex: 0,
      role: suggestedOnboardingRole(user.role),
      skippedTour: false,
      record: null,
    });
  }, [user.id, user.role]);

  const value = useMemo<OnboardingState>(
    () => ({
      active: session.active,
      step: session.step,
      tourIndex: session.tourIndex,
      role: session.role,
      skippedTour: session.skippedTour,
      record: session.record,
      setRole,
      next,
      back,
      skipSetup,
      skipTour,
      finish,
      restart,
    }),
    [session, setRole, next, back, skipSetup, skipTour, finish, restart]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding outside OnboardingProvider');
  return ctx;
}
