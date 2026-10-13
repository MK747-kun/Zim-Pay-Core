/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PaymentProvider, PaymentRailHealth, Transaction } from '../types';
import { db } from './db';

export interface FallbackRouteResult {
  fallbackProvider: PaymentProvider;
  reason: string;
  qrPayload?: string;
  zipitDetails?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    reference: string;
  };
  ussdRef?: string;
  instructions: string;
}

export class RoutingEngine {
  /**
   * Evaluates the health and status of the primary rail.
   */
  public static getRailHealth(provider: PaymentProvider): PaymentRailHealth | undefined {
    return db.railHealths.get(provider);
  }

  public static getAllRails(): PaymentRailHealth[] {
    return Array.from(db.railHealths.values()).sort((a, b) => a.priorityOrder - b.priorityOrder);
  }

  public static updateRailStatus(
    provider: PaymentProvider,
    status: 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE',
    notes?: string
  ): PaymentRailHealth {
    const rail = db.railHealths.get(provider);
    if (!rail) {
      throw new Error(`Rail ${provider} not found`);
    }
    rail.status = status;
    if (notes) rail.notes = notes;
    db.railHealths.set(provider, { ...rail });
    return rail;
  }

  /**
   * Determines dynamic fallback route when primary rail fails or times out.
   * Maintains active session state and generates backup payment credentials.
   */
  public static triggerFallback(
    transaction: Transaction,
    failureReason: string,
    preferredFallback?: PaymentProvider
  ): FallbackRouteResult {
    // Determine best fallback provider based on health priority
    let chosenFallback: PaymentProvider = preferredFallback || 'INNBUCKS';
    
    if (!preferredFallback) {
      const innBucksHealth = db.railHealths.get('INNBUCKS');
      const zipitHealth = db.railHealths.get('ZIPIT');

      if (innBucksHealth?.status === 'OPERATIONAL') {
        chosenFallback = 'INNBUCKS';
      } else if (zipitHealth?.status === 'OPERATIONAL') {
        chosenFallback = 'ZIPIT';
      } else {
        chosenFallback = 'INNBUCKS';
      }
    }

    const uniqueVoucherCode = 'IB-' + Math.floor(100000 + Math.random() * 900000);
    const zipitRef = 'ZPT-' + transaction.referenceCode.replace('ZIM-PAY-', '') + '-' + Math.floor(100 + Math.random() * 900);

    let result: FallbackRouteResult;

    if (chosenFallback === 'INNBUCKS') {
      const qrPayload = `zimpay://innbucks/pay?voucher=${uniqueVoucherCode}&amount=${transaction.amount}&currency=${transaction.currency}&merchant=${transaction.merchantId}&tx=${transaction.id}`;
      result = {
        fallbackProvider: 'INNBUCKS',
        reason: failureReason,
        qrPayload,
        ussdRef: `*569# -> Enter Voucher Code: ${uniqueVoucherCode}`,
        instructions: `Primary rail (${transaction.provider}) timed out. Switched to InnBucks Instant Voucher. Scan QR code in InnBucks app or dial *569# and enter voucher ${uniqueVoucherCode}. Active checkout preserved.`,
      };
    } else {
      result = {
        fallbackProvider: 'ZIPIT',
        reason: failureReason,
        zipitDetails: {
          bankName: 'Stanbic Bank Zimbabwe (Clearing 3101)',
          accountNumber: '9140003849120',
          accountName: 'ZimPay Escrow FBO Harare Wholesale Ltd',
          reference: zipitRef,
        },
        instructions: `Primary rail (${transaction.provider}) unavailable. Switched to Zimswitch ZIPIT Instant Transfer. Transfer ${transaction.currency} ${transaction.amount.toFixed(2)} to account 9140003849120 with reference ${zipitRef}. Instant reconciliation guaranteed.`,
      };
    }

    return result;
  }
}
