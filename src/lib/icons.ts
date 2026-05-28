import {
  Compass,
  Heart,
  Home,
  Camera,
  Search,
  Map,
  MoreHorizontal,
  Sparkles,
  Stamp,
  BookOpen,
  LucideIcon,
} from "lucide-react";

export type IconKey =
  | "home"
  | "camera"
  | "search"
  | "spot"
  | "character"
  | "more"
  | "stamp"
  | "favorite"
  | "guide"
  | "account";

export const navIcons: Record<IconKey, LucideIcon> = {
  home: Home,
  camera: Camera,
  search: Search,
  spot: Map,
  character: Sparkles,
  more: MoreHorizontal,
  stamp: Stamp,
  favorite: Heart,
  guide: BookOpen,
  account: Compass,
};
