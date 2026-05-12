import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  to?: string;
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  className?: string;
}

const sizeMap = {
  sm: "text-base sm:text-lg",
  md: "text-xl sm:text-2xl",
  lg: "text-2xl sm:text-3xl",
};

export const BrandMark = ({
  to = "/",
  size = "md",
  showTagline = false,
  className,
}: BrandMarkProps) => {
  const content = (
    <div className={cn("flex flex-col leading-tight", className)}>
      <span className={cn("font-bold text-primary tracking-tight", sizeMap[size])}>
        Saver's <span className="text-accent">Pantry</span>
      </span>
      {showTagline && (
        <span className="text-[10px] sm:text-xs text-muted-foreground -mt-0.5">
          Eat well, save more
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
