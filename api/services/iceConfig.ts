export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type IceConfigResponse = {
  iceServers: IceServer[];
};

export function getIceConfigFromEnv(env: NodeJS.ProcessEnv): IceConfigResponse {
  const stunUrl = env.STUN_URL?.trim() || "stun:stun.l.google.com:19302";
  const turnUrl = env.TURN_URL?.trim();
  const turnUsername = env.TURN_USERNAME?.trim();
  const turnCredential = env.TURN_CREDENTIAL?.trim();

  const iceServers: IceServer[] = [{ urls: stunUrl }];

  if (turnUrl && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential
    });
  }

  return { iceServers };
}
