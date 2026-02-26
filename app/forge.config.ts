/**
 * Electron Forge configuration for Tandim.
 *
 * macOS Code Signing & Notarization:
 *
 *   Ad-hoc signing (local development, no env vars needed):
 *     pnpm make
 *     Signs with identity "-" (ad-hoc), sufficient for local testing.
 *
 *   Real signing + notarization (distribution builds):
 *     Set these env vars before running make/publish:
 *       APPLE_IDENTITY     — Signing identity (e.g. "Developer ID Application: Name (TEAMID)")
 *       APPLE_ID           — Apple ID email for notarization
 *       APPLE_ID_PASSWORD  — App-specific password (generate at appleid.apple.com)
 *       APPLE_TEAM_ID      — Apple Developer Team ID
 *     Then: pnpm make  (or pnpm publish for GitHub releases)
 *
 *   Publishing to GitHub releases:
 *     Set GITHUB_TOKEN env var, then: pnpm publish
 */

import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import path from "path";

const shouldNotarize =
  process.env.APPLE_ID &&
  process.env.APPLE_ID_PASSWORD &&
  process.env.APPLE_TEAM_ID;

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: "./src/assets/icon",
    osxSign: {
      identity: process.env.APPLE_IDENTITY || "-",
      optionsForFile: () => ({
        entitlements: path.resolve(__dirname, "entitlements.plist"),
        "entitlements-inherit": path.resolve(
          __dirname,
          "entitlements.inherit.plist"
        ),
      }),
    },
    ...(shouldNotarize && {
      osxNotarize: {
        appleId: process.env.APPLE_ID!,
        appleIdPassword: process.env.APPLE_ID_PASSWORD!,
        teamId: process.env.APPLE_TEAM_ID!,
      },
    }),
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ["darwin"]),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "jaerod95",
          name: "tandim",
        },
        prerelease: true,
      },
    },
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.mts",
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
