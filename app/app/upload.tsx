// app/upload.tsx
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ScrollView,
    Button,
    Alert,
    Platform,
    ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { Buffer } from 'buffer';
import JSZip from 'jszip';

// const API_URL = 'http://10.100.2.90:8000/analyze/';
const API_URL = 'https://5271-164-67-70-232.ngrok-free.app';

export default function Upload() {
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const router = useRouter();

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission required', 'Permission to access media library is required!');
            return;
        }
        // const result = await ImagePicker.launchCameraAsync({
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.8,
        });
        if (!result.canceled) {
            setImageUri(result.assets[0].uri);
        }
    };

    const handleSubmit = async () => {
        if (!imageUri) {
            Alert.alert('Please add a photo before continuing.');
            return;
        }
        setUploading(true);

        // 1) Upload the image and get back the ZIP as arraybuffer
        const formData = new FormData();
        formData.append('file', {
            uri: imageUri,
            name: 'photo.jpg',
            filename: 'photo.jpg',
            type: 'image/jpeg',
        } as any);

        console.log('Form data:');
        console.log(formData);

        // Make API request to "/analyze"
        console.log('Starting try block');
        try {
            console.log('Making API request to /analyze');
            console.log('API_URL: ' + API_URL);
            console.log('Endpoint: ' + `${API_URL}/analyze/`);
            // const response = await axios.get(`${API_URL}/analyze`);
            // console.log('Received response');
            // console.log(response);

            const response = await axios.post(`${API_URL}/analyze/`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Accept: 'application/zip',
                },
                responseType: 'arraybuffer',
            });
            console.log('Received response');

            // 2) Write the raw ZIP to disk
            const base64data = Buffer.from(response.data, 'binary').toString('base64');
            const zipUri = FileSystem.documentDirectory + 'results.zip';
            await FileSystem.writeAsStringAsync(zipUri, base64data, {
                encoding: FileSystem.EncodingType.Base64,
            });

            // 3) Parse the ZIP in-memory to count how many bb_image_*.png you have
            const zip = await JSZip.loadAsync(response.data);
            const imageEntries = Object.keys(zip.files).filter((f) =>
                f.match(/^bb_image_\d+\.png$/)
            );
            const total = imageEntries.length;

            // 4) Navigate to the first results page
            router.push({
                pathname: '/improvements/[idx]',
                params: {
                    idx: '1', // start at 1
                    total: total.toString(),
                    zipUri: zipUri, // pass along your zip location
                    saved: '', // empty string as nothing saved yet
                },
            });
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Upload or download failed.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.heading}>Add a photo of one area of their home</Text>
            <TouchableOpacity style={styles.photoBox} onPress={pickImage}>
                {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.photo} />
                ) : (
                    <Ionicons name="camera" size={48} color="#888" />
                )}
            </TouchableOpacity>

            <View style={styles.tipsBox}>
                <Text style={styles.tipsTitle}>Tips</Text>
                {[
                    'Start with the bedroom, bathroom, or hallway',
                    'Try showing floors, walls, and paths clearly',
                    "Good lighting helps, but don't worry if it's not perfect",
                    'You can retake or add more photos later if needed',
                ].map((tip, idx) => (
                    <View key={idx} style={styles.bulletRow}>
                        <Text style={styles.bullet}>{'•'}</Text>
                        <Text style={styles.tipText}>{tip}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.buttonContainer}>
                <Button
                    title={uploading ? 'Processing...' : 'See improvements'}
                    onPress={handleSubmit}
                    disabled={uploading}
                />
                {uploading && <ActivityIndicator style={styles.loader} />}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 20 },
    heading: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
    photoBox: {
        height: 200,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        overflow: 'hidden',
    },
    photo: { width: '100%', height: '100%', resizeMode: 'cover' },
    tipsBox: { padding: 16, backgroundColor: '#fafafa', borderRadius: 8, marginBottom: 24 },
    tipsTitle: { fontSize: 18, fontWeight: '500', marginBottom: 8 },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
    bullet: { fontSize: 14, lineHeight: 20, marginRight: 6 },
    tipText: { flex: 1, fontSize: 14, lineHeight: 20 },
    buttonContainer: { alignItems: 'center', marginBottom: Platform.OS === 'ios' ? 30 : 0 },
    loader: { marginTop: 10 },
});
