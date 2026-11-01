import { Globe, Lock, Star, UsersRound } from "lucide-react";

export const AUDIENCES = [
  { key: "public", label: "Public", description: "Anyone on Glow", icon: Globe },
  { key: "friends", label: "Friends", description: "Your friends", icon: UsersRound },
  {
    key: "close_friends",
    label: "Close friends",
    description: "Only your Close Friends list",
    icon: Star,
  },
  { key: "only_me", label: "Only me", description: "Just you", icon: Lock },
];

export const audienceInfo = (key) => AUDIENCES.find((a) => a.key === key) ?? AUDIENCES[0];
