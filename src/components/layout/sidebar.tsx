"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, MessageSquare, Settings, Zap } from "lucide-react";

interface SidebarProps {
  isAdmin?: boolean;
  clients?: Array<{ id: string; name: string }>;
}

export function Sidebar({ isAdmin = false, clients = [] }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">BlueReach Agency</h1>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {isAdmin ? (
          <>
            <NavLink
              href="/admin"
              active={pathname === "/admin"}
              icon={<LayoutDashboard className="h-4 w-4" />}
            >
              Command Center
            </NavLink>
            <NavLink
              href="/admin/clients"
              active={pathname.startsWith("/admin/clients")}
              icon={<Users className="h-4 w-4" />}
            >
              Customers
            </NavLink>
            <NavLink
              href="/admin/leads"
              active={pathname === "/admin/leads"}
              icon={<MessageSquare className="h-4 w-4" />}
            >
              All Leads
            </NavLink>

            <div className="pt-6">
              <p className="text-slate-500 text-xs uppercase tracking-wider mb-2 px-3">
                Integrations
              </p>
              <NavLink
                href="/admin/instantly"
                active={pathname.startsWith("/admin/instantly")}
                icon={<Zap className="h-4 w-4" />}
              >
                Instantly
              </NavLink>
            </div>
          </>
        ) : (
          <>
            <NavLink
              href="/dashboard"
              active={pathname === "/dashboard"}
              icon={<LayoutDashboard className="h-4 w-4" />}
            >
              Overview
            </NavLink>
            {clients.length > 0 && (
              <div className="pt-4">
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-2 px-3">
                  Your Clients
                </p>
                {clients.map((client) => (
                  <NavLink
                    key={client.id}
                    href={`/dashboard/${client.id}`}
                    active={pathname === `/dashboard/${client.id}`}
                  >
                    {client.name}
                  </NavLink>
                ))}
              </div>
            )}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800">
        <NavLink
          href={isAdmin ? "/admin/settings" : "/dashboard/settings"}
          active={pathname.includes("/settings")}
          icon={<Settings className="h-4 w-4" />}
        >
          Settings
        </NavLink>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm",
        active
          ? "bg-blue-600 text-white"
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
