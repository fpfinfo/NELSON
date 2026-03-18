"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  FileSpreadsheet,
  ArrowRightLeft,
  Settings,
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Search,
  User,
  BarChart3,
  Wallet,
  FileText,
  Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface AppShellProps {
  children: React.ReactNode;
}

const MENU_SECTIONS = [
  {
    title: "Principal",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "#", active: false },
      { icon: BarChart3, label: "Relatórios", href: "#", active: false },
    ],
  },
  {
    title: "Explorador",
    items: [
      { icon: Wallet, label: "Despesas", href: "#", active: false },
      { icon: FileText, label: "Documentos", href: "#", active: false },
      {
        icon: ArrowRightLeft,
        label: "Conversor CSV",
        href: "/",
        active: true,
        badge: "Novo",
      },
    ],
  },
  {
    title: "Gestão",
    items: [
      { icon: Building2, label: "Unidades", href: "#", active: false },
      { icon: Settings, label: "Configurações", href: "#", active: false },
    ],
  },
];

export function AppShell({ children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ===== SIDEBAR ===== */}
      <aside
        className={`
          relative flex flex-col border-r border-sidebar-border bg-sidebar
          transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? "w-[68px]" : "w-[260px]"}
        `}
      >
        {/* Logo / Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
          </div>
          {!sidebarCollapsed && (
            <div className="animate-fade-in">
              <h1 className="text-sm font-semibold text-sidebar-foreground tracking-tight">
                SEFIN TJPA
              </h1>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
                Sistema de Gestão Financeira
              </p>
            </div>
          )}
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-muted-foreground shadow-md hover:text-foreground hover:bg-accent transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {MENU_SECTIONS.map((section) => (
            <div key={section.title}>
              {!sidebarCollapsed && (
                <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className={`
                      group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-200
                      ${
                        item.active
                          ? "bg-primary/10 text-primary shadow-sm"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      }
                      ${sidebarCollapsed ? "justify-center px-2" : ""}
                    `}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <item.icon
                      className={`h-4.5 w-4.5 shrink-0 ${
                        item.active
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-sidebar-foreground"
                      }`}
                    />
                    {!sidebarCollapsed && (
                      <>
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <Badge
                            variant="secondary"
                            className="ml-auto bg-primary/15 text-primary text-[10px] px-1.5 py-0 font-semibold"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User Section (Bottom) */}
        <div className="border-t border-sidebar-border p-3">
          <div
            className={`flex items-center gap-3 rounded-lg p-2 hover:bg-sidebar-accent transition-colors cursor-pointer ${
              sidebarCollapsed ? "justify-center" : ""
            }`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
              ML
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0 animate-fade-in">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  Miguel Lucivaldo
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  Analista SEFIN
                </p>
              </div>
            )}
            {!sidebarCollapsed && (
              <LogOut className="h-4 w-4 shrink-0 text-muted-foreground hover:text-destructive transition-colors" />
            )}
          </div>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar..."
                className="h-9 w-64 rounded-lg border border-input bg-secondary/50 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/30 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-lg hover:bg-accent transition-colors">
              <Bell className="h-4.5 w-4.5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
            </button>
            <Separator orientation="vertical" className="h-6" />
            <button className="flex items-center gap-2.5 p-1.5 pr-3 rounded-lg hover:bg-accent transition-colors">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">
                Miguel Lucivaldo
              </span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
