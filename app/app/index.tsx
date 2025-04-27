// app/index.tsx
import React from 'react';
import { View, Text, Button, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';

export default function Index() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <Image source={require('./assessable_logo.png')} style={styles.logo} />
            <Text style={styles.title}>Welcome to AssessAble</Text>
            <Text style={styles.subtitle}>Let's identify the challenges your loved ones face.</Text>
            <Button title="Let's Start!" onPress={() => router.push('/query')} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    logo: {
        width: 240,
        height: 120,
        // marginBottom: 24,
        resizeMode: 'contain',
    },
    title: {
        fontSize: 28,
        fontWeight: '600',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 24,
    },
});
