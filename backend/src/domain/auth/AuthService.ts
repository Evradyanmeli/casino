import bcrypt from 'bcryptjs';
import { prisma } from '../../infrastructure/database/prisma.js';
import { ECONOMIC_DEFAULTS, isValidEconomicSetting } from '../economy/EconomicSettings.js';

const SALT_ROUNDS = 12;

export class AuthService {
  async register(email: string, pseudo: string, password: string, birthDate: string) {
    const birth = new Date(birthDate);
    const today = new Date();
    const adultBefore = new Date(Date.UTC(today.getUTCFullYear() - 18, today.getUTCMonth(), today.getUTCDate()));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !Number.isFinite(birth.getTime()) || birth.toISOString().slice(0, 10) !== birthDate || birth > adultBefore) {
      throw new AppError('Vous devez avoir au moins 18 ans et indiquer une date valide', 400);
    }
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { pseudo }] },
    });
    if (existing) {
      if (existing.email === email) {
        throw new AppError('Email already registered', 409);
      }
      throw new AppError('Pseudo already taken', 409);
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.$transaction(async tx => {
      const setting = await tx.systemSetting.findUnique({ where: { key: 'welcome_bonus' } });
      const bonus = setting?.value ?? ECONOMIC_DEFAULTS.welcome_bonus;
      if (!isValidEconomicSetting('welcome_bonus', bonus)) throw new AppError('Bonus de bienvenue invalide', 500);
      const created = await tx.user.create({
      data: {
        email,
        pseudo,
        passwordHash,
        birthDate: birth,
        balance: BigInt(bonus),
      },
      });
      if (bonus > 0) await tx.transaction.create({ data: { userId: created.id, amount: BigInt(bonus), type: 'welcome_bonus', description: 'Bonus de bienvenue' } });
      return created;
    });

    return user;
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new AppError('Invalid email or password', 401);
    }
    if (user.status !== 'ACTIVE') {
      throw new AppError('Account is suspended or banned', 403);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError('Invalid email or password', 401);
    }

    return user;
  }

  async loginWithGoogle(_googleId: string, _email: string, _pseudo: string): Promise<never> {
    // Client-supplied identity is not proof of ownership. No verified provider is configured.
    throw new AppError('Google authentication is not configured', 503);
  }
}

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
