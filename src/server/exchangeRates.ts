/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Currency, ExchangeRate, RateLock } from '../types';
import { db } from './db';

export class ExchangeRateService {
  private static readonly RATE_ID = 'fx_usd_zig_latest';

  public static getRate(): ExchangeRate {
    const rate = db.exchangeRates.get(this.RATE_ID);
    if (!rate) {
      throw new Error('Exchange rate configuration missing');
    }
    return rate;
  }

  public static updateMarketRate(newMarketRate: number, spreadBps = 250, slippageTolerance = 2.0): ExchangeRate {
    const current = this.getRate();
    // Effective customer rate = market rate * (1 + spreadBps / 10000)
    const effectiveRate = Number((newMarketRate * (1 + spreadBps / 10000)).toFixed(4));
    
    const updated: ExchangeRate = {
      ...current,
      rate: effectiveRate,
      marketRate: Number(newMarketRate.toFixed(4)),
      spreadBps,
      slippageTolerancePercent: slippageTolerance,
      lastUpdated: new Date().toISOString(),
    };

    db.exchangeRates.set(this.RATE_ID, updated);
    return updated;
  }

  /**
   * Dual-Currency Rate-Slippage Guard:
   * Locks the exchange rate for exactly 10 minutes (600 seconds)
   * at checkout creation.
   */
  public static createRateLock(
    baseCurrency: Currency,
    targetCurrency: Currency,
    amountBase: number
  ): RateLock {
    const currentRateObj = this.getRate();
    const effectiveRate = currentRateObj.rate;
    
    // Calculate target amount based on direction
    let amountTarget = 0;
    if (baseCurrency === 'USD' && targetCurrency === 'ZIG') {
      amountTarget = Number((amountBase * effectiveRate).toFixed(2));
    } else if (baseCurrency === 'ZIG' && targetCurrency === 'USD') {
      amountTarget = Number((amountBase / effectiveRate).toFixed(2));
    } else {
      amountTarget = amountBase;
    }

    const now = Date.now();
    const ttlSeconds = currentRateObj.lockedRateTtlSeconds || 600; // 10 minutes
    const expiresAtMs = now + ttlSeconds * 1000;
    const lockId = 'lock_' + Math.random().toString(36).substring(2, 10);
    const token = 'rt_lock_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);

    const lock: RateLock = {
      id: lockId,
      token,
      baseCurrency,
      targetCurrency,
      lockedRate: effectiveRate,
      amountBase,
      amountTarget,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      ttlRemainingSeconds: ttlSeconds,
      isExpired: false,
      slippageDetected: false,
      currentMarketRate: effectiveRate,
      slippageDeltaPercent: 0,
    };

    db.rateLocks.set(lock.token, lock);
    return lock;
  }

  /**
   * Validates if a locked rate is still valid or if rapid market fluctuation has breached slippage guard.
   */
  public static validateRateLock(token: string): {
    isValid: boolean;
    lock: RateLock;
    reason?: string;
  } {
    const lock = db.rateLocks.get(token);
    if (!lock) {
      throw new Error(`Rate lock '${token}' not found.`);
    }

    const now = Date.now();
    const expiresAtMs = new Date(lock.expiresAt).getTime();
    const remainingMs = expiresAtMs - now;
    const ttlRemainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    
    const isExpired = remainingMs <= 0;
    const currentRateObj = this.getRate();
    const currentRate = currentRateObj.rate;

    // Calculate slippage: |(currentRate - lockedRate) / lockedRate| * 100
    const slippageDeltaPercent = Number(
      (Math.abs((currentRate - lock.lockedRate) / lock.lockedRate) * 100).toFixed(2)
    );
    const slippageDetected = slippageDeltaPercent > currentRateObj.slippageTolerancePercent;

    const updatedLock: RateLock = {
      ...lock,
      ttlRemainingSeconds,
      isExpired,
      slippageDetected,
      currentMarketRate: currentRate,
      slippageDeltaPercent,
    };

    db.rateLocks.set(token, updatedLock);

    if (isExpired) {
      return {
        isValid: false,
        lock: updatedLock,
        reason: 'Rate lock expired after 10-minute validity window. Re-quote required.',
      };
    }

    if (slippageDetected) {
      return {
        isValid: false,
        lock: updatedLock,
        reason: `Rate-Slippage Guard triggered: Market moved by ${slippageDeltaPercent}% (tolerance is ${currentRateObj.slippageTolerancePercent}%). Re-quote required to prevent FX processing loss.`,
      };
    }

    return {
      isValid: true,
      lock: updatedLock,
    };
  }

  /**
   * Refreshes an expired or breached rate lock with the latest market rate, resetting the 10-min countdown.
   */
  public static refreshRateLock(token: string): RateLock {
    const existing = db.rateLocks.get(token);
    if (!existing) {
      throw new Error('Lock token not found');
    }

    return this.createRateLock(
      existing.baseCurrency,
      existing.targetCurrency,
      existing.amountBase
    );
  }
}
