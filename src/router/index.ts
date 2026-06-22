import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { pb } from "@/lib/pocketbase";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "landing",
      component: () => import("@/components/landing/LandingPage.vue"),
    },
    {
      path: "/wallet",
      name: "wallet",
      component: () => import("@/components/wallecx/WallecxApp.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/login",
      name: "login",
      component: () => import("@/components/Login.vue"),
    },
    {
      path: "/:pathMatch(.*)*",
      redirect: "/",
    },
  ],
});

router.beforeEach((to) => {
  // Token expiry is passive — no event fires when the JWT lapses. Clear a stale
  // session on navigation so the auth store (and navbar) reflect reality.
  if (!pb.authStore.isValid && pb.authStore.record) {
    pb.authStore.clear();
  }

  const auth = useAuthStore();
  if (to.meta?.requiresAuth && !auth.isLoggedIn) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
});

export default router;
