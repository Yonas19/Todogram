import React, { useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useStoryStats } from '@/hooks/use-story-stats';
import {
    SlideType,
    DeadlineItem,
    ProgressDay,
    CompletedItem,
    TodoSlideItem,
    StorySlide,
    StoryData,
} from '@/types/stories';

// Re-export for story-viewer and other consumers
export type {
    SlideType,
    DeadlineItem,
    ProgressDay,
    CompletedItem,
    TodoSlideItem,
    StorySlide,
    StoryData,
};

const STORY_SIZE = 68;
const RING_SIZE = STORY_SIZE + 6;

// Module-level ref so story-viewer can read the current stories
let _activeStories: StoryData[] = [];
export function getActiveStories(): StoryData[] {
    return _activeStories;
}

// ── Static stories that don't depend on user data ──────────────────────────

const SCREEN_STORY: StoryData = {
    id: 'screen',
    name: 'Screen',
    emoji: '📱',
    ringColors: ['#3B82F6', '#06B6D4'],
    seen: false,
    slides: [
        {
            type: 'screentime',
            backgroundColor: '#0B1426',
            emoji: '📱',
            title: 'Screen Time',
            subtitle: 'N/A — not tracked yet',
            screenTimeHours: 0,
            screenTimeMinutes: 0,
            screenTimeChange: 0,
            topApps: [],
        },
    ],
};

const AWARDS_STORY: StoryData = {
    id: 'awards',
    name: 'Awards',
    emoji: '🏆',
    ringColors: ['#F59E0B', '#EF4444'],
    seen: false,
    slides: [
        {
            type: 'default',
            backgroundColor: '#1A1000',
            emoji: '🏆',
            title: 'Awards',
            subtitle: 'Complete tasks consistently to earn badges!',
        },
    ],
};

// ── Component ──────────────────────────────────────────────────────────────

function StoryBubble({
    story,
    index,
    theme,
}: {
    story: StoryData;
    index: number;
    theme: typeof Colors.dark;
}) {
    const router = useRouter();

    const handlePress = () => {
        router.push({ pathname: '/story-viewer', params: { storyIndex: index.toString() } });
    };

    return (
        <TouchableOpacity style={styles.storyContainer} activeOpacity={0.7} onPress={handlePress}>
            {/* Ring */}
            <View
                style={[
                    styles.ring,
                    {
                        borderColor: story.seen ? theme.cardBorder : story.ringColors[0],
                    },
                ]}
            >
                {/* Avatar circle */}
                <View style={[styles.avatar, { backgroundColor: story.ringColors[0] + '20' }]}>
                    <Text style={styles.avatarEmoji}>{story.emoji}</Text>
                </View>
            </View>
            {/* Name */}
            <Text style={[styles.storyName, { color: theme.text }]} numberOfLines={1}>
                {story.name}
            </Text>
        </TouchableOpacity>
    );
}

