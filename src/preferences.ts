import { useSyncExternalStore } from "react";

// The preferences of the browser (docs/behaviors.md, Preferences), which the
// UI keeps in the origin's local storage: the tabs of the browser share it,
// and it lasts across restarts and sign-out. Each value of that storage is
// untrusted (docs/architecture.md, Same Origin): a value that a preference
// does not list counts as its default, so that a planted value changes only
// how the UI looks.

// A preference of the browser.
export interface Preference<TValue extends string> {
  // The value that applies now.
  get: () => TValue;
  // Stores a value, which applies at once in this tab and in every other one.
  set: (value: TValue) => void;
  // Calls the listener whenever the value may have changed, in this tab or in
  // another one, and returns the function that stops calling it.
  subscribe: (listener: () => void) => () => void;
}

// A preference stored under the key, whose stored value parse reads, the
// default included. When the browser blocks the storage, the preference
// reads its default, and a value set in this tab applies to this tab only.
export function storedPreference<TValue extends string>(
  key: string,
  parse: (value: string | null) => TValue,
): Preference<TValue> {
  const listeners = new Set<() => void>();
  // The value set while the browser blocks the storage.
  let unstored: TValue | undefined;

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };
  // Another tab changed the storage: the key of the event is null when it
  // cleared the storage.
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      notify();
    }
  };

  return {
    get() {
      try {
        return parse(window.localStorage.getItem(key));
      } catch {
        return unstored ?? parse(null);
      }
    },
    set(value) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        unstored = value;
      }
      notify();
    },
    subscribe(listener) {
      if (listeners.size === 0) {
        window.addEventListener("storage", onStorage);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          window.removeEventListener("storage", onStorage);
        }
      };
    },
  };
}

// The value of a preference, which the component shows again whenever it
// changes.
export function usePreference<TValue extends string>(
  preference: Preference<TValue>,
): TValue {
  return useSyncExternalStore(preference.subscribe, preference.get);
}

// The preference of the sidebar: expanded, by default, or collapsed to icons
// (docs/screen-map.md, Sidebar), which its own button sets. It applies only
// where the window is wide enough for the expanded sidebar beside the
// content.
export type SidebarPreference = "expanded" | "collapsed";

// The key of the preference of the sidebar in the origin's local storage.
export const SIDEBAR_STORAGE_KEY = "sentinel-aura:sidebar";

export function parseSidebarPreference(
  value: string | null,
): SidebarPreference {
  return value === "collapsed" ? value : "expanded";
}

export const sidebarPreference = storedPreference(
  SIDEBAR_STORAGE_KEY,
  parseSidebarPreference,
);
