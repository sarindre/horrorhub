export function Badge({ variant="default", className="", ...p }){
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs";
  const style = variant==="secondary" ? "bg-gray-200/60 dark:bg-white/10" : "bg-black text-white dark:bg-white dark:text-black";
  return <span {...p} className={`${base} ${style} ${className}`} />;
}
