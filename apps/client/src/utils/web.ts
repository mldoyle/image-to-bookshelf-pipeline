import { Platform, useWindowDimensions } from "react-native";

export const WEB_DESKTOP_MIN_WIDTH = 1024;

export type WebViewportMode = "native" | "web-mobile" | "web-desktop";

export function useWebViewportMode(): { mode: WebViewportMode; isWebDesktop: boolean; isWebMobile: boolean } {
  const { width } = useWindowDimensions();

  if (Platform.OS !== "web") {
    return { mode: "native", isWebDesktop: false, isWebMobile: false };
  }

  if (width >= WEB_DESKTOP_MIN_WIDTH) {
    return { mode: "web-desktop", isWebDesktop: true, isWebMobile: false };
  }

  return { mode: "web-mobile", isWebDesktop: false, isWebMobile: true };
}

export function injectWebFonts(): void {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return;
  }

  const existing = document.getElementById("shelf-web-fonts");
  if (existing) {
    return;
  }

  const link = document.createElement("link");
  link.id = "shelf-web-fonts";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;700&family=Source+Serif+4:wght@400;600;700&display=swap";
  document.head.appendChild(link);
}
