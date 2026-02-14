import { Home, Camera, Search, Map, Sparkles, LucideIcon } from "lucide-react";

export type IconKey =
  | "home"
  | "camera"
  | "search"
  | "spot"
  | "character";

export const navIcons: Record<IconKey, LucideIcon> = {
  home: Home,
  camera: Camera,
  search: Search,
  spot: Map,
  character: Sparkles,
};
