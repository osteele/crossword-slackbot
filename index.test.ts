import { describe, it, expect } from 'vitest';
import {
  formatDateSeparator,
  parseExistingDateMessage,
  isSameDay,
  getPreviousSunday,
  getUpcomingSunday,
  getDateRange,
} from './index';

describe('formatDateSeparator', () => {
  it('formats a Monday correctly', () => {
    const date = new Date(2024, 10, 4); // Mon Nov 4, 2024
    expect(formatDateSeparator(date)).toBe('--- Mon 11/4 ---');
  });

  it('formats a Sunday correctly', () => {
    const date = new Date(2024, 10, 3); // Sun Nov 3, 2024
    expect(formatDateSeparator(date)).toBe('--- Sun 11/3 ---');
  });

  it('formats a date with double-digit day', () => {
    const date = new Date(2024, 10, 12); // Tue Nov 12, 2024
    expect(formatDateSeparator(date)).toBe('--- Tue 11/12 ---');
  });

  it('formats a December date correctly', () => {
    const date = new Date(2024, 11, 25); // Wed Dec 25, 2024
    expect(formatDateSeparator(date)).toBe('--- Wed 12/25 ---');
  });
});

describe('parseExistingDateMessage', () => {
  it('parses a valid date message', () => {
    const text = '--- Mon 11/4 ---';
    const result = parseExistingDateMessage(text);
    expect(result).not.toBeNull();
    expect(result?.getMonth()).toBe(10); // November (0-indexed)
    expect(result?.getDate()).toBe(4);
  });

  it('parses date with extra whitespace', () => {
    const text = '---   Sun   11/3   ---';
    const result = parseExistingDateMessage(text);
    expect(result).not.toBeNull();
    expect(result?.getMonth()).toBe(10);
    expect(result?.getDate()).toBe(3);
  });

  it('returns null for invalid format', () => {
    expect(parseExistingDateMessage('Invalid text')).toBeNull();
    expect(parseExistingDateMessage('Mon 11/4')).toBeNull();
    expect(parseExistingDateMessage('--- 11/4 ---')).toBeNull();
  });

  it('returns null for invalid date', () => {
    const text = '--- Mon 2/30 ---'; // Feb 30 doesn't exist
    const result = parseExistingDateMessage(text);
    expect(result).toBeNull();
  });

  it('parses date in text context', () => {
    const text = 'Some text --- Tue 11/12 --- More text';
    const result = parseExistingDateMessage(text);
    expect(result).not.toBeNull();
    expect(result?.getDate()).toBe(12);
  });
});

describe('isSameDay', () => {
  it('returns true for same date', () => {
    const date1 = new Date(2024, 10, 12, 10, 30);
    const date2 = new Date(2024, 10, 12, 15, 45);
    expect(isSameDay(date1, date2)).toBe(true);
  });

  it('returns false for different days', () => {
    const date1 = new Date(2024, 10, 12);
    const date2 = new Date(2024, 10, 13);
    expect(isSameDay(date1, date2)).toBe(false);
  });

  it('returns false for different months', () => {
    const date1 = new Date(2024, 10, 12);
    const date2 = new Date(2024, 11, 12);
    expect(isSameDay(date1, date2)).toBe(false);
  });

  it('returns false for different years', () => {
    const date1 = new Date(2024, 10, 12);
    const date2 = new Date(2025, 10, 12);
    expect(isSameDay(date1, date2)).toBe(false);
  });
});

describe('getPreviousSunday', () => {
  it('returns previous Sunday when today is Monday', () => {
    const monday = new Date(2024, 10, 4); // Mon Nov 4, 2024
    const result = getPreviousSunday(monday);
    expect(result.getDay()).toBe(0); // Sunday
    expect(result.getDate()).toBe(3); // Nov 3
  });

  it('returns previous Sunday when today is Sunday', () => {
    const sunday = new Date(2024, 10, 3); // Sun Nov 3, 2024
    const result = getPreviousSunday(sunday);
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(27); // Oct 27 (previous week)
  });

  it('returns previous Sunday when today is Saturday', () => {
    const saturday = new Date(2024, 10, 9); // Sat Nov 9, 2024
    const result = getPreviousSunday(saturday);
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(3); // Nov 3
  });

  it('returns previous Sunday when today is Wednesday', () => {
    const wednesday = new Date(2024, 10, 6); // Wed Nov 6, 2024
    const result = getPreviousSunday(wednesday);
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(3); // Nov 3
  });
});

describe('getUpcomingSunday', () => {
  it('returns next Sunday when today is Monday', () => {
    const monday = new Date(2024, 10, 4); // Mon Nov 4, 2024
    const result = getUpcomingSunday(monday);
    expect(result.getDay()).toBe(0); // Sunday
    expect(result.getDate()).toBe(10); // Nov 10
  });

  it('returns next Sunday when today is Sunday', () => {
    const sunday = new Date(2024, 10, 3); // Sun Nov 3, 2024
    const result = getUpcomingSunday(sunday);
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(10); // Next Sunday, Nov 10
  });

  it('returns next Sunday when today is Saturday', () => {
    const saturday = new Date(2024, 10, 9); // Sat Nov 9, 2024
    const result = getUpcomingSunday(saturday);
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(10); // Nov 10
  });

  it('returns next Sunday when today is Wednesday', () => {
    const wednesday = new Date(2024, 10, 13); // Wed Nov 13, 2024
    const result = getUpcomingSunday(wednesday);
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(17); // Nov 17
  });
});

describe('getDateRange', () => {
  it('returns 7-day range ending on upcoming Sunday', () => {
    const range = getDateRange();

    expect(range).toHaveLength(7);
    expect(range[range.length - 1].getDay()).toBe(0); // Last day is Sunday
  });

  it('returns dates in ascending order', () => {
    const range = getDateRange();

    for (let i = 1; i < range.length; i++) {
      expect(range[i].getTime()).toBeGreaterThan(range[i - 1].getTime());
    }
  });

  it('all dates have time set to 00:00:00', () => {
    const range = getDateRange();

    for (const date of range) {
      expect(date.getHours()).toBe(0);
      expect(date.getMinutes()).toBe(0);
      expect(date.getSeconds()).toBe(0);
    }
  });
});

describe('date range calculation (CLI-based)', () => {
  it('calculates correct range for create-back=0, create-forward=1', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const createBackDays = 0;
    const createForwardDays = 1;

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - createBackDays);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + createForwardDays);

    const dateRange: Date[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dateRange.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    expect(dateRange).toHaveLength(2); // Today and tomorrow
    expect(isSameDay(dateRange[0], today)).toBe(true);
    expect(dateRange[1].getDate()).toBe((today.getDate() + 1) % 32 || 1);
  });

  it('calculates correct range for create-back=7, create-forward=7', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const createBackDays = 7;
    const createForwardDays = 7;

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - createBackDays);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + createForwardDays);

    const dateRange: Date[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dateRange.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    expect(dateRange).toHaveLength(15); // 7 back + today + 7 forward
    expect(isSameDay(dateRange[7], today)).toBe(true); // Middle day is today
  });

  it('calculates correct range for create-back=14, create-forward=0', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const createBackDays = 14;
    const createForwardDays = 0;

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - createBackDays);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + createForwardDays);

    const dateRange: Date[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dateRange.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    expect(dateRange).toHaveLength(15); // 14 back + today
    expect(isSameDay(dateRange[dateRange.length - 1], today)).toBe(true);
  });
});
