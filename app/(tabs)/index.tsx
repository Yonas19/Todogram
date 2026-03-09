import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRef, useEffect } from 'react';
import StoriesRow from '@/components/StoriesRow';
import TodoModal from '@/components/TodoModal';
import AiTodoModal from '@/components/AiTodoModal';
import TodoFeedCard from '@/components/TodoFeedCard';
import { useTodos } from '@/hooks/todo-context';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'dark'];
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [todoModalVisible, setTodoModalVisible] = useState(false);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const fabScale = useRef(new Animated.Value(1)).current;
  const fabRotation = useRef(new Animated.Value(0)).current;
  const menuBackdrop = useRef(new Animated.Value(0)).current;
  const menuItem1 = useRef(new Animated.Value(0)).current;
  const menuItem2 = useRef(new Animated.Value(0)).current;
  const { todos, addTodo } = useTodos();

  // Collapsible stories header
  const STORIES_HEIGHT = 110;
  const scrollY = useRef(new Animated.Value(0)).current;

  const storiesHeight = scrollY.interpolate({
    inputRange: [0, STORIES_HEIGHT],
    outputRange: [STORIES_HEIGHT, 0],
    extrapolate: 'clamp',
  });
  const storiesOpacity = scrollY.interpolate({
    inputRange: [0, STORIES_HEIGHT * 0.6],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const storiesScale = scrollY.interpolate({
    inputRange: [0, STORIES_HEIGHT],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12 ? 'Good Morning' : currentHour < 17 ? 'Good Afternoon' : 'Good Evening';

  const activeTodos = todos.filter((t) => !t.completed);
  const completedTodos = todos.filter((t) => t.completed);

  const openFabMenu = () => {
    setFabMenuOpen(true);
    menuItem1.setValue(0);
    menuItem2.setValue(0);
    menuBackdrop.setValue(0);
    fabRotation.setValue(0);

    Animated.parallel([
      Animated.timing(menuBackdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(fabRotation, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
      Animated.stagger(60, [
        Animated.spring(menuItem1, { toValue: 1, tension: 80, friction: 9, useNativeDriver: true }),
        Animated.spring(menuItem2, { toValue: 1, tension: 80, friction: 9, useNativeDriver: true }),
      ]),
    ]).start();
  };

  const closeFabMenu = () => {
    Animated.parallel([
      Animated.timing(menuBackdrop, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.spring(fabRotation, { toValue: 0, tension: 100, friction: 8, useNativeDriver: true }),
      Animated.stagger(30, [
        Animated.timing(menuItem2, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(menuItem1, { toValue: 0, duration: 120, useNativeDriver: true }),
      ]),
    ]).start(() => setFabMenuOpen(false));
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.greeting, { color: theme.textSecondary }]}>{greeting} 👋</Text>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Todogram</Text>
            </View>
            <TouchableOpacity
              style={[styles.notifButton, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
              activeOpacity={0.7}
            >
              <IconSymbol name="bell.fill" size={20} color={theme.accent} />
              <View style={[styles.notifDot, { backgroundColor: theme.danger }]} />
            </TouchableOpacity>
          </View>

          {/* Collapsible Stories */}
          <Animated.View
            style={{
              height: storiesHeight,
              opacity: storiesOpacity,
              transform: [{ scale: storiesScale }],
              overflow: 'hidden',
            }}
          >
            <StoriesRow />
          </Animated.View>

          {/* Todo Feed */}
          {todos.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📝</Text>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No tasks yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Tap the + button to add your first task
              </Text>
            </View>
          ) : (
            <View style={styles.feedContainer}>
              {/* Active Todos */}
              {activeTodos.length > 0 && (
                <View style={styles.feedSection}>
                  <View style={styles.feedSectionHeader}>
                    <Text style={[styles.feedSectionTitle, { color: theme.text }]}>
                      🔥 To Do
                    </Text>
                    <View style={[styles.countBadge, { backgroundColor: theme.accent + '20' }]}>
                      <Text style={[styles.countText, { color: theme.accent }]}>
                        {activeTodos.length}
                      </Text>
                    </View>
                  </View>
                  {activeTodos.map((todo, index) => (
                    <TodoFeedCard key={todo.id} todo={todo} index={index} />
                  ))}
                </View>
              )}

              {/* Completed Todos */}
              {completedTodos.length > 0 && (
                <View style={styles.feedSection}>
                  <View style={styles.feedSectionHeader}>
                    <Text style={[styles.feedSectionTitle, { color: theme.textSecondary }]}>
                      ✅ Completed
                    </Text>
                    <View style={[styles.countBadge, { backgroundColor: '#10B981' + '20' }]}>
                      <Text style={[styles.countText, { color: '#10B981' }]}>
                        {completedTodos.length}
                      </Text>
                    </View>
                  </View>
                  {completedTodos.map((todo, index) => (
                    <TodoFeedCard key={todo.id} todo={todo} index={index} />
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={{ height: Spacing.xl + 60 }} />
        </Animated.View>
      </Animated.ScrollView>

      {/* FAB Menu Backdrop */}
      {fabMenuOpen && (
        <TouchableOpacity
          style={styles.fabBackdrop}
          activeOpacity={1}
          onPress={closeFabMenu}
        >
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)', opacity: menuBackdrop }]}
          />
        </TouchableOpacity>
      )}

      {/* FAB Menu Items */}
      {fabMenuOpen && (
        <View style={styles.fabMenuContainer}>
          {/* Item 2: AI Todo Maker (top) */}
          <Animated.View
            style={[
              styles.fabMenuItem,
              {
                opacity: menuItem2,
                transform: [
                  { translateY: menuItem2.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                  { scale: menuItem2 },
                ],
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.fabMenuButton, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
              activeOpacity={0.7}
              onPress={() => { closeFabMenu(); setTimeout(() => setAiModalVisible(true), 200); }}
            >
              <View style={[styles.fabMenuIconCircle, { backgroundColor: '#EF4444' + '18' }]}>
                <Text style={styles.fabMenuEmoji}>🎙️</Text>
              </View>
              <Text style={[styles.fabMenuLabel, { color: theme.text }]}>AI Todo Maker</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Item 1: Text Todo (bottom, closest to FAB) */}
          <Animated.View
            style={[
              styles.fabMenuItem,
              {
                opacity: menuItem1,
                transform: [
                  { translateY: menuItem1.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                  { scale: menuItem1 },
                ],
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.fabMenuButton, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
              activeOpacity={0.7}
              onPress={() => {
                closeFabMenu();
                setTimeout(() => setTodoModalVisible(true), 200);
              }}
            >
              <View style={[styles.fabMenuIconCircle, { backgroundColor: theme.accent + '18' }]}>
                <Text style={styles.fabMenuEmoji}>✏️</Text>
              </View>
              <Text style={[styles.fabMenuLabel, { color: theme.text }]}>Text Todo</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {/* Floating Action Button */}
      <Animated.View
        style={[
          styles.fabContainer,
          { transform: [{ scale: fabScale }] },
        ]}
      >
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.accent }]}
          activeOpacity={0.85}
          onPress={fabMenuOpen ? closeFabMenu : openFabMenu}
        >
          <Animated.Text
            style={[
              styles.fabIcon,
              {
                transform: [{
                  rotate: fabRotation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '45deg'],
                  }),
                }],
              },
            ]}
          >
            ＋
          </Animated.Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Todo Modal */}
      <TodoModal
        visible={todoModalVisible}
        onClose={() => setTodoModalVisible(false)}
        onAdd={(todo) => addTodo(todo)}
      />
      <AiTodoModal
        visible={aiModalVisible}
        onClose={() => setAiModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  notifButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Feed
  feedContainer: {
    marginTop: 4,
  },
  feedSection: {
    marginBottom: 8,
  },
  feedSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  feedSectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 12,
    fontWeight: '800',
  },
  // FAB
  fabBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 90,
  },
  fabMenuContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 92,
    right: 22,
    zIndex: 95,
    alignItems: 'flex-end',
    gap: 10,
  },
  fabMenuItem: {
    alignItems: 'flex-end',
  },
  fabMenuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  fabMenuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabMenuEmoji: {
    fontSize: 18,
  },
  fabMenuLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  fabContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 28 : 22,
    right: 22,
    zIndex: 100,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '300',
    lineHeight: 32,
  },
});

