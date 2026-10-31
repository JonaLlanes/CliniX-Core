import type { Allergy } from '../api/client';

function AlertMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M8 1.8 14.5 14H1.5L8 1.8z" strokeLinejoin="round" />
      <path d="M8 6.2v3.4" strokeLinecap="round" />
      <path d="M8 11.6h.01" strokeLinecap="round" />
    </svg>
  );
}

export default function AllergyBanner({ allergies }: { allergies: Allergy[] }) {
  const active = allergies.filter((allergy) => allergy.status === 'active');

  if (active.length === 0) {
    return (
      <div className="mb-6 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700" role="status">
        No active allergies on file
      </div>
    );
  }

  const severe = active.some((allergy) => allergy.severity === 'severe');

  return (
    <div
      className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3"
      role={severe ? 'alert' : 'status'}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-red-900">
        <AlertMark />
        {severe ? 'Severe allergy' : 'Allergies'}
      </div>
      <ul className="mt-1 space-y-1 text-sm text-red-950">
        {active.map((allergy) => (
          <li key={allergy._id}>
            <span className="font-medium">{allergy.substance}</span>
            {' — '}
            {allergy.reaction}
            <span className="font-semibold text-red-900"> ({allergy.severity})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
