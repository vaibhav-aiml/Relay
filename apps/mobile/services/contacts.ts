import * as Contacts from 'expo-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiService } from './api';
import { UserContact } from '@relay/shared-types';

const SYNCED_CONTACTS_KEY = 'relay_has_synced_contacts_v1';

export class DeviceContactsService {
  /**
   * Request native permission to access device contacts
   */
  public static async requestPermission(): Promise<boolean> {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      return status === 'granted';
    } catch (err) {
      console.warn('Failed to request contacts permission:', err);
      return false;
    }
  }

  /**
   * Fetch contacts from on-device phonebook
   */
  public static async getPhoneContacts(): Promise<UserContact[]> {
    try {
      const isGranted = await this.requestPermission();
      if (!isGranted) {
        return [];
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.FirstName,
          Contacts.Fields.LastName,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
        ],
      });

      if (!data || data.length === 0) {
        return [];
      }

      const formatted: UserContact[] = [];

      for (const item of data) {
        const name = (
          item.name ||
          [item.firstName, item.lastName].filter(Boolean).join(' ') ||
          ''
        ).trim();

        if (!name) continue;

        // Take primary/first phone number
        const rawPhone = item.phoneNumbers?.[0]?.number || '';
        const email = item.emails?.[0]?.email || '';

        formatted.push({
          name,
          phone: rawPhone || undefined,
          email: email || undefined,
          relation: 'device_contact',
        });
      }

      return formatted;
    } catch (err) {
      console.warn('Failed to read device contacts:', err);
      return [];
    }
  }

  /**
   * Sync contacts to backend.
   * If force is false, only syncs once on first launch.
   */
  public static async syncContacts(force: boolean = false): Promise<{
    success: boolean;
    count: number;
    skipped?: boolean;
    error?: string;
  }> {
    try {
      if (!force) {
        const alreadySynced = await AsyncStorage.getItem(SYNCED_CONTACTS_KEY);
        if (alreadySynced === 'true') {
          return { success: true, count: 0, skipped: true };
        }
      }

      const contacts = await this.getPhoneContacts();
      if (contacts.length === 0) {
        return { success: true, count: 0 };
      }

      const res = await ApiService.syncContacts(contacts);
      await AsyncStorage.setItem(SYNCED_CONTACTS_KEY, 'true');

      return {
        success: true,
        count: res.count || contacts.length,
      };
    } catch (err: any) {
      console.warn('Device contacts sync failed:', err);
      return {
        success: false,
        count: 0,
        error: err.message || 'Failed to sync contacts',
      };
    }
  }

  /**
   * Clear local first-launch sync flag and backend synced contacts
   */
  public static async clearSyncedContacts(): Promise<{ success: boolean }> {
    try {
      await AsyncStorage.removeItem(SYNCED_CONTACTS_KEY);
      await ApiService.clearSyncedContacts();
      return { success: true };
    } catch (err) {
      console.warn('Failed to clear synced contacts:', err);
      return { success: false };
    }
  }
}
