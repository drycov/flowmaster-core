import { createFileRoute } from "@tanstack/react-router";
import ProfilePage from "@/components/profile";
import { requireAnyPermission } from "@/lib/auth/route-guards";

function AdminUserProfilePage() {
  const { id } = Route.useParams();
  return <ProfilePage viewUserId={id} />;
}

export const Route = createFileRoute("/_authenticated/admin/users/$id")({
  beforeLoad: () => requireAnyPermission("manage_users"),
  component: AdminUserProfilePage,
});