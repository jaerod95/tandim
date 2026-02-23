import { buildDesktopRoomDeepLink } from "./deepLink";

export type SlashCommandInput = {
  workspaceId: string;
  roomId: string;
};

export function createJoinCommandResponse(input: SlashCommandInput): {
  response_type: "ephemeral";
  text: string;
  deep_link: string;
} {
  return {
    response_type: "ephemeral",
    text: `Join room ${input.roomId}`,
    deep_link: buildDesktopRoomDeepLink(`${input.workspaceId}-${input.roomId}`)
  };
}
