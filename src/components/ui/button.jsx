export function Button({ variant = "default", size = "md", className = "", ...props }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const sizeCls = size === "icon" ? "w-9 h-9 p-0" : size === "sm" ? "px-3 py-1.5" : "px-3.5 py-2";
  const variantCls =
    variant === "outline"
      ? "border border-zinc-400/60 dark:border-zinc-700/60 bg-transparent text-zinc-900 dark:text-white hover:bg-black/5 dark:hover:bg-white/10"
      : variant === "secondary"
      ? "bg-zinc-700/60 text-white hover:bg-zinc-700/70"
      : variant === "ghost"
      ? "bg-transparent text-zinc-900 dark:text-white hover:bg-black/5 dark:hover:bg-white/10"
      : "bg-black text-white hover:bg-zinc-900";
  const cls = `${base} ${sizeCls} ${variantCls} ${className}`.trim();
  // type="button" by default, so a Button inside a <form> never submits it by accident
  return <button type="button" className={cls} {...props} />;
}
