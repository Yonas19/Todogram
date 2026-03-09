import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    Animated,
    FlatList,
    Platform,
    ViewToken,
    Modal,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/auth-context';

const { width, height } = Dimensions.get('window');

// ── Types ─────────────────────────────────────────────────────────────────────

interface GrindRoom {
    id: string;
    name: string;
    description: string;
    host_id: string;
    host_name: string;
    host_emoji: string;
    emoji: string;
    category: string;
    category_color: string;
    bg_color: string;
    tags: string[];
    max_members: number;
    member_count: number;
    is_live: boolean;
    created_at: string;
}

// ── Options for category picker ───────────────────────────────────────────────

const CATEGORIES = [
    { label: 'Focus', color: '#6C63FF', emoji: '🧠' },
    { label: 'Study', color: '#F59E0B', emoji: '📚' },
    { label: 'Coding', color: '#10B981', emoji: '💻' },
    { label: 'Productivity', color: '#EC4899', emoji: '⚡' },
    { label: 'Creative', color: '#8B5CF6', emoji: '🎨' },
    { label: 'Health', color: '#EF4444', emoji: '💪' },
    { label: 'Other', color: '#3B82F6', emoji: '🌟' },
];

const BG_COLORS = [
    '#1a1a2e', '#0d2137', '#0f2027', '#1a0533',
    '#1a0000', '#0b1426', '#0A1F1A', '#1A1000',
];

const ROOM_EMOJIS = ['🔥', '📚', '💻', '⚡', '✨', '🌅', '🎨', '🧠', '🎯', '🚀'];
const HOST_EMOJIS = ['👨‍💻', '👩‍🎓', '🧑‍💻', '👩', '🧑‍🎨', '🏋️', '🧑‍🔬', '👨‍🎨'];

// ── Room Card ─────────────────────────────────────────────────────────────────

