import React, { useRef, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Dimensions,
    Animated,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useTodos } from '@/hooks/todo-context';

const { width } = Dimensions.get('window');
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Date helpers ──────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Convert Sunday=0 → Mon=0 grid
}

function isSameDay(d1: Date, d2: Date) {
    return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
    );
}

function startOfDay(d: Date): number {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// ── Heat color ─────────────────────────────────────────────────────────────

function getHeatColor(pct: number, accent: string): string {
    if (pct <= 0) return 'transparent';
    if (pct <= 20) return accent + '25';
    if (pct <= 40) return accent + '45';
    if (pct <= 60) return accent + '65';
    if (pct <= 80) return accent + '90';
    return accent + 'DD';
}

// ── DayCell ───────────────────────────────────────────────────────────────────

interface DayCellProps {
    day: number;
    pct: number;      // -1 = future, 0 = no data, >0 = completion %
    total: number;
    done: number;
    isToday: boolean;
    isFuture: boolean;
    hasData: boolean; // true if that day had any todos at all
    theme: typeof Colors.dark;
    cellSize: number;
    onPress: () => void;
}

function DayCell({ day, pct, isToday, isFuture, hasData, theme, cellSize, onPress }: DayCellProps) {
    const scaleAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 6,
            delay: day * 12,
            useNativeDriver: true,
        }).start();
    }, []);

    // Colour logic:
    //  • future          → faint surface
    //  • past, no todos  → plain surface (user didn't track that day)
    //  • past, has todos → heat colour based on completion %
    const bgColor = isFuture
        ? theme.surfaceElevated + '30'
        : !hasData
            ? theme.surfaceElevated
            : pct === 0
                ? theme.surfaceElevated + 'AA'
                : getHeatColor(pct, theme.accent);

    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={onPress}
                style={[
                    s.cell,
                    {
                        width: cellSize,
                        height: cellSize,
                        backgroundColor: bgColor,
                        borderWidth: isToday ? 2 : 0,
                        borderColor: isToday ? theme.accent : 'transparent',
                    },
                ]}
            >
                <Text
                    style={[
                        s.cellDay,
                        {
                            color: isFuture
                                ? theme.textSecondary + '40'
                                : pct > 60
                                    ? '#FFFFFF'
                                    : theme.text,
                            fontWeight: isToday ? '800' : '500',
                        },
                    ]}
                >
                    {day}
                </Text>
            </TouchableOpacity>
        </Animated.View>
    );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function DashboardScreen() {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const { todos } = useTodos();

    const now = new Date();
    const [viewMonth, setViewMonth] = useState(now.getMonth());
    const [viewYear, setViewYear] = useState(now.getFullYear());
    const [selectedDay, setSelectedDay] = useState<number | null>(null);

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, []);

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

    // Cell size: 7 columns with 6 gaps inside available width
    const gridWidth = width - Spacing.lg * 2 - 32;
    const cellGap = 6;
    const cellSize = Math.floor((gridWidth - cellGap * 6) / 7);

    // ── Build a lookup: "YYYY-M-D" → { total, done } from real todos ─────────
    const todosByDay = useMemo(() => {
        const map: Record<string, { total: number; done: number }> = {};
        for (const t of todos) {
            const d = new Date(t.createdAt);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            if (!map[key]) map[key] = { total: 0, done: 0 };
            map[key].total++;
            if (t.completed) map[key].done++;
        }
        return map;
    }, [todos]);

    // ── Per-day data for the viewed month ────────────────────────────────────
    const dayData = useMemo(() => {
        const todayTs = startOfDay(now);
        const result: {
            day: number;
            pct: number;
            total: number;
            done: number;
            isFuture: boolean;
            hasData: boolean;
        }[] = [];

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(viewYear, viewMonth, d);
            const ts = date.getTime();
            const isFuture = ts > todayTs;
            const key = `${viewYear}-${viewMonth}-${d}`;
            const entry = todosByDay[key];

            if (isFuture) {
                result.push({ day: d, pct: -1, total: 0, done: 0, isFuture: true, hasData: false });
            } else if (!entry || entry.total === 0) {
                // Day is in the past but user had no todos — show untracked
                result.push({ day: d, pct: 0, total: 0, done: 0, isFuture: false, hasData: false });
            } else {
                const pct = Math.round((entry.done / entry.total) * 100);
                result.push({ day: d, pct, total: entry.total, done: entry.done, isFuture: false, hasData: true });
            }
        }
        return result;
    }, [viewYear, viewMonth, todosByDay, daysInMonth]);

    // ── Summary stats — only for days that had real todos ────────────────────
    const stats = useMemo(() => {
        // Count across ALL todos (not just the viewed month) so stats are global
        const allKeys = Object.keys(todosByDay);
        if (allKeys.length === 0) {
            return { avgPct: 0, perfectDays: 0, activeDays: 0, totalDays: 0 };
        }

        let totalPct = 0;
        let perfectDays = 0;
        let activeDays = 0;
        const totalDays = allKeys.length;

        for (const key of allKeys) {
            const { total, done } = todosByDay[key];
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            totalPct += pct;
            if (pct === 100) perfectDays++;
            if (done > 0) activeDays++;
        }

        const avgPct = Math.round(totalPct / totalDays);
        return { avgPct, perfectDays, activeDays, totalDays };
    }, [todosByDay]);

    const selectedData = selectedDay != null ? dayData.find((d) => d.day === selectedDay) : null;

    const goNextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
        else setViewMonth((m) => m + 1);
        setSelectedDay(null);
    };
    const goPrevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
        else setViewMonth((m) => m - 1);
        setSelectedDay(null);
    };

    const hasAnyData = stats.totalDays > 0;

    return (
        <SafeAreaView style={[s.safeArea, { backgroundColor: theme.background }]}>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
                <Animated.View style={{ opacity: fadeAnim }}>
                    {/* Header */}
                    <Text style={[s.headerTitle, { color: theme.text }]}>Dashboard</Text>

                    {/* Month Selector */}
                    <View style={s.monthRow}>
                        <TouchableOpacity onPress={goPrevMonth} style={[s.monthArrow, { backgroundColor: theme.surface }]}>
                            <Text style={[s.arrowText, { color: theme.text }]}>‹</Text>
                        </TouchableOpacity>
                        <Text style={[s.monthLabel, { color: theme.text }]}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
                        <TouchableOpacity onPress={goNextMonth} style={[s.monthArrow, { backgroundColor: theme.surface }]}>
                            <Text style={[s.arrowText, { color: theme.text }]}>›</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Heatmap Card */}
                    <View style={[s.heatCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
                        {/* Day headers */}
                        <View style={[s.dayHeaders, { gap: cellGap }]}>
                            {DAY_HEADERS.map((h) => (
                                <View key={h} style={{ width: cellSize, alignItems: 'center' }}>
                                    <Text style={[s.dayHeader, { color: theme.textSecondary }]}>{h}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Calendar grid */}
                        <View style={[s.grid, { gap: cellGap }]}>
                            {/* Empty offset cells */}
                            {Array.from({ length: firstDay }).map((_, i) => (
                                <View key={`empty-${i}`} style={{ width: cellSize, height: cellSize }} />
                            ))}
                            {/* Day cells */}
                            {dayData.map(({ day, pct, total, done, isFuture, hasData }) => {
                                const date = new Date(viewYear, viewMonth, day);
                                const todayFlag = isSameDay(date, now);
                                return (
                                    <DayCell
                                        key={day}
                                        day={day}
                                        pct={pct}
                                        total={total}
                                        done={done}
                                        isToday={todayFlag}
                                        isFuture={isFuture}
                                        hasData={hasData}
                                        theme={theme}
                                        cellSize={cellSize}
                                        onPress={() => !isFuture && setSelectedDay(day)}
                                    />
                                );
                            })}
                        </View>

                        {/* Legend */}
                        <View style={s.legend}>
                            <Text style={[s.legendLabel, { color: theme.textSecondary }]}>Less</Text>
                            {[0, 25, 50, 75, 100].map((v) => (
                                <View
                                    key={v}
                                    style={[
                                        s.legendBox,
                                        { backgroundColor: v === 0 ? theme.surfaceElevated : getHeatColor(v, theme.accent) },
                                    ]}
                                />
                            ))}
                            <Text style={[s.legendLabel, { color: theme.textSecondary }]}>More</Text>
                        </View>
                    </View>

                    {/* Selected Day Detail */}
                    {selectedData && !selectedData.isFuture && (
                        <View style={[s.detailCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
                            <Text style={[s.detailDate, { color: theme.text }]}>
                                {MONTH_NAMES[viewMonth]} {selectedDay}, {viewYear}
                            </Text>
                            {selectedData.hasData ? (
                                <>
                                    <View style={s.detailRow}>
                                        <View style={s.detailStat}>
                                            <Text style={[s.detailValue, { color: theme.accent }]}>{selectedData.pct}%</Text>
                                            <Text style={[s.detailLabel, { color: theme.textSecondary }]}>Completed</Text>
                                        </View>
                                        <View style={[s.detailDivider, { backgroundColor: theme.cardBorder }]} />
                                        <View style={s.detailStat}>
                                            <Text style={[s.detailValue, { color: theme.text }]}>
                                                {selectedData.done}/{selectedData.total}
                                            </Text>
                                            <Text style={[s.detailLabel, { color: theme.textSecondary }]}>Tasks</Text>
                                        </View>
                                    </View>
                                    <View style={[s.detailBarBg, { backgroundColor: theme.surfaceElevated }]}>
                                        <View
                                            style={[
                                                s.detailBarFill,
                                                { width: `${selectedData.pct}%` as any, backgroundColor: theme.accent },
                                            ]}
                                        />
                                    </View>
                                </>
                            ) : (
                                <Text style={[s.noDataText, { color: theme.textSecondary }]}>
                                    No tasks tracked on this day
                                </Text>
                            )}
                        </View>
                    )}

                    {/* Summary Stats */}
                    {!hasAnyData ? (
                        <View style={[s.emptyState, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
                            <Text style={s.emptyEmoji}>📊</Text>
                            <Text style={[s.emptyTitle, { color: theme.text }]}>No data yet</Text>
                            <Text style={[s.emptySubtitle, { color: theme.textSecondary }]}>
                                Start adding and completing tasks to see your stats here
                            </Text>
                        </View>
                    ) : (
                        <>
                            <View style={s.statsRow}>
                                <View style={[s.statCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
                                    <Text style={s.statEmoji}>📊</Text>
                                    <Text style={[s.statValue, { color: theme.text }]}>{stats.avgPct}%</Text>
                                    <Text style={[s.statLabel, { color: theme.textSecondary }]}>Avg Completion</Text>
                                </View>
                                <View style={[s.statCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
                                    <Text style={s.statEmoji}>🔥</Text>
                                    <Text style={[s.statValue, { color: theme.text }]}>{stats.activeDays}</Text>
                                    <Text style={[s.statLabel, { color: theme.textSecondary }]}>Active Days</Text>
                                </View>
                            </View>
                            <View style={s.statsRow}>
                                <View style={[s.statCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
                                    <Text style={s.statEmoji}>⭐</Text>
                                    <Text style={[s.statValue, { color: theme.text }]}>{stats.perfectDays}</Text>
                                    <Text style={[s.statLabel, { color: theme.textSecondary }]}>Perfect Days</Text>
                                </View>
                                <View style={[s.statCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
                                    <Text style={s.statEmoji}>📅</Text>
                                    <Text style={[s.statValue, { color: theme.text }]}>{stats.totalDays}</Text>
                                    <Text style={[s.statLabel, { color: theme.textSecondary }]}>Days Tracked</Text>
                                </View>
                            </View>
                        </>
                    )}

                    <View style={{ height: Spacing.xl + 40 }} />
                </Animated.View>
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safeArea: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
    headerTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: Spacing.md },

    // Month selector
    monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: Spacing.lg },
    monthArrow: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    arrowText: { fontSize: 24, fontWeight: '300', lineHeight: 28 },
    monthLabel: { fontSize: 18, fontWeight: '700', minWidth: 160, textAlign: 'center' },

    // Heatmap
    heatCard: { borderRadius: BorderRadius.lg, padding: 16, borderWidth: 1, marginBottom: Spacing.lg },
    dayHeaders: { flexDirection: 'row', marginBottom: 8 },
    dayHeader: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },

    cell: { borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    cellDay: { fontSize: 12 },

    // Legend
    legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 },
    legendBox: { width: 16, height: 16, borderRadius: 4 },
    legendLabel: { fontSize: 11, fontWeight: '600' },

    // Detail Card
    detailCard: { borderRadius: BorderRadius.lg, padding: 16, borderWidth: 1, marginBottom: Spacing.lg },
    detailDate: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
    detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    detailStat: { flex: 1, alignItems: 'center' },
    detailValue: { fontSize: 28, fontWeight: '800' },
    detailLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    detailDivider: { width: 1, height: 40 },
    detailBarBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
    detailBarFill: { height: '100%', borderRadius: 4 },
    noDataText: { fontSize: 14, fontWeight: '500', textAlign: 'center', paddingVertical: 8 },

    // Empty state
    emptyState: {
        borderRadius: BorderRadius.lg,
        padding: 32,
        borderWidth: 1,
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    emptyEmoji: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
    emptySubtitle: { fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 20 },

    // Stats
    statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
    statCard: { flex: 1, padding: 16, borderRadius: BorderRadius.lg, borderWidth: 1, alignItems: 'center' },
    statEmoji: { fontSize: 24, marginBottom: 6 },
    statValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
    statLabel: { fontSize: 12, fontWeight: '600', marginTop: 2, textAlign: 'center' },
});
