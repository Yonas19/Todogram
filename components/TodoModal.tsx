import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    Animated,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const { width, height } = Dimensions.get('window');

const PRIORITY_OPTIONS = [
    { label: 'Low', emoji: '🟢', color: '#10B981' },
    { label: 'Medium', emoji: '🟡', color: '#F59E0B' },
    { label: 'High', emoji: '🔴', color: '#EF4444' },
];

const CATEGORY_OPTIONS = [
    { label: 'Personal', emoji: '🏠', color: '#6C63FF' },
    { label: 'Work', emoji: '💼', color: '#3B82F6' },
    { label: 'Health', emoji: '💪', color: '#10B981' },
    { label: 'Study', emoji: '📚', color: '#F59E0B' },
    { label: 'Social', emoji: '🎉', color: '#EC4899' },
    { label: 'Other', emoji: '✨', color: '#8B5CF6' },
];

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

// ── Inline Calendar ───────────────────────────────────────────────────────────

function InlineCalendar({
    selected,
    onChange,
    theme,
    accentColor,
}: {
    selected: Date | null;
    onChange: (d: Date | null) => void;
    theme: typeof Colors.dark;
    accentColor: string;
}) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());

    const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const prevMonth = () => {
        if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
        else setViewMonth(m => m + 1);
    };

    const isSelected = (day: number) => {
        if (!selected) return false;
        return (
            selected.getFullYear() === viewYear &&
            selected.getMonth() === viewMonth &&
            selected.getDate() === day
        );
    };
    const isToday = (day: number) => (
        today.getFullYear() === viewYear &&
        today.getMonth() === viewMonth &&
        today.getDate() === day
    );
    const isPast = (day: number) => {
        const d = new Date(viewYear, viewMonth, day);
        return d < today;
    };

    const cells: (number | null)[] = [
        ...Array(firstDay).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    // Pad to full rows
    while (cells.length % 7 !== 0) cells.push(null);

    return (
        <View style={[cal.wrapper, { backgroundColor: theme.background, borderColor: theme.cardBorder }]}>
            {/* Month nav */}
            <View style={cal.nav}>
                <TouchableOpacity onPress={prevMonth} style={cal.navBtn} activeOpacity={0.7}>
                    <MaterialIcons name="chevron-left" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
                <Text style={[cal.monthLabel, { color: theme.text }]}>
                    {MONTHS[viewMonth]} {viewYear}
                </Text>
                <TouchableOpacity onPress={nextMonth} style={cal.navBtn} activeOpacity={0.7}>
                    <MaterialIcons name="chevron-right" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Day headers */}
            <View style={cal.row}>
                {DAYS.map(d => (
                    <Text key={d} style={[cal.dayHeader, { color: theme.textSecondary }]}>{d}</Text>
                ))}
            </View>

            {/* Grid */}
            {Array.from({ length: cells.length / 7 }, (_, row) => (
                <View key={row} style={cal.row}>
                    {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                        if (!day) return <View key={col} style={cal.cell} />;
                        const past = isPast(day);
                        const sel = isSelected(day);
                        const tod = isToday(day);
                        return (
                            <TouchableOpacity
                                key={col}
                                style={[
                                    cal.cell,
                                    sel && { backgroundColor: accentColor, borderRadius: 10 },
                                    !sel && tod && { borderRadius: 10, borderWidth: 1.5, borderColor: accentColor },
                                ]}
                                activeOpacity={past ? 1 : 0.7}
                                onPress={() => {
                                    if (past) return;
                                    const d = new Date(viewYear, viewMonth, day);
                                    onChange(sel ? null : d); // tap again to deselect
                                }}
                                disabled={past}
                            >
                                <Text style={[
                                    cal.dayNum,
                                    { color: sel ? '#FFFFFF' : past ? theme.textSecondary + '50' : theme.text },
                                    tod && !sel && { color: accentColor, fontWeight: '800' },
                                ]}>
                                    {day}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            ))}
        </View>
    );
}

// ── Due Date Picker Section ───────────────────────────────────────────────────

function DueDatePicker({
    value,
    onChange,
    theme,
    accentColor,
}: {
    value: Date | null;
    onChange: (d: Date | null) => void;
    theme: typeof Colors.dark;
    accentColor: string;
}) {
    const [showCalendar, setShowCalendar] = useState(false);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);

    const isSameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();

    const quick = [
        { label: 'Today', emoji: '☀️', date: today },
        { label: 'Tomorrow', emoji: '🌅', date: tomorrow },
        { label: 'Next Week', emoji: '📅', date: nextWeek },
    ];

    const formatDate = (d: Date) => {
        if (isSameDay(d, today)) return 'Today';
        if (isSameDay(d, tomorrow)) return 'Tomorrow';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>📅 Due Date (optional)</Text>

            {/* Quick picks */}
            <View style={due.quickRow}>
                {quick.map((q) => {
                    const active = value && isSameDay(value, q.date);
                    return (
                        <TouchableOpacity
                            key={q.label}
                            style={[
                                due.quickChip,
                                {
                                    backgroundColor: active ? accentColor + '20' : theme.background,
                                    borderColor: active ? accentColor : theme.cardBorder,
                                },
                            ]}
                            onPress={() => onChange(active ? null : q.date)}
                            activeOpacity={0.7}
                        >
                            <Text style={due.quickEmoji}>{q.emoji}</Text>
                            <Text style={[due.quickLabel, { color: active ? accentColor : theme.textSecondary, fontWeight: active ? '700' : '500' }]}>
                                {q.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Calendar toggle */}
            <TouchableOpacity
                style={[due.calToggle, { backgroundColor: theme.background, borderColor: showCalendar ? accentColor : theme.cardBorder }]}
                onPress={() => setShowCalendar(s => !s)}
                activeOpacity={0.7}
            >
                <MaterialIcons name="calendar-month" size={18} color={showCalendar ? accentColor : theme.textSecondary} />
                <Text style={[due.calToggleText, { color: showCalendar ? accentColor : theme.textSecondary }]}>
                    {showCalendar ? 'Hide calendar' : 'Pick from calendar'}
                </Text>
                <MaterialIcons
                    name={showCalendar ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                    size={18}
                    color={showCalendar ? accentColor : theme.textSecondary}
                />
            </TouchableOpacity>

            {/* Inline calendar */}
            {showCalendar && (
                <InlineCalendar
                    selected={value}
                    onChange={(d) => { onChange(d); if (d) setShowCalendar(false); }}
                    theme={theme}
                    accentColor={accentColor}
                />
            )}

            {/* Selected date display */}
            {value && (
                <View style={[due.selectedBadge, { backgroundColor: accentColor + '15', borderColor: accentColor + '40' }]}>
                    <Text style={due.selectedEmoji}>🗓️</Text>
                    <Text style={[due.selectedText, { color: accentColor }]}>Due: {formatDate(value)}</Text>
                    <TouchableOpacity onPress={() => onChange(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <MaterialIcons name="close" size={14} color={accentColor} />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

interface TodoModalProps {
    visible: boolean;
    onClose: () => void;
    onAdd?: (todo: {
        title: string;
        note: string;
        priority: number;
        category: number;
        dueDate?: Date;
    }) => void;
}

export default function TodoModal({ visible, onClose, onAdd }: TodoModalProps) {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const ACCENT = theme.accent;

    const [title, setTitle] = useState('');
    const [note, setNote] = useState('');
    const [selectedPriority, setSelectedPriority] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState(0);
    const [dueDate, setDueDate] = useState<Date | null>(null);

    // Animations
    const backdropAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(height)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const headerAnim = useRef(new Animated.Value(0)).current;
    const formItemAnims = useRef(Array.from({ length: 5 }, () => new Animated.Value(0))).current;
    const buttonAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            backdropAnim.setValue(0);
            slideAnim.setValue(height * 0.3);
            scaleAnim.setValue(0.9);
            headerAnim.setValue(0);
            formItemAnims.forEach((a) => a.setValue(0));
            buttonAnim.setValue(0);

            Animated.parallel([
                Animated.timing(backdropAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
                Animated.spring(scaleAnim, { toValue: 1, tension: 65, friction: 11, useNativeDriver: true }),
            ]).start(() => {
                Animated.timing(headerAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
                Animated.stagger(80, formItemAnims.map((anim) =>
                    Animated.spring(anim, { toValue: 1, tension: 80, friction: 12, useNativeDriver: true })
                )).start(() => {
                    Animated.spring(buttonAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }).start();
                });
            });
        }
    }, [visible]);

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: height * 0.3, duration: 250, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 0.9, duration: 250, useNativeDriver: true }),
        ]).start(() => {
            setTitle(''); setNote(''); setSelectedPriority(0); setSelectedCategory(0); setDueDate(null);
            onClose();
        });
    };

    const handleAdd = () => {
        if (onAdd && title.trim()) {
            onAdd({
                title: title.trim(),
                note: note.trim(),
                priority: selectedPriority,
                category: selectedCategory,
                dueDate: dueDate ?? undefined,
            });
        }
        handleClose();
    };

    const renderFormItem = (index: number, child: React.ReactNode) => {
        const anim = formItemAnims[index];
        return (
            <Animated.View key={index} style={{
                opacity: anim,
                transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
            }}>
                {child}
            </Animated.View>
        );
    };

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={handleClose}>
            <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} activeOpacity={1} />
            </Animated.View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
                <Animated.View style={[
                    styles.modalContainer,
                    {
                        backgroundColor: theme.surface,
                        borderColor: theme.cardBorder,
                        transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
                    },
                ]}>
                    {/* Drag Handle */}
                    <View style={styles.dragHandleWrapper}>
                        <View style={[styles.dragHandle, { backgroundColor: theme.cardBorder }]} />
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Header */}
                        <Animated.View style={[styles.headerSection, { opacity: headerAnim }]}>
                            <Text style={styles.headerEmoji}>📝</Text>
                            <Text style={[styles.headerTitle, { color: theme.text }]}>New Task</Text>
                            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                                What do you want to accomplish?
                            </Text>
                        </Animated.View>

                        {/* Title */}
                        {renderFormItem(0,
                            <View style={styles.inputGroup}>
                                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>✏️ Task Title</Text>
                                <View style={[styles.inputWrapper, { backgroundColor: theme.background, borderColor: title ? ACCENT : theme.cardBorder }]}>
                                    <TextInput
                                        style={[styles.textInput, { color: theme.text }]}
                                        placeholder="e.g. Review screen time report"
                                        placeholderTextColor={theme.textSecondary + '80'}
                                        value={title}
                                        onChangeText={setTitle}
                                    />
                                </View>
                            </View>
                        )}

                        {/* Note */}
                        {renderFormItem(1,
                            <View style={styles.inputGroup}>
                                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>💬 Notes (optional)</Text>
                                <View style={[styles.inputWrapper, styles.textAreaWrapper, { backgroundColor: theme.background, borderColor: note ? ACCENT : theme.cardBorder }]}>
                                    <TextInput
                                        style={[styles.textInput, styles.textArea, { color: theme.text }]}
                                        placeholder="Add any extra details..."
                                        placeholderTextColor={theme.textSecondary + '80'}
                                        value={note}
                                        onChangeText={setNote}
                                        multiline
                                        numberOfLines={3}
                                        textAlignVertical="top"
                                    />
                                </View>
                            </View>
                        )}

                        {/* Priority */}
                        {renderFormItem(2,
                            <View style={styles.inputGroup}>
                                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>🎯 Priority</Text>
                                <View style={styles.chipRow}>
                                    {PRIORITY_OPTIONS.map((opt, idx) => (
                                        <TouchableOpacity
                                            key={opt.label}
                                            style={[styles.chip, {
                                                backgroundColor: selectedPriority === idx ? opt.color + '20' : theme.background,
                                                borderColor: selectedPriority === idx ? opt.color : theme.cardBorder,
                                            }]}
                                            onPress={() => setSelectedPriority(idx)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.chipEmoji}>{opt.emoji}</Text>
                                            <Text style={[styles.chipLabel, {
                                                color: selectedPriority === idx ? opt.color : theme.textSecondary,
                                                fontWeight: selectedPriority === idx ? '700' : '500',
                                            }]}>{opt.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Category */}
                        {renderFormItem(3,
                            <View style={styles.inputGroup}>
                                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>📁 Category</Text>
                                <View style={styles.categoryGrid}>
                                    {CATEGORY_OPTIONS.map((cat, idx) => (
                                        <TouchableOpacity
                                            key={cat.label}
                                            style={[styles.categoryChip, {
                                                backgroundColor: selectedCategory === idx ? cat.color + '15' : theme.background,
                                                borderColor: selectedCategory === idx ? cat.color : theme.cardBorder,
                                            }]}
                                            onPress={() => setSelectedCategory(idx)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                                            <Text style={[styles.categoryLabel, {
                                                color: selectedCategory === idx ? cat.color : theme.textSecondary,
                                                fontWeight: selectedCategory === idx ? '700' : '500',
                                            }]}>{cat.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Due Date — full picker */}
                        {renderFormItem(4,
                            <DueDatePicker
                                value={dueDate}
                                onChange={setDueDate}
                                theme={theme}
                                accentColor={ACCENT}
                            />
                        )}

                        <View style={{ height: 8 }} />
                    </ScrollView>

                    {/* Add Button */}
                    <Animated.View style={[
                        styles.buttonWrapper,
                        {
                            opacity: buttonAnim,
                            transform: [{ scale: buttonAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
                        },
                    ]}>
                        <TouchableOpacity
                            style={[styles.addButton, { backgroundColor: ACCENT, opacity: title.trim() ? 1 : 0.5 }]}
                            onPress={handleAdd}
                            activeOpacity={0.8}
                            disabled={!title.trim()}
                        >
                            <Text style={styles.addButtonEmoji}>🚀</Text>
                            <Text style={styles.addButtonText}>
                                Add Task{dueDate ? ` · ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                </Animated.View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
    keyboardView: { flex: 1, justifyContent: 'flex-end' },
    modalContainer: {
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        borderWidth: 1, borderBottomWidth: 0,
        maxHeight: height * 0.92,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    dragHandleWrapper: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
    dragHandle: { width: 40, height: 4, borderRadius: 2 },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 8 },
    headerSection: { alignItems: 'center', paddingTop: 8, paddingBottom: 20 },
    headerEmoji: { fontSize: 40, marginBottom: 8 },
    headerTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
    headerSubtitle: { fontSize: 14, fontWeight: '500' },
    inputGroup: { marginBottom: 18 },
    inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, letterSpacing: 0.3 },
    inputWrapper: { borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 14 : 10 },
    textAreaWrapper: { minHeight: 80 },
    textInput: { fontSize: 15, fontWeight: '500' },
    textArea: { minHeight: 60 },
    chipRow: { flexDirection: 'row', gap: 10 },
    chip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, gap: 6 },
    chipEmoji: { fontSize: 14 },
    chipLabel: { fontSize: 13 },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    categoryChip: { width: (width - 48 - 20) / 3, alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, gap: 6 },
    categoryEmoji: { fontSize: 22 },
    categoryLabel: { fontSize: 11, letterSpacing: 0.2 },
    buttonWrapper: { paddingHorizontal: 24, paddingTop: 8 },
    addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, gap: 8 },
    addButtonEmoji: { fontSize: 18 },
    addButtonText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
});

const cal = StyleSheet.create({
    wrapper: { borderRadius: 14, borderWidth: 1.5, padding: 12, marginTop: 10 },
    nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    navBtn: { padding: 4 },
    monthLabel: { fontSize: 15, fontWeight: '700' },
    row: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 4 },
    dayHeader: { width: 34, textAlign: 'center', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    cell: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    dayNum: { fontSize: 14, fontWeight: '500' },
});

const due = StyleSheet.create({
    quickRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    quickChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, gap: 4 },
    quickEmoji: { fontSize: 18 },
    quickLabel: { fontSize: 11 },
    calToggle: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingVertical: 11, paddingHorizontal: 14,
        borderRadius: 12, borderWidth: 1.5, marginBottom: 0,
    },
    calToggleText: { flex: 1, fontSize: 13, fontWeight: '600' },
    selectedBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 10, borderWidth: 1, marginTop: 10,
    },
    selectedEmoji: { fontSize: 14 },
    selectedText: { flex: 1, fontSize: 13, fontWeight: '700' },
});
