/**
 * Google Calendar Service
 * Premium feature: auto-schedule study blocks around existing calendar events.
 * Uses chrome.identity for OAuth2 with Google Calendar API.
 */

import type { CalendarStudyBlock } from '../types';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

interface BusySlot {
  start: string;
  end: string;
}

interface AssignmentInput {
  id: string | number;
  title: string;
  dueDate: string;
  estimatedMinutes: number | null;
}

export class CalendarService {
  private accessToken: string | null = null;

  /**
   * Authenticate with Google via chrome.identity OAuth2 flow
   */
  async authenticate(): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError || !token) {
          reject(new Error(chrome.runtime.lastError?.message || 'Failed to get auth token'));
          return;
        }
        this.accessToken = token;
        resolve(token);
      });
    });
  }

  /**
   * Revoke the cached token (for sign-out)
   */
  async revokeToken(): Promise<void> {
    if (!this.accessToken) return;

    return new Promise((resolve) => {
      chrome.identity.removeCachedAuthToken({ token: this.accessToken! }, () => {
        this.accessToken = null;
        resolve();
      });
    });
  }

  /**
   * Get free/busy slots for the next N days
   */
  async getFreeBusySlots(daysAhead: number = 7): Promise<BusySlot[]> {
    if (!this.accessToken) await this.authenticate();

    const now = new Date();
    const end = new Date();
    end.setDate(end.getDate() + daysAhead);

    const response = await fetch(`${CALENDAR_API}/freeBusy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: now.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: 'primary' }],
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        await this.revokeToken();
        await this.authenticate();
        return this.getFreeBusySlots(daysAhead);
      }
      throw new Error(`Calendar API error: ${response.status}`);
    }

    const data = await response.json();
    return data.calendars?.primary?.busy || [];
  }

  /**
   * Create a study block event on the user's primary calendar
   */
  async createStudyBlock(
    title: string,
    startTime: Date,
    durationMinutes: number,
  ): Promise<{ id: string; htmlLink: string }> {
    if (!this.accessToken) await this.authenticate();

    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    const response = await fetch(`${CALENDAR_API}/calendars/primary/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: `Study: ${title}`,
        description: `Auto-scheduled study block for "${title}" by Canvas Time Estimator.`,
        start: { dateTime: startTime.toISOString() },
        end: { dateTime: endTime.toISOString() },
        colorId: '9', // Blueberry color
        reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 10 }] },
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        await this.revokeToken();
        await this.authenticate();
        return this.createStudyBlock(title, startTime, durationMinutes);
      }
      throw new Error(`Failed to create event: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Auto-schedule study blocks for a list of assignments.
   * Finds free time slots and creates calendar events.
   *
   * Scheduling rules:
   * - Only schedule between 8 AM and 10 PM
   * - Study blocks are 60 min max (split larger estimates)
   * - Must be before the assignment due date
   * - Avoid existing busy times
   */
  async autoSchedule(assignments: AssignmentInput[]): Promise<CalendarStudyBlock[]> {
    if (!this.accessToken) await this.authenticate();

    const busySlots = await this.getFreeBusySlots(30);
    const scheduled: CalendarStudyBlock[] = [];

    // Sort by due date (earliest first)
    const sorted = [...assignments]
      .filter(a => a.dueDate && a.estimatedMinutes && a.estimatedMinutes > 0)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    for (const assignment of sorted) {
      const totalMinutes = assignment.estimatedMinutes!;
      const dueDate = new Date(assignment.dueDate);
      const blockSize = Math.min(60, totalMinutes);
      const numBlocks = Math.ceil(totalMinutes / blockSize);

      let blocksScheduled = 0;
      const cursor = new Date();
      cursor.setMinutes(0, 0, 0);
      cursor.setHours(cursor.getHours() + 1); // Start from next full hour

      while (blocksScheduled < numBlocks && cursor < dueDate) {
        const hour = cursor.getHours();

        // Only schedule 8 AM - 10 PM
        if (hour >= 8 && hour < 22) {
          const slotEnd = new Date(cursor.getTime() + blockSize * 60 * 1000);

          // Check against busy slots
          const isBusy = busySlots.some(busy => {
            const busyStart = new Date(busy.start);
            const busyEnd = new Date(busy.end);
            return cursor < busyEnd && slotEnd > busyStart;
          });

          // Check against already-scheduled blocks
          const isConflict = scheduled.some(s => {
            const sStart = new Date(s.startTime);
            const sEnd = new Date(s.endTime);
            return cursor < sEnd && slotEnd > sStart;
          });

          if (!isBusy && !isConflict) {
            try {
              await this.createStudyBlock(assignment.title, cursor, blockSize);

              scheduled.push({
                assignmentId: assignment.id,
                assignmentTitle: assignment.title,
                startTime: cursor.toISOString(),
                endTime: slotEnd.toISOString(),
                durationMinutes: blockSize,
              });

              blocksScheduled++;
            } catch (error) {
              console.error(`Failed to schedule block for ${assignment.title}:`, error);
            }
          }
        }

        // Move cursor forward by 1 hour
        cursor.setHours(cursor.getHours() + 1);
      }
    }

    return scheduled;
  }
}

export const calendarService = new CalendarService();
