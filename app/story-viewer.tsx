import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Pressable,
    Animated,
    Dimensions,
    PanResponder,
    StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getActiveStories, StorySlide, TodoSlideItem } from '@/components/StoriesRow';

const { width } = Dimensions.get('window');
const SLIDE_DURATION = 6000;

// ─── Shared Animated Row ─────────────────────────────────────────────────────
function AnimatedRow({ children, delay }: { children: React.ReactNode; delay: number }) {
    const slideAnim = useRef(new Animated.Value(40)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(slideAnim, { toValue: 0, duration: 350, delay, useNativeDriver: true }),
            Animated.timing(fadeAnim, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
        ]).start();
    }, []);

    return (
        <Animated.View style={[rowS.row, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {children}
        </Animated.View>
    );
}
const rowS = StyleSheet.create({
    row: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14,
        paddingVertical: 14, paddingHorizontal: 16, gap: 12,
    },
});

// ─── Streak Slide ────────────────────────────────────────────────────────────
function StreakSlide({ slide }: { slide: StorySlide }) {
    const scaleAnim = useRef(new Animated.Value(0.6)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }).start();
        Animated.loop(Animated.sequence([
            Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
            Animated.timing(glowAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])).start();
    }, []);
    const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] });
    return (
        <View style={skS.c}>
            <Animated.View style={[skS.glow, { opacity: glowOpacity }]} />
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <Text style={skS.flame}>🔥</Text>
            </Animated.View>
            <Text style={skS.num}>{slide.streakDays}</Text>
            <Text style={skS.label}>Day Streak</Text>
            <View style={skS.div} />
            <View style={skS.row}>
                <View style={skS.stat}><Text style={skS.sv}>{slide.streakDays}</Text><Text style={skS.sl}>Current</Text></View>
                <View style={skS.sd} />
                <View style={skS.stat}><Text style={skS.sv}>{slide.streakBestDays}</Text><Text style={skS.sl}>Best</Text></View>
            </View>
            <Text style={skS.sub}>{slide.subtitle}</Text>
        </View>
    );
}
const skS = StyleSheet.create({
    c: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    glow: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: '#FF6B35' },
    flame: { fontSize: 96, textAlign: 'center' },
    num: { fontSize: 88, fontWeight: '900', color: '#FFF', marginTop: -8, lineHeight: 96 },
    label: { fontSize: 22, fontWeight: '700', color: 'rgba(255,255,255,0.75)', marginBottom: 24 },
    div: { width: 80, height: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 24, borderRadius: 1 },
    row: { flexDirection: 'row', marginBottom: 20 },
    stat: { alignItems: 'center', paddingHorizontal: 32 },
    sv: { fontSize: 28, fontWeight: '800', color: '#FFF' },
    sl: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginTop: 2 },
    sd: { width: 1, height: 44, backgroundColor: 'rgba(255,255,255,0.15)' },
    sub: { fontSize: 16, color: 'rgba(255,255,255,0.6)', fontWeight: '600', textAlign: 'center' },
});

// ─── Deadlines Slide ─────────────────────────────────────────────────────────
function DeadlinesSlide({ slide }: { slide: StorySlide }) {
    const items = slide.deadlines ?? [];
    return (
        <View style={dlS.c}>
            <Text style={dlS.em}>{slide.emoji}</Text>
            <Text style={dlS.tt}>{slide.title}</Text>
            <Text style={dlS.st}>{slide.subtitle}</Text>
            <View style={dlS.list}>
                {items.map((item, i) => {
                    const uc = item.done ? '#34D399' : item.dueIn === 'Today' ? '#F87171' : item.dueIn.includes('2') ? '#FBBF24' : 'rgba(255,255,255,0.5)';
                    return (
                        <AnimatedRow key={i} delay={i * 80}>
                            <View style={[dlS.ck, { borderColor: uc, backgroundColor: item.done ? uc + '30' : 'transparent' }]}>
                                {item.done && <Text style={dlS.cm}>✓</Text>}
                            </View>
                            <Text style={[dlS.il, item.done && dlS.id]}>{item.label}</Text>
                            <View style={[dlS.bg, { backgroundColor: uc + '25', borderColor: uc }]}>
                                <Text style={[dlS.bt, { color: uc }]}>{item.dueIn}</Text>
                            </View>
                        </AnimatedRow>
                    );
                })}
            </View>
        </View>
    );
}
const dlS = StyleSheet.create({
    c: { flex: 1, paddingHorizontal: 28, justifyContent: 'center' },
    em: { fontSize: 52, textAlign: 'center', marginBottom: 8 },
    tt: { fontSize: 26, fontWeight: '800', color: '#FFF', textAlign: 'center', marginBottom: 4 },
    st: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 28 },
    list: { gap: 14 },
    ck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    cm: { fontSize: 12, color: '#34D399', fontWeight: '900' },
    il: { flex: 1, fontSize: 15, fontWeight: '600', color: '#FFF' },
    id: { textDecorationLine: 'line-through', color: 'rgba(255,255,255,0.4)' },
    bg: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
    bt: { fontSize: 12, fontWeight: '700' },
});

