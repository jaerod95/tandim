export type IceMode = "direct" | "relay";

export function selectIceMode(input: {
  directConnectionSucceeded: boolean;
  relayConnectionSucceeded: boolean;
}): IceMode | "failed" {
  if (input.directConnectionSucceeded) {
    return "direct";
  }
  if (input.relayConnectionSucceeded) {
    return "relay";
  }
  return "failed";
}
