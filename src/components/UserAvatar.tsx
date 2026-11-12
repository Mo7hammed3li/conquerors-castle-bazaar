import { User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAvatarUrl } from "@/lib/profiles";
import { cn } from "@/lib/utils";

export function UserAvatar({ path, src, className }: { path?: string | null; src?: string | null; className?: string }) {
  const { data } = useAvatarUrl(src ? null : path);
  const url = src ?? data;
  return (
    <Avatar className={cn("border border-primary/40", className)}>
      {url && <AvatarImage src={url} alt="" className="object-cover" />}
      <AvatarFallback className="bg-muted text-primary"><UserIcon className="size-1/2" /></AvatarFallback>
    </Avatar>
  );
}

export function Handle({ username, className }: { username: string | null | undefined; className?: string }) {
  if (!username) return null;
  return <span dir="ltr" className={cn("text-sm text-primary", className)}>@{username}</span>;
}