export default function StoriesRow() {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const stats = useStoryStats();

    const stories = useMemo<StoryData[]>(() => {
        // ── Today Todos story (first) ──────────────────────────────────────
        const todayStory: StoryData | null =
            stats.todayTotalCount > 0
                ? {
                    id: 'today-todos',
                    name: 'Today',
                    emoji: '📋',
                    ringColors: ['#8B5CF6', '#EC4899'],
                    seen: false,
                    slides: [
                        {
                            type: 'todos',
                            backgroundColor: '#1B0F30',
                            emoji: '📋',
                            title: "Today's Todos",
                            subtitle:
                                stats.todayDoneCount === stats.todayTotalCount
                                    ? `${stats.todayDoneCount}/${stats.todayTotalCount} done — All done! 🎉`
                                    : `${stats.todayDoneCount}/${stats.todayTotalCount} done — ${Math.round(
                                        (stats.todayDoneCount / stats.todayTotalCount) * 100
                                    )}% complete`,
                            todoItems: stats.todayTodos,
                            todoDoneCount: stats.todayDoneCount,
                            todoTotalCount: stats.todayTotalCount,
                        },
                    ],
                }
                : null;

        // ── Streak story ───────────────────────────────────────────────────
        const streakStory: StoryData = {
            id: 'streak',
            name: 'Streak',
            emoji: '🔥',
            ringColors: ['#FF6B35', '#FFD93D'],
            seen: false,
            slides: [
                {
                    type: 'streak',
                    backgroundColor: '#1A1040',
                    emoji: '🔥',
                    title: 'Your Streak',
                    subtitle:
                        stats.streak.current > 0
                            ? `${stats.streak.current} day${stats.streak.current !== 1 ? 's' : ''} strong! Keep it going!`
                            : 'No streak yet — complete a task to start!',
                    streakDays: stats.streak.current,
                    streakBestDays: stats.streak.best,
                },
            ],
        };

        // ── Deadlines story ────────────────────────────────────────────────
        const deadlineStory: StoryData = {
            id: 'deadlines',
            name: 'Deadlines',
            emoji: '📅',
            ringColors: ['#F87171', '#FBBF24'],
            seen: false,
            slides: [
                {
                    type: 'deadlines',
                    backgroundColor: '#0D2137',
                    emoji: '📅',
                    title: 'Deadlines',
                    subtitle:
                        stats.deadlines.length > 0
                            ? "Here's what's coming up"
                            : 'No deadlines set — add a due date to a task!',
                    deadlines: stats.deadlines,
                },
            ],
        };

        // ── Completed story ────────────────────────────────────────────────
        const completedStory: StoryData = {
            id: 'completed',
            name: 'Completed',
            emoji: '✅',
            ringColors: ['#34D399', '#10B981'],
            seen: false,
            slides: [
                {
                    type: 'completed',
                    backgroundColor: '#0A1F1A',
                    emoji: '✅',
                    title: 'Completed Today',
                    subtitle:
                        stats.completedToday.length > 0
                            ? `Nice work! You crushed ${stats.completedToday.length} task${stats.completedToday.length !== 1 ? 's' : ''}`
                            : 'Nothing completed yet today — you got this!',
                    completedTotal: stats.completedToday.length,
                    completedItems: stats.completedToday,
                },
            ],
        };

        // ── Progress story ─────────────────────────────────────────────────
        const hasAnyProgress = stats.weeklyProgress.some((d) => d.value > 0);
        const progressStory: StoryData = {
            id: 'progress',
            name: 'Progress',
            emoji: '📈',
            ringColors: ['#6C63FF', '#A78BFA'],
            seen: false,
            slides: [
                {
                    type: 'progress',
                    backgroundColor: '#0F1F35',
                    emoji: '📈',
                    title: 'Weekly Progress',
                    subtitle: hasAnyProgress
                        ? 'Tasks completed this week'
                        : 'No activity yet this week',
                    progressLabel: hasAnyProgress ? 'Last 7 days' : 'N/A',
                    progressDays: stats.weeklyProgress,
                },
            ],
        };

        const result = [
            ...(todayStory ? [todayStory] : []),
            streakStory,
            deadlineStory,
            completedStory,
            progressStory,
            SCREEN_STORY,
            AWARDS_STORY,
        ];
        _activeStories = result;
        return result;
    }, [stats]);

    return (
        <View style={styles.wrapper}>
            <FlatList
                data={stories}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item, index }) => (
                    <StoryBubble story={item} index={index} theme={theme} />
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: Spacing.md,
        marginHorizontal: -Spacing.lg,
    },
    listContent: {
        paddingHorizontal: Spacing.lg,
        gap: 14,
    },
    storyContainer: {
        alignItems: 'center',
        width: RING_SIZE + 8,
    },
    ring: {
        width: RING_SIZE,
        height: RING_SIZE,
        borderRadius: RING_SIZE / 2,
        borderWidth: 2.5,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
    },
    avatar: {
        width: STORY_SIZE,
        height: STORY_SIZE,
        borderRadius: STORY_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarEmoji: {
        fontSize: 30,
    },
    storyName: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 6,
        textAlign: 'center',
    },
});
