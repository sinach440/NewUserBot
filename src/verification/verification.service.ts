import { Injectable } from '@nestjs/common';
import { BybitService } from '../bybit/bybit.service';
import { VerifiedUserService } from '../storage/verified-user.service';

export type VerificationStatus =
  | 'NOT_REGISTERED'
  | 'ACCOUNT_TOO_OLD'
  | 'INSUFFICIENT_FUNDS'
  | 'APPROVED';

export interface VerificationResult {
  status: VerificationStatus;
  /** True when UID was already in storage – Elite Group link must not be sent again. */
  alreadyVerified?: boolean;
}

/**
 * Eligibility uses Bybit totalWalletBalance tier:
 * "1" = <100 USDT, "2" = [100, 250), "3" = [250, 500), "4" = >= 500.
 * We require tier >= 2 (i.e. at least 100 USDT wallet balance).
 * Account must also have been registered on or after ACCOUNT_CUTOFF_DATE.
 */

// Accounts registered before this date are considered pre-existing and ineligible.
const ACCOUNT_CUTOFF_DATE = new Date('2026-06-27T00:00:00.000Z');

@Injectable()
export class VerificationService {
  constructor(
    private bybit: BybitService,
    private verifiedUser: VerifiedUserService,
  ) {}

  async verify(uid: string): Promise<VerificationResult> {
    const normalized = String(uid).trim();

    if (await this.verifiedUser.isVerified(normalized)) {
      return { status: 'APPROVED', alreadyVerified: true };
    }

    const info = await this.bybit.getAffiliateCustomerInfo(normalized);

    console.log('[Verification] Step 1 - Check if user is registered under affiliate');
    if (!info) {
      console.log('[Verification] ❌ User NOT registered under affiliate');
      return { status: 'NOT_REGISTERED' };
    }
    console.log('[Verification] ✓ User IS registered under affiliate | uid:', normalized);

    // If registerTime is not in aff-customer-info, fetch from aff-user-list
    let registerTime = info.registerTime;
    if (!registerTime) {
      console.log('[Verification] registerTime not in aff-customer-info, fetching from aff-user-list...');
      const userFromList = await this.bybit.getAffiliateUserFromList(normalized);
      registerTime = userFromList?.registerTime;
      console.log('[Verification] registerTime from aff-user-list:', registerTime);
    }

    // Log the account creation date
    let createdAtReadable = 'unknown';
    let accountAgeMs: number | null = null;
    if (registerTime) {
      const raw = registerTime;
      const ms = /^\d{10,}$/.test(raw) ? parseInt(raw, 10) : Date.parse(raw);
      if (!isNaN(ms)) {
        accountAgeMs = ms;
        createdAtReadable = new Date(ms).toISOString();
      }
    }

    console.log('[Verification] Step 2 - Check account registration date');
    console.log('[Verification] Account created at:', createdAtReadable);
    console.log('[Verification] Cutoff date:', ACCOUNT_CUTOFF_DATE.toISOString());

    if (!registerTime || !accountAgeMs || accountAgeMs < ACCOUNT_CUTOFF_DATE.getTime()) {
      console.log('[Verification] ❌ Account registered BEFORE cutoff date (too old)');
      return { status: 'ACCOUNT_TOO_OLD' };
    }
    console.log('[Verification] ✓ Account registered ON or AFTER cutoff date');

    console.log('[Verification] Step 3 - Check wallet balance');
    console.log('[Verification] totalWalletBalance tier:', info.totalWalletBalance, '(need >= 2 for $100+)');

    if (!this.bybit.hasMinWalletBalance(info, 2)) {
      console.log('[Verification] ❌ Insufficient wallet balance');
      return { status: 'INSUFFICIENT_FUNDS' };
    }
    console.log('[Verification] ✓ Wallet balance meets minimum requirement');

    console.log('[Verification] ✅ ALL CHECKS PASSED - User approved');
    return { status: 'APPROVED', alreadyVerified: false };
  }
}
