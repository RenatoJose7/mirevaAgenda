"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Home,
  Menu,
  Scissors,
  Settings,
  Sparkles,
  LogOut,
  Users,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useThemeStyle } from "@/lib/use-theme-style";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/profissionais", label: "Profissionais", icon: Users },
  { href: "/servicos", label: "Servicos", icon: Scissors },
  { href: "/notificacoes", label: "Notificacoes", icon: Bell },
  { href: "/configuracoes", label: "Configuracoes", icon: Settings },
];

function NavList() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition",
              active && "bg-primary text-primary-foreground shadow-sm",
              !active && "hover:bg-secondary hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({
  title,
  description,
  businessName,
  businessLogoUrl,
  themeKey,
  unreadCount = 0,
  children,
}: {
  title: string;
  description: string;
  businessName: string;
  businessLogoUrl?: string | null;
  themeKey?: string | null;
  unreadCount?: number;
  children: React.ReactNode;
}) {
  const themeStyle = useThemeStyle(themeKey);

  return (
    <div className="min-h-screen bg-background" style={themeStyle}>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r bg-sidebar/95 px-5 py-6 backdrop-blur xl:block">
        <BrandMark />
        <Separator className="my-6" />
        <NavList />
        <div className="absolute bottom-6 left-5 right-5 rounded-lg border bg-secondary p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="size-4 text-primary" />
            Ambiente de testes
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Dados reais do estabelecimento no projeto configurado.
          </p>
        </div>
      </aside>

      <div className="xl:pl-72">
        <header className="sticky top-0 z-10 border-b bg-card/90 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Sheet>
                <SheetTrigger
                  render={<Button variant="outline" size="icon" className="xl:hidden" aria-label="Abrir menu" />}
                >
                  <Menu className="size-4" />
                </SheetTrigger>
                <SheetContent side="left" className="w-80 p-5" style={themeStyle}>
                  <BrandMark />
                  <Separator className="my-6" />
                  <NavList />
                </SheetContent>
              </Sheet>
              {businessLogoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={businessLogoUrl}
                  alt={businessName}
                  className="hidden size-11 rounded-lg border object-cover sm:block"
                />
              )}
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
                  {businessName}
                </p>
                <h1 className="text-xl font-semibold text-foreground md:text-2xl">{title}</h1>
                <p className="hidden text-sm text-muted-foreground md:block">{description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Teste</Badge>
              <Link href="/notificacoes">
                <Button variant="outline" size="icon" aria-label="Ver notificacoes" className="relative">
                  <Bell className="size-4" />
                  <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {unreadCount}
                  </span>
                </Button>
              </Link>
              <Link href="/auth/logout">
                <Button variant="outline" size="icon" aria-label="Sair">
                  <LogOut className="size-4" />
                </Button>
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
