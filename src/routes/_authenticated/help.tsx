import HelpPage from "@/components/help";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/help")({
  component: HelpPage,
});
