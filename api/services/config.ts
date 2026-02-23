import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.string().min(1),
  SLACK_SIGNING_SECRET: z.string().min(1),
  STUN_URL: z.string().min(1),
  TURN_URL: z.string().optional(),
  TURN_USERNAME: z.string().optional(),
  TURN_CREDENTIAL: z.string().optional()
});

export type AppConfig = z.infer<typeof configSchema>;

export function validateConfig(env: NodeJS.ProcessEnv): AppConfig {
  return configSchema.parse(env);
}
