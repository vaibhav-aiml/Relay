import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Header } from '../components/Header';
import { ShieldCheck, Mail, Calendar, Users, Globe, ExternalLink, Trash2 } from 'lucide-react-native';
import { ApiService } from '../services/api';
import { useAppStore } from '../store/useAppStore';

export default function ConnectionsScreen() {
  const { connections, fetchConnections } = useAppStore();
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    fetchConnections();
  }, []);

  const googleConn = connections.find((c) => c.provider === 'google' && c.status === 'active');

  const handleConnectGoogle = async () => {
    setConnecting(true);
    try {
      const { authUrl } = await ApiService.getGoogleAuthUrl();
      if (authUrl) {
        await Linking.openURL(authUrl);
      }
    } catch (err) {
      console.warn('Failed to get Google OAuth URL:', err);
    } finally {
      setConnecting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    await ApiService.revokeConnection(id);
    fetchConnections();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Integrations" subtitle="External Workspace Connections" />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Security Shield Banner */}
        <View style={styles.securityBox}>
          <ShieldCheck size={20} color="#10b981" />
          <View style={{ flex: 1 }}>
            <Text style={styles.securityTitle}>Zero Client Secret Exposure</Text>
            <Text style={styles.securityDesc}>
              All OAuth refresh tokens are encrypted using AES-256-GCM at rest on the backend. No credentials ever touch the mobile device.
            </Text>
          </View>
        </View>

        {/* Google Workspace Integration Card */}
        <View style={styles.integrationCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardLeft}>
              <View style={styles.googleIconBox}>
                <Globe size={22} color="#6366f1" />
              </View>
              <View>
                <Text style={styles.providerName}>Google Workspace</Text>
                <Text style={styles.providerScopes}>Gmail • Calendar • Contacts</Text>
              </View>
            </View>

            <View style={[styles.statusPill, googleConn ? styles.statusActive : styles.statusInactive]}>
              <Text style={[styles.statusPillText, googleConn ? styles.statusActiveText : styles.statusInactiveText]}>
                {googleConn ? 'CONNECTED' : 'DISCONNECTED'}
              </Text>
            </View>
          </View>

          {/* Capabilities List */}
          <View style={styles.capabilitiesList}>
            <View style={styles.capabilityItem}>
              <Mail size={16} color="#94a3b8" />
              <Text style={styles.capabilityText}>Gmail: Search, Read, Draft, Send (Confirmed)</Text>
            </View>
            <View style={styles.capabilityItem}>
              <Calendar size={16} color="#94a3b8" />
              <Text style={styles.capabilityText}>Calendar: Free/Busy availability, Book meetings</Text>
            </View>
            <View style={styles.capabilityItem}>
              <Users size={16} color="#94a3b8" />
              <Text style={styles.capabilityText}>Contacts: Name & Email autocomplete</Text>
            </View>
          </View>

          {/* Action button */}
          {googleConn ? (
            <TouchableOpacity style={styles.revokeBtn} onPress={() => handleRevoke(googleConn.id)}>
              <Trash2 size={16} color="#ef4444" />
              <Text style={styles.revokeBtnText}>Revoke Google Access</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.connectBtn}
              onPress={handleConnectGoogle}
              disabled={connecting}
            >
              {connecting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <ExternalLink size={16} color="#ffffff" />
                  <Text style={styles.connectBtnText}>Connect Google Account</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090a0f',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  securityBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    marginBottom: 20,
  },
  securityTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 3,
  },
  securityDesc: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 17,
  },
  integrationCard: {
    backgroundColor: '#111726',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  googleIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  providerScopes: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusActiveText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '800',
  },
  statusInactive: {
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
  },
  statusInactiveText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
  },
  capabilitiesList: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    marginBottom: 16,
  },
  capabilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  capabilityText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 10,
  },
  connectBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  revokeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingVertical: 12,
    borderRadius: 10,
  },
  revokeBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
});
