import { useEffect } from 'react';
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
export function useFocusTrap(active, ref) {
    useEffect(() => {
        if (!active)
            return;
        const root = ref.current;
        if (!root)
            return;
        function onKey(event) {
            if (event.key !== 'Tab' || !root)
                return;
            const nodes = [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.getAttribute('aria-hidden') !== 'true');
            if (nodes.length === 0) {
                event.preventDefault();
                return;
            }
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            const current = document.activeElement;
            const inside = current instanceof Node && root.contains(current);
            if (event.shiftKey && (!inside || current === first)) {
                event.preventDefault();
                last.focus();
            }
            else if (!event.shiftKey && (!inside || current === last)) {
                event.preventDefault();
                first.focus();
            }
        }
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [active, ref]);
}