// ─── Completed Slide ─────────────────────────────────────────────────────────
function CompletedSlide({ slide }: { slide: StorySlide }) {
    const items = slide.completedItems ?? [];
    return (
        <View style={cpS.c}>
            <Text style={cpS.em}>{slide.emoji}</Text>
            <Text style={cpS.tt}>{slide.title}</Text>
            <View style={cpS.tb}><Text style={cpS.tbt}>{slide.completedTotal} tasks done today</Text></View>
            <View style={cpS.list}>
                {items.map((item, i) => (
                    <AnimatedRow key={i} delay={i * 80}>
                        <View style={cpS.ec}><Text style={cpS.ie}>{item.emoji}</Text></View>
                        <View style={cpS.ic}><Text style={cpS.il}>{item.label}</Text><Text style={cpS.it}>{item.completedAt}</Text></View>
                        <Text style={cpS.dc}>✓</Text>
                    </AnimatedRow>
                ))}
            </View>
        </View>
    );
}
const cpS = StyleSheet.create({
    c: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
    em: { fontSize: 52, textAlign: 'center', marginBottom: 8 },
    tt: { fontSize: 26, fontWeight: '800', color: '#FFF', textAlign: 'center', marginBottom: 10 },
    tb: { alignSelf: 'center', backgroundColor: '#34D39930', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 24 },
    tbt: { fontSize: 14, color: '#34D399', fontWeight: '700' },
    list: { gap: 12 },
    ec: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    ie: { fontSize: 18 },
    ic: { flex: 1 },
    il: { fontSize: 15, fontWeight: '600', color: '#FFF' },
    it: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
    dc: { fontSize: 16, color: '#34D399', fontWeight: '800' },
});

// ─── Screen Time Slide ───────────────────────────────────────────────────────
function ScreenTimeSlide({ slide }: { slide: StorySlide }) {
    const apps = slide.topApps ?? [];
    const good = (slide.screenTimeChange ?? 0) <= 0;
    const ct = good ? `${Math.abs(slide.screenTimeChange ?? 0)}% less than yesterday` : `${slide.screenTimeChange}% more than yesterday`;
    return (
        <View style={stS.c}>
            <Text style={stS.em}>{slide.emoji}</Text>
            <Text style={stS.bt}>{slide.screenTimeHours}h {slide.screenTimeMinutes}m</Text>
            <View style={[stS.cb, { backgroundColor: good ? '#34D39925' : '#F8717125' }]}>
                <Text style={[stS.ct, { color: good ? '#34D399' : '#F87171' }]}>{good ? '↓' : '↑'} {ct}</Text>
            </View>
            <Text style={stS.at}>Top Apps</Text>
            <View style={stS.al}>
                {apps.map((app, i) => (
                    <AnimatedRow key={i} delay={i * 60}>
                        <View style={stS.ai}><Text style={stS.ait}>{i + 1}</Text></View>
                        <Text style={stS.ae}>{app.emoji}</Text>
                        <Text style={stS.an}>{app.name}</Text>
                        <Text style={stS.am}>{app.minutes}m</Text>
                    </AnimatedRow>
                ))}
            </View>
        </View>
    );
}
const stS = StyleSheet.create({
    c: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', alignItems: 'center' },
    em: { fontSize: 48, marginBottom: 8 },
    bt: { fontSize: 52, fontWeight: '900', color: '#FFF', letterSpacing: -1 },
    cb: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginTop: 8, marginBottom: 24 },
    ct: { fontSize: 13, fontWeight: '700' },
    at: { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, alignSelf: 'flex-start' },
    al: { width: '100%', gap: 10 },
    ai: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    ait: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '700' },
    ae: { fontSize: 20, marginLeft: 10 },
    an: { flex: 1, fontSize: 15, fontWeight: '600', color: '#FFF', marginLeft: 10 },
    am: { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: '700' },
});

