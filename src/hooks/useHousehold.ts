import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Household = {
  id: string;
  name: string;
  owner_user_id: string;
};

export type HouseholdMember = {
  id: string;
  household_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  display_name?: string | null;
};

export type HouseholdInvite = {
  id: string;
  household_id: string;
  code: string;
  invited_by_user_id: string;
  invited_email: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export function useHousehold() {
  const { user } = useAuth();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [invites, setInvites] = useState<HouseholdInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const [{ data: memberRows }, { data: profile }] = await Promise.all([
      supabase
        .from("household_members")
        .select("household_id, household:households(id, name, owner_user_id)")
        .eq("user_id", user.id),
      supabase.from("profiles").select("active_household_id").eq("user_id", user.id).maybeSingle(),
    ]);
    const hhs = (memberRows ?? [])
      .map((r: any) => r.household)
      .filter(Boolean) as Household[];
    setHouseholds(hhs);
    const active = (profile as any)?.active_household_id ?? hhs[0]?.id ?? null;
    setActiveId(active);
    if (active) {
      const [{ data: m }, { data: inv }] = await Promise.all([
        supabase.from("household_members").select("*").eq("household_id", active),
        supabase.from("household_invites").select("*").eq("household_id", active).is("accepted_at", null).order("created_at", { ascending: false }),
      ]);
      // Fetch display names for members
      const ids = (m ?? []).map((x: any) => x.user_id);
      let nameMap: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", ids);
        nameMap = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p.display_name]));
      }
      setMembers((m ?? []).map((x: any) => ({ ...x, display_name: nameMap[x.user_id] ?? null })) as HouseholdMember[]);
      setInvites((inv ?? []) as HouseholdInvite[]);
    } else {
      setMembers([]); setInvites([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const createHousehold = async (name: string) => {
    if (!user) throw new Error("Not signed in");
    const { data, error } = await supabase
      .from("households")
      .insert({ name: name.trim(), owner_user_id: user.id })
      .select("id")
      .single();
    if (error) throw error;
    await supabase.from("profiles").update({ active_household_id: data.id }).eq("user_id", user.id);
    await refresh();
    return data.id as string;
  };

  const switchHousehold = async (id: string) => {
    if (!user) return;
    await supabase.from("profiles").update({ active_household_id: id }).eq("user_id", user.id);
    setActiveId(id);
    await refresh();
  };

  const renameHousehold = async (id: string, name: string) => {
    const { error } = await supabase.from("households").update({ name: name.trim() }).eq("id", id);
    if (error) throw error;
    await refresh();
  };

  const deleteHousehold = async (id: string) => {
    const { error } = await supabase.from("households").delete().eq("id", id);
    if (error) throw error;
    await refresh();
  };

  const leaveHousehold = async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("household_members")
      .delete()
      .eq("household_id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    await refresh();
  };

  const removeMember = async (memberRowId: string) => {
    const { error } = await supabase.from("household_members").delete().eq("id", memberRowId);
    if (error) throw error;
    await refresh();
  };

  const createInvite = async (householdId: string, email?: string) => {
    if (!user) throw new Error("Not signed in");
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    const { data, error } = await supabase
      .from("household_invites")
      .insert({
        household_id: householdId,
        code,
        invited_by_user_id: user.id,
        invited_email: email?.trim() || null,
      })
      .select("*")
      .single();
    if (error) throw error;
    await refresh();
    return data as HouseholdInvite;
  };

  const revokeInvite = async (id: string) => {
    const { error } = await supabase.from("household_invites").delete().eq("id", id);
    if (error) throw error;
    await refresh();
  };

  const redeemInvite = async (code: string) => {
    if (!user) throw new Error("Not signed in");
    const trimmed = code.trim().toUpperCase();
    const { data: invite, error: lookupErr } = await supabase
      .from("household_invites")
      .select("id, household_id, expires_at, accepted_at")
      .eq("code", trimmed)
      .maybeSingle();
    if (lookupErr) throw lookupErr;
    if (!invite) throw new Error("Invite not found");
    if (invite.accepted_at) throw new Error("Invite already used");
    if (new Date(invite.expires_at) < new Date()) throw new Error("Invite expired");

    // Add as member (RLS allows auth.uid() = user_id)
    const { error: addErr } = await supabase
      .from("household_members")
      .insert({ household_id: invite.household_id, user_id: user.id, role: "member" });
    if (addErr && !addErr.message.includes("duplicate")) throw addErr;

    await supabase
      .from("household_invites")
      .update({ accepted_at: new Date().toISOString(), accepted_by_user_id: user.id })
      .eq("id", invite.id);

    await supabase.from("profiles").update({ active_household_id: invite.household_id }).eq("user_id", user.id);
    await refresh();
    return invite.household_id;
  };

  const active = households.find((h) => h.id === activeId) ?? null;
  const isOwner = !!(active && user && active.owner_user_id === user.id);

  return {
    loading, households, active, activeId, members, invites, isOwner,
    createHousehold, switchHousehold, renameHousehold, deleteHousehold,
    leaveHousehold, removeMember,
    createInvite, revokeInvite, redeemInvite,
    refresh,
  };
}
