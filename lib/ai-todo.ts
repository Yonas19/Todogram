// lib/ai-todo.ts
// AI-powered voice-to-todo utility using AssemblyAI for transcription
// and local keyword extraction for structured fields.

const ASSEMBLYAI_API_KEY = process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY || '';
const ASSEMBLYAI_BASE = 'https://api.assemblyai.com/v2';

// ── Priority keywords ─────────────────────────────────────────────────────────
const HIGH_KEYWORDS = ['urgent', 'critical', 'high priority', 'asap', 'must do', 'immediately', 'right now', 'top priority'];
const LOW_KEYWORDS = ['whenever', 'eventually', 'sometime', 'low priority', 'no rush', 'later', 'when i can'];

// ── Category keywords ─────────────────────────────────────────────────────────
// 0=Personal, 1=Work, 2=Health, 3=Study, 4=Social, 5=Other
const WORK_KEYWORDS = ['work', 'office', 'meeting', 'boss', 'client', 'project', 'deadline', 'email', 'report', 'presentation', 'job', 'colleague', 'team', 'slack', 'zoom', 'call'];
const HEALTH_KEYWORDS = ['gym', 'exercise', 'health', 'doctor', 'medicine', 'workout', 'run', 'diet', 'sleep', 'hospital', 'appointment', 'yoga', 'meditate', 'dentist', 'pharmacy'];
const STUDY_KEYWORDS = ['study', 'learn', 'read', 'book', 'class', 'exam', 'test', 'assignment', 'homework', 'school', 'university', 'course', 'lecture', 'research', 'essay'];
const SOCIAL_KEYWORDS = ['friend', 'family', 'party', 'dinner', 'lunch', 'meet', 'birthday', 'celebrate', 'call', 'visit', 'hang', 'coffee', 'date', 'wedding', 'gift'];

// ── Day names for due-date extraction ─────────────────────────────────────────
// Maps to JS getDay() equivalents: Sun=0, Mon=1,...Sat=6
const DAY_MAP: { name: string; day: number }[] = [
    { name: 'sunday', day: 0 },
    { name: 'monday', day: 1 },
    { name: 'tuesday', day: 2 },
    { name: 'wednesday', day: 3 },
    { name: 'thursday', day: 4 },
    { name: 'friday', day: 5 },
    { name: 'saturday', day: 6 },
];

export interface ExtractedTodo {
    title: string;
    note: string;
    priority: number;   // 0=Low, 1=Medium, 2=High
    category: number;   // 0-5
    dueDate?: Date;
}

export async function processVoiceToTodo(audioUri: string): Promise<ExtractedTodo> {
    try {
        // 1. Read local file into blob
        const fileResponse = await fetch(audioUri);
        const blob = await fileResponse.blob();

        // 2. Upload to AssemblyAI
        const uploadRes = await fetch(`${ASSEMBLYAI_BASE}/upload`, {
            method: 'POST',
            headers: {
                'Authorization': ASSEMBLYAI_API_KEY,
            },
            body: blob,
        });

        if (!uploadRes.ok) throw new Error('Failed to upload audio to AssemblyAI');
        const uploadData = await uploadRes.json();
        const uploadUrl = uploadData.upload_url;

        // 3. Request Transcription
        const transcriptRes = await fetch(`${ASSEMBLYAI_BASE}/transcript`, {
            method: 'POST',
            headers: {
                'Authorization': ASSEMBLYAI_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ audio_url: uploadUrl })
        });

        if (!transcriptRes.ok) throw new Error('Failed to start transcription');
        const transcriptData = await transcriptRes.json();
        const transcriptId = transcriptData.id;

        // 4. Poll for Completion
        let transcriptText = '';
        while (true) {
            await new Promise(resolve => setTimeout(resolve, 1500)); // wait 1.5s

            const pollRes = await fetch(`${ASSEMBLYAI_BASE}/transcript/${transcriptId}`, {
                headers: { 'Authorization': ASSEMBLYAI_API_KEY }
            });
            const pollData = await pollRes.json();

            if (pollData.status === 'completed') {
                transcriptText = pollData.text;
                break;
            } else if (pollData.status === 'error') {
                throw new Error('Transcription error: ' + pollData.error);
            }
            // else keep polling
        }

        if (!transcriptText) throw new Error('No speech detected in audio.');

        // 5. Local Extraction Heuristics
        const textLower = transcriptText.toLowerCase();

        // Priority (Default: Medium/1)
        let priority = 1;
        if (HIGH_KEYWORDS.some(k => textLower.includes(k))) priority = 2;
        else if (LOW_KEYWORDS.some(k => textLower.includes(k))) priority = 0;

        // Category (Default: Personal/0)
        let category = 0;
        if (WORK_KEYWORDS.some(k => textLower.includes(k))) category = 1;
        else if (HEALTH_KEYWORDS.some(k => textLower.includes(k))) category = 2;
        else if (STUDY_KEYWORDS.some(k => textLower.includes(k))) category = 3;
        else if (SOCIAL_KEYWORDS.some(k => textLower.includes(k))) category = 4;

        // Due Date
        let dueDate: Date | undefined = undefined;
        if (textLower.includes('today')) {
            dueDate = new Date();
        } else if (textLower.includes('tomorrow')) {
            dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 1);
        } else {
            for (const dm of DAY_MAP) {
                if (textLower.includes(dm.name)) {
                    dueDate = new Date();
                    let currentDay = dueDate.getDay();
                    let diff = dm.day - currentDay;
                    if (diff <= 0) diff += 7; // Next occurrence of that day
                    dueDate.setDate(dueDate.getDate() + diff);
                    break;
                }
            }
        }

        // Title (derive from transcript, max ~5-6 words)
        const words = transcriptText.split(/\s+/);
        let title = words.slice(0, 6).join(' ');
        if (words.length > 6) title += '...';
        if (!title.trim()) title = 'Voice Task';

        return {
            title,
            note: transcriptText,
            priority,
            category,
            dueDate
        };
    } catch (e: any) {
        console.error('AssemblyAI error:', e);
        throw new Error(e.message || 'AI processing failed.');
    }
}
