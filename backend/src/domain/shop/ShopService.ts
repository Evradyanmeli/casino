import { PrismaClient } from '@prisma/client';
import { AppError } from '../auth/AuthService.js';
import { EconomyService } from '../economy/EconomyService.js';
import { ResponsibleGamingService } from '../rg/ResponsibleGamingService.js';
import { runFinancialOperation } from '../economy/FinancialOperation.js';

interface TokenPackage {
  id: string;
  name: string;
  tokens: number;
  price: number;
  bonus?: number;
  popular?: boolean;
}

const PACKAGES: TokenPackage[] = [
  { id: 'starter', name: 'Starter', tokens: 1000, price: 199, popular: false },
  { id: 'casual', name: 'Casual', tokens: 5000, price: 499, popular: false },
  { id: 'regular', name: 'Regular', tokens: 12000, price: 999, bonus: 3000, popular: true },
  { id: 'highroller', name: 'Highroller', tokens: 50000, price: 2499, bonus: 25000, popular: false },
  { id: 'whale', name: 'Whale', tokens: 250000, price: 9999, bonus: 250000, popular: false },
  { id: 'mega', name: 'Mega', tokens: 1000000, price: 19999, bonus: 1500000, popular: false },
];

export class ShopService {
  constructor(private prisma: PrismaClient) {}

  getPackages(): TokenPackage[] {
    return PACKAGES.map(pkg => ({ ...pkg }));
  }

  async purchasePackage(userId: string, packageId: string, key?: string): Promise<{ tokensAwarded: number; newBalance: number }> {
    const pkg = PACKAGES.find(p => p.id === packageId);
    if (!pkg) throw new AppError('Pack introuvable', 404);

    const totalTokens = pkg.tokens + (pkg.bonus ?? 0);

    return runFinancialOperation(this.prisma, userId, 'shop_purchase', key, { packageId }, async tx => {
      // Serialize the limit check with other purchases for this user.
      const locked = await tx.user.updateMany({
        where: { id: userId, status: 'ACTIVE' }, data: { balance: { increment: 0n } },
      });
      if (locked.count !== 1) throw new AppError('Account unavailable', 403);
      await new ResponsibleGamingService(tx).assertCanDeposit(userId, BigInt(totalTokens));
      const balance = await new EconomyService(tx).addBalance(
        userId, BigInt(totalTokens), 'deposit', `shop_${packageId}`,
        `Achat simule du pack ${pkg.name} - ${pkg.tokens} GC${pkg.bonus ? ` + ${pkg.bonus} bonus` : ''}`,
      );
      return {
        tokensAwarded: totalTokens,
        newBalance: Number(balance),
      };
    });
  }
}
