import { randomInt } from 'node:crypto';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import type { Redis } from 'ioredis';
import type { Env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';

type StoredChallenge = {
  hash: string;
  attempts: number;
};

const RESEND_COOLDOWN_SECONDS = 60;
const DAILY_REQUEST_CAP = 10;

/**
 * OTP state lives in Redis rather than Postgres: it is short-lived, high-churn
 * and worthless after five minutes, so it should expire on its own rather than
 * accumulate rows that later need purging.
 *
 * Codes are argon2-hashed even though they are only six digits and live five
 * minutes, because a Redis snapshot leaking live login codes for every trader
 * currently signing in is a full account-takeover primitive.
 */
export class OtpStore {
  constructor(
    private readonly redis: Redis,
    private readonly env: Env,
  ) {}

  private challengeKey(phone: string) {
    return `otp:challenge:${phone}`;
  }

  private cooldownKey(phone: string) {
    return `otp:cooldown:${phone}`;
  }

  private dailyKey(phone: string) {
    return `otp:daily:${phone}`;
  }

  /**
   * Layered limits, because every SMS costs real money and an unthrottled OTP
   * endpoint is a way to bill a company to exhaustion. The per-IP limit lives on
   * the route; these two are per phone number, which is what an attacker
   * rotating IPs cannot change.
   */
  async assertCanRequest(phone: string): Promise<void> {
    if (await this.redis.exists(this.cooldownKey(phone))) {
      throw new AppError('rate_limited', 'A code was just sent. Wait a moment before retrying.');
    }

    const dailyKey = this.dailyKey(phone);
    const count = await this.redis.incr(dailyKey);
    if (count === 1) await this.redis.expire(dailyKey, 24 * 60 * 60);

    if (count > DAILY_REQUEST_CAP) {
      throw new AppError('rate_limited', 'Too many codes requested today. Try again tomorrow.');
    }
  }

  async issue(phone: string): Promise<string> {
    const code = this.generateCode();
    const hash = await argonHash(code);

    const challenge: StoredChallenge = { hash, attempts: 0 };

    await this.redis
      .multi()
      .set(this.challengeKey(phone), JSON.stringify(challenge), 'EX', this.env.OTP_TTL_SECONDS)
      .set(this.cooldownKey(phone), '1', 'EX', RESEND_COOLDOWN_SECONDS)
      .exec();

    return code;
  }

  /**
   * Returns false for a wrong code and throws for an exhausted or missing
   * challenge, so the caller can distinguish "try again" from "start over"
   * without the response ever revealing whether the number has an account.
   */
  async verify(phone: string, code: string): Promise<boolean> {
    const key = this.challengeKey(phone);
    const raw = await this.redis.get(key);

    if (!raw) {
      throw AppError.badRequest('That code has expired. Request a new one.');
    }

    const challenge = JSON.parse(raw) as StoredChallenge;

    if (challenge.attempts >= this.env.OTP_MAX_ATTEMPTS) {
      await this.redis.del(key);
      throw new AppError('rate_limited', 'Too many incorrect attempts. Request a new code.');
    }

    const valid = await argonVerify(challenge.hash, code).catch(() => false);

    if (!valid) {
      // Preserve the remaining TTL: a wrong guess must not extend the window.
      const ttl = await this.redis.ttl(key);
      challenge.attempts += 1;
      await this.redis.set(key, JSON.stringify(challenge), 'EX', Math.max(ttl, 1));
      return false;
    }

    // Single-use: a correct code cannot be replayed even inside its TTL.
    await this.redis.del(key, this.cooldownKey(phone));
    return true;
  }

  private generateCode(): string {
    const max = 10 ** this.env.OTP_LENGTH;
    return randomInt(0, max).toString().padStart(this.env.OTP_LENGTH, '0');
  }
}
