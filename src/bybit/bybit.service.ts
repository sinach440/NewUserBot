import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import type {
  BybitAffCustomerInfo,
  BybitAffUserListItem,
  BybitAffUserListResult,
  BybitApiResponse,
} from './bybit.types';

@Injectable()
export class BybitService {
  constructor(private config: ConfigService) {}

  private sign(payload: string): string {
    const secret = this.config.get<string>('BYBIT_SECRET');
    if (!secret) {
      throw new Error('BYBIT_SECRET is not configured');
    }
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  private static readonly RECV_WINDOW = '5000';

  private async request<T>(endpoint: string, query: string): Promise<T> {
    const apiKey = this.config.get<string>('BYBIT_API_KEY');
    const baseUrl = this.config.get<string>('BYBIT_BASE_URL');
    if (!apiKey || !baseUrl) {
      throw new Error('BYBIT_API_KEY or BYBIT_BASE_URL is not configured');
    }
    const timestamp = Date.now().toString();
    // Bybit GET: timestamp + api_key + recv_window + queryString
    const signPayload = timestamp + apiKey + BybitService.RECV_WINDOW + query;
    const signature = this.sign(signPayload);

    const url = `${baseUrl}${endpoint}?${query}`;
    try {
      const { status, data } = await axios.get<BybitApiResponse<T>>(url, {
        headers: {
          'X-BAPI-API-KEY': apiKey,
          'X-BAPI-TIMESTAMP': timestamp,
          'X-BAPI-RECV-WINDOW': BybitService.RECV_WINDOW,
          'X-BAPI-SIGN': signature,
        },
      });
      console.log('[Bybit]', endpoint, '| status:', status, '| response:', JSON.stringify(data));
      if (data.retCode !== 0 && data.retCode !== undefined) {
        throw new Error(data.retMsg ?? 'Bybit API error');
      }
      return data.result as T;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        console.log('[Bybit]', endpoint, '| status:', err.response.status, '| response:', JSON.stringify(err.response.data));
      }
      throw err;
    }
  }

  private readonly affCustomerInfoEndpoint = '/v5/user/aff-customer-info';
  private readonly affUserListEndpoint = '/v5/affiliate/aff-user-list';

  /**
   * GET /v5/user/aff-customer-info – single request per UID.
   * Returns affiliate client info (uid, totalWalletBalance, deposit amounts, etc.) or null.
   */
  async getAffiliateCustomerInfo(uid: string): Promise<BybitAffCustomerInfo | null> {
    const query = `uid=${encodeURIComponent(String(uid).trim())}`;
    try {
      const result = await this.request<BybitAffCustomerInfo>(
        this.affCustomerInfoEndpoint,
        query,
      );
      return result ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Whether the given UID is under the affiliate (we got a valid aff-customer-info result).
   */
  async isUserUnderAffiliate(uid: string): Promise<boolean> {
    const info = await this.getAffiliateCustomerInfo(uid);
    return info != null;
  }

  /**
   * totalWalletBalance: "1"=<100 USDT, "2"=[100,250), "3"=[250,500), "4"=>=500.
   * Returns true if wallet balance tier is >= 100 USDT (i.e. "2", "3", or "4").
   */
  hasMinWalletBalance(info: BybitAffCustomerInfo, minTier: number = 2): boolean {
    const tier = info.totalWalletBalance;
    if (!tier) return false;
    const n = parseInt(tier, 10);
    return n >= minTier; // 2 = [100, 250), 3 = [250, 500), 4 = >= 500
  }

  /**
   * Fallback: paginate aff-user-list to find UID (use only if aff-customer-info is unavailable).
   */
  async getAffiliateUserFromList(uid: string): Promise<BybitAffUserListItem | null> {
    const targetUid = String(uid).trim();
    let cursor: string | undefined;
    const size = 100;
    const needDeposit = true;

    try {
      do {
        const params = new URLSearchParams();
        params.set('size', String(size));
        params.set('needDeposit', String(needDeposit));
        if (cursor) params.set('cursor', cursor);
        const query = params.toString();

        const result = await this.request<BybitAffUserListResult>(
          this.affUserListEndpoint,
          query,
        );
        const list = result?.list ?? [];
        const found = list.find((u) => u.userId === targetUid);
        if (found) return found;
        cursor = result?.nextPageCursor;
      } while (cursor);

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Returns true if the account was registered on or after the given cutoff date.
   * Handles both Unix-ms string timestamps and ISO date strings.
   */
  isAccountRegisteredOnOrAfter(info: BybitAffCustomerInfo, cutoff: Date): boolean {
    const raw = info.registerTime;
    if (!raw) return false;
    const ms = /^\d{10,}$/.test(raw) ? parseInt(raw, 10) : Date.parse(raw);
    if (isNaN(ms)) return false;
    return ms >= cutoff.getTime();
  }

  getUserDepositAmount(user: BybitAffUserListItem): number {
    const d365 = user.depositAmount365Day;
    const d30 = user.depositAmount30Day;
    const v365 = d365 ? parseFloat(d365) : 0;
    const v30 = d30 ? parseFloat(d30) : 0;
    return Math.max(v365, v30);
  }
}
