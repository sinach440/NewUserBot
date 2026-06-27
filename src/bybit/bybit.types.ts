/** Bybit API response types */

export interface BybitApiResponse<T = unknown> {
  retCode?: number;
  retMsg?: string;
  result?: T;
}

/** GET /v5/user/aff-customer-info – single affiliate client by uid */
export interface BybitAffCustomerInfo {
  uid?: string;
  vipLevel?: string;
  totalWalletBalance?: string; // "1"=<100 USDT, "2"=[100,250), "3"=[250,500), "4"=>=500
  depositAmount30Day?: string;
  depositAmount365Day?: string;
  tradeVol30Day?: string;
  tradeVol365Day?: string;
  depositUpdateTime?: string;
  volUpdateTime?: string;
  KycLevel?: number;
  registerTime?: string; // Unix timestamp ms or ISO string
  [key: string]: unknown;
}

/** GET /v5/affiliate/aff-user-list – single item in list */
export interface BybitAffUserListItem {
  userId: string;
  registerTime?: string;
  depositAmount30Day?: string;
  depositAmount365Day?: string;
  [key: string]: unknown;
}

/** GET /v5/affiliate/aff-user-list – result */
export interface BybitAffUserListResult {
  list?: BybitAffUserListItem[];
  nextPageCursor?: string;
}
