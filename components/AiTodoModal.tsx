import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Animated,
    Dimensions,
    Platform,
    ScrollView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Audio } from 'expo-av';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing } from '@/constants/theme';
import { processVoiceToTodo, ExtractedTodo } from '@/lib/ai-todo';
import { useTodos } from '@/hooks/todo-context';

const { width, height } = Dimensions.get('window');

// ── Constants ──────────────────────────────────────────────────────────────────
const PRIORITY_CONFIG = [
    { label: 'Low', emoji: '🟢', color: '#10B981' },
    { label: 'Medium', emoji: '🟡', color: '#F59E0B' },
    { label: 'High', emoji: '🔴', color: '#EF4444' },
];

const CATEGORY_CONFIG = [
    { label: 'Personal', emoji: '🏠', color: '#6C63FF' },
    { label: 'Work', emoji: '💼', color: '#3B82F6' },
    { label: 'Health', emoji: '💪', color: '#10B981' },
    { label: 'Study', emoji: '📚', color: '#F59E0B' },
    { label: 'Social', emoji: '🎉', color: '#EC4899' },
    { label: 'Other', emoji: '✨', color: '#8B5CF6' },
];

type ScreenState = 'idle' | 'recording' | 'processing' | 'review';

interface AiTodoModalProps {
    visible: boolean;
    onClose: () => void;
}

// ── Review Screen ──────────────────────────────────────────────────────────────

interface ReviewCardProps {
    extracted: ExtractedTodo;
    onChange: (updated: ExtractedTodo) => void;
    theme: typeof Colors.dark;
    accentColor: string;
}

