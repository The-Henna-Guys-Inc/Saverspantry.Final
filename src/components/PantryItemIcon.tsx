import { usePantryItemIcon } from "@/hooks/usePantryItemIcon";
import { Loader2 } from "lucide-react";

type Props = {
  item: string;
  category?: string | null;
  imageUrl?: string | null;
  className?: string;
  alt?: string;
};

// Shows the user-provided image_url when set, otherwise lazily fetches an
// AI-generated sticker icon for the pantry item. Falls back to a category
// initial bubble if generation fails.
export const PantryItemIcon = ({ item, category, imageUrl, className, alt }: Props) => {
  // Only call the AI hook when there's no explicit image.
  const generated = usePantryItemIcon(imageUrl ? undefined : item, category);

  const wrapperCls =
    className ??
    "h-14 w-14 rounded-full bg-secondary border border-border shrink-0 flex items-center justify-center overflow-hidden";

  if (imageUrl) {
    return (
      <div className={wrapperCls}>
        <img src={imageUrl} alt={alt ?? item} className="h-full w-full object-cover" loading="lazy" />
      </div>
    );
  }
  if (generated === undefined) {
    return (
      <div className={wrapperCls}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (generated === null) {
    return (
      <div className={`${wrapperCls} text-muted-foreground text-xs uppercase font-semibold`}>
        {category?.[0] ?? item?.[0] ?? "·"}
      </div>
    );
  }
  return (
    <div className={wrapperCls}>
      <img src={generated} alt={alt ?? item} className="h-11 w-11 object-contain" loading="lazy" />
    </div>
  );
};
