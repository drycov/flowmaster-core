import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOnboardingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", userId)
      .single();
    
    return {
      completed: profile?.onboarding_completed ?? false,
    };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    
    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_completed: true } as never)
      .eq("id", userId);
    
    if (error) throw new Error(error.message);
    
    return { ok: true };
  });
