import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Bookmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

type Props = {
  table: "saved_lookups" | "saved_swaps" | "saved_recipes";
  payload: Record<string, any>;
};

export const SaveButton = ({ table, payload }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const onSave = async () => {
    if (!user) {
      toast.info("Sign in to save");
      navigate("/auth");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from(table as any).insert({ ...payload, user_id: user.id });
    setSaving(false);
    if (error) return toast.error(error.message);
    setSaved(true);
    toast.success("Saved to your library");
  };

  return (
    <Button onClick={onSave} disabled={saving || saved} variant="outline" size="sm" className="rounded-xl">
      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} />}
      <span className="ml-1.5">{saved ? "Saved" : "Save"}</span>
    </Button>
  );
};
