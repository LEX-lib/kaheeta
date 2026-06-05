<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useTheme } from "@/composables/useTheme";
import { useAuthStore } from "@/stores/auth";
import type Menu from "primevue/menu";

const router = useRouter();
const { theme, toggle } = useTheme();
const auth = useAuthStore();
const menuRef = ref<InstanceType<typeof Menu> | null>(null);

const userInitials = computed(() => {
  const name: string = auth.user?.["name"] || auth.user?.["email"] || "";
  return name.slice(0, 2).toUpperCase() || "??";
});

const displayName = computed<string>(
  () => auth.user?.["name"] || auth.user?.["email"] || "Account",
);

async function logout() {
  auth.logout();
  await router.push({ name: "login" });
}

const profileMenuItems = computed(() => [
  { label: displayName.value, disabled: true, class: "profile-menu-label" },
  { separator: true },
  { label: "Log out", icon: "pi pi-sign-out", command: logout },
]);
</script>

<template>
  <header
    class="kaheeta-navbar"
    :style="{
      paddingTop: 'env(safe-area-inset-top)',
      paddingLeft: 'env(safe-area-inset-left)',
      paddingRight: 'env(safe-area-inset-right)',
    }"
  >
    <div class="kaheeta-navbar-inner">
      <RouterLink to="/" class="kaheeta-brand" aria-label="Kaheeta home">
        <img src="/kaheeta-logo.svg" alt="" width="28" height="28" />
        <span class="kaheeta-brand-name">Kaheeta</span>
      </RouterLink>

      <div class="kaheeta-navbar-actions">
        <Button
          text
          rounded
          severity="secondary"
          :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggle"
        >
          <iconify-icon
            :icon="theme === 'dark' ? 'mdi:weather-sunny' : 'mdi:weather-night'"
            width="20"
            height="20"
            aria-hidden="true"
          ></iconify-icon>
        </Button>

        <template v-if="auth.isLoggedIn">
          <Menu ref="menuRef" :model="profileMenuItems" popup />
          <button
            class="profile-trigger"
            :aria-label="`Account menu for ${displayName}`"
            @click="menuRef?.toggle($event)"
          >
            <span class="profile-avatar">{{ userInitials }}</span>
            <span class="profile-name">{{ displayName }}</span>
            <iconify-icon
              icon="mdi:chevron-down"
              width="16"
              height="16"
              aria-hidden="true"
            ></iconify-icon>
          </button>
        </template>
      </div>
    </div>
  </header>
</template>

<style scoped>
.kaheeta-navbar {
  position: sticky;
  top: 0;
  z-index: 40;
  background: var(--color-surface-card, #ffffff);
  border-bottom: 1px solid var(--color-surface-divider, #e8ecf2);
}

.kaheeta-navbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  max-width: 1100px;
  margin: 0 auto;
  padding: 0.5rem 0.75rem;
}

.kaheeta-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  color: var(--color-typo-heading, #0d1117);
}

.kaheeta-brand-name {
  font-weight: 700;
  font-size: 1.125rem;
}

.kaheeta-navbar-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.profile-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.6rem 0.3rem 0.3rem;
  border: 1px solid var(--color-surface-divider, #e8ecf2);
  border-radius: 999px;
  background: transparent;
  color: var(--color-typo-heading, #0d1117);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition:
    background 0.18s ease,
    border-color 0.18s ease;
}
.profile-trigger:hover {
  background: var(--color-surface-card, #f5f7fa);
  border-color: var(--p-primary-500, #002244);
}

.profile-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--p-primary-500, #002244);
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 700;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  letter-spacing: 0.02em;
}

.profile-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 480px) {
  .profile-name {
    display: none;
  }
}
</style>
