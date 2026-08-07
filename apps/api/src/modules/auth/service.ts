import type { FastifyInstance } from 'fastify';
import type { RequestOtp, Session, VerifyOtp } from '@dwaso/shared-types';
import { AppError } from '../../lib/errors.js';
import { normalisePhone, maskPhone, type CountryCode } from '../../lib/phone.js';
import { randomToken, sha256 } from '../../lib/ids.js';
import { OtpStore } from './otp.js';
import * as repo from './repo.js';

export class AuthService {
  private readonly otp: OtpStore;

  constructor(private readonly app: FastifyInstance) {
    this.otp = new OtpStore(app.redis, app.env);
  }

  async requestOtp(input: RequestOtp) {
    const phone = normalisePhone(input.phone, input.countryCode as CountryCode);

    await this.otp.assertCanRequest(phone);
    const code = await this.otp.issue(phone);

    await this.app.sms.send({
      to: phone,
      body: `${code} is your Dwaso code. It expires in ${Math.round(
        this.app.env.OTP_TTL_SECONDS / 60,
      )} minutes. Do not share it with anyone.`,
    });

    this.app.log.info({ phone: maskPhone(phone) }, 'OTP issued');

    return {
      status: 'sent' as const,
      expiresInSeconds: this.app.env.OTP_TTL_SECONDS,
      // Only ever populated by the console provider, which the env schema
      // rejects in production.
      ...(this.app.env.SMS_PROVIDER === 'console' ? { devCode: code } : {}),
    };
  }

  async verifyOtp(input: VerifyOtp): Promise<Session> {
    const phone = normalisePhone(input.phone, input.countryCode as CountryCode);

    const valid = await this.otp.verify(phone, input.code);
    if (!valid) throw AppError.unauthorized('That code is not correct');

    const db = this.app.db;

    const user = (await repo.findUserByPhone(db, phone)) ?? (await repo.createUser(db, phone));

    await repo.upsertDevice(db, {
      id: input.device.id,
      userId: user.id,
      label: input.device.label,
      platform: input.device.platform,
    });

    const membership = await repo.findPrimaryMembership(db, user.id);

    return this.issueSession(user, input.device.id, membership);
  }

  /**
   * Rotates a refresh token, revoking the whole device chain if a token that was
   * already exchanged is presented again. That is the signature of a stolen
   * token: the legitimate device and the attacker both hold credentials and
   * there is no way to tell them apart, so neither keeps access.
   */
  async refresh(refreshToken: string, deviceId: string): Promise<Session> {
    const db = this.app.db;
    const tokenHash = sha256(refreshToken);

    const existing = await repo.findRefreshTokenByHash(db, tokenHash);

    if (!existing || existing.deviceId !== deviceId) {
      throw AppError.unauthorized('Session is no longer valid');
    }

    if (existing.revokedAt) {
      await repo.revokeDeviceTokens(db, existing.deviceId);
      this.app.log.warn(
        { deviceId: existing.deviceId, userId: existing.userId },
        'Refresh token reuse detected; revoked all sessions for the device',
      );
      throw AppError.unauthorized('Session is no longer valid');
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw AppError.unauthorized('Session has expired');
    }

    const user = await repo.findUserById(db, existing.userId);
    if (!user) throw AppError.unauthorized();

    const membership = await repo.findPrimaryMembership(db, existing.userId);
    const session = await this.issueSession(user, existing.deviceId, membership);

    const rotated = await repo.findRefreshTokenByHash(db, sha256(session.refreshToken));
    if (rotated) await repo.markRefreshTokenRotated(db, existing.id, rotated.id);

    return session;
  }

  async logout(deviceId: string) {
    await repo.revokeDeviceTokens(this.app.db, deviceId);
  }

  private async issueSession(
    user: { id: string; phone: string; displayName: string | null },
    deviceId: string,
    membership: { shopId: string; role: 'owner' | 'staff'; shopName: string; currency: string } | null,
  ): Promise<Session> {
    const accessToken = this.app.jwt.sign({
      sub: user.id,
      shopId: membership?.shopId ?? null,
      deviceId,
      role: membership?.role ?? 'owner',
    });

    const refreshToken = randomToken(48);
    const expiresAt = new Date(Date.now() + this.app.env.REFRESH_TOKEN_TTL_SECONDS * 1000);

    await repo.createRefreshToken(this.app.db, {
      userId: user.id,
      deviceId,
      // Only the hash is stored, so a database leak cannot be replayed into
      // live sessions.
      tokenHash: sha256(refreshToken),
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(
        Date.now() + this.app.env.ACCESS_TOKEN_TTL_SECONDS * 1000,
      ).toISOString(),
      user: { id: user.id, phone: user.phone, displayName: user.displayName },
      shop: membership
        ? { id: membership.shopId, name: membership.shopName, currency: membership.currency }
        : null,
      onboarded: Boolean(membership),
    };
  }
}
