import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useOnboarding } from '../../context/OnboardingContext';
import { useFocusTrap } from '../a11y';
import {
  BuildingIcon,
  CapsuleIcon,
  CareIcon,
  CheckIcon,
  PulseIcon,
  UsersIcon,
} from '../icons';
import {
  ONBOARDING_ROLES,
  TOUR_STEPS,
  onboardingRoleLabel,
  type OnboardingRole,
} from '../../onboarding/content';

const ROLE_ICONS: Record<OnboardingRole, typeof CareIcon> = {
  physician: CareIcon,
  nurse: PulseIcon,
  admin: BuildingIcon,
  pharmacist: CapsuleIcon,
  caregiver: UsersIcon,
};

const primaryBtn =
  'inline-flex items-center justify-center rounded-xl bg-clinical-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-clinical-teal-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clinical-teal disabled:cursor-not-allowed disabled:opacity-50';
const secondaryBtn =
  'inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clinical-teal';

const COVERED = ['Dashboard', 'Patient search', 'Schedule', 'Check-in', 'Reports'];

function StepMarks({ index }: { index: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {[0, 1, 2, 3].map((step) => (
        <span
          key={step}
          className={`h-1.5 rounded-full transition-all ${
            step === index ? 'w-6 bg-white' : step < index ? 'w-1.5 bg-teal-200' : 'w-1.5 bg-white/30'
          }`}
        />
      ))}
    </div>
  );
}

