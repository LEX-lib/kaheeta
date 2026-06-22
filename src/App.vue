<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import { Toaster } from "vue-sonner";
import KaheetaNavBar from "@/components/wallecx/KaheetaNavBar.vue";
import { useTheme } from "@/composables/useTheme";
import {
  setInstallPromptEvent,
  clearInstallPromptEvent,
  type BeforeInstallPromptEvent,
} from "@/composables/useMobileEnv";

const route = useRoute();
const { theme } = useTheme();
// One consistent navbar across landing, login, and wallet. The "Log in" CTA is
// suppressed on the login page itself, where it would be redundant.
const showLoginCta = computed(() => route.name !== "login");

// Capture the Android `beforeinstallprompt` event (FND-02) so PwaInstallBanner's
// Android branch can offer an Install button. Without this capture the event is
// never stored, installPromptEvent stays null, and the banner never renders.
// preventDefault() suppresses Chrome's default mini-infobar in favour of our UI.
function onBeforeInstallPrompt(event: Event) {
  event.preventDefault();
  setInstallPromptEvent(event as BeforeInstallPromptEvent);
}

// Once the app is installed the stored event is spent — clear it so the banner
// (and any future Install button) hides.
function onAppInstalled() {
  clearInstallPromptEvent();
}

onMounted(() => {
  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.addEventListener("appinstalled", onAppInstalled);
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.removeEventListener("appinstalled", onAppInstalled);
});
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
