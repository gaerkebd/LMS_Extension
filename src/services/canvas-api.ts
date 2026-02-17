/**
 * Canvas API Service
 * Handles all communication with the Canvas LMS API
 */

export class CanvasAPI {
  constructor() {
    this.baseUrl = null;
    this.apiToken = null;
  }

  /**
   * Configure the API with Canvas URL and token
   */
  configure(baseUrl, apiToken) {
    // Normalize the base URL
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    if (!this.baseUrl.includes('/api/v1')) {
      this.baseUrl = `${this.baseUrl}/api/v1`;
    }
    this.apiToken = apiToken;
  }

  /**
   * Make an authenticated request to the Canvas API
   */
  async request(endpoint, options = {}) {
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
  async testConnection() {
    try {
      const user = await this.request('/users/self');
      return !!user.id;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get current user information
   */
  async getCurrentUser() {
    return await this.request('/users/self');
  }

  /**
   * Get user's courses
   */
  async getCourses(options = {}) {
    const params = new URLSearchParams({
      enrollment_state: 'active',
      per_page: options.perPage || 50,
      ...options
    });

    return await this.request(`/courses?${params}`);
  }

  /**
   * Get the user's to-do items (planner items)
   */
  async getTodoItems(options = {}) {
    const startDate = options.startDate || new Date().toISOString();
    const endDate = options.endDate || this.getEndOfWeek();

    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      per_page: options.perPage || 100
    });

    try {
      // Try the planner items endpoint first (more comprehensive)
      const plannerItems = await this.request(`/planner/items?${params}`);
      return this.normalizePlannerItems(plannerItems);
    } catch (error) {
      // Fall back to the todo endpoint
      console.warn('Planner API failed, falling back to todo endpoint');
      const todoItems = await this.request('/users/self/todo');
      return this.normalizeTodoItems(todoItems);
    }
  }

  /**
   * Get assignments for a specific course
   */
  async getCourseAssignments(courseId, options = {}) {
    const params = new URLSearchParams({
      per_page: options.perPage || 50,
      order_by: 'due_at',
      ...options
    });

    return await this.request(`/courses/${courseId}/assignments?${params}`);
  }

  /**
   * Get a single assignment details
   */
  async getAssignment(courseId, assignmentId) {
    return await this.request(`/courses/${courseId}/assignments/${assignmentId}`);
  }

  /**
   * Get upcoming assignments across all courses
   */
  async getUpcomingAssignments() {
    const courses = await this.getCourses();
    const assignments = [];

    for (const course of courses) {
      try {
        const courseAssignments = await this.getCourseAssignments(course.id, {
          bucket: 'upcoming'
        });

        const enriched = courseAssignments.map(a => ({
          ...a,
          courseName: course.name,
          courseId: course.id
        }));

        assignments.push(...enriched);
      } catch (error) {
        console.warn(`Failed to fetch assignments for course ${course.id}:`, error);
      }
    }

    return assignments.sort((a, b) =>
      new Date(a.due_at) - new Date(b.due_at)
    );
  }

  /**
   * Normalize planner items to a consistent format
   */
  normalizePlannerItems(items) {
    return items
      .filter(item => item.plannable_type === 'assignment' || item.plannable_type === 'quiz')
      .map(item => ({
        id: item.plannable_id,
        title: item.plannable?.title || item.plannable_type,
        type: item.plannable_type,
        dueDate: item.plannable_date,
        courseName: item.context_name,
        courseId: item.course_id,
        pointsPossible: item.plannable?.points_possible,
        htmlUrl: item.html_url,
        submissionTypes: item.plannable?.submission_types || [],
        description: item.plannable?.description || '',
        completed: item.planner_override?.marked_complete || false
      }));
  }

  /**
   * Normalize todo items to a consistent format
   */
  normalizeTodoItems(items) {
    return items.map(item => ({
      id: item.assignment?.id || item.id,
      title: item.assignment?.name || 'Untitled',
      type: item.type || 'assignment',
      dueDate: item.assignment?.due_at,
      courseName: item.context_name,
      courseId: item.course_id,
      pointsPossible: item.assignment?.points_possible,
      htmlUrl: item.html_url,
      submissionTypes: item.assignment?.submission_types || [],
      description: item.assignment?.description || '',
      completed: false
    }));
  }

  /**
   * Get the end of the current week (Sunday)
   */
  getEndOfWeek() {
    const now = new Date();
    const daysUntilSunday = 7 - now.getDay();
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + daysUntilSunday);
    endOfWeek.setHours(23, 59, 59, 999);
    return endOfWeek.toISOString();
  }
}

// Export singleton instance for convenience
export const canvasAPI = new CanvasAPI();
