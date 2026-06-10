<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { ref, reactive } from "vue";
import { zodResolver } from "@primevue/forms/resolvers/zod";
import { useAuthStore } from "@/stores/auth";
import { useRouter, useRoute } from "vue-router";
import { z } from "zod";
import { Form, type FormSubmitEvent } from "@primevue/forms";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const remember = ref(false);

const login = async ({ valid, values }: FormSubmitEvent) => {
  if (!valid) return;

  try {
    await auth.login(values.email, values.password);

    // Determine safe redirect target
    const redirectRaw = route.query.redirect;
    let target = "/wallet";
    if (
      typeof redirectRaw === "string" &&
      redirectRaw.startsWith("/") &&
      !redirectRaw.startsWith("//")
    ) {
      target = redirectRaw;
    }

    // Use replace so login is not kept in history
    await router.replace(target);
  } catch (error) {
    // Handle login error (e.g., show error message)
    console.error("Login failed:", error);
  }
};

const initialValues = reactive({
  email: "",
  password: "",
});

const resolver = ref(
  zodResolver(
    z.object({
      //email: z.string().min(1, { message: 'Email is required.' }).email({ message: 'Invalid email address.' }),
      email: z
        .email({ message: "Invalid email address." })
        .min(1, { message: "Email is required." }), //error : 'Invalid email address.'
      password: z.string().min(1, { message: "Password is required." }),
    }),
  ),
);
</script>

<template>
  <div class="flex flex-1 items-center justify-center p-4 login-bg">
    <div class="w-full max-w-md">
      <div
        class="relative rounded-2xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-xl p-6 sm:p-8"
      >
        <div
          class="absolute inset-0 rounded-2xl pointer-events-none"
          style="box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.25)"
        ></div>
        <div class="mb-6 text-center">
          <h1
            class="text-2xl font-semibold text-black dark:text-white drop-shadow"
          >
            Welcome back
          </h1>
          <p class="mt-1 text-black/80 dark:text-white/80 text-sm">
            Sign in to continue
          </p>
        </div>

        <Form
          v-slot="$form"
          :initialValues
          :resolver
          @submit="login"
          class="space-y-5"
          validate-on-submit
        >
          <div class="flex flex-col gap-1">
            <FloatLabel variant="on">
              <InputText
                name="email"
                id="email"
                autocomplete="email"
                type="text"
                fluid
              />
              <Message
                v-if="$form.email?.invalid"
                severity="error"
                size="small"
                variant="simple"
              >
                {{ $form.email.error?.message }}
              </Message>
              <label for="email">Email</label>
            </FloatLabel>
          </div>

          <div class="flex flex-col gap-1">
            <FloatLabel variant="on">
              <Password
                name="password"
                :feedback="false"
                id="password"
                fluid
                toggleMask
                autocomplete="password"
              />
              <Message
                v-if="$form.password?.invalid"
                severity="error"
                size="small"
                variant="simple"
              >
                {{ $form.password.error?.message }}
              </Message>
              <label for="password">Password</label>
            </FloatLabel>
          </div>

          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Checkbox input-id="remember" v-model="remember" :binary="true" />
              <label
                for="remember"
                class="text-sm text-black/90 dark:text-white/90"
                >Remember me</label
              >
            </div>
          </div>

          <Button
            type="submit"
            label="Sign in"
            icon="pi pi-sign-in"
            class="w-full"
          />
        </Form>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Subtle gradient text helper if needed */
:deep(.p-inputtext),
:deep(.p-password),
:deep(.p-checkbox),
:deep(.p-button) {
  /* Ensure frosted container vibes by lifting contrast inside glass */
}

/* Brand-aligned backdrop — amber glow over a navy-tinted base, matching the
   landing hero. Surface + amber glow come from shared tokens (so the base flips
   to navy in dark automatically); the secondary navy glow is kept explicit
   because --color-brand-primary inverts to amber in dark. */
.login-bg {
  background-color: var(--color-surface-page);
  background-image:
    radial-gradient(
      900px 500px at 12% -10%,
      color-mix(in srgb, var(--color-brand-accent) 16%, transparent),
      transparent 60%
    ),
    radial-gradient(
      800px 600px at 100% 110%,
      color-mix(in srgb, var(--color-brand-primary) 8%, transparent),
      transparent 55%
    );
}

:global(.my-app-dark) .login-bg {
  background-image:
    radial-gradient(
      900px 500px at 12% -10%,
      color-mix(in srgb, var(--color-brand-accent) 18%, transparent),
      transparent 60%
    ),
    radial-gradient(800px 600px at 100% 110%, rgba(13, 51, 96, 0.9), transparent 55%);
}
</style>
