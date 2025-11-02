// src/components/ui/card.jsx
export function Card({ className = "", ...p }) {
  return (
    <div
      {...p}
      className={"border rounded-2xl bg-white/70 dark:bg-black/30 " + className}
    />
  );
}
export function CardContent({ className = "", ...p }) {
  return <div {...p} className={"p-4 " + className} />;
}
