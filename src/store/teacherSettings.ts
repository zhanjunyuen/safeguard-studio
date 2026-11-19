import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cleanSettings, DEFAULT_SETTINGS, type AssessmentSettings } from '../engine/assessmentSettings';

/** The teacher's assessment settings saved on this device: used for attempts started without a class
 *  code, and as the starting point when a teacher sets up a class. */
interface TeacherSettingsState {
  settings: AssessmentSettings;
  /** the class these settings were last saved to, if any */
  classCode: string | null;
  save: (settings: AssessmentSettings, classCode?: string | null) => void;
}

export const useTeacherSettings = create<TeacherSettingsState>()(persist((set) => ({
  settings: DEFAULT_SETTINGS,
  classCode: null,
  save: (settings, classCode) => set((s) => ({ settings: cleanSettings(settings), classCode: classCode === undefined ? s.classCode : classCode })),
}), {
  name: 'safeguard-teacher-settings-v1',
  // Settings from older versions or edited storage are cleaned before use.
  merge: (persisted, current) => ({ ...current, ...(persisted as object), settings: cleanSettings((persisted as TeacherSettingsState | undefined)?.settings) }),
}));
