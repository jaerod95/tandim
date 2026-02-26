type TandimLogoProps = {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
};

const sizes = {
  sm: { icon: "h-5 w-5", text: "text-sm" },
  md: { icon: "h-6 w-6", text: "text-base" },
  lg: { icon: "h-8 w-8", text: "text-lg" },
};

function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      fill="none"
      className={className}
    >
      <rect x="2" y="4" width="22" height="18" rx="4" fill="#4F46E5" />
      <polygon points="8,22 12,28 16,22" fill="#4F46E5" />
      <rect x="14" y="10" width="22" height="18" rx="4" fill="#818CF8" />
      <polygon points="26,28 30,34 34,28" fill="#818CF8" />
    </svg>
  );
}

export function TandimLogo({ size = "md", showText = true, className = "" }: TandimLogoProps) {
  const s = sizes[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <LogoMark className={s.icon} />
      {showText && (
        <span className={`${s.text} font-semibold tracking-tight text-foreground`}>
          Tandim
        </span>
      )}
    </div>
  );
}
