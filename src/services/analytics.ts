/**
 * Analytics Service
 * Tracks workload history for the premium analytics dashboard.
 * Stores daily snapshots in chrome.storage.local (max 90 entries).
 */

import type { AnalyticsEntry } from '../types';

const ANALYTICS_KEY = 'analyticsHistory';
const MAX_ENTRIES = 90;

export class AnalyticsService {
  /**
   * Record a daily snapshot from the current assignments.
   * Called after each background refresh.
   */
  async recordSnapshot(assignments: Array<{
    courseName?: string;
    estimatedMinutes?: number | null;
    [key: string]: unknown;
  }>): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const history = await this.getHistory();

    // Don't duplicate today's entry — overwrite it
    const filtered = history.filter(e => e.date !== today);

    const byCourseMap = new Map<string, { minutes: number; count: number }>();
    let totalMinutes = 0;

    for (const a of assignments) {
      const mins = a.estimatedMinutes || 0;
      totalMinutes += mins;
      const course = a.courseName || 'Unknown';
      const existing = byCourseMap.get(course) || { minutes: 0, count: 0 };
      byCourseMap.set(course, {
        minutes: existing.minutes + mins,
        count: existing.count + 1,
      });
    }

    const entry: AnalyticsEntry = {
      date: today,
      totalMinutes,
      assignmentCount: assignments.length,
      byCourse: Array.from(byCourseMap.entries()).map(([courseName, data]) => ({
        courseName,
        ...data,
      })),
    };

    filtered.push(entry);

    // Keep only last MAX_ENTRIES days
    const trimmed = filtered.slice(-MAX_ENTRIES);
    await chrome.storage.local.set({ [ANALYTICS_KEY]: trimmed });
  }

  /**
   * Get full analytics history
   */
  async getHistory(): Promise<AnalyticsEntry[]> {
    const { [ANALYTICS_KEY]: data } = await chrome.storage.local.get(ANALYTICS_KEY);
    return (data as AnalyticsEntry[]) || [];
  }

  /**
   * Get history for the last N days
   */
  async getRecentHistory(days: number): Promise<AnalyticsEntry[]> {
    const history = await this.getHistory();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return history.filter(e => e.date >= cutoffStr);
  }

  /**
   * Get summary stats for the last N days
   */
  async getSummary(days: number = 14): Promise<{
    totalMinutes: number;
    totalAssignments: number;
    avgMinutesPerDay: number;
    byCourse: { courseName: string; minutes: number; count: number }[];
    trend: 'increasing' | 'decreasing' | 'stable';
  }> {
    const recent = await this.getRecentHistory(days);

    if (recent.length === 0) {
      return {
        totalMinutes: 0,
        totalAssignments: 0,
        avgMinutesPerDay: 0,
        byCourse: [],
        trend: 'stable',
      };
    }

    const totalMinutes = recent.reduce((sum, e) => sum + e.totalMinutes, 0);
    const totalAssignments = recent.reduce((sum, e) => sum + e.assignmentCount, 0);

    // Aggregate by course
    const courseMap = new Map<string, { minutes: number; count: number }>();
    for (const entry of recent) {
      for (const c of entry.byCourse) {
        const existing = courseMap.get(c.courseName) || { minutes: 0, count: 0 };
        courseMap.set(c.courseName, {
          minutes: existing.minutes + c.minutes,
          count: existing.count + c.count,
        });
      }
    }

    // Simple trend: compare first half vs second half
    const mid = Math.floor(recent.length / 2);
    const firstHalf = recent.slice(0, mid).reduce((s, e) => s + e.totalMinutes, 0);
    const secondHalf = recent.slice(mid).reduce((s, e) => s + e.totalMinutes, 0);
    const trend = secondHalf > firstHalf * 1.15
      ? 'increasing'
      : secondHalf < firstHalf * 0.85
      ? 'decreasing'
      : 'stable';

    return {
      totalMinutes,
      totalAssignments,
      avgMinutesPerDay: Math.round(totalMinutes / recent.length),
      byCourse: Array.from(courseMap.entries()).map(([courseName, data]) => ({
        courseName,
        ...data,
      })).sort((a, b) => b.minutes - a.minutes),
      trend,
    };
  }
}

export const analyticsService = new AnalyticsService();
