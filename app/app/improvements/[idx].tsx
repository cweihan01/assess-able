// app/improvements/[idx].tsx
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    Image,
    ScrollView,
    Button,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import JSZip from 'jszip';
import { Buffer } from 'buffer';

export default function ImprovementDetail() {
    // Grab the params from the route: zip URI, total count, and current idx
    const { zipUri, total: totalStr, idx: idxStr } = useLocalSearchParams();
    const router = useRouter();
    const idx = parseInt(idxStr as string, 10);
    const total = parseInt(totalStr as string, 10);

    // Local state for each page's content
    const [bbImage, setBbImage] = useState<string | null>(null);
    const [modImage, setModImage] = useState<string | null>(null);
    const [recommendation, setRecommendation] = useState<string>('');
    const [rationale, setRationale] = useState<string>('');
    const [cost, setCost] = useState<string>('');
    const [installation, setInstallation] = useState<string>('');

    const [loading, setLoading] = useState(true);
    const [previewMode, setPreviewMode] = useState(false);

    useEffect(() => {
        async function loadZipContents() {
            try {
                console.log('Loading zip contents...');
                console.log('zipUri:', zipUri);

                // 1) read base64 zip from disk
                const base64 = await FileSystem.readAsStringAsync(zipUri as string, {
                    encoding: FileSystem.EncodingType.Base64,
                });

                // 2) load zip
                const zip = await JSZip.loadAsync(Buffer.from(base64, 'base64'));
                console.log('Files inside zipfile:');
                // This print statement does not work for json - RangeError: property storage
                // console.log(zip.files);

                // 3) pull out each piece
                const bbKey = `bb_image_${idx}.png`;
                const modKey = `mod_image_${idx}.png`;
                const textKey = `text_${idx}.json`;

                // image parts as base64 URIs
                const bbBase64 = await zip.file(bbKey)!.async('base64');
                const modBase64 = await zip.file(modKey)!.async('base64');

                // text parts
                const jsonStr = await zip.file(textKey)!.async('string');
                const parsed = JSON.parse(jsonStr);

                setBbImage(`data:image/png;base64,${bbBase64}`);
                setModImage(`data:image/png;base64,${modBase64}`);
                setRecommendation(parsed.modification.trim());
                setRationale(parsed.rationale.trim());
                setCost(parsed.cost);
                setInstallation(parsed.installation);
            } catch (e) {
                console.error(e);
                Alert.alert('Error', 'Failed to load modification data.');
            } finally {
                setLoading(false);
            }
        }
        loadZipContents();
    }, [idx, zipUri]);

    const goNext = () => {
        if (idx < total) {
            router.push({
                pathname: '/improvements/[idx]',
                params: {
                    idx: idx + 1, // move to next image
                    total: total.toString(),
                    zipUri, // pass along zip file location
                },
            });
        } else {
            Alert.alert('All done!', 'You’ve reviewed all improvements.');
            router.replace('/'); // back to home
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.header}>Improvements identified</Text>
            <Text style={styles.subheader}>
                {idx} of {total} improvements
            </Text>

            {!previewMode ? (
                // — Recommendation screen —
                <>
                    {bbImage && <Image source={{ uri: bbImage }} style={styles.imageFull} />}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Recommendation</Text>
                        <Text style={styles.recommendationText}>{recommendation}</Text>

                        <View style={styles.section}>
                            <Text style={styles.sectionHeader}>Why:</Text>
                            <Text style={styles.sectionText}>{rationale}</Text>
                        </View>
                        <View style={styles.section}>
                            <Text style={styles.sectionHeader}>Cost:</Text>
                            <Text style={styles.sectionText}>{cost}</Text>
                        </View>
                        <View style={styles.section}>
                            <Text style={styles.sectionHeader}>Installation:</Text>
                            <Text style={styles.sectionText}>{installation}</Text>
                        </View>
                    </View>

                    <View style={styles.buttonsRow}>
                        <Button title="Not now" onPress={goNext} />
                        <Button title="Show me" onPress={() => setPreviewMode(true)} />
                    </View>
                </>
            ) : (
                // — Preview screen —
                <>
                    {modImage && <Image source={{ uri: modImage }} style={styles.imageFull} />}
                    <View style={styles.buttonsRow}>
                        <Button title="Back" onPress={() => setPreviewMode(false)} />
                        <Button title="Discard" onPress={goNext} />
                        <Button title="Save" onPress={goNext} />
                    </View>
                </>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 20 },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: { fontSize: 24, fontWeight: '600' },
    subheader: { fontSize: 14, color: '#666', marginBottom: 16 },
    imageFull: {
        width: '100%',
        height: 250,
        resizeMode: 'cover',
        marginBottom: 16,
        borderRadius: 8,
    },
    card: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 8,
        marginBottom: 24,
        // drop shadow for iOS / Android
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: { elevation: 3 },
        }),
    },
    cardTitle: { fontSize: 18, fontWeight: '500', marginBottom: 8 },
    recommendationText: { fontSize: 16, marginBottom: 12 },
    section: { marginBottom: 12 },
    sectionHeader: { fontSize: 16, fontWeight: '500', marginBottom: 4 },
    sectionText: { fontSize: 14, color: '#333' },
    buttonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
});