// ─── Progress Graph Slide ────────────────────────────────────────────────────
function ProgressSlide({ slide }: { slide: StorySlide }) {
    const days = slide.progressDays ?? [];
    const anims = useRef(days.map(() => new Animated.Value(0))).current;
    const BAR = 130;
    useEffect(() => {
        Animated.stagger(60, anims.map((a, i) =>
            Animated.spring(a, { toValue: days[i].value / 100, friction: 6, useNativeDriver: false })
        )).start();
    }, []);
    return (
        <View style={pgS.c}>
            <Text style={pgS.em}>{slide.emoji}</Text>
            <Text style={pgS.tt}>{slide.title}</Text>
            {slide.progressLabel && <View style={pgS.lb}><Text style={pgS.lt}>{slide.progressLabel}</Text></View>}
            <View style={pgS.ch}>
                {days.map((d, i) => {
                    const cl = d.value > 80 ? '#F87171' : d.value > 60 ? '#FBBF24' : '#34D399';
                    return (
                        <View key={i} style={pgS.bc}>
                            <View style={[pgS.btr, { height: BAR }]}>
                                <View style={[pgS.ll, { bottom: BAR * 0.8 }]} />
                                <Animated.View style={[pgS.bf, { height: anims[i].interpolate({ inputRange: [0, 1], outputRange: [0, BAR] }), backgroundColor: cl }]} />
                            </View>
                            <Text style={pgS.dl}>{d.day}</Text>
                            <Text style={[pgS.pl, { color: cl }]}>{d.value}%</Text>
                        </View>
                    );
                })}
            </View>
            <Text style={pgS.st}>{slide.subtitle}</Text>
        </View>
    );
}
const pgS = StyleSheet.create({
    c: { flex: 1, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
    em: { fontSize: 44, marginBottom: 6 },
    tt: { fontSize: 24, fontWeight: '800', color: '#FFF', marginBottom: 8 },
    lb: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 24 },
    lt: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
    ch: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 16 },
    bc: { alignItems: 'center', width: 36 },
    btr: { width: 28, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden', justifyContent: 'flex-end', position: 'relative' },
    ll: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(255,255,255,0.25)', zIndex: 2 },
    bf: { width: '100%', borderRadius: 8 },
    dl: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6, fontWeight: '600' },
    pl: { fontSize: 10, fontWeight: '700', marginTop: 2 },
    st: { fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center', paddingHorizontal: 24 },
});

// ─── Today's Todos Slide ─────────────────────────────────────────────────────
function TodosSlide({ slide }: { slide: StorySlide }) {
    const items = slide.todoItems ?? [];
    const done = slide.todoDoneCount ?? 0;
    const total = slide.todoTotalCount ?? 0;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    // Animated progress ring
    const progressAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(progressAnim, { toValue: pct, duration: 800, useNativeDriver: false }).start();
    }, []);

    return (
        <View style={tdS.c}>
            <Text style={tdS.em}>{slide.emoji}</Text>
            <Text style={tdS.tt}>{slide.title}</Text>

            {/* Circular progress indicator */}
            <View style={tdS.progressCircle}>
                <Text style={tdS.pctText}>{pct}%</Text>
                <Text style={tdS.pctLabel}>{done}/{total}</Text>
            </View>

            <Text style={tdS.st}>{slide.subtitle}</Text>

            {/* Todo list */}
            <View style={tdS.list}>
                {items.map((item, i) => {
                    const prioColor = item.priority === 2 ? '#F87171' : item.priority === 1 ? '#FBBF24' : '#34D399';
                    return (
                        <AnimatedRow key={item.id} delay={i * 70}>
                            <View style={[tdS.ck, {
                                borderColor: item.completed ? '#34D399' : prioColor,
                                backgroundColor: item.completed ? '#34D39930' : 'transparent',
                            }]}>
                                {item.completed && <Text style={tdS.cm}>✓</Text>}
                            </View>
                            <Text style={[tdS.il, item.completed && tdS.done]} numberOfLines={1}>{item.title}</Text>
                            {!item.completed && (
                                <View style={[tdS.prioBadge, { backgroundColor: prioColor + '25' }]}>
                                    <View style={[tdS.prioDot, { backgroundColor: prioColor }]} />
                                </View>
                            )}
                        </AnimatedRow>
                    );
                })}
            </View>
        </View>
    );
}

