import { computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import type { MenuItem } from "primevue/menuitem";
import { useAuthStore } from "@/stores/auth";

/**
 * Shared logged-in profile menu used by the app-wide KaheetaNavBar. Exposes the
 * display identity plus a PrimeVue MenuItem[] (My Wallet, Log out). The theme
 * toggle lives in the navbar itself (always visible), not in this menu.
 * "My Wallet" is omitted when already on the wallet page.
 */
export function useProfileMenu() {
  const router = useRouter();
  const route = useRoute();
  const auth = useAuthStore();

  const displayName = computed<string>(
    () => auth.user?.["name"] || auth.user?.["email"] || "Account",
  );

  const userInitials = computed<string>(() => {
    const name: string = auth.user?.["name"] || auth.user?.["email"] || "";
    return name.slice(0, 2).toUpperCase() || "??";
  });

  async function logout(): Promise<void> {
    auth.logout();
    await router.push({ name: "login" });
  }

  const profileMenuItems = computed<MenuItem[]>(() => {
    const items: MenuItem[] = [
      { label: displayName.value, disabled: true, class: "profile-menu-label" },
      { separator: true },
    ];
    // Skip "My Wallet" when already on the wallet page.
    if (route.name !== "wallet") {
      items.push({
        label: "My Wallet",
        icon: "pi pi-wallet",
        command: () => router.push({ name: "wallet" }),
      });
      items.push({ separator: true });
    }
    items.push({ label: "Log out", icon: "pi pi-sign-out", command: logout });
    return items;
  });

  return { displayName, userInitials, profileMenuItems };
}
