import { describe, it, expect } from "vitest";
import { parseTandimDeepLink } from "../deepLink";

describe("parseTandimDeepLink", () => {
  describe("view-room (tandim://room/<roomId>)", () => {
    it("parses a basic room link", () => {
      expect(parseTandimDeepLink("tandim://room/general")).toEqual({
        type: "view-room",
        roomId: "general",
      });
    });

    it("handles room IDs with hyphens", () => {
      expect(parseTandimDeepLink("tandim://room/dev-team")).toEqual({
        type: "view-room",
        roomId: "dev-team",
      });
    });

    it("returns unknown for room path without roomId", () => {
      expect(parseTandimDeepLink("tandim://room/")).toEqual({
        type: "unknown",
      });
    });
  });

  describe("join-room (tandim://join/<roomId>)", () => {
    it("parses a basic join link", () => {
      expect(parseTandimDeepLink("tandim://join/general")).toEqual({
        type: "join-room",
        roomId: "general",
      });
    });

    it("handles room IDs with hyphens", () => {
      expect(parseTandimDeepLink("tandim://join/standup-room")).toEqual({
        type: "join-room",
        roomId: "standup-room",
      });
    });

    it("returns unknown for join path without roomId", () => {
      expect(parseTandimDeepLink("tandim://join/")).toEqual({
        type: "unknown",
      });
    });
  });

  describe("workspace (tandim://workspace/<workspaceId>)", () => {
    it("parses a workspace link", () => {
      expect(parseTandimDeepLink("tandim://workspace/team-alpha")).toEqual({
        type: "workspace",
        workspaceId: "team-alpha",
      });
    });

    it("returns unknown for workspace path without ID", () => {
      expect(parseTandimDeepLink("tandim://workspace/")).toEqual({
        type: "unknown",
      });
    });
  });

  describe("workspace + room (tandim://workspace/<wid>/room/<rid>)", () => {
    it("parses workspace + room link as view-room with workspaceId", () => {
      expect(
        parseTandimDeepLink("tandim://workspace/team-alpha/room/general"),
      ).toEqual({
        type: "view-room",
        roomId: "general",
        workspaceId: "team-alpha",
      });
    });
  });

  describe("workspace + join (tandim://workspace/<wid>/join/<rid>)", () => {
    it("parses workspace + join link as join-room with workspaceId", () => {
      expect(
        parseTandimDeepLink("tandim://workspace/team-alpha/join/general"),
      ).toEqual({
        type: "join-room",
        roomId: "general",
        workspaceId: "team-alpha",
      });
    });
  });

  describe("invalid / unknown inputs", () => {
    it("returns unknown for malformed URLs", () => {
      expect(parseTandimDeepLink("not a url")).toEqual({ type: "unknown" });
    });

    it("returns unknown for wrong protocol", () => {
      expect(parseTandimDeepLink("https://room/general")).toEqual({
        type: "unknown",
      });
    });

    it("returns unknown for empty path", () => {
      expect(parseTandimDeepLink("tandim://")).toEqual({ type: "unknown" });
    });

    it("returns unknown for unsupported route", () => {
      expect(parseTandimDeepLink("tandim://settings/profile")).toEqual({
        type: "unknown",
      });
    });

    it("returns unknown for extra segments on room path", () => {
      expect(parseTandimDeepLink("tandim://room/general/extra")).toEqual({
        type: "unknown",
      });
    });

    it("returns unknown for extra segments on join path", () => {
      expect(parseTandimDeepLink("tandim://join/general/extra")).toEqual({
        type: "unknown",
      });
    });

    it("returns unknown for workspace with unsupported sub-path", () => {
      expect(
        parseTandimDeepLink("tandim://workspace/team/settings/profile"),
      ).toEqual({ type: "unknown" });
    });
  });

  describe("backward compatibility", () => {
    it("existing tandim://room/<id> links still work as view-room", () => {
      const result = parseTandimDeepLink("tandim://room/lobby");
      expect(result.type).toBe("view-room");
      if (result.type === "view-room") {
        expect(result.roomId).toBe("lobby");
        expect(result.workspaceId).toBeUndefined();
      }
    });
  });
});
