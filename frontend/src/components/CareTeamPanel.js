import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import Panel from './Panel';
function memberId(member) {
    return typeof member === 'string' ? member : member._id;
}
export default function CareTeamPanel({ members, directory, canEdit, onSave, }) {
    const [selected, setSelected] = useState(() => members.map(memberId));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const memberKey = members.map(memberId).join('|');
    useEffect(() => {
        setSelected(memberKey ? memberKey.split('|') : []);
    }, [memberKey]);
    const known = new Map(directory.map((user) => [user._id, user]));
    for (const member of members) {
        if (typeof member !== 'string' && !known.has(member._id))
            known.set(member._id, member);
    }
    const options = Array.from(known.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
    async function save() {
        setSaving(true);
        setError('');
        try {
            await onSave(selected);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Could not update care team');
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsxs(Panel, { title: "Care team", subtitle: "Only assigned people and administrators can open this chart", children: [error && (_jsx("div", { className: "mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm", children: error })), options.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: "No care team assigned." })) : canEdit ? (_jsxs("div", { className: "space-y-2", children: [options.map((user) => (_jsxs("label", { className: "flex items-center gap-2 text-sm text-gray-700", children: [_jsx("input", { type: "checkbox", checked: selected.includes(user._id), onChange: (event) => {
                                    setSelected((current) => event.target.checked
                                        ? Array.from(new Set([...current, user._id]))
                                        : current.filter((id) => id !== user._id));
                                } }), _jsxs("span", { children: [user.displayName, ' ', _jsxs("span", { className: "text-gray-500", children: ["(", user.role, ")"] })] })] }, user._id))), _jsx("button", { type: "button", onClick: save, disabled: saving, className: "mt-3 px-4 py-2 bg-clinical-teal text-white rounded-lg text-sm hover:bg-clinical-teal-dark disabled:opacity-50", children: saving ? 'Saving...' : 'Save care team' })] })) : (_jsx("ul", { className: "space-y-1 text-sm", children: members.map((member) => {
                    const id = memberId(member);
                    const user = known.get(id);
                    return (_jsxs("li", { children: [user?.displayName || id, user?.role ? _jsxs("span", { className: "text-gray-500", children: [" \u00B7 ", user.role] }) : null] }, id));
                }) }))] }));
}
