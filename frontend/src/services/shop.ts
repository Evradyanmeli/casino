import api from './api';

export interface TokenPackage {
  id: string;
  name: string;
  tokens: number;
  price: number;
  bonus?: number;
  popular?: boolean;
}

export interface PurchaseResult {
  tokensAwarded: number;
  newBalance: number;
}

export const shopApi = {
  getPackages: () => api.get<TokenPackage[]>('/shop/packages').then(r => r.data),
  purchase: (packageId: string) => api.post<PurchaseResult>(`/shop/purchase/${packageId}`).then(r => r.data),
};
