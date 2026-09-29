export function Select({ value, onValueChange, children }) {
  return <div data-value={value} data-onchange={onValueChange}>{children}</div>;
}
export function SelectTrigger({ className = "", children }) {
  return <div className={"inline-flex items-center rounded-xl border px-3 py-2 text-sm " + className}>{children}</div>;
}
export function SelectValue({ placeholder }) {
  return <span>{placeholder}</span>;
}
export function SelectContent({ children }) {
  return <div className="mt-1">{children}</div>;
}
export function SelectItem({ value, children, onClick }) {
  return (
    <div
      onClick={onClick}
      data-value={value}
      className="px-3 py-1.5 rounded cursor-pointer hover:bg-gray-200/60 dark:hover:bg-white/10"
    >
      {children}
    </div>
  );
}
/* You'll pass onClick={() => onValueChange(theValue)} when rendering items */

