<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { Toaster } from "vue-sonner";
import KaheetaNavBar from "@/components/wallecx/KaheetaNavBar.vue";

const route = useRoute();
const showNavBar = computed(() => route.name !== "login");
</script>

<template>
  <KaheetaNavBar v-if="showNavBar" />
  <main>
    <RouterView />
  </main>
  <Toaster rich-colors position="top-right" />
</template>
