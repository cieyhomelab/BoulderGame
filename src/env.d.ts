declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
  }
}

interface Window {
  /** Present only under `?clock=manual`, so E2E tests can advance game time deterministically. */
  __boulderGameClock?: import("./lib/game-clock").ManualGameClock;
}