function SetupDialog() {
  const { step, role, skippedTour, setRole, next, back, skipSetup, finish } = useOnboarding();
  const dialogRef = useRef<HTMLDivElement>(null);
  const stepIndex = step === 'welcome' ? 0 : step === 'role' ? 1 : 3;
  const panelTitle = step === 'welcome' ? 'Welcome' : step === 'role' ? 'Your role' : 'Ready';
  useFocusTrap(true, dialogRef);

  useEffect(() => {
    dialogRef.current?.focus();
  }, [step]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        tabIndex={-1}
        className="onboard-card grid max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl outline-none md:grid-cols-[15.5rem_1fr]"
      >
        <div className="bg-gradient-to-br from-teal-800 via-teal-900 to-slate-950 px-6 py-6 text-white md:px-7 md:py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/80">CliniX Core</p>
          <p className="mt-6 text-lg font-semibold leading-snug">{panelTitle}</p>
          <p className="mt-2 text-sm leading-relaxed text-teal-50/80">
            Step {stepIndex + 1} of 4
          </p>
          <div className="mt-5">
            <StepMarks index={stepIndex} />
          </div>
        </div>

        <div className="px-6 py-6 sm:px-8 sm:py-8">
          {step === 'welcome' && (
            <>
              <h2 id="onboarding-title" className="text-2xl font-semibold tracking-tight text-slate-900">
                Welcome to CliniX Core
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                This workspace is the clinical source of truth for charts, the day schedule, check-in, and clinic reports.
                A short setup tailors the tour to how you work.
              </p>
              <ul className="mt-5 space-y-2">
                {COVERED.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-teal-50 text-clinical-teal">
                      <CheckIcon className="h-3.5 w-3.5" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </>
          )}

          {step === 'role' && (
            <>
              <h2 id="onboarding-title" className="text-2xl font-semibold tracking-tight text-slate-900">
                Select role
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Choose the work you do most often. This is saved in this browser and does not change your sign-in permissions.
              </p>
              <fieldset className="mt-5">
                <legend className="sr-only">Select role</legend>
                <div className="space-y-2">
                  {ONBOARDING_ROLES.map((item) => {
                    const Icon = ROLE_ICONS[item.id];
                    const selected = role === item.id;
                    return (
                      <label
                        key={item.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-3 transition-colors ${
                          selected
                            ? 'border-clinical-teal bg-teal-50/80 ring-1 ring-clinical-teal'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="clinix-onboarding-role"
                          value={item.id}
                          checked={selected}
                          onChange={() => setRole(item.id)}
                          className="h-4 w-4 accent-teal-700"
                        />
                        <span className={`grid h-9 w-9 place-items-center rounded-xl ${selected ? 'bg-white text-clinical-teal' : 'bg-slate-100 text-slate-500'}`}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-slate-900">{item.label}</span>
                          <span className="block text-xs text-slate-500">{item.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </>
          )}

          {step === 'complete' && (
            <>
              <h2 id="onboarding-title" className="text-2xl font-semibold tracking-tight text-slate-900">
                You're ready for clinic
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {skippedTour
                  ? 'You skipped the product tour. Setup is saved in this browser, and you can replay it from Settings.'
                  : 'Setup is saved in this browser. Replay the tour anytime from Settings.'}
              </p>
              {onboardingRoleLabel(role) && (
                <p className="mt-4 inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800">
                  Role · {onboardingRoleLabel(role)}
                </p>
              )}
              <ul className="mt-5 space-y-2">
                {COVERED.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckIcon className="h-4 w-4 text-clinical-teal" />
                    {item}
                  </li>
                ))}
              </ul>
            </>
          )}

          {step === 'complete' ? (
            <div className="mt-8 flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" className={`${primaryBtn} sm:flex-1`} onClick={() => finish('/dashboard')}>
                  Go to dashboard
                </button>
                <button type="button" className={`${secondaryBtn} sm:flex-1`} onClick={() => finish('/')}>
                  Open patients
                </button>
              </div>
              <button type="button" onClick={back} className="self-start text-sm font-medium text-slate-500 hover:text-slate-800">
                Back to tour
              </button>
            </div>
          ) : (
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={skipSetup} className="text-sm font-medium text-slate-500 hover:text-slate-800">
                Skip for now
              </button>
              <div className="flex gap-2">
                {step === 'role' && (
                  <button type="button" className={secondaryBtn} onClick={back}>
                    Back
                  </button>
                )}
                <button type="button" className={primaryBtn} onClick={next} disabled={step === 'role' && !role}>
                  Continue
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function useTourBox(id: string) {
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number; viewport: number } | null>(null);

  useLayoutEffect(() => {
    let observer: ResizeObserver | null = null;
    let timer = 0;

    const update = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${id}"]`);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      setBox((prev) => {
        const next = {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          viewport: window.innerWidth,
        };
        if (
          prev &&
          Math.abs(prev.top - next.top) < 0.5 &&
          Math.abs(prev.left - next.left) < 0.5 &&
          Math.abs(prev.width - next.width) < 0.5 &&
          Math.abs(prev.height - next.height) < 0.5 &&
          prev.viewport === next.viewport
        ) {
          return prev;
        }
        return next;
      });
    };

    const attach = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${id}"]`);
      if (!el) return false;
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      update();
      observer?.disconnect();
      observer = new ResizeObserver(update);
      observer.observe(el);
      return true;
    };

    if (!attach()) {
      timer = window.setInterval(() => {
        if (attach()) window.clearInterval(timer);
      }, 50);
    }
    const stop = window.setTimeout(() => window.clearInterval(timer), 1500);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      observer?.disconnect();
      window.clearInterval(timer);
      window.clearTimeout(stop);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [id]);

  return box;
}

function TourSpotlight() {
  const { tourIndex, next, back, skipTour } = useOnboarding();
  const navigate = useNavigate();
  const location = useLocation();
  const step = TOUR_STEPS[tourIndex];
  const box = useTourBox(step.id);
  const last = tourIndex === TOUR_STEPS.length - 1;
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, dialogRef);

  useEffect(() => {
    if (location.pathname !== step.to) {
      navigate(step.to, { replace: true });
    }
  }, [location.pathname, navigate, step.to]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, [tourIndex]);

  const pad = 6;
  const hole = box
    ? {
        top: Math.max(8, box.top - pad),
        left: Math.max(8, box.left - pad),
        width: box.width + pad * 2,
        height: box.height + pad * 2,
      }
    : null;

  const compact = (box?.viewport ?? window.innerWidth) < 640;
  let tipStyle: CSSProperties = { left: 16, right: 16, bottom: 16 };
  if (hole && !compact) {
    const width = Math.min(340, window.innerWidth - 24);
    const estimated = 220;
    if (window.innerWidth - (hole.left + hole.width) >= width + 24) {
      tipStyle = {
        width,
        top: Math.max(12, Math.min(hole.top, window.innerHeight - estimated - 12)),
        left: hole.left + hole.width + 14,
      };
    } else {
      const left = Math.max(12, Math.min(hole.left, window.innerWidth - width - 12));
      const below = hole.top + hole.height + 14;
      tipStyle =
        below + estimated < window.innerHeight
          ? { width, top: below, left }
          : { width, top: Math.max(12, hole.top - estimated - 12), left };
    }
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]">
      {hole ? (
        <>
          <div className="pointer-events-auto fixed inset-x-0 top-0 bg-slate-950/55" style={{ height: hole.top }} />
          <div className="pointer-events-auto fixed inset-x-0 bg-slate-950/55" style={{ top: hole.top + hole.height, bottom: 0 }} />
          <div className="pointer-events-auto fixed bg-slate-950/55" style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }} />
          <div
            className="pointer-events-auto fixed bg-slate-950/55"
            style={{ top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height }}
          />
          <div className="tour-ring pointer-events-none fixed z-[71] rounded-2xl" style={hole} />
        </>
      ) : (
        <div className="pointer-events-auto fixed inset-0 bg-slate-950/45" />
      )}

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        tabIndex={-1}
        className="pointer-events-auto fixed z-[80] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl outline-none"
        style={compact ? { left: 12, right: 12, bottom: 12 } : tipStyle}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-clinical-teal">
          Product tour · {tourIndex + 1} of {TOUR_STEPS.length}
        </p>
        <h2 id="tour-title" className="mt-1 text-base font-semibold text-slate-900">
          {step.title}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.body}</p>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-clinical-teal"
            style={{ width: `${((tourIndex + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" onClick={skipTour} className="text-sm font-medium text-slate-500 hover:text-slate-800">
            Skip tour
          </button>
          <div className="flex gap-2">
            <button type="button" className={secondaryBtn} onClick={back}>
              Back
            </button>
            <button type="button" className={primaryBtn} onClick={next}>
              {last ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingOverlay() {
  const { step } = useOnboarding();
  if (step === 'tour') return <TourSpotlight />;
  return <SetupDialog />;
}
