import { useEffect, useState } from 'react';
import type { CareTeamMember } from '../api/client';
import Panel from './Panel';

function memberId(member: CareTeamMember | string) {
  return typeof member === 'string' ? member : member._id;
}

export default function CareTeamPanel({
  members,
  directory,
  canEdit,
  onSave,
}: {
  members: Array<CareTeamMember | string>;
  directory: CareTeamMember[];
  canEdit: boolean;
  onSave: (ids: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>(() => members.map(memberId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const memberKey = members.map(memberId).join('|');

  useEffect(() => {
    setSelected(memberKey ? memberKey.split('|') : []);
  }, [memberKey]);

  const known = new Map(directory.map((user) => [user._id, user]));
  for (const member of members) {
    if (typeof member !== 'string' && !known.has(member._id)) known.set(member._id, member);
  }
  const options = Array.from(known.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

  async function save() {
    setSaving(true);
    setError('');
    try {
      await onSave(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update care team');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Care team" subtitle="Only assigned people and administrators can open this chart">
      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}
      {options.length === 0 ? (
        <p className="text-sm text-gray-500">No care team assigned.</p>
      ) : canEdit ? (
        <div className="space-y-2">
          {options.map((user) => (
            <label key={user._id} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={selected.includes(user._id)}
                onChange={(event) => {
                  setSelected((current) =>
                    event.target.checked
                      ? Array.from(new Set([...current, user._id]))
                      : current.filter((id) => id !== user._id)
                  );
                }}
              />
              <span>
                {user.displayName}{' '}
                <span className="text-gray-500">({user.role})</span>
              </span>
            </label>
          ))}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="mt-3 px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save care team'}
          </button>
        </div>
      ) : (
        <ul className="space-y-1 text-sm">
          {members.map((member) => {
            const id = memberId(member);
            const user = known.get(id);
            return (
              <li key={id}>
                {user?.displayName || id}
                {user?.role ? <span className="text-gray-500"> · {user.role}</span> : null}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
