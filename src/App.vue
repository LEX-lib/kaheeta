<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { Toaster } from "vue-sonner";
import KaheetaNavBar from "@/components/wallecx/KaheetaNavBar.vue";

const route = useRoute();
// The app navbar (theme toggle + logout) only belongs inside the Kaheeta app.
// The landing page has its own delveen nav; the login page has none.
const showNavBar = computed(() => route.name === "wallet");
</script>

<template>
  <KaheetaNavBar v-if="showNavBar" />
  <main>
    <RouterView />
  </main>
  <Toaster rich-colors position="top-right" />
</template>
