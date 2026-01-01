"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, LogOut, User, LayoutDashboard, Settings } from "lucide-react";

interface HeaderProps {
  email?: string;
  fullName?: string;
  isAdmin?: boolean;
}

export function Header({ email, fullName, isAdmin }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const initials = fullName
    ? fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : email?.[0]?.toUpperCase() || "U";

  return (
    <header className="h-16 border-b bg-white px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {isAdmin && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
            Admin
          </span>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 h-10">
            <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center">
              <span className="text-xs font-medium text-white">{initials}</span>
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-slate-900">
                {fullName || "User"}
              </p>
              <p className="text-xs text-slate-500">{email}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{fullName || "User"}</p>
            <p className="text-xs text-slate-500">{email}</p>
          </div>
          <DropdownMenuSeparator />
          {isAdmin ? (
            <DropdownMenuItem asChild>
              <a href="/dashboard" className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Switch to Client View
              </a>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem asChild>
              <a href="/admin" className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Switch to Admin View
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <a href="/profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </a>
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem asChild>
              <a href="/admin/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-red-600 focus:text-red-600"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
