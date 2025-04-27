// app/query.tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Button, Alert } from 'react-native';
import Checkbox from 'expo-checkbox';
import { useRouter } from 'expo-router';

// Define the options
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
    const router = useRouter();

    const toggleOption = (key: string) => {
        setSelections((prev) => {
            const newState = { ...prev, [key]: !prev[key] };
            if (key === 'none' && !prev.none) {
                // selecting none: clear all others
                challengeOptions.forEach((opt) => {
                    if (opt.key !== 'none') newState[opt.key] = false;
                });
            } else if (key !== 'none' && prev.none) {
                // selecting any option deselects none
                newState.none = false;
            }
            return newState;
        });
    };

    const handleSubmit = () => {
        const chosen = challengeOptions
            .filter((opt) => selections[opt.key])
            .map((opt) => opt.label);
        if (chosen.length === 0) {
            Alert.alert('Please select at least one option.');
            return;
        }
        const payload = {
            challenges: chosen,
            timestamp: new Date().toISOString(),
        };
        console.log('Submitting payload:', payload);
        // Alert.alert('Thanks!', 'Your choices have been recorded.');
        router.push('/upload');
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.question}>Which challenges do your loved ones face?</Text>
            <Text style={styles.subtitle}>
                It's okay if you're not sure. We'll find anything you might miss.
            </Text>
            <View style={styles.optionsContainer}>
                {challengeOptions.map((opt) => (
                    <View key={opt.key} style={styles.optionRow}>
                        <Checkbox
                            value={!!selections[opt.key]}
                            onValueChange={() => toggleOption(opt.key)}
                        />
                        <Text style={styles.optionLabel}>{opt.label}</Text>
                    </View>
                ))}
            </View>
            <View style={styles.buttonContainer}>
                <Button title="Upload photos" onPress={handleSubmit} />
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
    },
    question: {
        fontSize: 24,
        fontWeight: '600',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#555',
        marginBottom: 16,
    },
    optionsContainer: {
        marginBottom: 24,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    optionLabel: {
        marginLeft: 8,
        fontSize: 16,
    },
    buttonContainer: {
        alignItems: 'center',
    },
});
