/**
 * Placeholder Page — for screens owned by Person B or C.
 */

export function PlaceholderPage({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="bg-white border border-[var(--color-border)] rounded-md p-12 text-center elevation-1">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-surface-alt)] flex items-center justify-center">
          <span className="text-2xl">🚧</span>
        </div>
        <h1 className="text-headline-lg mb-2">{title}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">{subtitle}</p>
      </div>
    </div>
  );
}
