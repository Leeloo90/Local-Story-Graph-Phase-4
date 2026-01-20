import { WordToken } from '../../shared/types';
import fs from 'fs/promises';
import StoryGraphDatabase from '../database/schema';

export const srtTimeToSeconds = (time: string): number => {
    const parts = time.split(':');
    const secondsParts = parts[2].split(',');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const seconds = parseInt(secondsParts[0]);
    const milliseconds = parseInt(secondsParts[1]);
    return (hours * 3600) + (minutes * 60) + seconds + (milliseconds / 1000);
};

export const parseSRT = (fileContent: string): WordToken[] => {
    // Basic implementation, needs to be more robust
    const lines = fileContent.split('\\n');
    const tokens: WordToken[] = [];
    let idCounter = 0;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('-->')) {
            const timeLine = lines[i];
            const contentLine = lines[i + 1];
            if (timeLine && contentLine) {
                const [startStr, endStr] = timeLine.split(' --> ');
                const start = srtTimeToSeconds(startStr);
                const end = srtTimeToSeconds(endStr);

                // This is a simple sentence-level split.
                // A more advanced implementation would split by word and interpolate timestamps.
                const words = contentLine.split(' ');
                const wordDuration = (end - start) / words.length;

                words.forEach((word, index) => {
                    tokens.push({
                        id: idCounter++,
                        text: word,
                        start: start + (index * wordDuration),
                        end: start + ((index + 1) * wordDuration),
                    });
                });
                i++; // Skip content line
            }
        }
    }
    return tokens;
};

export const importTranscript = async (db: StoryGraphDatabase, mediaId: string, filePath: string): Promise<{ success: boolean, error?: string }> => {
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const wordTokens = parseSRT(fileContent);
        const rawText = wordTokens.map(t => t.text).join(' ');
        const wordMapJson = JSON.stringify(wordTokens);

        db.execute(
            `INSERT INTO transcripts (media_id, source_type, raw_text, word_map_json)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(media_id) DO UPDATE SET
                source_type = excluded.source_type,
                raw_text = excluded.raw_text,
                word_map_json = excluded.word_map_json`,
            [mediaId, 'SRT', rawText, wordMapJson]
        );
        console.log(`Transcript imported for media: ${mediaId}`);
        return { success: true };
    } catch (error) {
        console.error(`Error importing transcript for media ${mediaId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
};

export const getTranscriptForNode = async (db: StoryGraphDatabase, nodeId: string): Promise<{ transcript: any, clip_in: number, clip_out: number } | null> => {
    try {
        const nodes = db.query('SELECT asset_id, clip_in, clip_out FROM story_nodes WHERE id = ?', [nodeId]);
        const node = nodes[0];

        if (!node || !node.asset_id) {
            return null;
        }

        const transcripts = db.query('SELECT * FROM transcripts WHERE media_id = ?', [node.asset_id]);
        const transcript = transcripts[0];

        if (!transcript) {
            return null;
        }

        return {
            transcript: {
                ...transcript,
                word_map_json: JSON.parse(transcript.word_map_json),
            },
            clip_in: node.clip_in,
            clip_out: node.clip_out,
        };
    } catch (error) {
        console.error(`Error getting transcript for node ${nodeId}:`, error);
        return null;
    }
};
