import { CUISINE_LABEL, type CuisineTag } from "@/lib/cuisineHints";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  cuisines: CuisineTag[];
  isFiltering: boolean;
  onShowAll: () => void;
  onResume?: () => void;
  className?: string;
  label?: string;
}

export const CuisineFilterBar = ({ cuisines, isFiltering, onShowAll, onResume, className, label }: Props) => {
  if (!cuisines.length) {
    return (
      <div className={`flex items-center gap-2 flex-wrap text-xs text-muted-foreground ${className ?? ""}`}>
        <Filter className="h-3.5 w-3.5" />
        <span>No cuisine preferences set —</span>
        <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
          <Link to="/settings">Pick your cuisines</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className ?? ""}`}>
      <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground">{label ?? "Showing for"}:</span>
      {cuisines.map((c) => (
        <span key={c} className={`text-xs px-2.5 py-1 rounded-full ${isFiltering ? "bg-primary/10 text-primary border border-primary/20" : "bg-secondary text-muted-foreground line-through"}`}>
          {CUISINE_LABEL[c]}
        </span>
      ))}
      {isFiltering ? (
        <button
          onClick={onShowAll}
          className="text-xs px-2.5 py-1 rounded-full bg-secondary hover:bg-muted text-foreground inline-flex items-center gap-1 min-h-[28px]"
        >
          <X className="h-3 w-3" /> Show everything
        </button>
      ) : onResume ? (
        <button
          onClick={onResume}
          className="text-xs px-2.5 py-1 rounded-full bg-primary text-primary-foreground hover:opacity-90 min-h-[28px]"
        >
          Filter to my cuisines
        </button>
      ) : null}
      <Link to="/settings" className="text-[11px] text-muted-foreground hover:text-primary underline underline-offset-2 ml-auto">
        Change in Settings
      </Link>
    </div>
  );
};
