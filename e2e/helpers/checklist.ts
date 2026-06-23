import type { Page } from "@playwright/test";

type Rec = Record<string, unknown>;

interface Seed {
  checklists: Rec[];
  tasks: Rec[];
}

let counter = 0;
function genId(): string {
  counter += 1;
  return `rec${counter.toString().padStart(12, "0")}`;
}

/**
 * Stateful in-memory mock of the two checklist PocketBase collections, so the
 * real pb code path (instrumentedGetFullList + create/update/delete) is
 * exercised without a live backend. Handles list (GET), create (POST),
 * update (PATCH) and delete (DELETE) for both collections.
 *
 * Register AFTER the generic stubPocketBase so these more specific routes win
 * (Playwright tries the most-recently-added matching route first).
 */
export async function mockChecklistApi(page: Page, seed: Seed): Promise<void> {
  const stores: Record<string, Rec[]> = {
    kaheeta_checklists: seed.checklists.map((c) => ({ ...c })),
    kaheeta_checklist_tasks: seed.tasks.map((t) => ({ ...t })),
  };

  for (const name of Object.keys(stores)) {
    const items = stores[name]!;

    // list (GET) + create (POST) — path ends at /records (optionally with query).
    await page.route(
      new RegExp(`/api/collections/${name}/records(\\?|$)`),
      async (route) => {
        const method = route.request().method();
        if (method === "GET") {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              page: 1,
              perPage: 500,
              totalItems: items.length,
              totalPages: 1,
              items,
            }),
          });
        }
        if (method === "POST") {
          const body = JSON.parse(route.request().postData() ?? "{}") as Rec;
          const rec: Rec = {
            id: genId(),
            created: "2026-01-01 00:00:00.000Z",
            updated: "2026-01-01 00:00:00.000Z",
            collectionId: name,
            collectionName: name,
            ...body,
          };
          items.push(rec);
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(rec),
          });
        }
        return route.fallback();
      },
    );

    // view (GET) / update (PATCH) / delete (DELETE) — path ends at /records/<id>.
    await page.route(
      new RegExp(`/api/collections/${name}/records/[^/?]+`),
      async (route) => {
        const method = route.request().method();
        const id = new URL(route.request().url()).pathname.split("/").pop() ?? "";
        const idx = items.findIndex((r) => r.id === id);
        if (method === "PATCH") {
          const body = JSON.parse(route.request().postData() ?? "{}") as Rec;
          if (idx !== -1) {
            items[idx] = { ...items[idx], ...body, updated: "2026-01-02 00:00:00.000Z" };
          }
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(items[idx] ?? body),
          });
        }
        if (method === "DELETE") {
          if (idx !== -1) {
            items.splice(idx, 1);
          }
          return route.fulfill({ status: 204, body: "" });
        }
        if (method === "GET") {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(items[idx] ?? {}),
          });
        }
        return route.fallback();
      },
    );
  }
}

/** A small, deterministic seed: Groceries (2 of 4 done) + Errands (1 of 2). */
export function checklistSeed(): Seed {
  const mkTask = (
    id: string,
    checklist: string,
    title: string,
    done: boolean,
    order: number,
  ): Rec => ({ id, checklist, title, done, order, subtasks: [], user: "e2e_user" });

  return {
    checklists: [
      { id: "cl1", name: "Groceries", icon: "mdi:cart-outline", color: "#e89820", order: 0, user: "e2e_user" },
      { id: "cl2", name: "Errands", icon: "mdi:run-fast", color: "#378add", order: 1, user: "e2e_user" },
    ],
    tasks: [
      mkTask("t1", "cl1", "Apples", true, 0),
      mkTask("t2", "cl1", "Bread", true, 1),
      mkTask("t3", "cl1", "Coffee", false, 2),
      mkTask("t4", "cl1", "Eggs", false, 3),
      mkTask("t5", "cl2", "Bank", true, 0),
      mkTask("t6", "cl2", "Post office", false, 1),
    ],
  };
}
