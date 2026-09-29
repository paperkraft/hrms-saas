"use client";

import { useState, useEffect } from "react";
import { LogOut, User as UserIcon } from "lucide-react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProfileDialog } from "@/components/features/profile/profile-dialog";
import { getUserProfile } from "@/actions/user";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface UserNavProps {
  userName: string;
  userEmail?: string;
  initialAvatarUrl?: string | null;
  initialDesignation?: string | null;
}

export function UserNav({
  userName,
  userEmail = "",
  initialAvatarUrl = null,
  initialDesignation = null,
}: UserNavProps) {
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [userData, setUserData] = useState<any>({
    name: userName,
    email: userEmail,
    designation: initialDesignation,
    avatarUrl: initialAvatarUrl,
  });
  const [avatar, setAvatar] = useState<string | null>(initialAvatarUrl);

  useEffect(() => {
    setAvatar(initialAvatarUrl);
    setUserData((prev: any) => ({
      ...prev,
      name: userName,
      email: userEmail,
      designation: initialDesignation ?? prev?.designation,
      avatarUrl: initialAvatarUrl ?? prev?.avatarUrl,
    }));
  }, [userName, userEmail, initialAvatarUrl, initialDesignation]);

  useEffect(() => {
    const fetchProfile = () => {
      getUserProfile().then((res) => {
        if (res.success && res.data) {
          setUserData(res.data);
          if ((res.data as any).avatarUrl) {
            setAvatar(`${(res.data as any).avatarUrl}?t=${Date.now()}`);
          }
        }
      });
    };

    // Listen for cross-component avatar updates (e.g. from Profile settings)
    window.addEventListener("avatar-updated", fetchProfile);
    return () => window.removeEventListener("avatar-updated", fetchProfile);
  }, []);

  const initials = userName
    ? userName
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase()
    : "U";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex items-center gap-2.5 cursor-pointer hover:bg-muted/70 p-1.5 pr-3.5 rounded-full transition-all duration-200 border border-transparent hover:border-border/40 select-none bg-muted/20">
            <Avatar className="size-7 rounded-full shrink-0 border border-border/40 shadow-xs">
              {avatar && <AvatarImage src={avatar} alt={userName} className="object-cover rounded-full" />}
              <AvatarFallback className="text-[10px] font-black bg-primary text-primary-foreground rounded-full flex items-center justify-center size-full">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-col text-left hidden sm:flex shrink-0">
              <span className="text-xs font-bold text-foreground leading-none">{userName}</span>
              {userData?.designation && (
                <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-0.5 leading-none">
                  {userData.designation}
                </span>
              )}
            </div>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 animate-scale-in shadow-2xl border-border/60 p-1">
          <DropdownMenuLabel className="p-3 font-normal">
            <div className="flex items-center gap-3">
              <Avatar className="size-10 rounded-full border border-border/40 shadow-xs shrink-0">
                {avatar && <AvatarImage src={avatar} alt={userName} className="object-cover rounded-full" />}
                <AvatarFallback className="text-[13px] font-black bg-primary text-primary-foreground rounded-full flex items-center justify-center size-full">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col text-left min-w-0">
                <span className="text-xs font-bold text-foreground truncate leading-none mb-1">
                  {userData?.name || userName}
                </span>
                <span className="text-[10px] text-muted-foreground/85 font-medium truncate leading-none mb-1.5">
                  {userData?.email}
                </span>
                {userData?.designation && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-[3px] text-[8px] font-black uppercase border border-primary/20 bg-primary/5 text-primary w-fit tracking-widest leading-none mt-0.5">
                    {userData.designation}
                  </span>
                )}
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border/60" />
          <DropdownMenuItem
            onClick={() => router.push("/dashboard/profile")}
            className="transition-colors cursor-pointer text-xs font-bold p-2 px-2.5 rounded-sm hover:bg-muted focus:bg-muted"
          >
            <UserIcon className="mr-2 h-3.5 w-3.5 opacity-60" />
            <span>Profile Settings</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-border/40" />
          <DropdownMenuItem
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-rose-500 focus:bg-rose-500/10 focus:text-rose-500 transition-colors cursor-pointer text-xs font-bold p-2 px-2.5 rounded-sm"
          >
            <LogOut className="mr-2 h-3.5 w-3.5" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {userData && (
        <ProfileDialog
          user={userData}
          open={profileOpen}
          onOpenChange={setProfileOpen}
        />
      )}
    </>
  );
}
