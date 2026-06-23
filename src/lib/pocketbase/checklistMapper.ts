import type { Checklist } from "@/types/wallecx/checklists/types";

/**
 * Strip a checklist down to its writable backend fields (no id/created/updated/
 * user — `user` is set explicitly on create and never changed). Mirrors the
 * mapToUpdateX convention used across the PocketBase write layer.
 */
export function mapToUpdateChecklist(
  c: Pick<Checklist, "name" | "icon" | "color" | "order">,
): { name: string; icon: string; color: string; order: number } {
  return {
    name: c.name,
    icon: c.icon,
    color: c.color,
    order: c.order,
  };
}
