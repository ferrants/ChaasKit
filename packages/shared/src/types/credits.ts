export interface CreditsBalanceResponse {
  balance: number;
  expiresSoonestAt?: Date | null;
}

export interface RedeemPromoCodeRequest {
  code: string;
}

export interface RedeemPromoCodeResponse {
  balance: number;
  granted: number;
  expiresAt?: Date | null;
}

export interface GrantCreditsRequest {
  ownerType: 'user' | 'team';
  ownerId: string;
  amount: number;
  reason?: string;
  expiresAt?: Date | null;
}

export interface GrantCreditsResponse {
  balance: number;
}
