import { describe, expect, it } from 'vitest';
import { extractSolveTimeFromMessage, formatTime, isFastTime, parseSolveTime } from './parser';

describe('parseSolveTime', () => {
  it('parses standard MM:SS format', () => {
    const result = parseSolveTime('3:45');
    expect(result).not.toBeNull();
    expect(result?.minutes).toBe(3);
    expect(result?.seconds).toBe(45);
    expect(result?.totalSeconds).toBe(225);
  });

  it('parses time with leading zero minutes', () => {
    const result = parseSolveTime('0:47');
    expect(result).not.toBeNull();
    expect(result?.minutes).toBe(0);
    expect(result?.seconds).toBe(47);
    expect(result?.totalSeconds).toBe(47);
  });

  it('parses time without minutes (:SS format)', () => {
    const result = parseSolveTime(':23');
    expect(result).not.toBeNull();
    expect(result?.minutes).toBe(0);
    expect(result?.seconds).toBe(23);
    expect(result?.totalSeconds).toBe(23);
  });

  it('parses bare number as seconds (under 60)', () => {
    const result = parseSolveTime('45');
    expect(result).not.toBeNull();
    expect(result?.minutes).toBe(0);
    expect(result?.seconds).toBe(45);
    expect(result?.totalSeconds).toBe(45);
  });

  it('rejects invalid seconds (>= 60)', () => {
    const result = parseSolveTime('3:65');
    expect(result).toBeNull();
  });

  it('rejects bare number >= 60', () => {
    const result = parseSolveTime('75');
    expect(result).toBeNull();
  });

  it('rejects invalid format', () => {
    expect(parseSolveTime('abc')).toBeNull();
    expect(parseSolveTime('3.45')).toBeNull();
    expect(parseSolveTime('')).toBeNull();
  });

  it('preserves raw text', () => {
    const result = parseSolveTime('3:45');
    expect(result?.rawText).toBe('3:45');
  });
});

describe('formatTime', () => {
  it('formats time under 1 minute', () => {
    expect(formatTime(45)).toBe('0:45');
  });

  it('formats time over 1 minute', () => {
    expect(formatTime(225)).toBe('3:45');
  });

  it('pads single-digit seconds', () => {
    expect(formatTime(185)).toBe('3:05');
  });

  it('handles zero seconds', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('handles exactly 1 minute', () => {
    expect(formatTime(60)).toBe('1:00');
  });
});

describe('isFastTime', () => {
  it('returns true for times under 30 seconds', () => {
    expect(isFastTime(29)).toBe(true);
    expect(isFastTime(15)).toBe(true);
    expect(isFastTime(1)).toBe(true);
  });

  it('returns false for times >= 30 seconds', () => {
    expect(isFastTime(30)).toBe(false);
    expect(isFastTime(45)).toBe(false);
    expect(isFastTime(120)).toBe(false);
  });
});

describe('extractSolveTimeFromMessage', () => {
  it('extracts time from simple message', () => {
    const result = extractSolveTimeFromMessage('3:45');
    expect(result).not.toBeNull();
    expect(result?.totalSeconds).toBe(225);
  });

  it('extracts time from message with text', () => {
    const result = extractSolveTimeFromMessage('I solved it in 3:45 today!');
    expect(result).not.toBeNull();
    expect(result?.totalSeconds).toBe(225);
  });

  it('extracts first valid time from message', () => {
    const result = extractSolveTimeFromMessage('Started at 8:00, finished in 3:45');
    expect(result).not.toBeNull();
    expect(result?.totalSeconds).toBe(480); // 8:00 comes first
  });

  it('returns null if no valid time found', () => {
    const result = extractSolveTimeFromMessage('No time here!');
    expect(result).toBeNull();
  });

  it('extracts bare number time', () => {
    const result = extractSolveTimeFromMessage('Wow only 23 seconds!');
    expect(result).not.toBeNull();
    expect(result?.totalSeconds).toBe(23);
  });
});
