
// src/routes/_authenticated/profile.tsx (свой профиль)
import ProfilePage from "@/components/profile";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});