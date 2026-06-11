/** SAP Fiori 3 / Horizon tokens scoped to the auth shell. */
export const sap = {
  brand: "#0070F2",
  brandHover: "#0064D9",
  brandActive: "#0057D2",
  link: "#0064D9",
  shell: "#354A5F",
  shellLight: "#475E75",
  pageBg: "#F5F6F7",
  heroBg: "#354A5F",
  card: "#FFFFFF",
  text: "#32363A",
  textSecondary: "#6A6D70",
  textMuted: "#89919A",
  textOnShell: "#FFFFFF",
  textOnShellMuted: "rgba(255,255,255,0.72)",
  border: "#D9D9D9",
  borderLight: "#E5E5E5",
  fieldBorder: "#89919A",
  buttonBorder: "#BCC3CA",
  highlight: "#EBF8FF",
  listSeparator: "#E5E5E5",
  messageInfoBg: "#F5FAFF",
  positive: "#107E3E",
  shadowCard: "0 0 0 0.0625rem rgba(34,53,72,0.08), 0 0.125rem 0.5rem rgba(34,53,72,0.12)",
} as const;

export const sapInputClass =
  "h-9 rounded border border-[#89919A] bg-white px-3 text-sm text-[#32363A] shadow-none transition-colors placeholder:text-[#89919A] focus-visible:border-[#0070F2] focus-visible:ring-1 focus-visible:ring-[#0070F2] disabled:bg-[#F5F6F7]";

export const sapLabelClass = "text-xs font-normal text-[#6A6D70]";

export const sapButtonEmphasizedClass =
  "h-9 w-full rounded bg-[#0070F2] text-sm font-semibold text-white shadow-none hover:bg-[#0064D9] active:bg-[#0057D2]";

export const sapButtonDefaultClass =
  "h-9 w-full rounded border border-[#BCC3CA] bg-white text-sm font-semibold text-[#0064D9] shadow-none hover:border-[#0070F2] hover:bg-[#EBF8FF]";

export const sapLinkClass =
  "text-xs font-normal text-[#0064D9] hover:text-[#0057D2] hover:underline";

export const sapTabListClass =
  "flex h-auto w-full justify-start gap-0 rounded-none border-b border-[#D9D9D9] bg-transparent p-0";

export const sapTabTriggerClass =
  "relative -mb-px rounded-none border-b-2 border-transparent bg-transparent px-4 py-2.5 text-sm font-normal text-[#6A6D70] shadow-none data-[state=active]:border-[#0070F2] data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-[#0064D9] data-[state=active]:shadow-none";
