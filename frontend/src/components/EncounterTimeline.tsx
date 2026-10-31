import type { DisplayTimelineEvent } from '../api/client';
import { formatEncounterWhen } from './encounterDisplay';

export default function EncounterTimeline({ events }: { events: DisplayTimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-gray-500">No encounter events yet.</p>;
  }
  return (
    <ol className="space-y-3">
      {events.map((event, index) => (
        <li key={`${event.kind}-${event.at}-${index}`} className="flex gap-3 text-sm">
          <div className="w-36 shrink-0 text-gray-500">{formatEncounterWhen(event.at)}</div>
          <div>
            <div className="font-medium text-gray-900">{event.label}</div>
            {event.detail && <div className="text-gray-600">{event.detail}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
