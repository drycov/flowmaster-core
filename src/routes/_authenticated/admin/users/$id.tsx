// src/routes/_authenticated/admin/users/$id.tsx
import { createFileRoute } from "@tanstack/react-router";
import ProfilePage from "@/components/profile";

export const Route = createFileRoute("/_authenticated/admin/users/$id")({
  component: ProfilePage,
});