const tdS = StyleSheet.create({
    c: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' },
    em: { fontSize: 48, marginBottom: 4 },
    tt: { fontSize: 26, fontWeight: '800', color: '#FFF', textAlign: 'center', marginBottom: 12 },
    progressCircle: {
        width: 80, height: 80, borderRadius: 40,
        borderWidth: 4, borderColor: '#8B5CF650',
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    },
    pctText: { fontSize: 22, fontWeight: '900', color: '#FFF' },
    pctLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
    st: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 20, textAlign: 'center' },
    list: { width: '100%', gap: 10 },
    ck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    cm: { fontSize: 12, color: '#34D399', fontWeight: '900' },
    il: { flex: 1, fontSize: 15, fontWeight: '600', color: '#FFF' },
    done: { textDecorationLine: 'line-through', color: 'rgba(255,255,255,0.4)' },
    prioBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    prioDot: { width: 8, height: 8, borderRadius: 4 },
});

// ─── Default Slide ───────────────────────────────────────────────────────────
function DefaultSlide({ slide }: { slide: StorySlide }) {
    return (
        <View style={dfS.c}>
            <Text style={dfS.em}>{slide.emoji}</Text>
            <Text style={dfS.tt}>{slide.title}</Text>
            <Text style={dfS.st}>{slide.subtitle}</Text>
        </View>
    );
}
const dfS = StyleSheet.create({
    c: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    em: { fontSize: 80, marginBottom: 24 },
    tt: { fontSize: 26, fontWeight: '800', color: '#FFF', textAlign: 'center', marginBottom: 12, letterSpacing: -0.5 },
    st: { fontSize: 17, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 24, fontWeight: '500' },
});

