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
  <div class="login-shell">
    <!-- Brand showcase panel -->
    <section class="brand-panel">
      <div class="brand-content">
        <RouterLink to="/" class="brand-mark" aria-label="Kaheeta home">
          <img src="/kaheeta-logo.svg" alt="" width="32" height="32" />
          <span>Kaheeta</span>
        </RouterLink>

        <div class="accent-rule"></div>
        <h1 class="brand-title">
          Your wallet,<br /><span class="em">digitized.</span>
        </h1>
        <p class="brand-tagline">
          The everyday Filipino wallet — your IDs, cards, vaccination records
          and receipts — always in your pocket.
        </p>

        <ul class="brand-features">
          <li>
            <iconify-icon
              icon="mdi:card-account-details-outline"
              width="20"
              height="20"
              aria-hidden="true"
            ></iconify-icon>
            IDs &amp; membership cards
          </li>
          <li>
            <iconify-icon
              icon="mdi:receipt-text-outline"
              width="20"
              height="20"
              aria-hidden="true"
            ></iconify-icon>
            Receipts &amp; expenses
          </li>
          <li>
            <iconify-icon
              icon="mdi:needle"
              width="20"
              height="20"
              aria-hidden="true"
            ></iconify-icon>
            Vaccination records
          </li>
        </ul>
      </div>
    </section>

    <!-- Sign-in form panel -->
    <section class="form-panel">
      <div class="form-content">
        <div class="form-head">
          <h2>Welcome back</h2>
          <p>Sign in to open your wallet.</p>
        </div>

        <Form
          v-slot="$form"
          :initialValues
          :resolver
          @submit="login"
          class="login-form"
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

          <div class="flex items-center gap-2">
            <Checkbox input-id="remember" v-model="remember" :binary="true" />
            <label for="remember" class="remember-label">Remember me</label>
          </div>

          <button type="submit" class="login-submit">
            Log in
            <span class="arrow">→</span>
          </button>
        </Form>

        <p class="invite-note">Sign-up is invite-only (beta)</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.login-shell {
  display: flex;
  flex: 1;
  flex-direction: column;
  font-family:
    "Inter",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    Helvetica,
    Arial,
    sans-serif;
}

/* ─── Brand showcase panel (always navy, both themes) ─────────────────────── */
.brand-panel {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  color: #ffffff;
  background:
    radial-gradient(
      700px 420px at 12% -10%,
      color-mix(in srgb, var(--color-brand-accent) 20%, transparent),
      transparent 60%
    ),
    var(--color-brand-primary);
}
/* dot grid, fading toward the form panel */
.brand-panel::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image: radial-gradient(
    rgba(255, 255, 255, 0.05) 1px,
    transparent 1px
  );
  background-size: 24px 24px;
  mask-image: linear-gradient(to bottom, black, transparent 82%);
  -webkit-mask-image: linear-gradient(to bottom, black, transparent 82%);
  pointer-events: none;
}
.brand-content {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 34rem;
  margin: 0 auto;
  padding: clamp(1.5rem, 4vw, 2rem) clamp(1.25rem, 5vw, 2.5rem);
}
.brand-mark {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 800;
  font-size: 1.25rem;
  letter-spacing: -0.02em;
  color: #ffffff;
  text-decoration: none;
}
.accent-rule {
  width: 56px;
  height: 5px;
  border-radius: 999px;
  background: var(--color-brand-accent);
  margin: 1.75rem 0 1.25rem;
}
.brand-title {
  font-weight: 900;
  font-size: clamp(2rem, 4vw, 3.25rem);
  line-height: 0.95;
  letter-spacing: -0.03em;
}
.brand-title .em {
  color: var(--color-brand-accent);
}
.brand-tagline {
  color: rgba(215, 226, 240, 0.82);
  font-size: 1.05rem;
  line-height: 1.6;
  max-width: 34ch;
  margin-top: 1.25rem;
}
.brand-features {
  list-style: none;
  margin: 2rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.brand-features li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.98rem;
  color: #d7e2f0;
}
.brand-features iconify-icon {
  color: var(--color-brand-accent);
  flex-shrink: 0;
}

/* ─── Form panel ──────────────────────────────────────────────────────────── */
.form-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(1.75rem, 5vw, 3.5rem);
  background: var(--color-surface-card);
}
.form-content {
  width: 100%;
  max-width: 23rem;
}
.form-head {
  margin-bottom: 1.75rem;
}
.form-head h2 {
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--color-typo-heading);
}
.form-head p {
  margin-top: 0.3rem;
  color: var(--color-typo-muted);
  font-size: 0.95rem;
}
.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
}
.remember-label {
  font-size: 0.875rem;
  color: var(--color-typo-body);
}
.login-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.72rem 1.2rem;
  border: none;
  border-radius: 999px;
  background: var(--color-brand-accent);
  color: #002244; /* brand navy — invariant contrast on amber */
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition:
    background 0.18s ease,
    transform 0.18s ease;
}
.login-submit:hover {
  background: var(--color-brand-accent-hover);
  transform: translateY(-1px);
}
.login-submit .arrow {
  transition: transform 0.18s ease;
}
.login-submit:hover .arrow {
  transform: translateX(3px);
}
.invite-note {
  margin-top: 1.5rem;
  text-align: center;
  font-size: 0.85rem;
  color: var(--color-typo-muted);
}

/* ─── Responsive: split on desktop, stacked slim header on mobile ─────────── */
@media (min-width: 1024px) {
  .login-shell {
    flex-direction: row;
  }
  .brand-panel {
    flex: 0 0 46%;
    max-width: 46%;
  }
}
@media (max-width: 1023px) {
  /* Compact navy header above the form. */
  .brand-tagline,
  .brand-features {
    display: none;
  }
  .accent-rule {
    margin: 1.25rem 0 1rem;
  }
  .brand-title {
    font-size: 1.9rem;
  }
}
</style>
