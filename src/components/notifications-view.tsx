"use client";

import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { InternalNotificationRecord } from "@/lib/business/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function NotificationsView({
  businessId,
  businessName,
  themeKey,
  initialNotifications,
}: {
  businessId: string;
  businessName: string;
  themeKey?: string | null;
  initialNotifications: InternalNotificationRecord[];
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const unreadCount = notifications.filter((item) => !item.is_read).length;

  async function markRead(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("internal_notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("business_id", businessId);

    if (!error) {
      setNotifications((current) => current.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    }
  }

  async function markAllRead() {
    const supabase = createClient();
    const { error } = await supabase
      .from("internal_notifications")
      .update({ is_read: true })
      .eq("business_id", businessId)
      .eq("is_read", false);

    if (!error) {
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    }
  }

  return (
    <AdminShell
      title="Notificacoes"
      description="Eventos internos reais do estabelecimento."
      businessName={businessName}
      themeKey={themeKey}
      unreadCount={unreadCount}
    >
      <div className="space-y-5">
        <div className="flex justify-end">
          <Button variant="outline" onClick={markAllRead} disabled={unreadCount === 0}>
            <CheckCheck className="size-4" />
            Marcar todas como lidas
          </Button>
        </div>
        {notifications.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma notificação interna ainda.
            </CardContent>
          </Card>
        ) : (
          notifications.map((notification) => (
            <Card key={notification.id} className={cn(!notification.is_read && "border-primary/40 shadow-sm shadow-primary/10")}>
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-4">
                  <span className={cn("grid size-11 place-items-center rounded-lg", notification.is_read ? "bg-secondary" : "bg-primary text-primary-foreground")}>
                    <Bell className="size-5" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-slate-950">{notification.title}</h2>
                      <Badge variant={notification.is_read ? "secondary" : "default"}>{notification.is_read ? "Lida" : "Não lida"}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
                    <span className="mt-2 block text-xs text-muted-foreground">{new Date(notification.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                </div>
                <Button type="button" variant="outline" className="gap-2" onClick={() => markRead(notification.id)} disabled={notification.is_read}>
                  <CheckCheck className="size-4" />
                  Marcar lida
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AdminShell>
  );
}
