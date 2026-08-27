import '../polyfills';
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Home, History, Clock, Settings } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import { MobileNotificationService } from '../services/notifications';
import { useAppStore } from '../store/useAppStore';

export default function RootLayout() {
  const router = useRouter();
  const lastNotificationResponse = Notifications.useLastNotificationResponse();
  const { submitApproval, checkPushPermission } = useAppStore();
  const responseListener = useRef<any>(null);

  // 1. Cold-start notification handling
  useEffect(() => {
    if (lastNotificationResponse) {
      MobileNotificationService.handleNotificationResponse(
        lastNotificationResponse,
        router,
        async (approvalId, decision) => {
          await submitApproval(approvalId, decision);
        }
      );
    }
  }, [lastNotificationResponse]);

  // 2. Setup channels, categories, and live notification response listener
  useEffect(() => {
    MobileNotificationService.setupChannelsAndCategories().catch(console.warn);
    checkPushPermission().catch(console.warn);

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      MobileNotificationService.handleNotificationResponse(
        response,
        router,
        async (approvalId, decision) => {
          await submitApproval(approvalId, decision);
        }
      );
    });

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: '#6366f1',
          tabBarInactiveTintColor: '#64748b',
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => <Home size={size || 20} color={color} />,
          }}
        />
        <Tabs.Screen
          name="schedules"
          options={{
            title: 'Routines',
            tabBarIcon: ({ color, size }) => <Clock size={size || 20} color={color} />,
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ color, size }) => <History size={size || 20} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => <Settings size={size || 20} color={color} />,
          }}
        />
        <Tabs.Screen
          name="connections"
          options={{
            href: null, // Hidden from bottom tabs (accessible via Settings)
          }}
        />
        <Tabs.Screen
          name="task/[id]"
          options={{
            href: null, // Hidden from bottom tabs, navigated directly
          }}
        />
      </Tabs>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090a0f',
  },
  tabBar: {
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 6,
    paddingBottom: 8,
    height: 60,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
