/**
 * dashjs (v5) — minimal typings for tsc; runtime types come from the package.
 */
declare module "dashjs" {
  export interface MediaPlayerInstance {
    updateSettings(settings: unknown): void;
    initialize(element: HTMLVideoElement, url: string, autoplay: boolean): void;
    on(event: string, callback: () => void): void;
    reset(): void;
  }

  interface MediaPlayerFactory {
    (): { create(): MediaPlayerInstance };
    events: { readonly ERROR: string; readonly STREAM_INITIALIZED: string };
  }

  export const MediaPlayer: MediaPlayerFactory;
}
