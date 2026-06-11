/** @deprecated Import from @/lib/design-tokens instead. */
export {
  ds as sap,
  linkClass,
  fieldLgClass as authInputClass,
  btnPrimaryPillClass as authButtonClass,
  linkClass as authLinkClass,
  labelClass as authLabelClass,
  fieldLgClass as sapInputClass,
  btnPrimaryPillClass as sapButtonEmphasizedClass,
  linkClass as sapLinkClass,
  labelClass as sapLabelClass,
} from "@/lib/design-tokens";

export const sapButtonDefaultClass =
  "h-10 w-full rounded-full border border-border bg-transparent text-sm font-medium text-primary shadow-none hover:border-primary hover:bg-accent";

export const sapTabListClass = "mb-6 flex justify-center gap-6 border-0 bg-transparent p-0";

export const sapTabTriggerClass =
  "rounded-none border-0 bg-transparent px-0 py-0 text-sm shadow-none data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground";