// ─── Story Viewer ────────────────────────────────────────────────────────────
export default function StoryViewerScreen() {
    const router = useRouter();
    const { storyIndex } = useLocalSearchParams<{ storyIndex: string }>();
    const STORIES = getActiveStories();

    const [currentStoryIdx, setCurrentStoryIdx] = useState(parseInt(storyIndex || '0', 10));
    const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    const progressAnim = useRef(new Animated.Value(0)).current;
    const progressAnimation = useRef<Animated.CompositeAnimation | null>(null);
    const translateY = useRef(new Animated.Value(0)).current;
    const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pausedProgress = useRef(0);
    const isHolding = useRef(false);

    const story = STORIES[currentStoryIdx];
    const slide = story?.slides[currentSlideIdx];

    const startProgress = useCallback((fromValue = 0) => {
        progressAnim.setValue(fromValue);
        progressAnimation.current?.stop();
        const remaining = SLIDE_DURATION * (1 - fromValue);
        progressAnimation.current = Animated.timing(progressAnim, {
            toValue: 1, duration: remaining, useNativeDriver: false,
        });
        progressAnimation.current.start(({ finished }) => { if (finished) goNext(); });
    }, [currentStoryIdx, currentSlideIdx]);

    useEffect(() => {
        startProgress(0);
        return () => { progressAnimation.current?.stop(); };
    }, [currentStoryIdx, currentSlideIdx]);

    const pauseProgress = useCallback(() => {
        progressAnimation.current?.stop();
        // Read current value via listener
        const listenerId = progressAnim.addListener(({ value }) => {
            pausedProgress.current = value;
            progressAnim.removeListener(listenerId);
        });
        setIsPaused(true);
    }, [progressAnim]);

    const resumeProgress = useCallback(() => {
        setIsPaused(false);
        startProgress(pausedProgress.current);
    }, [startProgress]);

    const goNext = () => {
        const s = STORIES[currentStoryIdx];
        if (currentSlideIdx < s.slides.length - 1) setCurrentSlideIdx((p) => p + 1);
        else if (currentStoryIdx < STORIES.length - 1) { setCurrentStoryIdx((p) => p + 1); setCurrentSlideIdx(0); }
        else router.back();
    };

    const goPrev = () => {
        if (currentSlideIdx > 0) setCurrentSlideIdx((p) => p - 1);
        else if (currentStoryIdx > 0) {
            const prev = STORIES[currentStoryIdx - 1];
            setCurrentStoryIdx((p) => p - 1);
            setCurrentSlideIdx(prev.slides.length - 1);
        } else startProgress(0);
    };

    const handleClose = () => router.back();

    // Track press position for tap direction
    const pressX = useRef(0);

    const handlePressIn = (evt: any) => {
        pressX.current = evt.nativeEvent.locationX;
    };

    const handleLongPress = () => {
        isHolding.current = true;
        pauseProgress();
    };

    const handlePressOut = () => {
        if (isHolding.current) {
            // Was a long press — resume
            isHolding.current = false;
            resumeProgress();
        }
    };

    const handlePress = () => {
        // Only fires on short tap (not long press)
        if (!isHolding.current) {
            if (pressX.current < width / 3) goPrev(); else goNext();
        }
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 20 && Math.abs(gs.dy) > Math.abs(gs.dx),
            onPanResponderMove: (_, gs) => { if (gs.dy > 0) translateY.setValue(gs.dy); },
            onPanResponderRelease: (_, gs) => {
                if (gs.dy > 100) handleClose();
                else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
            },
        })
    ).current;

    if (!story || !slide) return null;

    const renderSlide = () => {
        switch (slide.type) {
            case 'streak': return <StreakSlide slide={slide} />;
            case 'deadlines': return <DeadlinesSlide slide={slide} />;
            case 'completed': return <CompletedSlide slide={slide} />;
            case 'progress': return <ProgressSlide slide={slide} />;
            case 'screentime': return <ScreenTimeSlide slide={slide} />;
            case 'todos': return <TodosSlide slide={slide} />;
            default: return <DefaultSlide slide={slide} />;
        }
    };

    return (
        <Animated.View
            style={[styles.container, { backgroundColor: slide.backgroundColor, transform: [{ translateY }] }]}
            {...panResponder.panHandlers}
        >
            <StatusBar barStyle="light-content" />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.progressContainer}>
                    {story.slides.map((_, idx) => (
                        <View key={idx} style={styles.progressBarBg}>
                            <Animated.View style={[styles.progressBarFill, {
                                width: idx < currentSlideIdx ? '100%'
                                    : idx === currentSlideIdx
                                        ? progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                                        : '0%',
                            }]} />
                        </View>
                    ))}
                </View>

                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <View style={[styles.headerAvatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                            <Text style={styles.headerEmoji}>{story.emoji}</Text>
                        </View>
                        <Text style={styles.headerName}>{story.name}</Text>
                        <Text style={styles.headerTime}>{currentSlideIdx + 1}/{story.slides.length}</Text>
                    </View>
                    <TouchableOpacity onPress={handleClose} style={styles.closeButton} activeOpacity={0.7}>
                        <Text style={styles.closeIcon}>✕</Text>
                    </TouchableOpacity>
                </View>

                <Pressable
                    style={{ flex: 1 }}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    onLongPress={handleLongPress}
                    onPress={handlePress}
                    delayLongPress={200}
                >
                    {renderSlide()}
                </Pressable>

                <View style={styles.bottomBar}>
                    <View style={styles.dots}>
                        {STORIES.map((_, idx) => (
                            <View key={idx} style={[styles.dot, idx === currentStoryIdx && styles.dotActive]} />
                        ))}
                    </View>
                    <Text style={styles.swipeHint}>Tap sides to navigate • Swipe down to close</Text>
                </View>
            </SafeAreaView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    progressContainer: { flexDirection: 'row', paddingHorizontal: 8, paddingTop: 8, gap: 4 },
    progressBarBg: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: '#FFF', borderRadius: 2 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    headerEmoji: { fontSize: 18 },
    headerName: { fontSize: 15, fontWeight: '700', color: '#FFF' },
    headerTime: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
    closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
    closeIcon: { fontSize: 18, color: '#FFF', fontWeight: '700' },
    bottomBar: { alignItems: 'center', paddingBottom: 16, gap: 10 },
    dots: { flexDirection: 'row', gap: 6 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
    dotActive: { backgroundColor: '#FFF', width: 18, borderRadius: 3 },
    swipeHint: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
});
