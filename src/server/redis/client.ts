import "server-only";
import { Redis } from "@upstash/redis";
import { env } from "@/server/env";

let redis: Redis | null = null;

export function getRedis(): Redis {
  redis ??= new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
  return redis;
}
