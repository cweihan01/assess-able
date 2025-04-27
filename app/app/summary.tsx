// app/summary.tsx
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    Button,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { WebView } from 'react-native-webview';

const API_URL = 'https://5271-164-67-70-232.ngrok-free.app';

export default function Summary() {
    const { saved: savedParam } = useLocalSearchParams();
    const router = useRouter();
    const saved = Array.isArray(savedParam) ? savedParam.join(',') : savedParam ?? '';

    const [loading, setLoading] = useState(true);
    const [reportUri, setReportUri] = useState<string | null>(null);
    const [previewUri, setPreviewUri] = useState<string | null>(null);

    const generate = async () => {
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('indexes', saved);

            const resp = await axios.post(`${API_URL}/generate_report/`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Accept: 'application/pdf',
                },
                responseType: 'arraybuffer',
            });

            // correctly convert ArrayBuffer → base64
            const b64 = Buffer.from(new Uint8Array(resp.data)).toString('base64');
            const path = FileSystem.documentDirectory + 'home_safety_report.pdf';

            await FileSystem.writeAsStringAsync(path, b64, {
                encoding: FileSystem.EncodingType.Base64,
            });

            setReportUri(path);

            if (Platform.OS === 'android') {
                // get content:// URI so WebView can load it
                const contentUri = await FileSystem.getContentUriAsync(path);
                setPreviewUri(contentUri);
            } else {
                // on iOS the file:// URI works fine
                setPreviewUri(path);
            }
        } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Could not generate report.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!saved) {
            Alert.alert('No selections to report on.');
            router.replace('/');
            return;
        }
        generate();
    }, [saved]);

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" />
                <Text style={styles.loadingText}>Generating your report…</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Your Safety Report</Text>

            {/* {previewUri ? (
                <View style={styles.previewContainer}>
                    <WebView
                        source={{ uri: previewUri }}
                        style={styles.webview}
                        originWhitelist={['*']}
                        onError={(e) => {
                            console.error(e);
                            // Alert.alert('Error', 'Could not display PDF preview.');
                        }}
                    />
                </View>
            ) : (
                <Text style={styles.errorText}>Failed to load preview.</Text>
            )} */}

            {reportUri && (
                <Button
                    title="Open in External Viewer"
                    onPress={async () => {
                        try {
                            if (Platform.OS === 'android') {
                                const cu = await FileSystem.getContentUriAsync(reportUri);
                                Linking.openURL(cu);
                            } else {
                                Linking.openURL(reportUri);
                            }
                        } catch (err) {
                            console.error(err);
                            Alert.alert('Error', 'Could not open report.');
                        }
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: { marginTop: 12, fontSize: 16, color: '#555' },
    container: { flex: 1, padding: 20 },
    header: {
        fontSize: 24,
        fontWeight: '600',
        marginBottom: 16,
        textAlign: 'center',
    },
    previewContainer: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ccc',
        marginBottom: 12,
        borderRadius: 8,
        overflow: 'hidden',
    },
    webview: { flex: 1 },
    errorText: { color: 'red', textAlign: 'center' },
});
