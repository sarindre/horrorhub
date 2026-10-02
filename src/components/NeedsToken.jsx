// Shown wherever a feature needs the TMDb token: says what it unlocks and links straight to the
// setup (Settings → Connections, which moves to the top while you have no token).
export function NeedsToken({ children, className = "text-sm opacity-80" }) {
  return (
    <div className={className}>
      {children}{" "}
      <a href="#settings" className="underline underline-offset-2">Set up your free TMDb token (about 3 minutes)</a>.
    </div>
  );
}
