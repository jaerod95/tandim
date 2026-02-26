import { nativeImage, NativeImage } from "electron";

export type TrayStatus =
  | "available"
  | "in-call"
  | "idle"
  | "dnd"
  | "offline";

const STATUS_COLORS: Record<TrayStatus, string> = {
  available: "#22c55e", // green
  "in-call": "#3b82f6", // blue
  idle: "#eab308", // yellow
  dnd: "#ef4444", // red
  offline: "#9ca3af", // gray
};

/**
 * Build a data-URL for a small circle icon rendered in an off-screen canvas.
 *
 * The image is 32x32 (renders at 16x16 @2x on macOS retina).
 * On macOS we create a "template image" — Electron will recolor it
 * automatically based on the menu-bar theme, so we draw in black and
 * attach a small colored badge.  On other platforms we draw a filled
 * circle in the status color directly.
 */
function buildIconDataUrl(
  status: TrayStatus,
  isMac: boolean,
): string {
  const size = 32;
  const color = STATUS_COLORS[status];

  // We generate a minimal PNG using a raw data-URL SVG trick:
  // Electron's nativeImage.createFromDataURL supports SVG data URLs.
  if (isMac) {
    // macOS template images: draw a simple shape in black with alpha.
    // The colored indicator is a small badge in the corner.
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
      `  <circle cx="16" cy="16" r="12" fill="black" opacity="0.85"/>`,
      `  <circle cx="24" cy="24" r="6" fill="${color}"/>`,
      `</svg>`,
    ].join("");
  }

  // Windows / Linux: full colored circle
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `  <circle cx="16" cy="16" r="14" fill="${color}"/>`,
    `  <circle cx="16" cy="16" r="10" fill="white" opacity="0.25"/>`,
    `  <circle cx="16" cy="16" r="9" fill="${color}"/>`,
    `</svg>`,
  ].join("");
}

/**
 * Create a NativeImage tray icon for the given presence status.
 *
 * On macOS the image is marked as a template so the OS can adapt it
 * to light / dark menu bars.
 */
export function createTrayIcon(status: TrayStatus): NativeImage {
  const isMac = process.platform === "darwin";
  const svg = buildIconDataUrl(status, isMac);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  const image = nativeImage.createFromDataURL(dataUrl);

  // On macOS mark the main shape as a template image so the menu bar
  // adapts it for light/dark mode.  The colored badge will still show
  // through because it uses an explicit fill color.
  if (isMac) {
    image.setTemplateImage(true);
  }

  return image;
}
