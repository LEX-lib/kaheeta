import { toast } from "vue-sonner";

/**
 * Single entry point for app toasts so every notification is formatted the same
 * way (consistent per-severity durations) and the repeated messages live in one
 * place. Import via `const toast = useToast()` — the returned object exposes the
 * same `success`/`error`/`info`/`warning` methods as vue-sonner (so existing
 * call sites are unchanged) plus named helpers for the strings used in 2+ files.
 *
 * Options are passed through and override the defaults, e.g.
 *   toast.info(msg, { action, duration: Infinity })   // PWA update toast
 */

type ToastOptions = Parameters<typeof toast.error>[1];

// Consistent default durations per severity (ms). Errors linger longest.
const DURATION = {
  success: 3000,
  info: 4000,
  warning: 5000,
  error: 6000,
} as const;

function success(message: string, opts?: ToastOptions) {
  return toast.success(message, { duration: DURATION.success, ...opts });
}
function info(message: string, opts?: ToastOptions) {
  return toast.info(message, { duration: DURATION.info, ...opts });
}
function warning(message: string, opts?: ToastOptions) {
  return toast.warning(message, { duration: DURATION.warning, ...opts });
}
function error(message: string, opts?: ToastOptions) {
  return toast.error(message, { duration: DURATION.error, ...opts });
}

// Shared messages — single source of truth for strings repeated across files.
const sessionExpired = () => error("Session expired. Please log in again.");
const fileTooLarge = (maxMb = 10) =>
  error(`File too large. Maximum size is ${maxMb} MB.`);
const fileTypeUnsupported = (allowed: string) =>
  error(`File type not supported. Use ${allowed}.`);
const locationDataRemoved = () => info("Location data removed.");
const imageProcessFailed = () =>
  error("Failed to process image. Please try again.");

const api = {
  success,
  info,
  warning,
  error,
  sessionExpired,
  fileTooLarge,
  fileTypeUnsupported,
  locationDataRemoved,
  imageProcessFailed,
  dismiss: toast.dismiss,
  /** Escape hatch to the raw vue-sonner `toast` for anything not wrapped here. */
  raw: toast,
};

export function useToast() {
  return api;
}
