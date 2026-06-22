import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { pb } from "@/lib/pocketbase";
import type { RecordModel } from "pocketbase";

export const useAuthStore = defineStore("auth", () => {
  // Only treat the record as a logged-in user when the token is still valid.
  // PocketBase keeps `record` populated after the JWT expires, so reading it
  // directly would leave the navbar showing a name for a dead session.
  const currentUser = () => (pb.authStore.isValid ? pb.authStore.record : null);

  const user = ref<RecordModel | null>(currentUser());

  const isLoggedIn = computed(() => !!user.value);

  pb.authStore.onChange(() => {
    user.value = currentUser();
  });

  async function login(email: string, password: string) {
    await pb.collection("users").authWithPassword(email, password);
  }
  //
  // async function signup(email, password, passwordConfirm, name) {
  //     await pb.collection('users').create({
  //         email,
  //         password,
  //         passwordConfirm,
  //         name,
  //     });
  //     // Optional: log them in immediately after signup
  //     await login(email, password);
  // }
  //
  function logout() {
    pb.authStore.clear();
  }

  return { user, isLoggedIn, login, logout }; //, signup, logout
});
