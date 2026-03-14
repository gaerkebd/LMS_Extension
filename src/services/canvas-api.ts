/**
 * Canvas API Service
 * Handles all communication with the Canvas LMS API
 */

interface Course {
  id: number;
  name: string;
  course_code: string;
  enrollments?: Enrollment[];
  workflow_state: string;
}

interface Enrollment {
  type: string;
  enrollment_state: string;
  computed_current_score: number | null;
  computed_final_score: number | null;
}

interface Assignment {
  id: number;
  name: string;
  due_at: string | null;
  points_possible: number | null;
  html_url: string;
  submission_types: string[];
  description: string | null;
  course_id: number;
}

interface NormalizedAssignment {
  id: number;
  title: string;
  type: string;
  dueDate: string | null;
  courseName: string;
  courseId: number;
  pointsPossible: number | null;
  htmlUrl: string;
  submissionTypes: string[];
  description: string;
}

export class CanvasAPI {
  private baseUrl: string | null;
  private apiToken: string | null;

  constructor() {
    this.baseUrl = null;
    this.apiToken = null;
  }

  /**
   * Configure the API with Canvas URL and token
   */
  configure(baseUrl: string, apiToken: string): void {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    if (!this.baseUrl.includes('/api/v1')) {
      this.baseUrl = `${this.baseUrl}/api/v1`;
    }
    this.apiToken = apiToken;
  }

  /**
   * Make an authenticated request to the Canvas API
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.baseUrl || !this.apiToken) {
      throw new Error('Canvas API not configured. Please set URL and token.');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Canvas API error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Canvas API request failed:', error);
      throw error;
    }
  }

  /**
   * Test the API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const user = await this.request<{ id: number }>('/users/self');
      return !!user.id;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<unknown> {
    return await this.request('/users/self');
  }

  /**
   * Get all active courses with enrollment scores
   */
  private async fetchAllCourses(): Promise<Course[]> {
    const params = new URLSearchParams({
      per_page: '100',
      enrollment_state: 'active',
      enrollment_type: 'student',
      state: 'available',
      'include[]': 'total_scores'
    });

    console.log('[Canvas-API] Fetching all courses...');
    return await this.request<Course[]>(`/courses?${params}`);
  }

  /**
   * Filter courses to only include "graded" courses
   * A graded course has either computed_current_score or computed_final_score set
   * This filters out clubs, orientations, and other non-academic courses
   */
  private filterGradedCourses(courses: Course[]): Course[] {
    return courses.filter(course => {
      const enrollment = course.enrollments?.[0];
      if (!enrollment) return false;

      // Course is graded if it has any score computed
      const hasCurrentScore = enrollment.computed_current_score !== null;
      const hasFinalScore = enrollment.computed_final_score !== null;

      return hasCurrentScore || hasFinalScore;
    });
  }

  /**
   * Get only graded courses (filters out clubs, orientations, etc.)
   */
  async getGradedCourses(): Promise<Course[]> {
    const allCourses = await this.fetchAllCourses();
    const gradedCourses = this.filterGradedCourses(allCourses);

    console.log(`[Canvas-API] Found ${allCourses.length} total courses, ${gradedCourses.length} are graded`);
    console.log(allCourses);
    return gradedCourses;
  }

  /**
   * Get assignments for a specific course
   */
  private async fetchCourseAssignments(courseId: number): Promise<Assignment[]> {
    const params = new URLSearchParams({
      per_page: '100',
      order_by: 'due_at'
    });

    return await this.request<Assignment[]>(`/courses/${courseId}/assignments?${params}`);
  }

  /**
   * Filter assignments to only those due within the specified number of days
   */
  private filterAssignmentsByDaysAhead(
    assignments: Assignment[],
    daysAhead: number
  ): Assignment[] {
    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(now.getDate() + daysAhead);
    cutoffDate.setHours(23, 59, 59, 999);

    return assignments.filter(assignment => {
      if (!assignment.due_at) return false;

      const dueDate = new Date(assignment.due_at);
      // Assignment must be due in the future and within the cutoff
      return dueDate >= now && dueDate <= cutoffDate;
    });
  }

  /**
   * Normalize assignments to a consistent format
   */
  private normalizeAssignments(
    assignments: Assignment[],
    course: Course
  ): NormalizedAssignment[] {
    return assignments.map(assignment => ({
      id: assignment.id,
      title: assignment.name,
      type: 'assignment',
      dueDate: assignment.due_at,
      courseName: course.name,
      courseId: course.id,
      pointsPossible: assignment.points_possible,
      htmlUrl: assignment.html_url,
      submissionTypes: assignment.submission_types || [],
      description: assignment.description || ''
    }));
  }

  /**
   * Get all assignments due within the specified number of days
   * This is the main method to call for fetching upcoming work
   *
   * @param daysAhead - Number of days to look ahead (default: 7)
   * @returns Array of normalized assignments sorted by due date
   */
  async getAssignmentsDueWithinDays(daysAhead: number = 7): Promise<NormalizedAssignment[]> {
    console.log(`[Canvas-API] Fetching assignments due within ${daysAhead} days...`);

    // Step 1: Get graded courses only
    const gradedCourses = await this.getGradedCourses();

    // Step 2: Fetch assignments for each course in parallel
    const assignmentPromises = gradedCourses.map(async (course) => {
      try {
        const assignments = await this.fetchCourseAssignments(course.id);
        const filteredAssignments = this.filterAssignmentsByDaysAhead(assignments, daysAhead);
        console.log(filteredAssignments);
        return this.normalizeAssignments(filteredAssignments, course);
      } catch (error) {
        console.warn(`[Canvas-API] Failed to fetch assignments for course ${course.id} (${course.name}):`, error);
        return [];
      }
    });

    const assignmentArrays = await Promise.all(assignmentPromises);
    const allAssignments = assignmentArrays.flat();

    // Step 3: Sort by due date
    allAssignments.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    console.log(`[Canvas-API] Found ${allAssignments.length} assignments due within ${daysAhead} days`);
    console.log(allAssignments);
    return allAssignments;
  }

  /**
   * Legacy method - kept for backwards compatibility
   * @deprecated Use getGradedCourses() instead
   */
  async getCourses(): Promise<Course[]> {
    return await this.fetchAllCourses();
  }

  /**
   * Legacy method - kept for backwards compatibility
   * @deprecated Use getAssignmentsDueWithinDays() instead
   */
  async getUpcomingAssignments(): Promise<NormalizedAssignment[]> {
    return await this.getAssignmentsDueWithinDays(7);
  }
}

// Export singleton instance for convenience
export const canvasAPI = new CanvasAPI();
