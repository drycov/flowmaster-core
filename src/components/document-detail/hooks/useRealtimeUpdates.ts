import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useRealtimeUpdates(documentId: string, onUpdate: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel(`doc:${documentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents", filter: `id=eq.${documentId}` },
        () => onUpdate()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "document_comments", filter: `document_id=eq.${documentId}` },
        () => onUpdate()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workflow_events", filter: `document_id=eq.${documentId}` },
        () => onUpdate()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [documentId, onUpdate]);
}