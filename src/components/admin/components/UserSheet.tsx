import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { localized } from "@/lib/i18n";

export function UserSheet({ user, locale, t, onClose }: any) {
  return (
    <Sheet open={!!user} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        {user && (
          <>
            <SheetHeader>
              <SheetTitle>
                {localized(user, locale, "full_name") || "—"}
              </SheetTitle>
              <SheetDescription>ID: {user.id}</SheetDescription>
            </SheetHeader>

            <div className="mt-4">
              <div>{user.email}</div>

              <div className="mt-4">
                {user.roles.map((r: string) => (
                  <Badge key={r}>{t(`roles.${r}`) || r}</Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}