function RoomCard({
    room,
    index,
    isActive,
    onJoin,
    onDelete,
    isOwner,
}: {
    room: GrindRoom;
    index: number;
    isActive: boolean;
    onJoin: () => void;
    onDelete: () => void;
    isOwner: boolean;
}) {
    const scaleAnim = useRef(new Animated.Value(isActive ? 1 : 0.92)).current;
    const joinScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.spring(scaleAnim, {
            toValue: isActive ? 1 : 0.92,
            tension: 60,
            friction: 8,
            useNativeDriver: true,
        }).start();
    }, [isActive]);

    const memberPercent = Math.min((room.member_count / room.max_members) * 100, 100);
    const createdAt = new Date(room.created_at);
    const minutesAgo = Math.floor((Date.now() - createdAt.getTime()) / 60000);
    const durationLabel =
        minutesAgo < 1 ? 'just now' :
            minutesAgo < 60 ? `${minutesAgo}m` :
                `${Math.floor(minutesAgo / 60)}h ${minutesAgo % 60}m`;

    return (
        <Animated.View style={[styles.roomCard, { transform: [{ scale: scaleAnim }] }]}>
            <View style={[styles.roomBg, { backgroundColor: room.bg_color }]}>
                {/* Large background emoji */}
                <Text style={styles.bgEmoji}>{room.emoji}</Text>

                {/* Live badge + owner delete */}
                <View style={styles.topRow}>
                    <View style={styles.liveBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>LIVE</Text>
                        <Text style={styles.liveDuration}> · {durationLabel}</Text>
                    </View>
                    {isOwner && (
                        <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} activeOpacity={0.7}>
                            <MaterialIcons name="delete-outline" size={18} color="rgba(255,100,100,0.8)" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Category pill */}
                <View style={[styles.categoryPill, { backgroundColor: room.category_color + '30', borderColor: room.category_color + '50' }]}>
                    <Text style={[styles.categoryText, { color: room.category_color }]}>{room.category}</Text>
                </View>

                {/* Main content */}
                <View style={styles.roomContent}>
                    <Text style={styles.roomName}>{room.name}</Text>
                    <Text style={styles.roomDesc}>{room.description}</Text>

                    {/* Host */}
                    <View style={styles.hostRow}>
                        <View style={styles.hostBadge}>
                            <Text style={styles.hostEmoji}>{room.host_emoji}</Text>
                        </View>
                        <Text style={styles.hostName}>Hosted by {room.host_name}</Text>
                    </View>

                    {/* Tags */}
                    {room.tags.length > 0 && (
                        <View style={styles.tagsRow}>
                            {room.tags.slice(0, 3).map((tag) => (
                                <View key={tag} style={[styles.tag, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                                    <Text style={styles.tagText}>#{tag}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Members bar */}
                    <View style={styles.membersSection}>
                        <View style={styles.membersInfo}>
                            <View style={styles.memberAvatars}>
                                {Array.from({ length: Math.min(4, room.member_count) }).map((_, i) => (
                                    <View key={i} style={[styles.memberDot, { left: i * 14, backgroundColor: room.category_color, opacity: 1 - i * 0.2 }]} />
                                ))}
                            </View>
                            <Text style={styles.membersText}>
                                {room.member_count}/{room.max_members} grinding
                            </Text>
                        </View>
                        <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${memberPercent}%` as any, backgroundColor: room.category_color }]} />
                        </View>
                    </View>
                </View>

                {/* Join button */}
                <Animated.View style={[styles.joinButtonWrapper, { transform: [{ scale: joinScale }] }]}>
                    <TouchableOpacity
                        style={[styles.joinButton, { backgroundColor: room.category_color }]}
                        activeOpacity={0.85}
                        onPressIn={() => Animated.spring(joinScale, { toValue: 0.92, useNativeDriver: true }).start()}
                        onPressOut={() => Animated.spring(joinScale, { toValue: 1, friction: 3, tension: 150, useNativeDriver: true }).start()}
                        onPress={onJoin}
                    >
                        <MaterialIcons name="login" size={20} color="#FFFFFF" />
                        <Text style={styles.joinText}>Join Room</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Swipe hint */}
                <View style={styles.swipeHint}>
                    <MaterialIcons name="keyboard-arrow-up" size={20} color="rgba(255,255,255,0.3)" />
                    <Text style={styles.swipeText}>Swipe for more rooms</Text>
                </View>
            </View>
        </Animated.View>
    );
}

// ── Create Room Modal ─────────────────────────────────────────────────────────

interface CreateRoomModalProps {
    visible: boolean;
    onClose: () => void;
    onCreated: () => void;
    userId: string;
    userEmail: string;
}

function CreateRoomModal({ visible, onClose, onCreated, userId, userEmail }: CreateRoomModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [hostName, setHostName] = useState(userEmail.split('@')[0]);
    const [hostEmoji, setHostEmoji] = useState(HOST_EMOJIS[0]);
    const [selectedEmoji, setSelectedEmoji] = useState(ROOM_EMOJIS[0]);
    const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
    const [selectedBg, setSelectedBg] = useState(BG_COLORS[0]);
    const [tagsInput, setTagsInput] = useState('');
    const [maxMembers, setMaxMembers] = useState('20');
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!name.trim()) { Alert.alert('Missing field', 'Please enter a room name.'); return; }
        if (!description.trim()) { Alert.alert('Missing field', 'Please enter a description.'); return; }

        const tags = tagsInput
            .split(',')
            .map((t) => t.trim().replace(/^#/, ''))
            .filter(Boolean);

        setLoading(true);
        const { error } = await (supabase.from('rooms') as any).insert({
            name: name.trim(),
            description: description.trim(),
            host_id: userId,
            host_name: hostName.trim() || 'Anonymous',
            host_emoji: hostEmoji,
            emoji: selectedEmoji,
            category: selectedCategory.label,
            category_color: selectedCategory.color,
            bg_color: selectedBg,
            tags,
            max_members: parseInt(maxMembers) || 20,
            member_count: 1,
            is_live: true,
        });
        setLoading(false);

        if (error) {
            Alert.alert('Error', `Could not create room: ${error.message}`);
            return;
        }

        // Reset
        setName(''); setDescription(''); setTagsInput(''); setMaxMembers('20');
        setSelectedCategory(CATEGORIES[0]); setSelectedBg(BG_COLORS[0]);
        setSelectedEmoji(ROOM_EMOJIS[0]); setHostEmoji(HOST_EMOJIS[0]);

        onCreated();
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={modal.container}>
                    {/* Modal Header */}
                    <View style={modal.header}>
                        <TouchableOpacity onPress={onClose} style={modal.cancelBtn}>
                            <Text style={modal.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={modal.title}>Create Room</Text>
                        <TouchableOpacity onPress={handleCreate} style={modal.createBtn} disabled={loading}>
                            {loading
                                ? <ActivityIndicator color="#FFFFFF" size="small" />
                                : <Text style={modal.createText}>Create</Text>}
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={modal.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                        {/* Room Name */}
                        <Text style={modal.label}>Room Name *</Text>
                        <TextInput
                            style={modal.input}
                            placeholder="e.g. Deep Work Zone 🧠"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            value={name}
                            onChangeText={setName}
                            maxLength={50}
                        />

                        {/* Description */}
                        <Text style={modal.label}>Description *</Text>
                        <TextInput
                            style={[modal.input, modal.textArea]}
                            placeholder="What's this room about?"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            numberOfLines={3}
                            maxLength={120}
                        />

                        {/* Host Name */}
                        <Text style={modal.label}>Your Name</Text>
                        <TextInput
                            style={modal.input}
                            placeholder="Host display name"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            value={hostName}
                            onChangeText={setHostName}
                            maxLength={30}
                        />

                        {/* Host Emoji */}
                        <Text style={modal.label}>Host Emoji</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={modal.emojiRow}>
                            {HOST_EMOJIS.map((e) => (
                                <TouchableOpacity
                                    key={e}
                                    style={[modal.emojiBtn, hostEmoji === e && modal.emojiBtnActive]}
                                    onPress={() => setHostEmoji(e)}
                                >
                                    <Text style={modal.emojiChar}>{e}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Room Emoji */}
                        <Text style={modal.label}>Room Emoji</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={modal.emojiRow}>
                            {ROOM_EMOJIS.map((e) => (
                                <TouchableOpacity
                                    key={e}
                                    style={[modal.emojiBtn, selectedEmoji === e && modal.emojiBtnActive]}
                                    onPress={() => setSelectedEmoji(e)}
                                >
                                    <Text style={modal.emojiChar}>{e}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Category */}
                        <Text style={modal.label}>Category</Text>
                        <View style={modal.categoryGrid}>
                            {CATEGORIES.map((cat) => (
                                <TouchableOpacity
                                    key={cat.label}
                                    style={[
                                        modal.categoryChip,
                                        { borderColor: cat.color + '60' },
                                        selectedCategory.label === cat.label && { backgroundColor: cat.color + '25', borderColor: cat.color },
                                    ]}
                                    onPress={() => setSelectedCategory(cat)}
                                >
                                    <Text style={modal.categoryChipEmoji}>{cat.emoji}</Text>
                                    <Text style={[modal.categoryChipText, { color: cat.color }]}>{cat.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Background Color */}
                        <Text style={modal.label}>Background</Text>
                        <View style={modal.bgRow}>
                            {BG_COLORS.map((c) => (
                                <TouchableOpacity
                                    key={c}
                                    style={[
                                        modal.bgSwatch,
                                        { backgroundColor: c },
                                        selectedBg === c && modal.bgSwatchActive,
                                    ]}
                                    onPress={() => setSelectedBg(c)}
                                >
                                    {selectedBg === c && (
                                        <MaterialIcons name="check" size={14} color="#FFFFFF" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Tags */}
                        <Text style={modal.label}>Tags (comma-separated)</Text>
                        <TextInput
                            style={modal.input}
                            placeholder="e.g. Focus, Pomodoro, Silent"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            value={tagsInput}
                            onChangeText={setTagsInput}
                            maxLength={80}
                        />

                        {/* Max Members */}
                        <Text style={modal.label}>Max Members</Text>
                        <TextInput
                            style={modal.input}
                            placeholder="20"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            value={maxMembers}
                            onChangeText={setMaxMembers}
                            keyboardType="number-pad"
                            maxLength={3}
                        />

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyRooms({ onCreate }: { onCreate: () => void }) {
    return (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🏠</Text>
            <Text style={styles.emptyTitle}>No rooms yet</Text>
            <Text style={styles.emptySubtitle}>Be the first to create a Grind Room and invite others to join!</Text>
            <TouchableOpacity style={styles.emptyCreateBtn} onPress={onCreate} activeOpacity={0.8}>
                <MaterialIcons name="add" size={20} color="#FFFFFF" />
                <Text style={styles.emptyCreateText}>Create First Room</Text>
            </TouchableOpacity>
        </View>
    );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function GrindRoomScreen() {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const [activeIndex, setActiveIndex] = useState(0);
    const router = useRouter();
    const { session } = useAuth();

    const [rooms, setRooms] = useState<GrindRoom[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    // Fetch rooms
    const fetchRooms = useCallback(async () => {
        const { data, error } = await (supabase.from('rooms') as any)
            .select('*')
            .eq('is_live', true)
            .order('created_at', { ascending: false });
        if (!error && data) setRooms(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchRooms();

        // Real-time subscription
        const channel = supabase
            .channel('rooms-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
                fetchRooms();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchRooms]);

    const handleDelete = async (room: GrindRoom) => {
        Alert.alert(
            'Delete Room',
            `Delete "${room.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive',
                    onPress: async () => {
                        await (supabase.from('rooms') as any).delete().eq('id', room.id);
                        fetchRooms();
                    },
                },
            ]
        );
    };

    const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;
    const onViewableItemsChanged = useRef(
        ({ viewableItems }: { viewableItems: ViewToken[] }) => {
            if (viewableItems.length > 0 && viewableItems[0].index != null) {
                setActiveIndex(viewableItems[0].index);
            }
        }
    ).current;

    const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 72;
    const CARD_HEIGHT = height - TAB_BAR_HEIGHT - (Platform.OS === 'ios' ? 50 : 40);

    const userId = session?.user?.id ?? '';
    const userEmail = session?.user?.email ?? 'user@app.com';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: '#0a0a1a' }]}>
            <StatusBar style="light" />

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Grind Room</Text>
                    <Text style={styles.headerSub}>
                        {loading ? 'Loading…' : `${rooms.length} public room${rooms.length !== 1 ? 's' : ''} live`}
                    </Text>
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7} onPress={() => setShowCreate(true)}>
                        <MaterialIcons name="add-circle-outline" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#6C63FF" />
                    <Text style={styles.loadingText}>Loading rooms…</Text>
                </View>
            ) : rooms.length === 0 ? (
                <EmptyRooms onCreate={() => setShowCreate(true)} />
            ) : (
                <>
                    {/* Pagination dots */}
                    <View style={styles.pagination}>
                        {rooms.map((r, i) => (
                            <View
                                key={r.id}
                                style={[
                                    styles.dot,
                                    i === activeIndex ? styles.dotActive : styles.dotInactive,
                                    i === activeIndex && { backgroundColor: rooms[activeIndex]?.category_color ?? '#6C63FF' },
                                ]}
                            />
                        ))}
                    </View>

                    {/* Reel-style rooms */}
                    <FlatList
                        data={rooms}
                        keyExtractor={(item) => item.id}
                        pagingEnabled
                        showsVerticalScrollIndicator={false}
                        snapToInterval={CARD_HEIGHT}
                        decelerationRate="fast"
                        viewabilityConfig={viewabilityConfig}
                        onViewableItemsChanged={onViewableItemsChanged}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        renderItem={({ item, index }) => (
                            <View style={{ height: CARD_HEIGHT, paddingHorizontal: 16, paddingVertical: 8 }}>
                                <RoomCard
                                    room={item}
                                    index={index}
                                    isActive={index === activeIndex}
                                    isOwner={item.host_id === userId}
                                    onDelete={() => handleDelete(item)}
                                    onJoin={() => {
                                        router.push({
                                            pathname: '/room-session',
                                            params: {
                                                roomId: item.id,
                                                roomName: item.name,
                                                roomColor: item.category_color,
                                                roomEmoji: item.emoji,
                                                roomMembers: String(item.member_count),
                                                roomHost: item.host_name,
                                            },
                                        });
                                    }}
                                />
                            </View>
                        )}
                    />
                </>
            )}

            {/* Create Room Modal */}
            <CreateRoomModal
                visible={showCreate}
                onClose={() => setShowCreate(false)}
                onCreated={fetchRooms}
                userId={userId}
                userEmail={userEmail}
            />
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },

    // Header
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8,
    },
    headerTitle: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
    headerSub: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.5)', marginTop: 2 },
    headerRight: { flexDirection: 'row', gap: 8 },
    headerBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center',
    },

    // Loading / Empty
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    loadingText: { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '500' },
    emptyContainer: {
        flex: 1, alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 40, gap: 12,
    },
    emptyEmoji: { fontSize: 60, marginBottom: 8 },
    emptyTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
    emptySubtitle: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 20 },
    emptyCreateBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#6C63FF', paddingHorizontal: 24, paddingVertical: 14,
        borderRadius: 16, marginTop: 8,
    },
    emptyCreateText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },

    // Pagination
    pagination: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 6 },
    dot: { height: 4, borderRadius: 2 },
    dotActive: { width: 20 },
    dotInactive: { width: 8, backgroundColor: 'rgba(255,255,255,0.2)' },

    // Room card
    roomCard: { flex: 1, borderRadius: 24, overflow: 'hidden' },
    roomBg: {
        flex: 1, borderRadius: 24, padding: 24,
        justifyContent: 'space-between', position: 'relative', overflow: 'hidden',
    },
    bgEmoji: { position: 'absolute', fontSize: 140, opacity: 0.06, right: -20, top: -10 },

    // Top row (live badge + delete)
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    liveBadge: {
        flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
        backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 20, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#EF4444', marginRight: 6 },
    liveText: { fontSize: 11, fontWeight: '800', color: '#EF4444', letterSpacing: 1 },
    liveDuration: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
    deleteBtn: {
        padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,100,100,0.1)',
    },

    // Category
    categoryPill: {
        position: 'absolute', top: 24, right: 24,
        paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, borderWidth: 1,
    },
    categoryText: { fontSize: 11, fontWeight: '700' },

    // Content
    roomContent: { flex: 1, justifyContent: 'center', gap: 12 },
    roomName: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, lineHeight: 34 },
    roomDesc: { fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.65)', lineHeight: 22 },

    // Host
    hostRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    hostBadge: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center',
    },
    hostEmoji: { fontSize: 16 },
    hostName: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },

    // Tags
    tagsRow: { flexDirection: 'row', gap: 8, marginTop: 2, flexWrap: 'wrap' },
    tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    tagText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },

    // Members
    membersSection: { marginTop: 4 },
    membersInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    memberAvatars: { flexDirection: 'row', width: 70, height: 22, position: 'relative' },
    memberDot: { position: 'absolute', width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#1a1a2e' },
    membersText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
    progressBarBg: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
    progressBarFill: { height: 4, borderRadius: 2 },

    // Join button
    joinButtonWrapper: { marginTop: 8 },
    joinButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 16, borderRadius: 16, gap: 8,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
    },
    joinText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },

    // Swipe hint
    swipeHint: { alignItems: 'center', gap: 2, marginTop: 6 },
    swipeText: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.2)' },
});

const modal = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0d0d1a' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    title: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
    cancelBtn: { padding: 4 },
    cancelText: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
    createBtn: {
        backgroundColor: '#6C63FF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, minWidth: 70, alignItems: 'center',
    },
    createText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },

    scroll: { paddingHorizontal: 20, paddingTop: 20 },
    label: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: {
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingVertical: 12,
        color: '#FFFFFF', fontSize: 15, marginBottom: 20,
    },
    textArea: { height: 80, textAlignVertical: 'top' },

    emojiRow: { marginBottom: 20 },
    emojiBtn: {
        width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)', marginRight: 8, borderWidth: 1, borderColor: 'transparent',
    },
    emojiBtnActive: { borderColor: '#6C63FF', backgroundColor: 'rgba(108,99,255,0.2)' },
    emojiChar: { fontSize: 24 },

    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    categoryChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 12, borderWidth: 1, backgroundColor: 'transparent',
    },
    categoryChipEmoji: { fontSize: 14 },
    categoryChipText: { fontSize: 13, fontWeight: '700' },

    bgRow: { flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
    bgSwatch: {
        width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: 'transparent',
    },
    bgSwatchActive: { borderColor: '#FFFFFF' },
});