function ReviewCard({ extracted, onChange, theme, accentColor }: ReviewCardProps) {
    const priorityCfg = PRIORITY_CONFIG[extracted.priority];
    const categoryCfg = CATEGORY_CONFIG[extracted.category];

    const formatDate = (d?: Date) => {
        if (!d) return null;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
        const isSameDay = (a: Date, b: Date) =>
            a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
        if (isSameDay(d, today)) return 'Today';
        if (isSameDay(d, tomorrow)) return 'Tomorrow';
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    return (
        <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={review.scrollContent}
            keyboardShouldPersistTaps="handled"
        >
            {/* Title */}
            <View style={[review.block, { borderColor: theme.cardBorder, backgroundColor: theme.background }]}>
                <Text style={[review.blockLabel, { color: theme.textSecondary }]}>✏️ Task Title</Text>
                <Text style={[review.blockValue, { color: theme.text }]}>{extracted.title}</Text>
            </View>

            {/* Transcript (note) */}
            <View style={[review.block, { borderColor: theme.cardBorder, backgroundColor: theme.background }]}>
                <Text style={[review.blockLabel, { color: theme.textSecondary }]}>🎤 Transcript</Text>
                <Text style={[review.blockValue, review.noteValue, { color: theme.textSecondary }]} numberOfLines={3}>
                    {extracted.note}
                </Text>
            </View>

            {/* Priority row */}
            <Text style={[review.sectionLabel, { color: theme.textSecondary }]}>🎯 Priority</Text>
            <View style={review.chipRow}>
                {PRIORITY_CONFIG.map((opt, idx) => (
                    <TouchableOpacity
                        key={opt.label}
                        style={[
                            review.chip,
                            {
                                backgroundColor: extracted.priority === idx ? opt.color + '20' : theme.background,
                                borderColor: extracted.priority === idx ? opt.color : theme.cardBorder,
                            },
                        ]}
                        onPress={() => onChange({ ...extracted, priority: idx })}
                        activeOpacity={0.7}
                    >
                        <Text style={review.chipEmoji}>{opt.emoji}</Text>
                        <Text style={[review.chipLabel, { color: extracted.priority === idx ? opt.color : theme.textSecondary, fontWeight: extracted.priority === idx ? '700' : '500' }]}>
                            {opt.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Category grid */}
            <Text style={[review.sectionLabel, { color: theme.textSecondary }]}>📁 Category</Text>
            <View style={review.categoryGrid}>
                {CATEGORY_CONFIG.map((cat, idx) => (
                    <TouchableOpacity
                        key={cat.label}
                        style={[
                            review.categoryChip,
                            {
                                backgroundColor: extracted.category === idx ? cat.color + '15' : theme.background,
                                borderColor: extracted.category === idx ? cat.color : theme.cardBorder,
                            },
                        ]}
                        onPress={() => onChange({ ...extracted, category: idx })}
                        activeOpacity={0.7}
                    >
                        <Text style={review.categoryEmoji}>{cat.emoji}</Text>
                        <Text style={[review.categoryLabel, { color: extracted.category === idx ? cat.color : theme.textSecondary, fontWeight: extracted.category === idx ? '700' : '500' }]}>
                            {cat.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Due date badge (if detected) */}
            {extracted.dueDate && (
                <View style={[review.dueBadge, { backgroundColor: accentColor + '15', borderColor: accentColor + '40' }]}>
                    <Text style={review.dueEmoji}>🗓️</Text>
                    <Text style={[review.dueText, { color: accentColor }]}>
                        Due: {formatDate(extracted.dueDate)}
                    </Text>
                    <TouchableOpacity
                        onPress={() => onChange({ ...extracted, dueDate: undefined })}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <MaterialIcons name="close" size={14} color={accentColor} />
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

export default function AiTodoModal({ visible, onClose }: AiTodoModalProps) {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const { addTodo } = useTodos();

    const [screen, setScreen] = useState<ScreenState>('idle');
    const [seconds, setSeconds] = useState(0);
    const [processLabel, setProcessLabel] = useState('Transcribing your voice...');
    const [extracted, setExtracted] = useState<ExtractedTodo | null>(null);
    const [saving, setSaving] = useState(false);
    const recordingRef = useRef<Audio.Recording | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Animations ─────────────────────────────────────────────────────────────
    const backdropAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(height)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const headerFade = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const ringAnim1 = useRef(new Animated.Value(0)).current;
    const ringAnim2 = useRef(new Animated.Value(0)).current;
    const ringAnim3 = useRef(new Animated.Value(0)).current;
    const waveAnims = useRef(
        Array.from({ length: 20 }, () => new Animated.Value(0.3))
    ).current;
    const aiDotAnims = useRef(
        Array.from({ length: 3 }, () => new Animated.Value(0))
    ).current;

    // ── Open animation ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (visible) {
            setScreen('idle');
            setSeconds(0);
            setExtracted(null);
            setSaving(false);
            backdropAnim.setValue(0);
            slideAnim.setValue(height * 0.35);
            scaleAnim.setValue(0.9);
            headerFade.setValue(0);

            Animated.parallel([
                Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
                Animated.spring(scaleAnim, { toValue: 1, tension: 65, friction: 11, useNativeDriver: true }),
            ]).start(() => {
                Animated.timing(headerFade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
            });
        }
    }, [visible]);

    // ── Timer ──────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (screen === 'recording') {
            timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [screen]);

    // ── Ripple / wave animations ───────────────────────────────────────────────
    useEffect(() => {
        if (screen !== 'recording') {
            pulseAnim.setValue(1);
            ringAnim1.setValue(0);
            ringAnim2.setValue(0);
            ringAnim3.setValue(0);
            waveAnims.forEach((a) => a.setValue(0.3));
            return;
        }

        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
            ])
        );
        const makeRipple = (anim: Animated.Value, delay: number) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(anim, { toValue: 1, duration: 1400, useNativeDriver: true }),
                    Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
                ])
            );
        const r1 = makeRipple(ringAnim1, 0);
        const r2 = makeRipple(ringAnim2, 450);
        const r3 = makeRipple(ringAnim3, 900);
        const waves = waveAnims.map((anim, i) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(i * 50),
                    Animated.timing(anim, { toValue: 0.2 + Math.random() * 0.8, duration: 180 + Math.random() * 180, useNativeDriver: true }),
                    Animated.timing(anim, { toValue: 0.1 + Math.random() * 0.3, duration: 180 + Math.random() * 180, useNativeDriver: true }),
                ])
            )
        );

        pulse.start(); r1.start(); r2.start(); r3.start();
        waves.forEach((w) => w.start());

        return () => {
            pulse.stop(); r1.stop(); r2.stop(); r3.stop();
            waves.forEach((w) => w.stop());
        };
    }, [screen]);

    // ── AI processing dot animation ────────────────────────────────────────────
    useEffect(() => {
        if (screen !== 'processing') {
            aiDotAnims.forEach((a) => a.setValue(0));
            return;
        }
        const loop = Animated.loop(
            Animated.stagger(200,
                aiDotAnims.map((a) =>
                    Animated.sequence([
                        Animated.timing(a, { toValue: 1, duration: 400, useNativeDriver: true }),
                        Animated.timing(a, { toValue: 0, duration: 400, useNativeDriver: true }),
                    ])
                )
            )
        );
        loop.start();
        return () => loop.stop();
    }, [screen]);

    // ── Close handler ──────────────────────────────────────────────────────────
    const handleClose = async () => {
        if (screen === 'recording' && recordingRef.current) {
            try { await recordingRef.current.stopAndUnloadAsync(); } catch (_) { /* ignore */ }
            recordingRef.current = null;
        }
        Animated.parallel([
            Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: height * 0.35, duration: 220, useNativeDriver: true }),
        ]).start(() => {
            setScreen('idle');
            setSeconds(0);
            setExtracted(null);
            onClose();
        });
    };

    // ── Start recording ────────────────────────────────────────────────────────
    const startRecording = async () => {
        try {
            const { granted } = await Audio.requestPermissionsAsync();
            if (!granted) {
                Alert.alert('Permission Required', 'Please allow microphone access in settings to use voice recording.');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const rec = new Audio.Recording();
            await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            await rec.startAsync();
            recordingRef.current = rec;
            setSeconds(0);
            setScreen('recording');
        } catch (err: any) {
            Alert.alert('Recording Error', err?.message ?? 'Could not start recording.');
        }
    };

    // ── Stop and process ───────────────────────────────────────────────────────
    const stopAndProcess = async () => {
        if (!recordingRef.current) return;

        try {
            setScreen('processing');
            setProcessLabel('Stopping recording...');
            await recordingRef.current.stopAndUnloadAsync();
            const uri = recordingRef.current.getURI();
            recordingRef.current = null;

            if (!uri) throw new Error('No audio captured. Please try again.');

            setProcessLabel('Uploading audio...');
            await new Promise((r) => setTimeout(r, 600)); // small UX delay

            setProcessLabel('Transcribing your voice...');
            const result = await processVoiceToTodo(uri);

            setExtracted(result);
            setScreen('review');
        } catch (err: any) {
            Alert.alert('AI Processing Failed', err?.message ?? 'Something went wrong. Please try again.');
            setScreen('idle');
            setSeconds(0);
        }
    };

    // ── Save todo ──────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!extracted) return;
        setSaving(true);
        try {
            await addTodo({
                title: extracted.title,
                note: extracted.note,
                priority: extracted.priority,
                category: extracted.category,
                dueDate: extracted.dueDate,
            });
            handleClose();
        } catch (err: any) {
            Alert.alert('Save Error', err?.message ?? 'Could not save todo.');
        } finally {
            setSaving(false);
        }
    };

    const formatTime = (s: number) => {
        const min = Math.floor(s / 60).toString().padStart(2, '0');
        const sec = (s % 60).toString().padStart(2, '0');
        return `${min}:${sec}`;
    };

    const renderRipple = (anim: Animated.Value) => (
        <Animated.View
            style={[
                styles.rippleRing,
                {
                    borderColor: theme.accent,
                    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
                },
            ]}
        />
    );

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={handleClose}>
            {/* Backdrop */}
            <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} activeOpacity={1} />
            </Animated.View>

            <Animated.View
                style={[
                    styles.modalContainer,
                    screen === 'review' && styles.modalTall,
                    {
                        backgroundColor: theme.surface,
                        borderColor: theme.cardBorder,
                        transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
                    },
                ]}
            >
                {/* Drag Handle */}
                <View style={styles.dragHandleWrapper}>
                    <View style={[styles.dragHandle, { backgroundColor: theme.cardBorder }]} />
                </View>

                {/* ── IDLE / RECORDING SCREEN ── */}
                {(screen === 'idle' || screen === 'recording') && (
                    <>
                        {/* Header */}
                        <Animated.View style={[styles.headerSection, { opacity: headerFade }]}>
                            <Text style={styles.headerEmoji}>🤖</Text>
                            <Text style={[styles.headerTitle, { color: theme.text }]}>AI Todo Maker</Text>
                            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                                {screen === 'idle'
                                    ? 'Record your voice — AI will organize it.'
                                    : 'Listening... Tap stop when done.'}
                            </Text>
                        </Animated.View>

                        {/* Waveform */}
                        <View style={styles.visualizerContainer}>
                            {screen === 'recording' ? (
                                <View style={styles.waveContainer}>
                                    {waveAnims.map((anim, i) => (
                                        <Animated.View
                                            key={i}
                                            style={[
                                                styles.waveBar,
                                                { backgroundColor: theme.accent, transform: [{ scaleY: anim }] },
                                            ]}
                                        />
                                    ))}
                                </View>
                            ) : (
                                <View style={styles.idleViz}>
                                    <Text style={[styles.idleHint, { color: theme.textSecondary }]}>
                                        e.g. "Buy groceries tomorrow, high priority"
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Timer */}
                        {screen === 'recording' && (
                            <Text style={[styles.timer, { color: theme.accent }]}>{formatTime(seconds)}</Text>
                        )}

                        {/* Record button */}
                        <View style={styles.recordArea}>
                            <View style={styles.recordButtonOuter}>
                                {screen === 'recording' && renderRipple(ringAnim1)}
                                {screen === 'recording' && renderRipple(ringAnim2)}
                                {screen === 'recording' && renderRipple(ringAnim3)}
                                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                                    <TouchableOpacity
                                        style={[
                                            styles.recordButton,
                                            { backgroundColor: screen === 'recording' ? '#EF4444' : theme.accent },
                                        ]}
                                        onPress={screen === 'recording' ? stopAndProcess : startRecording}
                                        activeOpacity={0.8}
                                    >
                                        {screen === 'recording' ? (
                                            <View style={styles.stopIcon} />
                                        ) : (
                                            <MaterialIcons name="mic" size={32} color="#FFFFFF" />
                                        )}
                                    </TouchableOpacity>
                                </Animated.View>
                            </View>
                            <Text style={[styles.recordHint, { color: theme.textSecondary }]}>
                                {screen === 'recording' ? 'Tap to stop' : 'Tap to record'}
                            </Text>
                        </View>
                    </>
                )}

                {/* ── PROCESSING SCREEN ── */}
                {screen === 'processing' && (
                    <View style={styles.processingScreen}>
                        <View style={[styles.processingOrb, { backgroundColor: theme.accent + '20' }]}>
                            <ActivityIndicator size="large" color={theme.accent} />
                        </View>
                        <Text style={[styles.processingTitle, { color: theme.text }]}>AI is working...</Text>
                        <Text style={[styles.processingLabel, { color: theme.textSecondary }]}>{processLabel}</Text>
                        {/* Bouncing dots */}
                        <View style={styles.dotsRow}>
                            {aiDotAnims.map((anim, i) => (
                                <Animated.View
                                    key={i}
                                    style={[styles.dot, { backgroundColor: theme.accent, opacity: anim }]}
                                />
                            ))}
                        </View>
                    </View>
                )}

                {/* ── REVIEW SCREEN ── */}
                {screen === 'review' && extracted && (
                    <>
                        <View style={styles.reviewHeader}>
                            <View style={styles.reviewHeaderLeft}>
                                <Text style={styles.reviewEmoji}>✨</Text>
                                <View>
                                    <Text style={[styles.reviewTitle, { color: theme.text }]}>AI Extracted</Text>
                                    <Text style={[styles.reviewSubtitle, { color: theme.textSecondary }]}>
                                        Review &amp; edit before saving
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={() => { setScreen('idle'); setSeconds(0); }}
                                style={[styles.reRecordBtn, { borderColor: theme.cardBorder }]}
                                activeOpacity={0.7}
                            >
                                <MaterialIcons name="refresh" size={16} color={theme.textSecondary} />
                                <Text style={[styles.reRecordLabel, { color: theme.textSecondary }]}>Re-record</Text>
                            </TouchableOpacity>
                        </View>

                        <ReviewCard
                            extracted={extracted}
                            onChange={setExtracted}
                            theme={theme}
                            accentColor={theme.accent}
                        />

                        {/* Save button */}
                        <View style={styles.saveWrapper}>
                            <TouchableOpacity
                                style={[styles.saveButton, { backgroundColor: theme.accent, opacity: saving ? 0.7 : 1 }]}
                                onPress={handleSave}
                                activeOpacity={0.85}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#FFF" size="small" />
                                ) : (
                                    <>
                                        <Text style={styles.saveEmoji}>🚀</Text>
                                        <Text style={styles.saveButtonText}>Add Task</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </Animated.View>
        </Modal>
    );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    modalContainer: {
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderBottomWidth: 0,
        paddingBottom: Platform.OS === 'ios' ? 40 : 28,
        minHeight: height * 0.52,
    },
    modalTall: {
        maxHeight: height * 0.92,
    },
    dragHandleWrapper: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 4,
    },
    dragHandle: {
        width: 40, height: 4, borderRadius: 2,
    },
    // Header (idle/recording)
    headerSection: {
        alignItems: 'center',
        paddingTop: 8,
        paddingBottom: 10,
    },
    headerEmoji: { fontSize: 44, marginBottom: 8 },
    headerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
    headerSubtitle: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
    // Visualizer
    visualizerContainer: {
        height: 90,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 24,
    },
    waveContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        height: 60,
    },
    waveBar: { width: 4, height: 50, borderRadius: 2 },
    idleViz: {
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    idleHint: { fontSize: 13, fontWeight: '500', fontStyle: 'italic', textAlign: 'center' },
    timer: {
        textAlign: 'center',
        fontSize: 30,
        fontWeight: '200',
        letterSpacing: 3,
        marginBottom: 4,
        fontVariant: ['tabular-nums'],
    },
    // Record button
    recordArea: { alignItems: 'center', paddingVertical: 14 },
    recordButtonOuter: {
        width: 90, height: 90,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rippleRing: {
        position: 'absolute',
        width: 90, height: 90,
        borderRadius: 45,
        borderWidth: 2,
    },
    recordButton: {
        width: 74, height: 74, borderRadius: 37,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
    },
    stopIcon: { width: 24, height: 24, borderRadius: 4, backgroundColor: '#FFFFFF' },
    recordHint: { fontSize: 12, fontWeight: '600', marginTop: 10 },
    // Processing screen
    processingScreen: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 24,
        gap: 12,
    },
    processingOrb: {
        width: 84, height: 84, borderRadius: 42,
        alignItems: 'center', justifyContent: 'center',
    },
    processingTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
    processingLabel: { fontSize: 13, fontWeight: '500' },
    dotsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    // Review screen
    reviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 12,
    },
    reviewHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    reviewEmoji: { fontSize: 36 },
    reviewTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
    reviewSubtitle: { fontSize: 12, fontWeight: '500' },
    reRecordBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    reRecordLabel: { fontSize: 12, fontWeight: '600' },
    // Save button
    saveWrapper: { paddingHorizontal: 20, paddingTop: 8 },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        gap: 8,
    },
    saveEmoji: { fontSize: 18 },
    saveButtonText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
});

// ── Review Card Styles ─────────────────────────────────────────────────────────

const review = StyleSheet.create({
    scrollContent: { paddingHorizontal: 20, paddingBottom: 4 },
    block: {
        borderRadius: 12, borderWidth: 1.5,
        padding: 14, marginBottom: 12,
    },
    blockLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
    blockValue: { fontSize: 15, fontWeight: '700', lineHeight: 22 },
    noteValue: { fontSize: 13, fontWeight: '400', fontStyle: 'italic' },
    sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
    chipRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    chip: {
        flex: 1, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'center', paddingVertical: 11,
        borderRadius: 12, borderWidth: 1.5, gap: 5,
    },
    chipEmoji: { fontSize: 14 },
    chipLabel: { fontSize: 12 },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    categoryChip: {
        width: (width - 40 - 16) / 3,
        alignItems: 'center', paddingVertical: 12,
        borderRadius: 12, borderWidth: 1.5, gap: 4,
    },
    categoryEmoji: { fontSize: 20 },
    categoryLabel: { fontSize: 11 },
    dueBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 10, borderWidth: 1, marginBottom: 14,
    },
    dueEmoji: { fontSize: 14 },
    dueText: { flex: 1, fontSize: 13, fontWeight: '700' },
});
