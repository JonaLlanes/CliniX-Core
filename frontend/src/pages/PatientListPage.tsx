import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { patientsApi, type Patient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Panel, { EmptyState } from '../components/Panel';
import { ErrorNotice, RowSkeleton } from '../components/feedback';
import {
  CANADIAN_PROVINCES,
  GENDER_IDENTITIES,
  LANGUAGES,
  RELATIONSHIPS,
  SEX_AT_BIRTH,
  formatAddress,
  patientPayloadFromForm,
} from '../components/canadianRegistration';

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
  const [patients, setPatients] = useState<Patient[]>([]);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
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

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError('');
    const fd = new FormData(e.currentTarget);
    const payload = patientPayloadFromForm(fd);
    try {
      await patientsApi.create(payload);
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Create failed');
    }
  }

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Patients</h1>
          <p className="text-gray-600 mt-1">
            {patients.length} chart{patients.length === 1 ? '' : 's'} · Canadian registration ·
            source of truth for CliniX Insight
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            aria-expanded={showForm}
            aria-controls="new-patient-form"
            onClick={() => setShowForm((s) => !s)}
            className="px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark"
          >
            {showForm ? 'Cancel' : 'New patient'}
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div>
          <label htmlFor="patient-quick" className="sr-only">
            Quick search by MRN, name, or health card
          </label>
          <input
            id="patient-quick"
            type="search"
            placeholder="Quick search (MRN, name, HCN)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="patient-mrn" className="sr-only">
            MRN
          </label>
          <input
            id="patient-mrn"
            type="text"
            placeholder="MRN"
            value={mrn}
            onChange={(e) => setMrn(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="patient-hcn" className="sr-only">
            Health card number
          </label>
          <input
            id="patient-hcn"
            type="text"
            placeholder="Health card number"
            value={healthCardNumber}
            onChange={(e) => setHealthCardNumber(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="patient-name" className="sr-only">
            Name
          </label>
          <input
            id="patient-name"
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="patient-dob" className="sr-only">
            Date of birth
          </label>
          <input
            id="patient-dob"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorNotice title="Patients could not be loaded" message={error} onRetry={() => void load()} />
        </div>
      )}

      {showForm && (
        <form
          id="new-patient-form"
          onSubmit={onCreate}
          className="bg-white rounded-lg border border-gray-200 p-6 mb-6 space-y-6"
        >
          {formError && (
            <div role="alert" className="bg-red-50 border border-red-200 text-red-900 px-4 py-2 rounded text-sm">
              {formError}
            </div>
          )}

          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Identity</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="MRN" name="mrn" required />
              <Field label="Legal given name" name="givenName" required />
              <Field label="Legal family name" name="familyName" required />
              <Field label="Preferred name" name="preferredName" />
              <div>
                <label htmlFor="birthDate" className={labelCls}>
                  Date of birth
                </label>
                <input id="birthDate" name="birthDate" type="date" required className={inputCls} />
              </div>
              <SelectField label="Language" name="language" options={LANGUAGES} defaultValue="en" />
              <SelectField
                label="Sex at birth"
                name="sex"
                options={SEX_AT_BIRTH}
                defaultValue="unknown"
              />
              <SelectField
                label="Gender identity"
                name="genderIdentity"
                options={GENDER_IDENTITIES}
                defaultValue="unknown"
              />
              <Field label="Phone" name="phone" />
              <Field label="Email" name="email" type="email" />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Provincial health</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="healthProvince" className={labelCls}>
                  Issuing province
                </label>
                <select
                  id="healthProvince"
                  name="healthProvince"
                  value={healthProvince}
                  onChange={(e) => setHealthProvince(e.target.value)}
                  className={inputCls}
                >
                  {CANADIAN_PROVINCES.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.label} ({p.code})
                    </option>
                  ))}
                </select>
              </div>
              <Field label="Health card number" name="healthCardNumber" />
              {healthProvince === 'ON' && (
                <Field label="Version code" name="versionCode" placeholder="e.g. AB" />
              )}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Address</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Field label="Street" name="street" />
              </div>
              <Field label="City" name="city" />
              <SelectField
                label="Province"
                name="addrProvince"
                options={CANADIAN_PROVINCES.map((p) => ({ code: p.code, label: p.code }))}
                defaultValue="ON"
              />
              <Field label="Postal code" name="postalCode" placeholder="K1A 0B1" />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Emergency contact</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Field label="Name" name="emergencyName" />
              <SelectField
                label="Relationship"
                name="emergencyRelationship"
                options={RELATIONSHIPS.map((r) => ({ code: r, label: r }))}
                allowEmpty
              />
              <Field label="Phone" name="emergencyPhone" />
              <Field label="Secondary phone" name="emergencyPhoneSecondary" />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Substitute decision maker
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Field label="Name" name="sdmName" />
              <SelectField
                label="Relationship"
                name="sdmRelationship"
                options={RELATIONSHIPS.map((r) => ({ code: r, label: r }))}
                allowEmpty
              />
              <Field label="Phone" name="sdmPhone" />
              <Field label="Secondary phone" name="sdmPhoneSecondary" />
            </div>
          </section>

          <div>
            <button
              type="submit"
              className="px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark"
            >
              Create
            </button>
          </div>
        </form>
      )}

      <Panel className="min-w-0 overflow-hidden">
        {loading ? (
          <RowSkeleton rows={6} label="Loading patients" />
        ) : error && patients.length === 0 ? null : patients.length === 0 ? (
          <EmptyState
            text={q || mrn || healthCardNumber || name || birthDate ? 'No patients match this search' : 'No patients registered'}
            hint={
              q || mrn || healthCardNumber || name || birthDate
                ? 'Try a different name, MRN, health card number, or date of birth.'
                : 'Register a patient to open a chart.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="sr-only">Patient charts</caption>
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 border-b border-gray-200">
                  <th className="pb-3 pr-4">MRN</th>
                  <th className="pb-3 pr-4">Legal name</th>
                  <th className="pb-3 pr-4">Preferred</th>
                  <th className="pb-3 pr-4">DOB</th>
                  <th className="pb-3 pr-4">Health card</th>
                  <th className="pb-3 pr-4">Address</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {patients.map((p) => (
                  <tr key={p._id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 font-medium text-gray-900">{p.mrn}</td>
                    <td className="py-3 pr-4">
                      {p.familyName}, {p.givenName}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">{p.preferredName || '—'}</td>
                    <td className="py-3 pr-4 text-gray-600">{p.birthDate?.slice(0, 10)}</td>
                    <td className="py-3 pr-4 text-gray-600">
                      {p.provincialHealth
                        ? `${p.provincialHealth.province} ${p.provincialHealth.healthCardNumber}${
                            p.provincialHealth.versionCode
                              ? `-${p.provincialHealth.versionCode}`
                              : ''
                          }`
                        : '—'}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 max-w-[12rem] truncate">
                      {formatAddress(p.address) || p.contact?.address || '—'}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        to={`/patients/${p._id}`}
                        className="text-clinical-teal hover:underline font-medium"
                      >
                        Open chart
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className={labelCls}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className={inputCls}
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
  defaultValue,
  allowEmpty,
}: {
  label: string;
  name: string;
  options: ReadonlyArray<{ code: string; label: string }>;
  defaultValue?: string;
  allowEmpty?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className={labelCls}>
        {label}
      </label>
      <select id={name} name={name} defaultValue={defaultValue ?? ''} className={inputCls}>
        {allowEmpty && <option value="">—</option>}
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
