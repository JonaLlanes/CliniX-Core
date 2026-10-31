import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

export default function Panel({
  title,
  subtitle,
  link,
  linkLabel = 'View all',
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  link?: string;
  linkLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      {(title || link) && (
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            {title && <h2 className="font-semibold text-gray-900">{title}</h2>}
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {link && (
            <Link to={link} className="text-sm text-clinical-teal hover:underline shrink-0">
              {linkLabel}
            </Link>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export function EmptyState({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm font-medium text-gray-800">{text}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">{hint}</p>}
    </div>
  );
}
