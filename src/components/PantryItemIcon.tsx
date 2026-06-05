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
    "h-11 w-11 rounded-lg object-cover border border-border shrink-0 bg-muted";

  if (imageUrl) {
    return <img src={imageUrl} alt={alt ?? item} className={wrapperCls} loading="lazy" />;
  }
  if (generated === undefined) {
    return (
      <div className={`${wrapperCls} flex items-center justify-center text-muted-foreground`}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  if (generated === null) {
    return (
      <div className={`${wrapperCls} flex items-center justify-center text-muted-foreground text-[10px] uppercase`}>
        {category?.[0] ?? item?.[0] ?? "·"}
      </div>
    );
  }
  return <img src={generated} alt={alt ?? item} className={wrapperCls} loading="lazy" />;
};
