import { useMemo } from 'react';
import { useTodos, TodoItem } from './todo-context';
import {
    DeadlineItem,
    CompletedItem,
    ProgressDay,
    TodoSlideItem,
} from '@/types/stories';

// ── helpers ────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isToday(d: Date): boolean {
    const now = new Date();
    return startOfDay(d).getTime() === startOfDay(now).getTime();
}

function dayKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function timeAgo(d: Date): string {
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
}

function dueDateLabel(d: Date): string {
    const today = startOfDay(new Date());
    const due = startOfDay(d);
    const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
    if (diff < 0) return 'Overdue';
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff <= 7) return `${diff} days`;
    return `${Math.round(diff / 7)} week${Math.round(diff / 7) > 1 ? 's' : ''}`;
}

// ── streak ─────────────────────────────────────────────────────────────────

function computeStreak(todos: TodoItem[]): { current: number; best: number } {
    // Collect unique days where at least one todo was completed
    const completedDays = new Set<string>();
    for (const t of todos) {
        if (t.completed) {
            completedDays.add(dayKey(t.createdAt));
        }
    }

    if (completedDays.size === 0) return { current: 0, best: 0 };

    // Walk backward from today counting consecutive days
    let current = 0;
    const today = startOfDay(new Date());
    let cursor = new Date(today);

    // If today has no completed todos, start counting from yesterday
    if (!completedDays.has(dayKey(cursor))) {
        cursor.setDate(cursor.getDate() - 1);
    }

    while (completedDays.has(dayKey(cursor))) {
        current++;
        cursor.setDate(cursor.getDate() - 1);
        if (current > 365) break; // safety cap
    }

    // Best streak: sort days and find longest run
    const sortedDays = Array.from(completedDays)
        .map((k) => {
            const [y, m, d] = k.split('-').map(Number);
            return new Date(y, m, d).getTime();
        })
        .sort((a, b) => a - b);

    let best = 0;
    let runLen = 1;
    for (let i = 1; i < sortedDays.length; i++) {
        const diff = Math.round((sortedDays[i] - sortedDays[i - 1]) / 86400000);
        if (diff === 1) {
            runLen++;
        } else {
            best = Math.max(best, runLen);
            runLen = 1;
        }
    }
    best = Math.max(best, runLen);

    return { current, best };
}

// ── deadlines ──────────────────────────────────────────────────────────────

function computeDeadlines(todos: TodoItem[]): DeadlineItem[] {
    return todos
        .filter((t) => t.dueDate != null)
        .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
        .slice(0, 6)
        .map((t) => ({
            label: t.title,
            dueIn: dueDateLabel(t.dueDate!),
            done: t.completed,
        }));
}

// ── completed today ────────────────────────────────────────────────────────

function computeCompletedToday(todos: TodoItem[]): CompletedItem[] {
    const CATEGORY_EMOJIS = ['📝', '💼', '🏃', '📖', '🎯', '💡'];
    return todos
        .filter((t) => t.completed && isToday(t.createdAt))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 8)
        .map((t) => ({
            label: t.title,
            completedAt: timeAgo(t.createdAt),
            emoji: CATEGORY_EMOJIS[t.category] ?? '✅',
        }));
}

// ── weekly progress ────────────────────────────────────────────────────────

function computeWeeklyProgress(todos: TodoItem[]): ProgressDay[] {
    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = startOfDay(new Date());

    // Build map: dayKey -> completed count
    const countMap: Record<string, number> = {};
    for (const t of todos) {
        if (t.completed) {
            const k = dayKey(t.createdAt);
            countMap[k] = (countMap[k] ?? 0) + 1;
        }
    }

    const days: ProgressDay[] = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const count = countMap[dayKey(d)] ?? 0;
        days.push({ day: DAY_LABELS[d.getDay()], value: count });
    }

    // Normalize to percentage (max = highest day or 1 to avoid div-by-zero)
    const max = Math.max(...days.map((d) => d.value), 1);
    return days.map((d) => ({ ...d, value: Math.round((d.value / max) * 100) }));
}

// ── hook ───────────────────────────────────────────────────────────────────

export interface StoryStats {
    streak: { current: number; best: number };
    deadlines: DeadlineItem[];
    completedToday: CompletedItem[];
    weeklyProgress: ProgressDay[];
    todayTodos: TodoSlideItem[];
    todayDoneCount: number;
    todayTotalCount: number;
}

export function useStoryStats(): StoryStats {
    const { todos } = useTodos();

    return useMemo<StoryStats>(() => {
        const streak = computeStreak(todos);
        const deadlines = computeDeadlines(todos);
        const completedToday = computeCompletedToday(todos);
        const weeklyProgress = computeWeeklyProgress(todos);

        // Today's todos for the Today story
        const todayTodos = todos
            .filter((t) => isToday(t.createdAt))
            .slice(0, 8)
            .map<TodoSlideItem>((t) => ({
                id: t.id,
                title: t.title,
                completed: t.completed,
                priority: t.priority,
            }));
        const todayDoneCount = todayTodos.filter((t) => t.completed).length;
        const todayTotalCount = todayTodos.length;

        return {
            streak,
            deadlines,
            completedToday,
            weeklyProgress,
            todayTodos,
            todayDoneCount,
            todayTotalCount,
        };
    }, [todos]);
}
