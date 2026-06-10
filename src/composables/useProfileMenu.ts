import { computed } from "vue";
import { useRouter } from "vue-router";
import type { MenuItem } from "primevue/menuitem";
import { useTheme } from "@/composables/useTheme";
import { useAuthStore } from "@/stores/auth";

/**
 * Shared logged-in profile menu used by both the landing nav and the in-app
 * KaheetaNavBar so the two stay in sync. Exposes the display identity plus a
 * PrimeVue MenuItem[] (My Wallet, theme toggle, Log out).
 */
export function useProfileMenu() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
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

  const profileMenuItems = computed<MenuItem[]>(() => [
    { label: displayName.value, disabled: true, class: "profile-menu-label" },
    { separator: true },
    {
      label: "My Wallet",
      icon: "pi pi-wallet",
      command: () => router.push({ name: "wallet" }),
    },
    {
      label: theme.value === "dark" ? "Light mode" : "Dark mode",
      icon: theme.value === "dark" ? "pi pi-sun" : "pi pi-moon",
      command: toggle,
    },
    { separator: true },
    { label: "Log out", icon: "pi pi-sign-out", command: logout },
  ]);

  return { displayName, userInitials, profileMenuItems };
}
