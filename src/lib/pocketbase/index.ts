import PocketBase from "pocketbase";

const baseUrl = import.meta.env.VITE_API_BASE_URL;

export const pb = new PocketBase(baseUrl);

// SSO: pick up a session written by the sibling delveen.cc app before this
// app's own router guards evaluate. loadFromCookie clears the store when the
// cookie is absent/unreadable, so only defer to it when there's no valid
// local session to protect — otherwise a missing cookie would log out a
// perfectly valid localStorage session on every refresh.
if (!pb.authStore.isValid) {
  pb.authStore.loadFromCookie(document.cookie);
}

// Token expiry is passive — no event fires when the JWT lapses mid-session.
// A 401 from the backend is the authoritative signal that the current token is
// no longer accepted, so clear the auth store. The clear() fires authStore's
// onChange, which reactively flips the navbar to logged-out. Guarded on
// `record` so we only act when there's actually a session to tear down.
// `afterSend` runs before the SDK throws its ClientResponseError, so this does
// not swallow the rejection — callers still see the failed request.
pb.afterSend = (response, data) => {
  if (response.status === 401 && pb.authStore.record) {
    pb.authStore.clear();
  }
  return data;
};
