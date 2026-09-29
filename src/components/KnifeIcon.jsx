import knifeSvg from "../assets/whiteknife.svg";

// Knife icon via CSS mask based on whiteknife.svg so it inherits currentColor
export function KnifeIcon({ className = "h-5 w-5" }) {
  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        backgroundColor: "currentColor",
        WebkitMaskImage: `url(${knifeSvg})`,
        maskImage: `url(${knifeSvg})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
      aria-hidden="true"
    />
  );
}
