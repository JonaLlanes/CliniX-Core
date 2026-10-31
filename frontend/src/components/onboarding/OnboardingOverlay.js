import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useOnboarding } from '../../context/OnboardingContext';
import { useFocusTrap } from '../a11y';
import { BuildingIcon, CapsuleIcon, CareIcon, CheckIcon, PulseIcon, UsersIcon, } from '../icons';
import { ONBOARDING_ROLES, TOUR_STEPS, onboardingRoleLabel, } from '../../onboarding/content';
const ROLE_ICONS = {
    physician: CareIcon,
    nurse: PulseIcon,
    admin: BuildingIcon,
    pharmacist: CapsuleIcon,
    caregiver: UsersIcon,
};
const primaryBtn = 'inline-flex items-center justify-center rounded-xl bg-clinical-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-clinical-teal-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clinical-teal disabled:cursor-not-allowed disabled:opacity-50';
const secondaryBtn = 'inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clinical-teal';
const COVERED = ['Dashboard', 'Patient search', 'Schedule', 'Check-in', 'Reports'];
function StepMarks({ index }) {
    return (_jsx("div", { className: "flex items-center gap-1.5", "aria-hidden": "true", children: [0, 1, 2, 3].map((step) => (_jsx("span", { className: `h-1.5 rounded-full transition-all ${step === index ? 'w-6 bg-white' : step < index ? 'w-1.5 bg-teal-200' : 'w-1.5 bg-white/30'}` }, step))) }));
}
function SetupDialog() {
    const { step, role, skippedTour, setRole, next, back, skipSetup, finish } = useOnboarding();
    const dialogRef = useRef(null);
    const stepIndex = step === 'welcome' ? 0 : step === 'role' ? 1 : 3;
    const panelTitle = step === 'welcome' ? 'Welcome' : step === 'role' ? 'Your role' : 'Ready';
    useFocusTrap(true, dialogRef);
    useEffect(() => {
        dialogRef.current?.focus();
    }, [step]);
    return (_jsx("div", { className: "fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]", children: _jsxs("div", { ref: dialogRef, role: "dialog", "aria-modal": "true", "aria-labelledby": "onboarding-title", tabIndex: -1, className: "onboard-card grid max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl outline-none md:grid-cols-[15.5rem_1fr]", children: [_jsxs("div", { className: "bg-gradient-to-br from-teal-800 via-teal-900 to-slate-950 px-6 py-6 text-white md:px-7 md:py-8", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/80", children: "CliniX Core" }), _jsx("p", { className: "mt-6 text-lg font-semibold leading-snug", children: panelTitle }), _jsxs("p", { className: "mt-2 text-sm leading-relaxed text-teal-50/80", children: ["Step ", stepIndex + 1, " of 4"] }), _jsx("div", { className: "mt-5", children: _jsx(StepMarks, { index: stepIndex }) })] }), _jsxs("div", { className: "px-6 py-6 sm:px-8 sm:py-8", children: [step === 'welcome' && (_jsxs(_Fragment, { children: [_jsx("h2", { id: "onboarding-title", className: "text-2xl font-semibold tracking-tight text-slate-900", children: "Welcome to CliniX Core" }), _jsx("p", { className: "mt-3 text-sm leading-relaxed text-slate-600", children: "This workspace is the clinical source of truth for charts, the day schedule, check-in, and clinic reports. A short setup tailors the tour to how you work." }), _jsx("ul", { className: "mt-5 space-y-2", children: COVERED.map((item) => (_jsxs("li", { className: "flex items-center gap-2 text-sm text-slate-700", children: [_jsx("span", { className: "grid h-5 w-5 place-items-center rounded-full bg-teal-50 text-clinical-teal", children: _jsx(CheckIcon, { className: "h-3.5 w-3.5" }) }), item] }, item))) })] })), step === 'role' && (_jsxs(_Fragment, { children: [_jsx("h2", { id: "onboarding-title", className: "text-2xl font-semibold tracking-tight text-slate-900", children: "Select role" }), _jsx("p", { className: "mt-3 text-sm leading-relaxed text-slate-600", children: "Choose the work you do most often. This is saved in this browser and does not change your sign-in permissions." }), _jsxs("fieldset", { className: "mt-5", children: [_jsx("legend", { className: "sr-only", children: "Select role" }), _jsx("div", { className: "space-y-2", children: ONBOARDING_ROLES.map((item) => {
                                                const Icon = ROLE_ICONS[item.id];
                                                const selected = role === item.id;
                                                return (_jsxs("label", { className: `flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-3 transition-colors ${selected
                                                        ? 'border-clinical-teal bg-teal-50/80 ring-1 ring-clinical-teal'
                                                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`, children: [_jsx("input", { type: "radio", name: "clinix-onboarding-role", value: item.id, checked: selected, onChange: () => setRole(item.id), className: "h-4 w-4 accent-teal-700" }), _jsx("span", { className: `grid h-9 w-9 place-items-center rounded-xl ${selected ? 'bg-white text-clinical-teal' : 'bg-slate-100 text-slate-500'}`, children: _jsx(Icon, { className: "h-5 w-5" }) }), _jsxs("span", { children: [_jsx("span", { className: "block text-sm font-semibold text-slate-900", children: item.label }), _jsx("span", { className: "block text-xs text-slate-500", children: item.description })] })] }, item.id));
                                            }) })] })] })), step === 'complete' && (_jsxs(_Fragment, { children: [_jsx("h2", { id: "onboarding-title", className: "text-2xl font-semibold tracking-tight text-slate-900", children: "You're ready for clinic" }), _jsx("p", { className: "mt-3 text-sm leading-relaxed text-slate-600", children: skippedTour
                                        ? 'You skipped the product tour. Setup is saved in this browser, and you can replay it from Settings.'
                                        : 'Setup is saved in this browser. Replay the tour anytime from Settings.' }), onboardingRoleLabel(role) && (_jsxs("p", { className: "mt-4 inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800", children: ["Role \u00B7 ", onboardingRoleLabel(role)] })), _jsx("ul", { className: "mt-5 space-y-2", children: COVERED.map((item) => (_jsxs("li", { className: "flex items-center gap-2 text-sm text-slate-700", children: [_jsx(CheckIcon, { className: "h-4 w-4 text-clinical-teal" }), item] }, item))) })] })), step === 'complete' ? (_jsxs("div", { className: "mt-8 flex flex-col gap-3", children: [_jsxs("div", { className: "flex flex-col gap-2 sm:flex-row", children: [_jsx("button", { type: "button", className: `${primaryBtn} sm:flex-1`, onClick: () => finish('/dashboard'), children: "Go to dashboard" }), _jsx("button", { type: "button", className: `${secondaryBtn} sm:flex-1`, onClick: () => finish('/'), children: "Open patients" })] }), _jsx("button", { type: "button", onClick: back, className: "self-start text-sm font-medium text-slate-500 hover:text-slate-800", children: "Back to tour" })] })) : (_jsxs("div", { className: "mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between", children: [_jsx("button", { type: "button", onClick: skipSetup, className: "text-sm font-medium text-slate-500 hover:text-slate-800", children: "Skip for now" }), _jsxs("div", { className: "flex gap-2", children: [step === 'role' && (_jsx("button", { type: "button", className: secondaryBtn, onClick: back, children: "Back" })), _jsx("button", { type: "button", className: primaryBtn, onClick: next, disabled: step === 'role' && !role, children: "Continue" })] })] }))] })] }) }));
}
function useTourBox(id) {
    const [box, setBox] = useState(null);
    useLayoutEffect(() => {
        let observer = null;
        let timer = 0;
        const update = () => {
            const el = document.querySelector(`[data-tour="${id}"]`);
            if (!el)
                return;
            const rect = el.getBoundingClientRect();
            if (rect.width < 2 || rect.height < 2)
                return;
            setBox((prev) => {
                const next = {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                    viewport: window.innerWidth,
                };
                if (prev &&
                    Math.abs(prev.top - next.top) < 0.5 &&
                    Math.abs(prev.left - next.left) < 0.5 &&
                    Math.abs(prev.width - next.width) < 0.5 &&
                    Math.abs(prev.height - next.height) < 0.5 &&
                    prev.viewport === next.viewport) {
                    return prev;
                }
                return next;
            });
        };
        const attach = () => {
            const el = document.querySelector(`[data-tour="${id}"]`);
            if (!el)
                return false;
            el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            update();
            observer?.disconnect();
            observer = new ResizeObserver(update);
            observer.observe(el);
            return true;
        };
        if (!attach()) {
            timer = window.setInterval(() => {
                if (attach())
                    window.clearInterval(timer);
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
    const dialogRef = useRef(null);
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
    let tipStyle = { left: 16, right: 16, bottom: 16 };
    if (hole && !compact) {
        const width = Math.min(340, window.innerWidth - 24);
        const estimated = 220;
        if (window.innerWidth - (hole.left + hole.width) >= width + 24) {
            tipStyle = {
                width,
                top: Math.max(12, Math.min(hole.top, window.innerHeight - estimated - 12)),
                left: hole.left + hole.width + 14,
            };
        }
        else {
            const left = Math.max(12, Math.min(hole.left, window.innerWidth - width - 12));
            const below = hole.top + hole.height + 14;
            tipStyle =
                below + estimated < window.innerHeight
                    ? { width, top: below, left }
                    : { width, top: Math.max(12, hole.top - estimated - 12), left };
        }
    }
    return (_jsxs("div", { className: "pointer-events-none fixed inset-0 z-[70]", children: [hole ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "pointer-events-auto fixed inset-x-0 top-0 bg-slate-950/55", style: { height: hole.top } }), _jsx("div", { className: "pointer-events-auto fixed inset-x-0 bg-slate-950/55", style: { top: hole.top + hole.height, bottom: 0 } }), _jsx("div", { className: "pointer-events-auto fixed bg-slate-950/55", style: { top: hole.top, left: 0, width: hole.left, height: hole.height } }), _jsx("div", { className: "pointer-events-auto fixed bg-slate-950/55", style: { top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height } }), _jsx("div", { className: "tour-ring pointer-events-none fixed z-[71] rounded-2xl", style: hole })] })) : (_jsx("div", { className: "pointer-events-auto fixed inset-0 bg-slate-950/45" })), _jsxs("div", { ref: dialogRef, role: "dialog", "aria-modal": "false", "aria-labelledby": "tour-title", tabIndex: -1, className: "pointer-events-auto fixed z-[80] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl outline-none", style: compact ? { left: 12, right: 12, bottom: 12 } : tipStyle, children: [_jsxs("p", { className: "text-[11px] font-semibold uppercase tracking-[0.14em] text-clinical-teal", children: ["Product tour \u00B7 ", tourIndex + 1, " of ", TOUR_STEPS.length] }), _jsx("h2", { id: "tour-title", className: "mt-1 text-base font-semibold text-slate-900", children: step.title }), _jsx("p", { className: "mt-1.5 text-sm leading-relaxed text-slate-600", children: step.body }), _jsx("div", { className: "mt-3 h-1 overflow-hidden rounded-full bg-slate-100", children: _jsx("div", { className: "h-full rounded-full bg-clinical-teal", style: { width: `${((tourIndex + 1) / TOUR_STEPS.length) * 100}%` } }) }), _jsxs("div", { className: "mt-4 flex items-center justify-between gap-3", children: [_jsx("button", { type: "button", onClick: skipTour, className: "text-sm font-medium text-slate-500 hover:text-slate-800", children: "Skip tour" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "button", className: secondaryBtn, onClick: back, children: "Back" }), _jsx("button", { type: "button", className: primaryBtn, onClick: next, children: last ? 'Finish' : 'Next' })] })] })] })] }));
}
export default function OnboardingOverlay() {
    const { step } = useOnboarding();
    if (step === 'tour')
        return _jsx(TourSpotlight, {});
    return _jsx(SetupDialog, {});
}
