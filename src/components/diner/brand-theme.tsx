// Scopes the diner-facing brand-* color scale to a venue's chosen accent
// (Restaurant.brandColor). See .s2o-tenant-theme in globals.css for the
// color-mix() derivation. Renders children unwrapped when unset/invalid, so
// the app's default palette applies untouched.
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function BrandTheme({
  color,
  children,
}: {
  color: string | null | undefined;
  children: React.ReactNode;
}) {
  if (!color || !HEX_RE.test(color)) return <>{children}</>;
  return (
    <div
      className="s2o-tenant-theme contents"
      style={{ "--color-brand-600": color } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
