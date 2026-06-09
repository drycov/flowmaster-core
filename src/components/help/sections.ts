import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  FileText,
  Inbox,
  CheckSquare,
  GitBranch,
  FilePlus2,
  Library,
  BookMarked,
  ShieldCheck,
  Search,
  Archive,
  Bell,
  Settings,
  Compass,
  BarChart3,
  KeyRound,
} from "lucide-react";

export type HelpSectionDef = {
  id: string;
  icon: LucideIcon;
  paragraphs: number;
  steps?: number;
};

export const HELP_SECTIONS: HelpSectionDef[] = [
  { id: "overview", icon: BookOpen, paragraphs: 2 },
  { id: "gettingStarted", icon: Compass, paragraphs: 1, steps: 5 },
  { id: "documents", icon: FileText, paragraphs: 2, steps: 7 },
  { id: "correspondence", icon: Inbox, paragraphs: 1, steps: 4 },
  { id: "tasksApprovals", icon: CheckSquare, paragraphs: 1, steps: 5 },
  { id: "workflows", icon: GitBranch, paragraphs: 2, steps: 5 },
  { id: "templates", icon: FilePlus2, paragraphs: 2, steps: 4 },
  { id: "nomenclature", icon: Library, paragraphs: 2 },
  { id: "references", icon: BookMarked, paragraphs: 1, steps: 4 },
  { id: "eds", icon: ShieldCheck, paragraphs: 2, steps: 5 },
  { id: "search", icon: Search, paragraphs: 2 },
  { id: "archive", icon: Archive, paragraphs: 2, steps: 3 },
  { id: "notifications", icon: Bell, paragraphs: 2 },
  { id: "reports", icon: BarChart3, paragraphs: 1, steps: 4 },
  { id: "license", icon: KeyRound, paragraphs: 2 },
  { id: "admin", icon: Settings, paragraphs: 1, steps: 7 },
];
