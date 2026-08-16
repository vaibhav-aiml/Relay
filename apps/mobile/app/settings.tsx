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
} from 'react-native';
import { Header } from '../components/Header';
import { Brain, Cpu, Volume2, Plus, Trash2, ShieldAlert } from 'lucide-react-native';
import { useAppStore } from '../store/useAppStore';
import { ApiService } from '../services/api';

export default function SettingsScreen() {
  const { memories, fetchMemories, addMemory, deleteMemory } = useAppStore();

  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [voiceTTS, setVoiceTTS] = useState(true);

  useEffect(() => {
    fetchMemories();
  }, []);

  const handleAddPreference = async () => {
    if (!newKey.trim() || !newValue.trim()) return;
    await addMemory(newKey.trim(), newValue.trim(), 'preference');
    setNewKey('');
    setNewValue('');
  };

  const handlePurgeAll = async () => {
    await ApiService.purgeAllMemories();
    fetchMemories();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Settings" subtitle="Preferences & Agent Memory" />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Model & Voice Configuration */}
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
            <View>
              <Text style={styles.settingLabel}>Fallback AI Provider</Text>
              <Text style={styles.settingSub}>Anthropic Claude 3.5 Sonnet</Text>
            </View>
            <View style={[styles.pillBadge, { backgroundColor: 'rgba(100, 116, 139, 0.2)' }]}>
              <Text style={[styles.pillText, { color: '#94a3b8' }]}>STANDBY</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Volume2 size={16} color="#94a3b8" />
              <View>
                <Text style={styles.settingLabel}>Voice Readout (TTS)</Text>
                <Text style={styles.settingSub}>Speak verified answers using on-device speech</Text>
              </View>
            </View>
            <Switch
              value={voiceTTS}
              onValueChange={setVoiceTTS}
              trackColor={{ false: '#334155', true: '#6366f1' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* User Memory & Scheduling Preferences */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Brain size={18} color="#10b981" />
            <Text style={styles.sectionTitle}>Learned Preferences & Memories</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Relay remembers your scheduling habits and contacts to customize plan creation.
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
              placeholder="Key (e.g. meeting_hours)"
              placeholderTextColor="#64748b"
              value={newKey}
              onChangeText={setNewKey}
            />
            <TextInput
              style={styles.inputField}
              placeholder="Preference (e.g. Schedule meetings 9-11 AM)"
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
});
