<script setup lang="ts">
import { ref } from "vue";
import { useTheme } from "@/composables/useTheme";
import { useAuthStore } from "@/stores/auth";
import { useProfileMenu } from "@/composables/useProfileMenu";
import type Menu from "primevue/menu";

// The single app-wide navbar (landing, login, wallet). `showLogin` is set false
// on the login page itself, where a "Log in" CTA would be redundant.
withDefaults(defineProps<{ showLogin?: boolean }>(), { showLogin: true });

const { theme, toggle } = useTheme();
const auth = useAuthStore();
const { displayName, userInitials, profileMenuItems } = useProfileMenu();
const menuRef = ref<InstanceType<typeof Menu> | null>(null);

const LOGIN = { name: "login", query: { redirect: "/wallet" } } as const;
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
        <template v-if="!auth.isLoggedIn">
          <Button
            text
            rounded
            severity="secondary"
            :aria-label="
              theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            "
            @click="toggle"
          >
            <iconify-icon
              :icon="
                theme === 'dark' ? 'mdi:weather-sunny' : 'mdi:weather-night'
              "
              width="20"
              height="20"
              aria-hidden="true"
            ></iconify-icon>
          </Button>
          <Button
            v-if="showLogin"
            as="router-link"
            :to="LOGIN"
            unstyled
            class="nav-login-btn"
            >Log in</Button
          >
        </template>

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

/* Logged-out "Log in" CTA — amber brand pill with navy text. */
.nav-login-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.45rem 1.15rem;
  border: none;
  border-radius: 999px;
  background: #e89820; /* brand amber */
  color: #002244; /* brand navy */
  font-weight: 600;
  font-size: 0.9rem;
  line-height: 1;
  text-decoration: none;
  cursor: pointer;
  transition:
    background 0.18s ease,
    transform 0.18s ease;
}
.nav-login-btn:hover {
  background: #f5b450; /* amber-light */
  transform: translateY(-1px);
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
