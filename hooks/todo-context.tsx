import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '@/hooks/auth-context';

export interface TodoItem {
    id: string;
    title: string;
    note: string;
    priority: number; // 0=Low, 1=Medium, 2=High
    category: number; // 0-5
    completed: boolean;
    createdAt: Date;
    dueDate?: Date; // optional deadline
}

interface TodoContextType {
    todos: TodoItem[];
    addTodo: (todo: Omit<TodoItem, 'id' | 'completed' | 'createdAt'>) => void;
    toggleTodo: (id: string) => void;
    updateTodo: (id: string, updates: Partial<Pick<TodoItem, 'title' | 'note' | 'priority' | 'category'>>) => void;
    deleteTodo: (id: string) => void;
}

const TodoContext = createContext<TodoContextType | undefined>(undefined);

// Map DB row -> TodoItem
function rowToTodo(row: any): TodoItem {
    return {
        id: row.id,
        title: row.title,
        note: row.note || '',
        priority: row.priority ?? 0,
        category: row.category ?? 0,
        completed: row.completed ?? false,
        createdAt: new Date(row.created_at),
        dueDate: row.due_date ? new Date(row.due_date) : undefined,
    };
}

export function TodoProvider({ children }: { children: React.ReactNode }) {
    const [todos, setTodos] = useState<TodoItem[]>([]);
    const { session } = useAuth();

    // Fetch todos from Supabase on mount & when session changes
    useEffect(() => {
        if (!session?.user) {
            setTodos([]);
            return;
        }

        async function fetchTodos() {
            if (!session?.user) return;
            console.log('Fetching todos for user:', session.user.id);
            const { data, error } = await (supabase.from('todos') as any)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('fetchTodos error:', error.message, error.details, error.hint);
                // Alert only if it's a real error (not just empty)
                if (error.code !== 'PGRST116') {
                    Alert.alert('Database Error', `Could not fetch todos: ${error.message}\n\nHint: Check if the 'todos' table exists and RLS policies are set.`);
                }
            } else if (data) {
                console.log('Fetched todos:', data.length);
                setTodos(data.map(rowToTodo));
            }
        }

        fetchTodos();

        // Real-time subscription for live updates
        const channel = supabase
            .channel('todos-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'todos',
                    filter: `user_id=eq.${session.user.id}`,
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setTodos((prev) => {
                            if (prev.find((t) => t.id === payload.new.id)) return prev;
                            return [rowToTodo(payload.new), ...prev];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        setTodos((prev) =>
                            prev.map((t) => (t.id === payload.new.id ? rowToTodo(payload.new) : t))
                        );
                    } else if (payload.eventType === 'DELETE') {
                        setTodos((prev) => prev.filter((t) => t.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session?.user?.id]);

    const addTodo = useCallback(
        async (todo: Omit<TodoItem, 'id' | 'completed' | 'createdAt'>) => {
            if (!session?.user) {
                console.error('addTodo: No active session');
                Alert.alert('Not Logged In', 'Your session may have expired. Please sign out and sign in again to save tasks.');
                return;
            }

            const newRow = {
                title: todo.title,
                note: todo.note,
                priority: todo.priority,
                category: todo.category,
                completed: false,
                user_id: session.user.id,
                due_date: todo.dueDate ? todo.dueDate.toISOString() : null,
            };

            console.log('Inserting new todo:', newRow);
            const { data, error } = await (supabase.from('todos') as any)
                .insert(newRow)
                .select()
                .single();

            if (error) {
                console.error('addTodo error:', error.message, error.details, error.hint);
                Alert.alert('Database Error', `Failed to save task: ${error.message}\n\n${error.hint || 'Ensure your "todos" table is created and your Supabase key is correct.'}`);
                return;
            }
            if (data) {
                console.log('Successfully added todo:', data.id);
                // Optimistic: real-time will also fire, but we add immediately for responsiveness
                setTodos((prev) => {
                    if (prev.find((t) => t.id === data.id)) return prev;
                    return [rowToTodo(data), ...prev];
                });
            }
        },
        [session?.user?.id]
    );

    const toggleTodo = useCallback(
        async (id: string) => {
            // Optimistic update
            setTodos((prev) =>
                prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
            );

            const todo = todos.find((t) => t.id === id);
            if (!todo) return;

            const { error } = await (supabase.from('todos') as any)
                .update({ completed: !todo.completed })
                .eq('id', id);

            if (error) {
                // Revert optimistic update
                setTodos((prev) =>
                    prev.map((t) => (t.id === id ? { ...t, completed: todo.completed } : t))
                );
                console.error('toggleTodo error:', error.message);
            }
        },
        [todos]
    );

    const updateTodo = useCallback(
        async (
            id: string,
            updates: Partial<Pick<TodoItem, 'title' | 'note' | 'priority' | 'category'>>
        ) => {
            // Optimistic update
            setTodos((prev) =>
                prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
            );

            const { error } = await (supabase.from('todos') as any).update(updates).eq('id', id);
            if (error) console.error('updateTodo error:', error.message);
        },
        []
    );

    const deleteTodo = useCallback(
        async (id: string) => {
            // Optimistic update
            setTodos((prev) => prev.filter((t) => t.id !== id));

            const { error } = await (supabase.from('todos') as any).delete().eq('id', id);
            if (error) {
                console.error('deleteTodo error:', error.message);
            }
        },
        []
    );

    return (
        <TodoContext.Provider value={{ todos, addTodo, toggleTodo, updateTodo, deleteTodo }}>
            {children}
        </TodoContext.Provider>
    );
}

export function useTodos() {
    const ctx = useContext(TodoContext);
    if (!ctx) throw new Error('useTodos must be used within TodoProvider');
    return ctx;
}
