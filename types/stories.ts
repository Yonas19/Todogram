// Shared story-related types used by both StoriesRow and use-story-stats

export type SlideType =
    | 'default'
    | 'streak'
    | 'deadlines'
    | 'progress'
    | 'completed'
    | 'screentime'
    | 'todos';

export interface DeadlineItem {
    label: string;
    dueIn: string;
    done: boolean;
}

export interface ProgressDay {
    day: string;
    value: number; // 0-100 percentage
}

export interface CompletedItem {
    label: string;
    completedAt: string;
    emoji: string;
}

export interface TodoSlideItem {
    id: string;
    title: string;
    completed: boolean;
    priority: number; // 0=Low, 1=Medium, 2=High
}

export interface StorySlide {
    type?: SlideType;
    backgroundColor: string;
    emoji: string;
    title: string;
    subtitle: string;
    // Streak slide
    streakDays?: number;
    streakBestDays?: number;
    // Deadlines slide
    deadlines?: DeadlineItem[];
    // Progress slide
    progressDays?: ProgressDay[];
    progressLabel?: string;
    // Completed slide
    completedItems?: CompletedItem[];
    completedTotal?: number;
    // Screen time
    screenTimeHours?: number;
    screenTimeMinutes?: number;
    screenTimeChange?: number;
    topApps?: { name: string; emoji: string; minutes: number }[];
    // Todos slide
    todoItems?: TodoSlideItem[];
    todoDoneCount?: number;
    todoTotalCount?: number;
}

export interface StoryData {
    id: string;
    name: string;
    emoji: string;
    ringColors: [string, string];
    seen: boolean;
    slides: StorySlide[];
}
