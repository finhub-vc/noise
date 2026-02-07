/**
 * Time Filter
 * Filters trading signals based on time of day, day of week, and market hours
 * Prevents trading during unfavorable times (e.g., overnight, low liquidity)
 */

export interface TimeFilterConfig {
  // Trading hours (UTC)
  futuresStartHour: number; // 6 = 6am UTC
  futuresEndHour: number;   // 22 = 10pm UTC
  equitiesStartHour: number; // 13 = 9:30am EST (approx UTC)
  equitiesEndHour: number;   // 20 = 4pm EST (approx UTC)

  // Days to avoid trading
  avoidFridays: boolean; // Avoid entering new positions late Friday
  avoidMondays: boolean; // Avoid Monday morning gap risk

  // Holiday mode
  holidayMode: boolean; // Disable trading around holidays

  // Low liquidity periods
  avoidEarlySession: boolean; // First 30 minutes
  avoidLateSession: boolean;   // Last 30 minutes
}

const DEFAULT_CONFIG: TimeFilterConfig = {
  futuresStartHour: 6,
  futuresEndHour: 22,
  equitiesStartHour: 13,
  equitiesEndHour: 20,
  avoidFridays: false,
  avoidMondays: false,
  holidayMode: false,
  avoidEarlySession: true,
  avoidLateSession: true,
};

export interface TimeFilterResult {
  allowed: boolean;
  reason?: string;
  session: 'PRE_MARKET' | 'REGULAR' | 'AFTER_HOURS' | 'CLOSED';
}

export class TimeFilter {
  constructor(private config: TimeFilterConfig = DEFAULT_CONFIG) {}

  /**
   * Check if current time is allowed for trading
   */
  isAllowedTime(assetClass: 'FUTURES' | 'EQUITY', timestamp: number = Date.now()): TimeFilterResult {
    const date = new Date(timestamp);
    const hour = date.getUTCHours();
    const day = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const minutes = date.getUTCMinutes();

    // Weekend check
    if (day === 0 || day === 6) {
      return {
        allowed: false,
        reason: 'Weekend - markets closed',
        session: 'CLOSED',
      };
    }

    // Holiday mode
    if (this.config.holidayMode) {
      return {
        allowed: false,
        reason: 'Holiday mode active',
        session: 'CLOSED',
      };
    }

    // Friday afternoon avoidance (no new positions near weekend)
    if (this.config.avoidFridays && day === 5 && hour >= 18) {
      return {
        allowed: false,
        reason: 'Friday afternoon - avoiding weekend gap risk',
        session: 'REGULAR',
      };
    }

    // Monday morning avoidance (gap risk)
    if (this.config.avoidMondays && day === 1 && hour < 14) {
      return {
        allowed: false,
        reason: 'Monday morning - avoiding gap risk',
        session: 'REGULAR',
      };
    }

    // Check trading hours based on asset class
    const hours = assetClass === 'FUTURES'
      ? { start: this.config.futuresStartHour, end: this.config.futuresEndHour }
      : { start: this.config.equitiesStartHour, end: this.config.equitiesEndHour };

    // Determine session
    let session: TimeFilterResult['session'] = 'REGULAR';
    if (hour < hours.start) {
      session = 'PRE_MARKET';
    } else if (hour >= hours.end) {
      session = 'AFTER_HOURS';
    }

    // Check if within trading hours
    if (hour < hours.start || hour >= hours.end) {
      return {
        allowed: false,
        reason: `Outside trading hours (${hours.start}:00-${hours.end}:00 UTC)`,
        session,
      };
    }

    // Early session avoidance
    if (this.config.avoidEarlySession && hour === hours.start && minutes < 30) {
      return {
        allowed: false,
        reason: 'Early session - avoiding opening volatility',
        session: 'REGULAR',
      };
    }

    // Late session avoidance
    if (this.config.avoidLateSession && hour === hours.end - 1 && minutes >= 30) {
      return {
        allowed: false,
        reason: 'Late session - avoiding closing volatility',
        session: 'REGULAR',
      };
    }

    return {
      allowed: true,
      session: 'REGULAR',
    };
  }

  /**
   * Check if signal should be allowed based on expiry time
   */
  isSignalValid(signalTimestamp: number, signalExpiry: number, currentTime: number = Date.now()): boolean {
    // Signal has expired
    if (currentTime > signalExpiry) {
      return false;
    }

    // Signal is too old (should be executed within a reasonable time)
    const maxSignalAge = 5 * 60 * 1000; // 5 minutes
    if (currentTime - signalTimestamp > maxSignalAge) {
      return false;
    }

    return true;
  }

  /**
   * Get next allowed trading time
   */
  getNextAllowedTime(assetClass: 'FUTURES' | 'EQUITY', timestamp: number = Date.now()): number {
    const date = new Date(timestamp);
    const hour = date.getUTCHours();
    const day = date.getUTCDay();
    const hours = assetClass === 'FUTURES'
      ? { start: this.config.futuresStartHour, end: this.config.futuresEndHour }
      : { start: this.config.equitiesStartHour, end: this.config.equitiesEndHour };

    // If we're past trading hours, move to next day
    if (hour >= hours.end || day === 0 || day === 6) {
      const nextDay = new Date(date);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);

      // Skip weekends
      while (nextDay.getUTCDay() === 0 || nextDay.getUTCDay() === 6) {
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      }

      nextDay.setUTCHours(hours.start, 0, 0, 0);
      return nextDay.getTime();
    }

    // If we're before trading hours, move to start of trading day
    if (hour < hours.start) {
      const today = new Date(date);
      today.setUTCHours(hours.start, 30, 0, 0); // Start at :30 to avoid early session
      return today.getTime();
    }

    return timestamp;
  }

  /**
   * Get current market session description
   */
  getSessionDescription(assetClass: 'FUTURES' | 'EQUITY', timestamp: number = Date.now()): string {
    const result = this.isAllowedTime(assetClass, timestamp);

    const sessionNames: Record<TimeFilterResult['session'], string> = {
      'PRE_MARKET': 'Pre-Market',
      'REGULAR': 'Regular Hours',
      'AFTER_HOURS': 'After Hours',
      'CLOSED': 'Market Closed',
    };

    return result.reason || sessionNames[result.session];
  }

  /**
   * Check if we're in a high-volatility period (first/last hour of trading)
   */
  isHighVolatilityPeriod(assetClass: 'FUTURES' | 'EQUITY', timestamp: number = Date.now()): boolean {
    const date = new Date(timestamp);
    const hour = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const hours = assetClass === 'FUTURES'
      ? { start: this.config.futuresStartHour, end: this.config.futuresEndHour }
      : { start: this.config.equitiesStartHour, end: this.config.equitiesEndHour };

    // First hour of trading
    if (hour === hours.start || (hour === hours.start + 1 && minutes < 30)) {
      return true;
    }

    // Last hour of trading
    if (hour === hours.end - 1 || (hour === hours.end - 2 && minutes >= 30)) {
      return true;
    }

    return false;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<TimeFilterConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}
