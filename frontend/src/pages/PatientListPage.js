import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { patientsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Panel, { EmptyState } from '../components/Panel';
import { ErrorNotice, RowSkeleton } from '../components/feedback';
import { CANADIAN_PROVINCES, GENDER_IDENTITIES, LANGUAGES, RELATIONSHIPS, SEX_AT_BIRTH, formatAddress, patientPayloadFromForm, } from '../components/canadianRegistration';
const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';
export default function PatientListPage() {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const urlQuery = searchParams.get('q') ?? '';
    const [q, setQ] = useState(urlQuery);
    const [mrn, setMrn] = useState('');
    const [healthCardNumber, setHealthCardNumber] = useState('');
    const [name, setName] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [patients, setPatients] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formError, setFormError] = useState('');
    const [healthProvince, setHealthProvince] = useState('ON');
    const canWrite = user && ['clinician', 'nurse', 'admin'].includes(user.role);
    async function load() {
        setLoading(true);
        try {
            const res = await patientsApi.list({
                q: q || undefined,
                mrn: mrn || undefined,
                healthCardNumber: healthCardNumber || undefined,
                name: name || undefined,
                birthDate: birthDate || undefined,
            });
            setPatients(res.data);
            setError('');
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load');
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        setQ(urlQuery);
    }, [urlQuery]);
    useEffect(() => {
        const timer = setTimeout(() => load(), q || mrn || healthCardNumber || name || birthDate ? 300 : 0);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q, mrn, healthCardNumber, name, birthDate]);
    async function onCreate(e) {
        e.preventDefault();
        setFormError('');
        const fd = new FormData(e.currentTarget);
        const payload = patientPayloadFromForm(fd);
        try {
            await patientsApi.create(payload);
            setShowForm(false);
            await load();
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : 'Create failed');
        }
    }
    return (_jsxs(_Fragment, { children: [_jsxs("header", { className: "flex flex-wrap items-start justify-between gap-4 mb-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold tracking-tight text-slate-950", children: "Patients" }), _jsxs("p", { className: "text-gray-600 mt-1", children: [patients.length, " chart", patients.length === 1 ? '' : 's', " \u00B7 Canadian registration \u00B7 source of truth for CliniX Insight"] })] }), canWrite && (_jsx("button", { type: "button", "aria-expanded": showForm, "aria-controls": "new-patient-form", onClick: () => setShowForm((s) => !s), className: "px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark", children: showForm ? 'Cancel' : 'New patient' }))] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "patient-quick", className: "sr-only", children: "Quick search by MRN, name, or health card" }), _jsx("input", { id: "patient-quick", type: "search", placeholder: "Quick search (MRN, name, HCN)", value: q, onChange: (e) => setQ(e.target.value), className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "patient-mrn", className: "sr-only", children: "MRN" }), _jsx("input", { id: "patient-mrn", type: "text", placeholder: "MRN", value: mrn, onChange: (e) => setMrn(e.target.value), className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "patient-hcn", className: "sr-only", children: "Health card number" }), _jsx("input", { id: "patient-hcn", type: "text", placeholder: "Health card number", value: healthCardNumber, onChange: (e) => setHealthCardNumber(e.target.value), className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "patient-name", className: "sr-only", children: "Name" }), _jsx("input", { id: "patient-name", type: "text", placeholder: "Name", value: name, onChange: (e) => setName(e.target.value), className: inputCls })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "patient-dob", className: "sr-only", children: "Date of birth" }), _jsx("input", { id: "patient-dob", type: "date", value: birthDate, onChange: (e) => setBirthDate(e.target.value), className: inputCls })] })] }), error && (_jsx("div", { className: "mb-4", children: _jsx(ErrorNotice, { title: "Patients could not be loaded", message: error, onRetry: () => void load() }) })), showForm && (_jsxs("form", { id: "new-patient-form", onSubmit: onCreate, className: "bg-white rounded-lg border border-gray-200 p-6 mb-6 space-y-6", children: [formError && (_jsx("div", { role: "alert", className: "bg-red-50 border border-red-200 text-red-900 px-4 py-2 rounded text-sm", children: formError })), _jsxs("section", { children: [_jsx("h2", { className: "text-sm font-semibold text-gray-900 mb-3", children: "Identity" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsx(Field, { label: "MRN", name: "mrn", required: true }), _jsx(Field, { label: "Legal given name", name: "givenName", required: true }), _jsx(Field, { label: "Legal family name", name: "familyName", required: true }), _jsx(Field, { label: "Preferred name", name: "preferredName" }), _jsxs("div", { children: [_jsx("label", { htmlFor: "birthDate", className: labelCls, children: "Date of birth" }), _jsx("input", { id: "birthDate", name: "birthDate", type: "date", required: true, className: inputCls })] }), _jsx(SelectField, { label: "Language", name: "language", options: LANGUAGES, defaultValue: "en" }), _jsx(SelectField, { label: "Sex at birth", name: "sex", options: SEX_AT_BIRTH, defaultValue: "unknown" }), _jsx(SelectField, { label: "Gender identity", name: "genderIdentity", options: GENDER_IDENTITIES, defaultValue: "unknown" }), _jsx(Field, { label: "Phone", name: "phone" }), _jsx(Field, { label: "Email", name: "email", type: "email" })] })] }), _jsxs("section", { children: [_jsx("h2", { className: "text-sm font-semibold text-gray-900 mb-3", children: "Provincial health" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "healthProvince", className: labelCls, children: "Issuing province" }), _jsx("select", { id: "healthProvince", name: "healthProvince", value: healthProvince, onChange: (e) => setHealthProvince(e.target.value), className: inputCls, children: CANADIAN_PROVINCES.map((p) => (_jsxs("option", { value: p.code, children: [p.label, " (", p.code, ")"] }, p.code))) })] }), _jsx(Field, { label: "Health card number", name: "healthCardNumber" }), healthProvince === 'ON' && (_jsx(Field, { label: "Version code", name: "versionCode", placeholder: "e.g. AB" }))] })] }), _jsxs("section", { children: [_jsx("h2", { className: "text-sm font-semibold text-gray-900 mb-3", children: "Address" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsx("div", { className: "md:col-span-2", children: _jsx(Field, { label: "Street", name: "street" }) }), _jsx(Field, { label: "City", name: "city" }), _jsx(SelectField, { label: "Province", name: "addrProvince", options: CANADIAN_PROVINCES.map((p) => ({ code: p.code, label: p.code })), defaultValue: "ON" }), _jsx(Field, { label: "Postal code", name: "postalCode", placeholder: "K1A 0B1" })] })] }), _jsxs("section", { children: [_jsx("h2", { className: "text-sm font-semibold text-gray-900 mb-3", children: "Emergency contact" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-4", children: [_jsx(Field, { label: "Name", name: "emergencyName" }), _jsx(SelectField, { label: "Relationship", name: "emergencyRelationship", options: RELATIONSHIPS.map((r) => ({ code: r, label: r })), allowEmpty: true }), _jsx(Field, { label: "Phone", name: "emergencyPhone" }), _jsx(Field, { label: "Secondary phone", name: "emergencyPhoneSecondary" })] })] }), _jsxs("section", { children: [_jsx("h2", { className: "text-sm font-semibold text-gray-900 mb-3", children: "Substitute decision maker" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-4", children: [_jsx(Field, { label: "Name", name: "sdmName" }), _jsx(SelectField, { label: "Relationship", name: "sdmRelationship", options: RELATIONSHIPS.map((r) => ({ code: r, label: r })), allowEmpty: true }), _jsx(Field, { label: "Phone", name: "sdmPhone" }), _jsx(Field, { label: "Secondary phone", name: "sdmPhoneSecondary" })] })] }), _jsx("div", { children: _jsx("button", { type: "submit", className: "px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark", children: "Create" }) })] })), _jsx(Panel, { className: "min-w-0 overflow-hidden", children: loading ? (_jsx(RowSkeleton, { rows: 6, label: "Loading patients" })) : error && patients.length === 0 ? null : patients.length === 0 ? (_jsx(EmptyState, { text: q || mrn || healthCardNumber || name || birthDate ? 'No patients match this search' : 'No patients registered', hint: q || mrn || healthCardNumber || name || birthDate
                        ? 'Try a different name, MRN, health card number, or date of birth.'
                        : 'Register a patient to open a chart.' })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full min-w-[36rem] text-sm", children: [_jsx("caption", { className: "sr-only", children: "Patient charts" }), _jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs font-medium text-gray-500 border-b border-gray-200", children: [_jsx("th", { className: "pb-3 pr-4", children: "MRN" }), _jsx("th", { className: "pb-3 pr-4", children: "Legal name" }), _jsx("th", { className: "pb-3 pr-4", children: "Preferred" }), _jsx("th", { className: "pb-3 pr-4", children: "DOB" }), _jsx("th", { className: "pb-3 pr-4", children: "Health card" }), _jsx("th", { className: "pb-3 pr-4", children: "Address" }), _jsx("th", { className: "pb-3" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-100", children: patients.map((p) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "py-3 pr-4 font-medium text-gray-900", children: p.mrn }), _jsxs("td", { className: "py-3 pr-4", children: [p.familyName, ", ", p.givenName] }), _jsx("td", { className: "py-3 pr-4 text-gray-600", children: p.preferredName || '—' }), _jsx("td", { className: "py-3 pr-4 text-gray-600", children: p.birthDate?.slice(0, 10) }), _jsx("td", { className: "py-3 pr-4 text-gray-600", children: p.provincialHealth
                                                ? `${p.provincialHealth.province} ${p.provincialHealth.healthCardNumber}${p.provincialHealth.versionCode
                                                    ? `-${p.provincialHealth.versionCode}`
                                                    : ''}`
                                                : '—' }), _jsx("td", { className: "py-3 pr-4 text-gray-600 max-w-[12rem] truncate", children: formatAddress(p.address) || p.contact?.address || '—' }), _jsx("td", { className: "py-3 text-right", children: _jsx(Link, { to: `/patients/${p._id}`, className: "text-clinical-teal hover:underline font-medium", children: "Open chart" }) })] }, p._id))) })] }) })) })] }));
}
function Field({ label, name, type = 'text', required, placeholder, }) {
    return (_jsxs("div", { children: [_jsx("label", { htmlFor: name, className: labelCls, children: label }), _jsx("input", { id: name, name: name, type: type, required: required, placeholder: placeholder, className: inputCls })] }));
}
function SelectField({ label, name, options, defaultValue, allowEmpty, }) {
    return (_jsxs("div", { children: [_jsx("label", { htmlFor: name, className: labelCls, children: label }), _jsxs("select", { id: name, name: name, defaultValue: defaultValue ?? '', className: inputCls, children: [allowEmpty && _jsx("option", { value: "", children: "\u2014" }), options.map((o) => (_jsx("option", { value: o.code, children: o.label }, o.code)))] })] }));
}
