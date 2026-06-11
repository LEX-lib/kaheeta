<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { Toaster } from "vue-sonner";
import KaheetaNavBar from "@/components/wallecx/KaheetaNavBar.vue";
import { useTheme } from "@/composables/useTheme";

const route = useRoute();
const { theme } = useTheme();
// One consistent navbar across landing, login, and wallet. The "Log in" CTA is
// suppressed on the login page itself, where it would be redundant.
const showLoginCta = computed(() => route.name !== "login");
</script>

<template>
  <div class="flex min-h-screen flex-col bg-surface-page">
    <KaheetaNavBar :show-login="showLoginCta" />
    <main class="flex flex-1 flex-col">
      <RouterView />
    </main>
  </div>
  <Toaster
    :theme="theme"
    rich-colors
    position="bottom-right"
    :close-button="true"
    close-button-position="top-right"
  />
</template>
