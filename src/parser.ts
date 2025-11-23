// Time parsing utilities for crossword solve times

export interface SolveTime {
  totalSeconds: number;
  minutes: number;
  seconds: number;
  rawText: string;
  userId?: string;
  timestamp?: string;
}

/**
 * Parse a solve time from text
 * Supports formats: "3:45", "0:47", ":23", "23"
 */
export function parseSolveTime(text: string): SolveTime | null {
  // Match patterns like "3:45", "0:47", ":23"
  const colonPattern = /(\d*):(\d{2})/;
  const colonMatch = text.match(colonPattern);

  if (colonMatch?.[2]) {
    const minutes = colonMatch[1] ? Number.parseInt(colonMatch[1], 10) : 0;
    const seconds = Number.parseInt(colonMatch[2], 10);

    if (seconds >= 60) {
      return null; // Invalid: seconds should be < 60
    }

    const totalSeconds = minutes * 60 + seconds;
    return {
      totalSeconds,
      minutes,
      seconds,
      rawText: text,
    };
  }

  // Match bare numbers like "23" (assume seconds if < 60)
  const bareNumberPattern = /^(\d+)$/;
  const bareMatch = text.match(bareNumberPattern);

  if (bareMatch?.[1]) {
    const value = Number.parseInt(bareMatch[1], 10);
    if (value < 60) {
      return {
        totalSeconds: value,
        minutes: 0,
        seconds: value,
        rawText: text,
      };
    }
  }

  return null;
}

/**
 * Format seconds as MM:SS
 */
export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Check if a time qualifies as "fast" (< 30 seconds)
 */
export function isFastTime(totalSeconds: number): boolean {
  return totalSeconds < 30;
}

/**
 * Extract solve time from a Slack message
 * Returns the parsed time if found
 */
export function extractSolveTimeFromMessage(messageText: string): SolveTime | null {
  // Try to find time pattern in the message
  // This is a simple implementation - may need refinement based on actual message patterns
  const words = messageText.split(/\s+/);

  for (const word of words) {
    const time = parseSolveTime(word);
    if (time) {
      return time;
    }
  }

  return null;
}
