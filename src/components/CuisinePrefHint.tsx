import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

/**
 * Small inline hint shown next to cuisine selectors when the user has no
 * cuisine preferences saved in their profile. Clicking takes them to Settings
 * to personalize defaults across all widgets.
 */
export const CuisinePrefHint = ({ className = "" }: { className?: string }) => (
  <span className={`inline-flex items-center gap-1 text-[11px] text-muted-foreground ${className}`}>
    <Sparkles className="h-3 w-3" />
    <Link to="/settings" className="underline hover:text-foreground">
      Add cuisine preferences
    </Link>
    <span>for a more personalized experience.</span>
  </span>
);
