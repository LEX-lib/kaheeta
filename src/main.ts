import { createApp } from "vue";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import ConfirmationService from "primevue/confirmationservice";
import Aura from "@primeuix/themes/aura";
import { addCollection } from "iconify-icon";
import mdiIcons from "@/lib/mdi-icons.json";
import "./assets/main.css";

// Preload the mdi icons the app uses so they render at first paint without a
// runtime fetch from the Iconify API. Avoids blank icons on cold loads (and on
// networks that block the CDN). Regenerate src/lib/mdi-icons.json when adding a
// new mdi icon. Icons not in this set still fall back to the runtime API.
addCollection(mdiIcons);

import App from "./App.vue";
import router from "./router";
import "primeicons/primeicons.css";
import "vue-sonner/style.css";
//import "./assets/sonner-brand.css"; // brand overrides — must come after sonner's styles
import { definePreset } from "@primeuix/themes";

// Brand palette:
//   Primary (navy):  #002244
//   Accent  (amber): #E89820
// The primary scale below is a hand-crafted navy ramp from near-white (#e8edf4)
// down to near-black (#00111f), with 500 anchored at the brand primary #002244.
const MyPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: "#e8edf4",
      100: "#c5d2e4",
      200: "#9fb4cf",
      300: "#7896ba",
      400: "#3d6a9a",
      500: "#002244", // brand primary
      600: "#001e3c",
      700: "#001833",
      800: "#00122a",
      900: "#000c1f",
      950: "#00060f",
    },
    colorScheme: {
      light: {
        primary: {
          color: "#002244",
          inverseColor: "#ffffff",
          hoverColor: "#0a3d6b",
          activeColor: "#001e3c",
        },
        highlight: {
          background: "#fdf3dc",
          focusBackground: "#e89820",
          color: "#002244",
          focusColor: "#ffffff",
        },
      },
      dark: {
        primary: {
          color: "#e89820",
          inverseColor: "#002244",
          hoverColor: "#f0ab40",
          activeColor: "#c87d10",
        },
        highlight: {
          background: "rgba(232,152,32,0.16)",
          focusBackground: "rgba(232,152,32,0.24)",
          color: "#fdf3dc",
          focusColor: "#fdf3dc",
        },
      },
    },
  },
});

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(PrimeVue, {
  theme: {
    preset: MyPreset,
    options: {
      prefix: "p",
      darkModeSelector: ".my-app-dark",
      cssLayer: false,
    },
  },
  ripple: true,
  pt: {
    button: {
      root: {
        class: "p-button-sm",
      },
    },
  },
});
app.use(ConfirmationService);

app.mount("#app");
