import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  to?: string;
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  className?: string;
}

const sizeMap = {
  sm: {
    title: "text-lg sm:text-xl",
    tagline: "text-[9px] sm:text-[10px]",
  },
  md: {
    title: "text-xl sm:text-2xl",
    tagline: "text-[10px] sm:text-[11px]",
  },
  lg: {
    title: "text-2xl sm:text-3xl",
    tagline: "text-[11px] sm:text-xs",
  },
};

export const BrandMark = ({
  to = "/",
  size = "md",
  showTagline = false,
  className,
}: BrandMarkProps) => {
  const content = (
    <div className={cn("inline-flex w-fit flex-col items-center justify-center leading-none", className)}>
      <span className={cn("whitespace-nowrap font-bold text-primary tracking-tight", sizeMap[size].title)}>
        Saver's <span className="text-accent">Pantry</span>
      </span>
      {showTagline && (
        <span className={cn("-mt-0.5 w-fit whitespace-nowrap text-center font-medium text-muted-foreground", sizeMap[size].tagline)}>
          Eat well, Save more
        </span>
      )}
    </div>
  );

  if (!to) return content;
  return (
    <Link to={to} className="flex items-center min-h-[44px]" aria-label="Saver's Pantry home">
      {content}
    </Link>
  );
};
