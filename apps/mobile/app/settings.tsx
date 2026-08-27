import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { Brain, Cpu, Volume2, Plus, Trash2, ShieldAlert, Users, RefreshCw, Globe, ExternalLink, ShieldCheck, Clock, Bell, BellRing, CheckCircle2, AlertCircle, Send, Check, Play } from 'lucide-react-native';
import { Linking, ActivityIndicator } from 'react-native';
import { Header } from '../components/Header';
import { useAppStore } from '../store/useAppStore';
import { ApiService } from '../services/api';
import { TTSService, TTSSettings } from '../services/tts';
import * as Speech from 'expo-speech';


export default function SettingsScreen() {
  const {
    memories,
    fetchMemories,
    addMemory,
    deleteMemory,
    syncedContacts,
    fetchSyncedContacts,
    syncDeviceContacts,
    clearSyncedContacts,
    isSyncingContacts,
    connections,
    fetchConnections,
    pushToken,
    pushPermissionStatus,
    isRegisteringPush,
    checkPushPermission,
    requestPushPermissionAndRegister,
    sendTestPushNotification,
    ttsEnabled,
    toggleTTS,
  } = useAppStore();

  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [ttsSettings, setTtsSettings] = useState<TTSSettings>(TTSService.getSettings());
  const [availableVoices, setAvailableVoices] = useState<Speech.Voice[]>([]);
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

  useEffect(() => {
    fetchMemories();
    fetchSyncedContacts();
    fetchConnections();
    checkPushPermission();
    TTSService.init().then(setTtsSettings);
    TTSService.getAvailableVoices().then(setAvailableVoices);
  }, []);

  const handleUpdateTtsSettings = async (updates: Partial<TTSSettings>) => {
    const next = await TTSService.saveSettings(updates);
    setTtsSettings(next);
  };

  const handleTestVoice = async () => {
    if (isTestingVoice) return;
    setIsTestingVoice(true);
    try {
      await TTSService.speak(
        'Hello! Relay is ready to speak autonomous mission updates and confirmations back to you.',
        {
          rate: ttsSettings.rate,
          pitch: ttsSettings.pitch,
          voiceId: ttsSettings.voiceId,
        }
      );
    } catch (err) {
      console.warn('Voice test failed:', err);
    } finally {
      setIsTestingVoice(false);
    }
  };

  const googleConn = connections.find((c) => c.provider === 'google' && c.status === 'active');

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    try {
      const { authUrl } = await ApiService.getGoogleAuthUrl();
      if (authUrl) {
        await Linking.openURL(authUrl);
      }
    } catch (err) {
      console.warn('Failed to get Google OAuth URL:', err);
    } finally {
      setConnectingGoogle(false);
    }
  };

  const handleRevokeGoogle = async (id: string) => {
    await ApiService.revokeConnection(id);
    fetchConnections();
  };

  const handleAddPreference = async () => {
    if (!newKey.trim() || !newValue.trim()) return;
    await addMemory(newKey.trim(), newValue.trim(), 'preference');
    setNewKey('');
    setNewValue('');
  };

  const handleEnablePush = async () => {
    const res = await requestPushPermissionAndRegister();
    if (res.success) {
      Alert.alert('Push Notifications Enabled', 'Relay will now send real-time action sign-offs and background routine alerts.');
    } else {
      Alert.alert('Permission Denied', res.error || 'Could not enable push notifications. Please check your system notification settings.');
    }
  };

  const handleSendTestAlert = async () => {
    setIsSendingTestPush(true);
    try {
      await sendTestPushNotification();
      Alert.alert('Test Notification Sent', 'A test approval alert with [Approve] / [Reject] buttons has been delivered.');
    } catch (err: any) {
      Alert.alert('Test Failed', err.message || 'Failed to dispatch test notification.');
    } finally {
      setIsSendingTestPush(false);
    }
  };

  const handleManualSyncContacts = async () => {
    const res = await syncDeviceContacts(true);
    if (res.success) {
      Alert.alert('Contacts Synced', `Successfully synced ${res.count} contacts from your device.`);
    } else {
      Alert.alert('Sync Failed', res.error || 'Could not access device contacts. Please ensure permissions are granted.');
    }
  };

  const handleClearContacts = () => {
    Alert.alert(
      'Clear Synced Contacts',
      'Are you sure you want to remove all synced device contacts from Relay?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Contacts',
          style: 'destructive',
          onPress: async () => {
            await clearSyncedContacts();
            Alert.alert('Cleared', 'Synced contacts have been removed.');
          },
        },
      ]
    );
  };

  const handlePurgeAll = () => {
    Alert.alert(
      'Purge All Stored Data',
      'This will delete all saved memories, preferences, and session data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purge All',
          style: 'destructive',
          onPress: async () => {
            await ApiService.purgeAllMemories();
            fetchMemories();
            Alert.alert('Purged', 'All stored memories and preferences have been cleared.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Settings" subtitle="Preferences & Workspace Integrations" />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Google Workspace & Integrations Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Globe size={18} color="#6366f1" />
            <Text style={styles.sectionTitle}>Workspace Integrations</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Connect your Google account to empower Relay to autonomously read emails, check calendars, and resolve contacts.
          </Text>

          <View style={styles.googleBox}>
            <View style={styles.googleHeader}>
              <View style={styles.googleLeft}>
                <View style={styles.googleIconBox}>
                  <Globe size={20} color="#6366f1" />
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

            {googleConn ? (
              <TouchableOpacity style={styles.revokeBtn} onPress={() => handleRevokeGoogle(googleConn.id)}>
                <Trash2 size={14} color="#ef4444" />
                <Text style={styles.revokeBtnText}>Revoke Google Access</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.connectBtn}
                onPress={handleConnectGoogle}
                disabled={connectingGoogle}
              >
                {connectingGoogle ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <ExternalLink size={14} color="#ffffff" />
                    <Text style={styles.connectBtnText}>Connect Google Account</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Push Notifications & Background Alerts */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <BellRing size={18} color="#6366f1" />
            <Text style={styles.sectionTitle}>Push Notifications & Action Alerts</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Receive real-time alerts when Relay requires your sign-off on sensitive actions or finishes background execution.
          </Text>

          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Notification Delivery</Text>
              <Text style={styles.settingSub}>
                {pushPermissionStatus === 'granted'
                  ? 'Real-time approval buttons & routine alerts active'
                  : 'Push permissions are currently disabled'}
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                pushPermissionStatus === 'granted' ? styles.statusActive : styles.statusInactive,
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  pushPermissionStatus === 'granted' ? styles.statusActiveText : styles.statusInactiveText,
                ]}
              >
                {pushPermissionStatus === 'granted' ? 'ENABLED' : 'DISABLED'}
              </Text>
            </View>
          </View>

          {pushPermissionStatus === 'granted' ? (
            <View style={styles.pushActionsBox}>
              <View style={styles.pushTokenRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tokenLabel}>Push Channel & Token</Text>
                  <Text style={styles.tokenValue} numberOfLines={1} ellipsizeMode="middle">
                    {pushToken || 'ExponentPushToken[active]'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.testPushBtn}
                onPress={handleSendTestAlert}
                disabled={isSendingTestPush}
              >
                {isSendingTestPush ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Send size={14} color="#ffffff" />
                    <Text style={styles.testPushBtnText}>Send Test Push Alert</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.connectBtn}
              onPress={handleEnablePush}
              disabled={isRegisteringPush}
            >
              {isRegisteringPush ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Bell size={14} color="#ffffff" />
                  <Text style={styles.connectBtnText}>Enable Push Alerts</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Model & Timezone Configuration */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Cpu size={18} color="#6366f1" />
            <Text style={styles.sectionTitle}>Agent Configuration</Text>
          </View>

          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Primary AI Provider</Text>
              <Text style={styles.settingSub}>Groq (Llama 3.3 70B Versatile)</Text>
            </View>
            <View style={styles.pillBadge}>
              <Text style={styles.pillText}>ACTIVE</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Clock size={16} color="#38bdf8" />
              <View>
                <Text style={styles.settingLabel}>Routine Timezone</Text>
                <Text style={styles.settingSub}>{detectedTimezone}</Text>
              </View>
            </View>
            <View style={[styles.pillBadge, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
              <Text style={[styles.pillText, { color: '#38bdf8' }]}>DETECTED</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Master Voice Readout (TTS) Toggle */}
          <View style={styles.settingRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <Volume2 size={16} color="#94a3b8" />
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Voice Readout (TTS)</Text>
                <Text style={styles.settingSub}>Speak verified answers and confirmations using on-device speech</Text>
              </View>
            </View>
            <Switch
              value={ttsEnabled}
              onValueChange={toggleTTS}
              trackColor={{ false: '#334155', true: '#6366f1' }}
              thumbColor="#ffffff"
            />
          </View>

          {/* Sub-controls when TTS is enabled */}
          {ttsEnabled && (
            <View style={styles.ttsConfigBox}>
              {/* Speech Rate Controls */}
              <View style={styles.ttsOptionRow}>
                <Text style={styles.ttsOptionLabel}>Speech Speed</Text>
                <View style={styles.ttsPillGroup}>
                  {[0.8, 1.0, 1.2, 1.5].map((rate) => (
                    <TouchableOpacity
                      key={rate}
                      style={[
                        styles.ttsPill,
                        ttsSettings.rate === rate && styles.ttsPillActive,
                      ]}
                      onPress={() => handleUpdateTtsSettings({ rate })}
                    >
                      <Text
                        style={[
                          styles.ttsPillText,
                          ttsSettings.rate === rate && styles.ttsPillTextActive,
                        ]}
                      >
                        {rate}x
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Speech Pitch Controls */}
              <View style={styles.ttsOptionRow}>
                <Text style={styles.ttsOptionLabel}>Voice Pitch</Text>
                <View style={styles.ttsPillGroup}>
                  {[0.8, 1.0, 1.2].map((pitch) => (
                    <TouchableOpacity
                      key={pitch}
                      style={[
                        styles.ttsPill,
                        ttsSettings.pitch === pitch && styles.ttsPillActive,
                      ]}
                      onPress={() => handleUpdateTtsSettings({ pitch })}
                    >
                      <Text
                        style={[
                          styles.ttsPillText,
                          ttsSettings.pitch === pitch && styles.ttsPillTextActive,
                        ]}
                      >
                        {pitch === 0.8 ? 'Low' : pitch === 1.0 ? 'Normal' : 'High'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Sub-Toggles for Results and Approvals */}
              <View style={styles.ttsSubToggleRow}>
                <Text style={styles.ttsSubToggleLabel}>Speak Task Summaries</Text>
                <Switch
                  value={ttsSettings.autoSpeakResults}
                  onValueChange={(val) => handleUpdateTtsSettings({ autoSpeakResults: val })}
                  trackColor={{ false: '#334155', true: '#818cf8' }}
                  thumbColor="#ffffff"
                />
              </View>

              <View style={styles.ttsSubToggleRow}>
                <Text style={styles.ttsSubToggleLabel}>Speak Approval Prompts</Text>
                <Switch
                  value={ttsSettings.autoSpeakApprovals}
                  onValueChange={(val) => handleUpdateTtsSettings({ autoSpeakApprovals: val })}
                  trackColor={{ false: '#334155', true: '#818cf8' }}
                  thumbColor="#ffffff"
                />
              </View>

              {/* Device Voice Selector (if available) */}
              {availableVoices.length > 0 && (
                <View style={{ marginTop: 4 }}>
                  <Text style={styles.ttsOptionLabel}>Available Voices ({availableVoices.length})</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.voiceListScroll}>
                    <TouchableOpacity
                      style={[
                        styles.voicePill,
                        !ttsSettings.voiceId && styles.voicePillActive,
                      ]}
                      onPress={() => handleUpdateTtsSettings({ voiceId: undefined })}
                    >
                      <Text style={[styles.voicePillText, !ttsSettings.voiceId && styles.voicePillTextActive]}>
                        System Default
                      </Text>
                    </TouchableOpacity>
                    {availableVoices.slice(0, 8).map((v) => (
                      <TouchableOpacity
                        key={v.identifier}
                        style={[
                          styles.voicePill,
                          ttsSettings.voiceId === v.identifier && styles.voicePillActive,
                        ]}
                        onPress={() => handleUpdateTtsSettings({ voiceId: v.identifier })}
                      >
                        <Text
                          style={[
                            styles.voicePillText,
                            ttsSettings.voiceId === v.identifier && styles.voicePillTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {v.name} ({v.language})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Load-bearing Test Voice Button */}
              <TouchableOpacity
                style={[styles.testVoiceBtn, isTestingVoice && styles.testVoiceBtnActive]}
                onPress={handleTestVoice}
                disabled={isTestingVoice}
              >
                {isTestingVoice ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Play size={14} color="#ffffff" fill="#ffffff" />
                    <Text style={styles.testVoiceBtnText}>Test Spoken Voice</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* User Memory & Scheduling Preferences */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Brain size={18} color="#10b981" />
            <Text style={styles.sectionTitle}>Learned Preferences & Memories</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Relay remembers your scheduling habits, food preferences, and contacts to customize execution.
          </Text>

          {/* Existing Memories */}
          {memories.map((m) => (
            <View key={m.id} style={styles.memoryItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.memoryKey}>{m.key}</Text>
                <Text style={styles.memoryVal}>{m.value}</Text>
              </View>
              <TouchableOpacity onPress={() => deleteMemory(m.id)} style={styles.deleteMemoryBtn}>
                <Trash2 size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}

          {/* Add Preference Input */}
          <View style={styles.addMemoryBox}>
            <TextInput
              style={styles.inputField}
              placeholder="Key (e.g. usual_coffee)"
              placeholderTextColor="#64748b"
              value={newKey}
              onChangeText={setNewKey}
            />
            <TextInput
              style={styles.inputField}
              placeholder="Preference (e.g. Cold Coffee with extra ice from Starbucks)"
              placeholderTextColor="#64748b"
              value={newValue}
              onChangeText={setNewValue}
            />
            <TouchableOpacity style={styles.addBtn} onPress={handleAddPreference}>
              <Plus size={16} color="#ffffff" />
              <Text style={styles.addBtnText}>Save Preference</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Device Contacts & Phonebook */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Users size={18} color="#38bdf8" />
            <Text style={styles.sectionTitle}>Device Contacts</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Allow Relay to resolve contact names to phone numbers directly from your device address book.
          </Text>

          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Synced Contacts</Text>
              <Text style={styles.settingSub}>
                {syncedContacts.length > 0
                  ? `${syncedContacts.length} contacts available for calling & WhatsApp`
                  : 'No contacts synced yet'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.syncBtn, isSyncingContacts && styles.btnDisabled]}
              onPress={handleManualSyncContacts}
              disabled={isSyncingContacts}
            >
              <RefreshCw size={14} color="#ffffff" />
              <Text style={styles.syncBtnText}>
                {isSyncingContacts ? 'Syncing...' : 'Sync Contacts'}
              </Text>
            </TouchableOpacity>
          </View>

          {syncedContacts.length > 0 && (
            <TouchableOpacity
              style={styles.clearContactsBtn}
              onPress={handleClearContacts}
              disabled={isSyncingContacts}
            >
              <Trash2 size={14} color="#f87171" />
              <Text style={styles.clearContactsBtnText}>Clear Synced Contacts</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Privacy & Data Purge */}
        <View style={[styles.sectionCard, { borderColor: 'rgba(239, 68, 68, 0.25)' }]}>
          <View style={styles.sectionHeader}>
            <ShieldAlert size={18} color="#ef4444" />
            <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>Privacy & Audit Purge</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Delete all stored user memories, preferences, and session data from Relay.
          </Text>

          <TouchableOpacity style={styles.purgeBtn} onPress={handlePurgeAll}>
            <Trash2 size={16} color="#ef4444" />
            <Text style={styles.purgeBtnText}>Purge All Stored Data</Text>
          </TouchableOpacity>
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
    paddingBottom: 40,
    gap: 16,
  },
  sectionCard: {
    backgroundColor: '#111726',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  sectionDesc: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 14,
    lineHeight: 18,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f8fafc',
  },
  settingSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  pillBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 6,
  },
  memoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  memoryKey: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  memoryVal: {
    fontSize: 13,
    color: '#e2e8f0',
    marginTop: 2,
  },
  deleteMemoryBtn: {
    padding: 6,
  },
  addMemoryBox: {
    marginTop: 8,
    gap: 8,
  },
  inputField: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingVertical: 10,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  purgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  purgeBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  syncBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  clearContactsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  clearContactsBtnText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  googleBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 12,
    padding: 14,
  },
  googleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  googleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  googleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  providerScopes: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusActiveText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '800',
  },
  statusInactive: {
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
  },
  statusInactiveText: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '800',
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#6366f1',
    paddingVertical: 10,
    borderRadius: 8,
  },
  connectBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  revokeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingVertical: 10,
    borderRadius: 8,
  },
  revokeBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  pushActionsBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    gap: 10,
  },
  pushTokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  tokenLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 2,
  },
  tokenValue: {
    fontSize: 12,
    color: '#cbd5e1',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  testPushBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4f46e5',
    paddingVertical: 10,
    borderRadius: 8,
  },
  testPushBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  ttsConfigBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  ttsOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ttsOptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  ttsPillGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  ttsPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  ttsPillActive: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
  },
  ttsPillText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  ttsPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  ttsSubToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  ttsSubToggleLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  voiceListScroll: {
    marginTop: 6,
  },
  voicePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginRight: 6,
    maxWidth: 160,
  },
  voicePillActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderColor: '#6366f1',
  },
  voicePillText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  voicePillTextActive: {
    color: '#c7d2fe',
    fontWeight: '600',
  },
  testVoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  testVoiceBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.4)',
  },
  testVoiceBtnText: {
    color: '#c7d2fe',
    fontSize: 13,
    fontWeight: '700',
  },
});



