import { createFileRoute } from "@tanstack/react-router";
import ProfilePage from "@/components/profile";
import { requireModule } from "@/lib/access/route-guards";

function AdminUserProfilePage() {
  const { id } = Route.useParams();
  return <ProfilePage viewUserId={id} />;
}

export const Route = createFileRoute("/_authenticated/admin/users/$id")({
  beforeLoad: () => requireModule("admin_users"),
  component: AdminUserProfilePage,
});
