import { usePantryItemIcon } from "@/hooks/usePantryItemIcon";
import { Loader2 } from "lucide-react";

type Props = {
  item: string;
  category?: string | null;
  imageUrl?: string | null; // accepted for API compatibility but ignored — we always use generated icons for consistency
  className?: string;
  alt?: string;
};

// Always shows a consistent AI-generated icon for pantry items.
export const PantryItemIcon = ({ item, category, className, alt }: Props) => {
  const generated = usePantryItemIcon(item, category);

  // Warm cream bubble with subtle ring — strong contrast against the white app bg.
  const wrapperCls =
    className ??
    "h-14 w-14 rounded-full bg-gradient-warm ring-1 ring-border shadow-soft shrink-0 flex items-center justify-center overflow-hidden";

  if (generated === undefined) {
    return (
      <div className={wrapperCls}>
        <Loader2 className="h-4 w-4 animate-spin text-primary/60" />
      </div>
    );
  }
  if (generated === null) {
    return (
      <div className={`${wrapperCls} text-primary text-sm uppercase font-bold`}>
        {(item?.[0] ?? "·").toUpperCase()}
      </div>
    );
  }
  return (
    <div className={wrapperCls}>
      <img src={generated} alt={alt ?? item} className="h-12 w-12 object-contain" loading="lazy" />
    </div>
  );
};
