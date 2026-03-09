import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/auth-context';
import { useStoryStats } from '@/hooks/use-story-stats';

const { width } = Dimensions.get('window');

// ── Types ─────────────────────────────────────────────────────────────────────

interface RoomMember {
    id: string;
    room_id: string;
    user_id: string;
    display_name: string;
    emoji: string;
    focus_seconds: number;
    joined_at: string;
}

interface FocusTotal {
    id: string;
    user_id: string;
    display_name: string;
    emoji: string;
    total_seconds: number;
    updated_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatFocusTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (seconds < 60) return `${seconds}s`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function RoomSessionScreen() {
    const router = useRouter();
    const { session } = useAuth();
    const { streak } = useStoryStats();

    const params = useLocalSearchParams<{
        roomId: string;
        roomName: string;
        roomColor: string;
        roomEmoji: string;
        roomMembers: string;
        roomHost: string;
    }>();

    const roomId = params.roomId || '';
    const roomName = params.roomName || 'Grind Room';
    const roomColor = params.roomColor || '#6C63FF';
    const roomEmoji = params.roomEmoji || '🔥';

    const userId = session?.user?.id ?? '';
    const userEmail = session?.user?.email ?? 'user@app.com';
    const displayName = userEmail.split('@')[0];

    const MEMBER_EMOJIS = ['🙋', '🧑‍💻', '👨‍🎓', '🧠', '🔥', '⚡', '🚀', '🎯'];
    const myEmoji = MEMBER_EMOJIS[streak.current % MEMBER_EMOJIS.length];

    // ── Timer state ────────────────────────────────────────────────────────────
    const [timerRunning, setTimerRunning] = useState(false);
    const [timerSeconds, setTimerSeconds] = useState(0);
    // 'room' = current session ranking, 'global' = all-time total focus ranking
    const [activeTab, setActiveTab] = useState<'room' | 'global'>('room');

    // ── Members state (current room session) ───────────────────────────────────
    const [members, setMembers] = useState<RoomMember[]>([]);
    const [membersLoading, setMembersLoading] = useState(true);

    // ── Global leaderboard state ───────────────────────────────────────────────
    const [globalLeaders, setGlobalLeaders] = useState<FocusTotal[]>([]);
    const [globalLoading, setGlobalLoading] = useState(true);

    // ── Animations ─────────────────────────────────────────────────────────────
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const timerPulse = useRef(new Animated.Value(1)).current;

    // Keep a ref to the current timer value for async callbacks
    const timerSecondsRef = useRef(0);
    timerSecondsRef.current = timerSeconds;

    // How many seconds we had at the START of this session (for accumulating)
    const sessionStartRef = useRef(0);

    const focusSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Fetch room members ─────────────────────────────────────────────────────
    const fetchMembers = useCallback(async () => {
        if (!roomId) return;
        const { data, error } = await (supabase.from('room_members') as any)
            .select('*')
            .eq('room_id', roomId)
            .order('focus_seconds', { ascending: false });
        if (!error && data) setMembers(data);
        setMembersLoading(false);
    }, [roomId]);

    // ── Fetch global leaderboard ───────────────────────────────────────────────
    const fetchGlobalLeaders = useCallback(async () => {
        const { data, error } = await (supabase.from('user_focus_totals') as any)
            .select('*')
            .order('total_seconds', { ascending: false })
            .limit(50);
        if (!error && data) setGlobalLeaders(data);
        setGlobalLoading(false);
    }, []);

    // ── Join room (upsert room_members) ────────────────────────────────────────
    const joinRoom = useCallback(async () => {
        if (!userId || !roomId) return;
        await (supabase.from('room_members') as any).upsert(
            {
                room_id: roomId,
                user_id: userId,
                display_name: displayName,
                emoji: myEmoji,
                focus_seconds: 0,
            },
            { onConflict: 'room_id,user_id' }
        );
    }, [userId, roomId, displayName, myEmoji]);

    // ── Leave room & persist global total ─────────────────────────────────────
    const leaveRoom = useCallback(async () => {
        if (!userId || !roomId) return;
        const finalSeconds = timerSecondsRef.current;

        // 1. Save final focus time in room
        await (supabase.from('room_members') as any)
            .update({ focus_seconds: finalSeconds })
            .eq('room_id', roomId)
            .eq('user_id', userId);

        // 2. Add this session's time to the user's global total (upsert with increment)
        //    We fetch the current total first, then add to it.
        if (finalSeconds > 0) {
            const { data: existing } = await (supabase.from('user_focus_totals') as any)
                .select('total_seconds')
                .eq('user_id', userId)
                .single();

            const previous = existing?.total_seconds ?? 0;
            const newTotal = previous + finalSeconds;

            await (supabase.from('user_focus_totals') as any).upsert(
                {
                    user_id: userId,
                    display_name: displayName,
                    emoji: myEmoji,
                    total_seconds: newTotal,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id' }
            );
        }

        // 3. Remove from room
        await (supabase.from('room_members') as any)
            .delete()
            .eq('room_id', roomId)
            .eq('user_id', userId);
    }, [userId, roomId, displayName, myEmoji]);

    // ── Lifecycle ──────────────────────────────────────────────────────────────
    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();

        joinRoom().then(fetchMembers);
        fetchGlobalLeaders();

        // Real-time: room members
        const roomChannel = supabase
            .channel(`room-${roomId}-members`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'room_members',
                filter: `room_id=eq.${roomId}`,
            }, fetchMembers)
            .subscribe();

        // Real-time: global leaderboard
        const globalChannel = supabase
            .channel('global-focus-totals')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'user_focus_totals',
            }, fetchGlobalLeaders)
            .subscribe();

        return () => {
            supabase.removeChannel(roomChannel);
            supabase.removeChannel(globalChannel);
            leaveRoom();
            if (focusSyncRef.current) clearInterval(focusSyncRef.current);
        };
    }, [roomId]);

    // ── Countdown logic ────────────────────────────────────────────────────────
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (timerRunning) {
            interval = setInterval(() => setTimerSeconds((s) => s + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [timerRunning]);

    // Sync room focus_seconds every 10 s while timer is running
    useEffect(() => {
        if (timerRunning && userId && roomId) {
            focusSyncRef.current = setInterval(async () => {
                await (supabase.from('room_members') as any)
                    .update({ focus_seconds: timerSecondsRef.current })
                    .eq('room_id', roomId)
                    .eq('user_id', userId);
                fetchMembers();
            }, 10000);
        } else {
            if (focusSyncRef.current) {
                clearInterval(focusSyncRef.current);
                focusSyncRef.current = null;
            }
        }
        return () => {
            if (focusSyncRef.current) clearInterval(focusSyncRef.current);
        };
    }, [timerRunning, userId, roomId]);

    // Pulse animation while running
    useEffect(() => {
        if (timerRunning) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(timerPulse, { toValue: 1.03, duration: 1200, useNativeDriver: true }),
                    Animated.timing(timerPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
                ])
            );
            pulse.start();
            return () => { pulse.stop(); timerPulse.setValue(1); };
        }
    }, [timerRunning]);

    // ── Derived display data ───────────────────────────────────────────────────
    const myFocusTime = timerSeconds;

    // Merge local timer into room members list for accurate display
    const displayMembers = members.map((m) =>
        m.user_id === userId ? { ...m, focus_seconds: myFocusTime } : m
    );
    const sortedByFocus = [...displayMembers].sort((a, b) => b.focus_seconds - a.focus_seconds);

    // For the global leaderboard, show local timer merged in if user already has a record
    const mergedGlobal = globalLeaders.map((g) => {
        if (g.user_id !== userId) return g;
        // Show existing total + current session (not yet saved)
        return { ...g, total_seconds: g.total_seconds + myFocusTime };
    });
    // If user doesn't have a global record yet, prepend a temporary entry
    const hasGlobalRecord = globalLeaders.some((g) => g.user_id === userId);
    const fullGlobal = hasGlobalRecord
        ? mergedGlobal
        : myFocusTime > 0
            ? [{ id: 'local', user_id: userId, display_name: displayName, emoji: myEmoji, total_seconds: myFocusTime, updated_at: '' }, ...mergedGlobal]
            : mergedGlobal;
    const sortedGlobal = [...fullGlobal].sort((a, b) => b.total_seconds - a.total_seconds);

    const topByTime = sortedByFocus.slice(0, 3);
    const PODIUM_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

    const toggleTimer = () => setTimerRunning((prev) => !prev);
    const resetTimer = () => { setTimerRunning(false); setTimerSeconds(0); };

    const handleBack = async () => {
        setTimerRunning(false);
        await leaveRoom();
        router.back();
    };

    const myGlobalRank = sortedGlobal.findIndex((g) => g.user_id === userId) + 1;

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: '#0a0a1a' }]}>
            <StatusBar style="light" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
                    <MaterialIcons name="arrow-back" size={22} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <View style={styles.headerLive}>
                        <View style={styles.headerLiveDot} />
                        <Text style={styles.headerLiveText}>LIVE</Text>
                    </View>
                    <Text style={styles.headerRoom} numberOfLines={1}>{roomName}</Text>
                </View>
                <View style={styles.headerRight}>
                    <View style={styles.memberCount}>
                        <MaterialIcons name="people" size={14} color="rgba(255,255,255,0.6)" />
                        <Text style={styles.memberCountText}>{members.length}</Text>
                    </View>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <Animated.View style={{ opacity: fadeAnim }}>

                    {/* Timer Section */}
                    <View style={styles.timerSection}>
                        <Text style={styles.timerLabel}>
                            {timerRunning ? '🔥 Grinding...' : timerSeconds > 0 ? '⏸️ Paused' : '⏱️ Ready to focus?'}
                        </Text>

                        <Animated.View
                            style={[
                                styles.timerCircle,
                                {
                                    borderColor: timerRunning ? roomColor : 'rgba(255,255,255,0.1)',
                                    transform: [{ scale: timerPulse }],
                                },
                            ]}
                        >
                            <View style={[styles.timerInner, { backgroundColor: timerRunning ? roomColor + '10' : 'rgba(255,255,255,0.03)' }]}>
                                <Text style={[styles.timerText, { color: timerRunning ? roomColor : '#FFFFFF' }]}>
                                    {formatTime(timerSeconds)}
                                </Text>
                                <Text style={styles.timerSub}>
                                    {timerRunning ? 'focusing' : 'tap start'}
                                </Text>
                            </View>
                        </Animated.View>

                        {/* My global rank badge */}
                        {myGlobalRank > 0 && (
                            <View style={[styles.myRankBadge, { borderColor: roomColor + '40', backgroundColor: roomColor + '10' }]}>
                                <Text style={styles.myRankEmoji}>🌍</Text>
                                <Text style={[styles.myRankText, { color: roomColor }]}>
                                    #{myGlobalRank} All-Time · {formatFocusTime(myFocusTime + (globalLeaders.find(g => g.user_id === userId)?.total_seconds ?? 0))} total
                                </Text>
                            </View>
                        )}

                        {/* Timer Controls */}
                        <View style={styles.timerControls}>
                            {timerSeconds > 0 && (
                                <TouchableOpacity style={[styles.controlBtn, styles.resetBtn]} onPress={resetTimer} activeOpacity={0.7}>
                                    <MaterialIcons name="refresh" size={22} color="rgba(255,255,255,0.6)" />
                                    <Text style={styles.resetText}>Reset</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={[styles.controlBtn, styles.mainBtn, { backgroundColor: timerRunning ? '#EF4444' : roomColor }]}
                                onPress={toggleTimer}
                                activeOpacity={0.85}
                            >
                                <MaterialIcons name={timerRunning ? 'pause' : 'play-arrow'} size={28} color="#FFFFFF" />
                                <Text style={styles.mainBtnText}>
                                    {timerRunning ? 'Pause' : timerSeconds > 0 ? 'Resume' : 'Start'}
                                </Text>
                            </TouchableOpacity>
                            {timerSeconds > 0 && (
                                <TouchableOpacity style={[styles.controlBtn, styles.resetBtn]} onPress={() => setTimerRunning(false)} activeOpacity={0.7}>
                                    <MaterialIcons name="stop" size={22} color="rgba(255,255,255,0.6)" />
                                    <Text style={styles.resetText}>Stop</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Top 3 Podium (room session) */}
                    {!membersLoading && topByTime.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>🏆 Top Grinders This Session</Text>
                            <View style={styles.podium}>
                                {topByTime.map((member, i) => {
                                    const isMe = member.user_id === userId;
                                    const focusDisplay = isMe ? myFocusTime : member.focus_seconds;
                                    return (
                                        <View key={member.id} style={[styles.podiumItem, i === 0 && styles.podiumFirst]}>
                                            <Text style={styles.podiumMedal}>
                                                {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                                            </Text>
                                            <View style={[styles.podiumAvatar, { backgroundColor: PODIUM_COLORS[i] + '25', borderColor: PODIUM_COLORS[i] }]}>
                                                <Text style={styles.podiumEmoji}>{member.emoji}</Text>
                                            </View>
                                            <Text style={styles.podiumName} numberOfLines={1}>
                                                {isMe ? 'You' : member.display_name}
                                            </Text>
                                            <View style={[styles.streakBadge, { backgroundColor: PODIUM_COLORS[i] + '20' }]}>
                                                <Text style={styles.streakFire}>⏱️</Text>
                                                <Text style={[styles.streakNum, { color: PODIUM_COLORS[i] }]}>
                                                    {formatFocusTime(focusDisplay)}
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* Tab switcher */}
                    <View style={styles.tabSwitcher}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'room' && { backgroundColor: roomColor + '20', borderColor: roomColor }]}
                            onPress={() => setActiveTab('room')}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.tabText, activeTab === 'room' && { color: roomColor }]}>⏱️ This Session</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'global' && { backgroundColor: roomColor + '20', borderColor: roomColor }]}
                            onPress={() => setActiveTab('global')}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.tabText, activeTab === 'global' && { color: roomColor }]}>🌍 All-Time Rank</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Leaderboard list */}
                    <View style={styles.section}>
                        {activeTab === 'room' ? (
                            /* ── Room session leaderboard ── */
                            membersLoading ? (
                                <View style={styles.loadingBox}>
                                    <ActivityIndicator color={roomColor} size="small" />
                                    <Text style={styles.loadingText}>Loading members…</Text>
                                </View>
                            ) : sortedByFocus.length === 0 ? (
                                <View style={styles.emptyMembers}>
                                    <Text style={styles.emptyMembersEmoji}>👥</Text>
                                    <Text style={styles.emptyMembersText}>You're the first one here!</Text>
                                    <Text style={styles.emptyMembersSub}>Start your timer and grind 💪</Text>
                                </View>
                            ) : (
                                sortedByFocus.map((member, i) => {
                                    const isMe = member.user_id === userId;
                                    const focusDisplay = isMe ? myFocusTime : member.focus_seconds;
                                    return (
                                        <View
                                            key={member.id}
                                            style={[
                                                styles.leaderRow,
                                                isMe && { backgroundColor: roomColor + '10', borderColor: roomColor + '30' },
                                            ]}
                                        >
                                            <Text style={[styles.rankNum, i < 3 && { color: roomColor }]}>{i + 1}</Text>
                                            <View style={[styles.leaderAvatar, isMe && { borderColor: roomColor }]}>
                                                <Text style={styles.leaderEmoji}>{member.emoji}</Text>
                                            </View>
                                            <View style={styles.leaderInfo}>
                                                <Text style={[styles.leaderName, isMe && { color: roomColor }]}>
                                                    {isMe ? `${member.display_name} (You)` : member.display_name}
                                                </Text>
                                                <Text style={styles.leaderStat}>
                                                    {focusDisplay > 0 ? formatFocusTime(focusDisplay) : 'Not started'}
                                                </Text>
                                            </View>
                                            {i === 0 && <Text style={styles.crownEmoji}>👑</Text>}
                                            {isMe && timerRunning && (
                                                <View style={[styles.activeDot, { backgroundColor: roomColor }]} />
                                            )}
                                        </View>
                                    );
                                })
                            )
                        ) : (
                            /* ── Global all-time leaderboard ── */
                            globalLoading ? (
                                <View style={styles.loadingBox}>
                                    <ActivityIndicator color={roomColor} size="small" />
                                    <Text style={styles.loadingText}>Loading global ranks…</Text>
                                </View>
                            ) : sortedGlobal.length === 0 ? (
                                <View style={styles.emptyMembers}>
                                    <Text style={styles.emptyMembersEmoji}>🌍</Text>
                                    <Text style={styles.emptyMembersText}>No global records yet</Text>
                                    <Text style={styles.emptyMembersSub}>Start your timer to claim #1! 🚀</Text>
                                </View>
                            ) : (
                                sortedGlobal.map((entry, i) => {
                                    const isMe = entry.user_id === userId;
                                    return (
                                        <View
                                            key={entry.id}
                                            style={[
                                                styles.leaderRow,
                                                isMe && { backgroundColor: roomColor + '10', borderColor: roomColor + '30' },
                                            ]}
                                        >
                                            {/* Rank with medal for top 3 */}
                                            {i < 3 ? (
                                                <Text style={styles.rankMedal}>
                                                    {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                                                </Text>
                                            ) : (
                                                <Text style={[styles.rankNum, { color: 'rgba(255,255,255,0.4)' }]}>{i + 1}</Text>
                                            )}
                                            <View style={[styles.leaderAvatar, isMe && { borderColor: roomColor }]}>
                                                <Text style={styles.leaderEmoji}>{entry.emoji}</Text>
                                            </View>
                                            <View style={styles.leaderInfo}>
                                                <Text style={[styles.leaderName, isMe && { color: roomColor }]}>
                                                    {isMe ? `${entry.display_name} (You)` : entry.display_name}
                                                </Text>
                                                <Text style={styles.leaderStat}>
                                                    {formatFocusTime(entry.total_seconds)} total focus
                                                </Text>
                                            </View>
                                            {/* Live badge if currently in this room */}
                                            {members.some(m => m.user_id === entry.user_id) && (
                                                <View style={[styles.livePill, { backgroundColor: roomColor + '20', borderColor: roomColor + '40' }]}>
                                                    <View style={[styles.liveDot, { backgroundColor: roomColor }]} />
                                                    <Text style={[styles.liveLabel, { color: roomColor }]}>Live</Text>
                                                </View>
                                            )}
                                            {i === 0 && <Text style={styles.crownEmoji}>👑</Text>}
                                        </View>
                                    );
                                })
                            )
                        )}
                    </View>

                    <View style={{ height: 40 }} />
                </Animated.View>
            </ScrollView>
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingHorizontal: 16 },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
    backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerLive: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    headerLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
    headerLiveText: { fontSize: 10, fontWeight: '800', color: '#EF4444', letterSpacing: 1 },
    headerRoom: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginTop: 2 },
    headerRight: { width: 50, alignItems: 'flex-end' },
    memberCount: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    memberCountText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },

    // Loading
    loadingBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 10 },
    loadingText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '500' },

    // Timer
    timerSection: { alignItems: 'center', paddingVertical: 16 },
    timerLabel: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginBottom: 16 },
    timerCircle: { width: 200, height: 200, borderRadius: 100, borderWidth: 3, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    timerInner: { width: 180, height: 180, borderRadius: 90, alignItems: 'center', justifyContent: 'center' },
    timerText: { fontSize: 44, fontWeight: '200', letterSpacing: 2, fontVariant: ['tabular-nums'] },
    timerSub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 2 },

    // My global rank badge
    myRankBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 7,
        borderRadius: 20, borderWidth: 1, marginBottom: 14,
    },
    myRankEmoji: { fontSize: 14 },
    myRankText: { fontSize: 13, fontWeight: '700' },

    timerControls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    controlBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 16 },
    resetBtn: { backgroundColor: 'rgba(255,255,255,0.06)' },
    resetText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
    mainBtn: { paddingHorizontal: 28, paddingVertical: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
    mainBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },

    // Empty states
    emptyMembers: { alignItems: 'center', paddingVertical: 24, gap: 6 },
    emptyMembersEmoji: { fontSize: 40, marginBottom: 4 },
    emptyMembersText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
    emptyMembersSub: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.4)' },

    // Section
    section: { marginTop: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 14, letterSpacing: -0.3 },

    // Podium
    podium: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 8 },
    podiumItem: { alignItems: 'center', width: (width - 52) / 3, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, paddingVertical: 14, gap: 6 },
    podiumFirst: { backgroundColor: 'rgba(255,215,0,0.06)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.15)' },
    podiumMedal: { fontSize: 20 },
    podiumAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    podiumEmoji: { fontSize: 20 },
    podiumName: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', maxWidth: 80, textAlign: 'center' },
    streakBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, gap: 3 },
    streakFire: { fontSize: 11 },
    streakNum: { fontSize: 12, fontWeight: '800' },

    // Tab switcher
    tabSwitcher: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 4 },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    tabText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },

    // Leaderboard rows
    leaderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 14, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', gap: 10 },
    rankNum: { width: 22, fontSize: 15, fontWeight: '800', color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
    rankMedal: { width: 22, fontSize: 18, textAlign: 'center' },
    leaderAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    leaderEmoji: { fontSize: 18 },
    leaderInfo: { flex: 1 },
    leaderName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
    leaderStat: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.4)', marginTop: 2 },
    crownEmoji: { fontSize: 18 },
    activeDot: { width: 8, height: 8, borderRadius: 4 },

    // Live pill for global leaderboard
    livePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
    liveDot: { width: 5, height: 5, borderRadius: 3 },
    liveLabel: { fontSize: 11, fontWeight: '700' },
});
