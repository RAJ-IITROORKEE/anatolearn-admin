import {
  Bell,
  BookOpenText,
  Boxes,
  ClipboardCheck,
  FileQuestion,
  FolderHeart,
  Gauge,
  Images,
  Layers3,
  LibraryBig,
  MessageSquareText,
  ScrollText,
  Settings,
  ShieldQuestion,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  accent?: "quiz" | "test";
};

type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

export const navigation: NavigationGroup[] = [
  { label: "Overview", items: [{ label: "Dashboard", href: "/dashboard", icon: Gauge }] },
  {
    label: "Learning content",
    items: [
      { label: "Organ systems", href: "/organ-systems", icon: Boxes },
      { label: "Topics", href: "/topics", icon: Layers3 },
      { label: "Content review", href: "/content", icon: BookOpenText },
      { label: "Flashcards", href: "/flashcards", icon: LibraryBig },
    ],
  },
  {
    label: "Assessments",
    items: [
      { label: "Quiz questions", href: "/questions/quiz", icon: ShieldQuestion, accent: "quiz" },
      { label: "Test questions", href: "/questions/test", icon: FileQuestion, accent: "test" },
      { label: "Attempts", href: "/attempts", icon: ClipboardCheck },
    ],
  },
  {
    label: "Community",
    items: [
      { label: "Users", href: "/users", icon: Users },
      { label: "Feedback", href: "/feedback", icon: MessageSquareText },
      { label: "Notifications", href: "/notifications", icon: Bell },
    ],
  },
  { label: "Assets", items: [{ label: "Media library", href: "/media", icon: Images }] },
  {
    label: "System",
    items: [
      { label: "Audit logs", href: "/audit-logs", icon: ScrollText },
      { label: "Settings", href: "/settings/profile", icon: Settings },
    ],
  },
] as const;

export const routeTitles = new Map(navigation.flatMap((group) => group.items.map((item) => [item.href, item.label])));

export const fallbackIcon = FolderHeart;
