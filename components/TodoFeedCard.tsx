import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Animated,
    Dimensions,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { TodoItem, useTodos } from '@/hooks/todo-context';

const { width } = Dimensions.get('window');

const PRIORITY_META = [
    { label: 'Low', emoji: '🟢', color: '#10B981' },
    { label: 'Medium', emoji: '🟡', color: '#F59E0B' },
    { label: 'High', emoji: '🔴', color: '#EF4444' },
];

const CATEGORY_META = [
    { label: 'Personal', emoji: '🏠', color: '#6C63FF' },
    { label: 'Work', emoji: '💼', color: '#3B82F6' },
    { label: 'Health', emoji: '💪', color: '#10B981' },
    { label: 'Study', emoji: '📚', color: '#F59E0B' },
    { label: 'Social', emoji: '🎉', color: '#EC4899' },
    { label: 'Other', emoji: '✨', color: '#8B5CF6' },
];

function timeAgo(date: Date): string {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return 'Today';
}

interface TodoFeedCardProps {
    todo: TodoItem;
    index: number;
}

export default function TodoFeedCard({ todo, index }: TodoFeedCardProps) {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const { toggleTodo, updateTodo, deleteTodo } = useTodos();

    const [editing, setEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(todo.title);
    const [editNote, setEditNote] = useState(todo.note);

    const scaleAnim = useRef(new Animated.Value(0)).current;
    const checkAnim = useRef(new Animated.Value(todo.completed ? 1 : 0)).current;

    // Entrance animation
    React.useEffect(() => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 60,
            friction: 9,
            delay: index * 100,
            useNativeDriver: true,
        }).start();
    }, []);

    const priority = PRIORITY_META[todo.priority];
    const category = CATEGORY_META[todo.category];

    const handleToggle = () => {
        toggleTodo(todo.id);
        Animated.sequence([
            Animated.timing(checkAnim, {
                toValue: todo.completed ? 0 : 1,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const handleSaveEdit = () => {
        updateTodo(todo.id, { title: editTitle, note: editNote });
        setEditing(false);
    };

    const handleCancelEdit = () => {
        setEditTitle(todo.title);
        setEditNote(todo.note);
        setEditing(false);
    };

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor: theme.surface,
                    borderColor: theme.cardBorder,
                    opacity: scaleAnim,
                    transform: [
                        {
                            translateY: scaleAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [40, 0],
                            }),
                        },
                    ],
                },
            ]}
        >
            {/* Card Header — like Instagram post header */}
            <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                    <View style={[styles.categoryBadge, { backgroundColor: category.color + '20' }]}>
                        <Text style={styles.categoryBadgeEmoji}>{category.emoji}</Text>
                    </View>
                    <View>
                        <Text style={[styles.categoryName, { color: theme.text }]}>{category.label}</Text>
                        <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                            {timeAgo(todo.createdAt)}
                        </Text>
                    </View>
                </View>
                <View style={styles.cardHeaderRight}>
                    <View style={[styles.priorityPill, { backgroundColor: priority.color + '15', borderColor: priority.color + '30' }]}>
                        <Text style={styles.priorityEmoji}>{priority.emoji}</Text>
                        <Text style={[styles.priorityLabel, { color: priority.color }]}>{priority.label}</Text>
                    </View>
                </View>
            </View>

            {/* Card Body — the "post" content */}
            <View style={[styles.cardBody, { backgroundColor: category.color + '08' }]}>
                {editing ? (
                    <View style={styles.editContainer}>
                        <TextInput
                            style={[styles.editTitleInput, { color: theme.text, borderColor: theme.accent }]}
                            value={editTitle}
                            onChangeText={setEditTitle}
                            autoFocus
                        />
                        <TextInput
                            style={[styles.editNoteInput, { color: theme.textSecondary, borderColor: theme.cardBorder }]}
                            value={editNote}
                            onChangeText={setEditNote}
                            placeholder="Add a note..."
                            placeholderTextColor={theme.textSecondary + '60'}
                            multiline
                        />
                    </View>
                ) : (
                    <TouchableOpacity activeOpacity={0.8} onLongPress={() => setEditing(true)}>
                        <Text
                            style={[
                                styles.todoTitle,
                                { color: theme.text },
                                todo.completed && styles.todoTitleCompleted,
                            ]}
                        >
                            {todo.title}
                        </Text>
                        {todo.note ? (
                            <Text
                                style={[
                                    styles.todoNote,
                                    { color: theme.textSecondary },
                                    todo.completed && styles.todoNoteCompleted,
                                ]}
                            >
                                {todo.note}
                            </Text>
                        ) : null}
                    </TouchableOpacity>
                )}
            </View>

            {/* Card Actions — like Instagram actions bar */}
            <View style={styles.cardActions}>
                {editing ? (
                    <View style={styles.editActions}>
                        <TouchableOpacity
                            style={[styles.editBtn, { backgroundColor: theme.accent }]}
                            onPress={handleSaveEdit}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.editBtnText}>✓ Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.editBtn, styles.cancelBtn, { borderColor: theme.cardBorder }]}
                            onPress={handleCancelEdit}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <TouchableOpacity
                            style={[
                                styles.completeButton,
                                {
                                    backgroundColor: todo.completed ? '#10B981' + '15' : theme.background,
                                    borderColor: todo.completed ? '#10B981' : theme.cardBorder,
                                },
                            ]}
                            onPress={handleToggle}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.completeEmoji}>{todo.completed ? '✅' : '⬜'}</Text>
                            <Text
                                style={[
                                    styles.completeText,
                                    { color: todo.completed ? '#10B981' : theme.textSecondary },
                                ]}
                            >
                                {todo.completed ? 'Done!' : 'Mark done'}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.rightActions}>
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: theme.background }]}
                                onPress={() => setEditing(true)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.actionEmoji}>✏️</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: '#EF4444' + '10' }]}
                                onPress={() => deleteTodo(todo.id)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.actionEmoji}>🗑️</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 16,
        overflow: 'hidden',
    },
    // Header
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    categoryBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoryBadgeEmoji: {
        fontSize: 18,
    },
    categoryName: {
        fontSize: 14,
        fontWeight: '700',
    },
    timeText: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 1,
    },
    cardHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    priorityPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1,
        gap: 4,
    },
    priorityEmoji: {
        fontSize: 10,
    },
    priorityLabel: {
        fontSize: 11,
        fontWeight: '700',
    },
    // Body
    cardBody: {
        paddingHorizontal: 16,
        paddingVertical: 20,
        minHeight: 80,
        justifyContent: 'center',
    },
    todoTitle: {
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.3,
        lineHeight: 26,
    },
    todoTitleCompleted: {
        textDecorationLine: 'line-through',
        opacity: 0.5,
    },
    todoNote: {
        fontSize: 14,
        fontWeight: '500',
        marginTop: 6,
        lineHeight: 20,
    },
    todoNoteCompleted: {
        textDecorationLine: 'line-through',
        opacity: 0.4,
    },
    // Edit mode
    editContainer: {
        gap: 10,
    },
    editTitleInput: {
        fontSize: 18,
        fontWeight: '700',
        borderWidth: 1.5,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    editNoteInput: {
        fontSize: 14,
        fontWeight: '500',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        minHeight: 50,
    },
    // Actions
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    completeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        gap: 6,
    },
    completeEmoji: {
        fontSize: 16,
    },
    completeText: {
        fontSize: 13,
        fontWeight: '700',
    },
    rightActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionEmoji: {
        fontSize: 16,
    },
    editActions: {
        flexDirection: 'row',
        flex: 1,
        gap: 10,
    },
    editBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 12,
    },
    editBtnText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    cancelBtn: {
        backgroundColor: 'transparent',
        borderWidth: 1,
    },
    cancelBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
