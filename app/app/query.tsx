// app/query.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Alert,
    Button,
    ActivityIndicator,
} from 'react-native';
import Checkbox from 'expo-checkbox';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

// const API_URL = 'http://10.100.2.90:8000/analyze/';
export const API_URL = 'https://5271-164-67-70-232.ngrok-free.app';

const challengeOptions = [
    { key: 'kneePain', label: 'Knee pain or hip problems' },
    { key: 'balance', label: 'Difficulty with balance' },
    { key: 'weakGrip', label: 'Weak grip or trouble holding things' },
    { key: 'poorVision', label: 'Poor vision' },
    { key: 'hearing', label: 'Hearing difficulties' },
    { key: 'walking', label: 'Slower walking speed' },
    { key: 'memory', label: 'Some memory slips' },
    { key: 'none', label: 'None of these, just planning ahead' },
];

export default function Query() {
    const [selections, setSelections] = useState<Record<string, boolean>>({});
    const [noteText, setNoteText] = useState('');
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [audioUri, setAudioUri] = useState<string | null>(null);

    // Playback state
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [position, setPosition] = useState(0);

    // Recording elapsed time (ms)
    const [recPosition, setRecPosition] = useState(0);

    // Problems parsed from voice recording from API

    const [isProcessing, setIsProcessing] = useState(false);
    const [problems, setProblems] = useState<string[]>([]);

    const router = useRouter();

    // any time audioUri changes (i.e. after stopRecording), kick off the analysis
    useEffect(() => {
        if (!audioUri) return;

        const analyze = async () => {
            console.log('Processing audio...');
            setIsProcessing(true);
            try {
                const formData = new FormData();
                formData.append('file', {
                    uri: audioUri,
                    name: 'note.m4a',
                    type: 'audio/m4a',
                } as any);

                console.log('Sending audio to Gemini...');
                const resp = await axios.post(`${API_URL}/analyze_audio/`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    responseType: 'text',
                });

                console.log('Received response from API');
                // parse comma list
                const list = resp.data
                    .split(',')
                    .map((s: string) => s.trim())
                    .filter((s: string) => s.length > 0);

                setProblems(list);
            } catch (err) {
                console.error(err);
                Alert.alert('Error', 'Audio analysis failed.');
            } finally {
                setIsProcessing(false);
            }
        };

        analyze();
    }, [audioUri]);

    const toggleOption = (key: string) => {
        setSelections((prev) => {
            const newState = { ...prev, [key]: !prev[key] };
            if (key === 'none' && !prev.none) {
                challengeOptions.forEach((opt) => {
                    if (opt.key !== 'none') newState[opt.key] = false;
                });
            } else if (key !== 'none' && prev.none) {
                newState.none = false;
            }
            return newState;
        });
    };

    // Recording handlers
    const startRecording = async () => {
        try {
            // unload previous playback
            if (sound) {
                await sound.unloadAsync();
                setSound(null);
            }
            if (audioUri) {
                setAudioUri(null);
                setDuration(0);
                setPosition(0);
            }

            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission required', 'Need microphone access to record.');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const rec = new Audio.Recording();
            // set interval AND callback *before* starting
            rec.setProgressUpdateInterval(500);
            rec.setOnRecordingStatusUpdate((st) => {
                if (st.isRecording) {
                    setRecPosition(st.durationMillis ?? 0);
                }
            });

            await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            await rec.startAsync();
            setRecording(rec);
            setRecPosition(0);
        } catch {
            Alert.alert('Error', 'Could not start recording.');
        }
    };

    const stopRecording = async () => {
        if (!recording) return;
        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI()!;
            setAudioUri(uri);
            const status = await recording.getStatusAsync();
            setDuration(status.durationMillis || 0);
            setRecording(null);
        } catch {
            Alert.alert('Error', 'Could not stop recording.');
        }
    };

    // Playback status updates
    const onPlaybackStatusUpdate = (status: any) => {
        if (!status.isLoaded) return;
        setPosition(status.positionMillis);
        setDuration(status.durationMillis);
        setIsPlaying(status.isPlaying);
        if (status.didJustFinish) {
            setIsPlaying(false);
            setPosition(0);
        }
    };

    const togglePlayback = async () => {
        if (!audioUri) return;
        try {
            if (!sound) {
                const { sound: snd, status } = await Audio.Sound.createAsync(
                    { uri: audioUri },
                    { shouldPlay: true },
                    onPlaybackStatusUpdate
                );
                setSound(snd);
                setIsPlaying(status.isLoaded);
            } else {
                const stat = await sound.getStatusAsync();
                if (stat.isLoaded) {
                    await sound.pauseAsync();
                } else {
                    await sound.playAsync();
                }
            }
        } catch {
            Alert.alert('Error', 'Playback failed.');
        }
    };

    // Cleanup
    useEffect(() => {
        return () => {
            if (sound) sound.unloadAsync();
            // if (recTimer.current) clearInterval(recTimer.current);
        };
    }, [sound]);

    const formatSec = (ms: number) => {
        return Math.round(ms / 1000).toString() + ' s';
    };

    const handleSubmit = async () => {
        const chosen = challengeOptions
            .filter((opt) => selections[opt.key])
            .map((opt) => opt.label);

        if (chosen.length === 0 && !noteText && !audioUri) {
            Alert.alert('Please select at least one option.');
            return;
        }

        router.push({
            pathname: '/upload',
            params: {
                challenges: JSON.stringify(chosen),
                note: noteText,
                audio: audioUri ?? '',
            },
        });
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.question}>Which challenges do your loved ones face?</Text>
            <Text style={styles.subtitle}>
                It's okay if you're not sure. We'll find anything you might miss.
            </Text>
            {challengeOptions.map((opt) => (
                <View key={opt.key} style={styles.optionRow}>
                    <Checkbox
                        value={!!selections[opt.key]}
                        onValueChange={() => toggleOption(opt.key)}
                    />
                    <Text style={styles.optionLabel}>{opt.label}</Text>
                </View>
            ))}

            <Text style={styles.sectionHeader}>Additional notes</Text>
            <TextInput
                style={styles.textInput}
                placeholder="e.g. They often fall when entering the bathroom…"
                multiline
                value={noteText}
                onChangeText={setNoteText}
            />

            <Text style={styles.sectionHeader}>Voice note</Text>
            <View style={styles.audioControlsRow}>
                {/* Record / Re-record */}
                <TouchableOpacity
                    onPress={recording ? stopRecording : startRecording}
                    style={styles.controlButton}
                >
                    <Ionicons
                        name={recording ? 'stop-circle' : 'mic-circle'}
                        size={48}
                        color={recording ? '#e74c3c' : '#2c3e50'}
                    />
                </TouchableOpacity>

                {/* Play / Pause */}
                {audioUri && !recording && (
                    <TouchableOpacity onPress={togglePlayback} style={styles.controlButton}>
                        <Ionicons
                            name={isPlaying ? 'pause-circle' : 'play-circle'}
                            size={48}
                            color="#2c3e50"
                        />
                    </TouchableOpacity>
                )}
            </View>

            {/* Show timing info */}
            {recording ? (
                <Text style={styles.durationText}>Recording: {formatSec(recPosition)}</Text>
            ) : audioUri ? (
                <Text style={styles.durationText}>Recorded: {formatSec(duration)}</Text>
            ) : null}

            {isProcessing ? (
                <View style={styles.processingContainer}>
                    <ActivityIndicator size="small" color="#007aff" />
                    <Text style={styles.processingText}>Processing audio…</Text>
                </View>
            ) : (
                problems.length > 0 && (
                    <View style={styles.resultsBox}>
                        <Text style={styles.resultsHeader}>Key concerns:</Text>
                        {problems.map((p, i) => (
                            <Text key={i} style={styles.bullet}>
                                • {p}
                            </Text>
                        ))}
                    </View>
                )
            )}

            <View style={styles.buttonContainer}>
                <Button title="Continue" onPress={handleSubmit} />
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 20 },
    question: { fontSize: 24, fontWeight: '600', marginBottom: 8 },
    subtitle: { fontSize: 16, color: '#555', marginBottom: 16 },
    optionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    optionLabel: { marginLeft: 8, fontSize: 16 },
    sectionHeader: { fontSize: 18, fontWeight: '500', marginTop: 20, marginBottom: 8 },
    textInput: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 6,
        padding: 8,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    audioControlsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 12,
    },
    controlButton: {
        marginHorizontal: 16,
    },
    durationText: { textAlign: 'center', fontSize: 14, color: '#555', marginBottom: 16 },
    buttonContainer: { marginTop: 24, alignItems: 'center' },
    processingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 12,
    },
    processingText: {
        marginLeft: 8,
        fontSize: 16,
        color: '#007aff',
    },
    resultsBox: {
        marginTop: 24,
        padding: 16,
        backgroundColor: '#fafafa',
        borderRadius: 8,
    },
    resultsHeader: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    bullet: { fontSize: 16, marginVertical: 4 },
});
