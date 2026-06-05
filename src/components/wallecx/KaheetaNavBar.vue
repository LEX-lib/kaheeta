<script setup lang="ts">
import { useRouter } from "vue-router";
import { useTheme } from "@/composables/useTheme";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const { theme, toggle } = useTheme();
const auth = useAuthStore();

async function logout() {
  auth.logout();
  await router.push({ name: "login" });
}
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
        <img src="/branding_logo.svg" alt="" width="28" height="28" />
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

        <Button
          v-if="auth.isLoggedIn"
          text
          rounded
          severity="secondary"
          aria-label="Log out"
          @click="logout"
        >
          <iconify-icon icon="mdi:logout" width="20" height="20" aria-hidden="true"></iconify-icon>
        </Button>
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
</style>
