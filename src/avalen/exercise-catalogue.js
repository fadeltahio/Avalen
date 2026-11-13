// Built-in exercise catalogue: about 300 common gym movements that every coach can
// add to a programme. It ships with the app and is never written into a workspace,
// so existing libraries, programmes and logged sets stay exactly as they are. A
// coach's own library comes first; a catalogue movement with the same name is hidden.
import rows from './exercise-catalogue-data.js';
import { t } from './i18n.js';

const slug = (id) => id.replace(/^catalogue-/, '');

export const CATALOGUE = rows.map(({ muscles: [primary, secondary], source, ...row }) => ({
  ...row,
  weight: 0,
  tempo: '',
  notes: '',
  muscles: { primary, secondary },
  frames: [0, 1].map((n) => `/exercises/library/${slug(row.id)}-${n}.webp`),
}));

const byName = new Map(CATALOGUE.map((exercise) => [exercise.name, exercise]));
export const catalogueExercise = (name) => byName.get(name) || null;

// The coach's library followed by every catalogue movement it does not already have.
export function libraryWithCatalogue(library = []) {
  const names = new Set(library.map((exercise) => exercise.name));
  return [...library, ...CATALOGUE.filter((exercise) => !names.has(exercise.name))];
}

// What a programme stores: the prescription, without photo paths or muscle data,
// which are looked up by name so they can be improved later without a migration.
export function planExercise(exercise) {
  const { frames, muscles, ...rest } = exercise;
  return rest;
}

// Broad regions for filtering. Specific groups (Quads, Biceps…) roll up to one region.
export const REGIONS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Full body', 'Cardio'];
const REGION_OF = {
  chest: 'Chest', back: 'Back', 'lower back': 'Back', traps: 'Back',
  shoulders: 'Shoulders', arms: 'Arms', biceps: 'Arms', triceps: 'Arms', forearms: 'Arms',
  legs: 'Legs', quads: 'Legs', hamstrings: 'Legs', glutes: 'Legs', calves: 'Legs', adductors: 'Legs',
  core: 'Core', abs: 'Core', 'full body': 'Full body', plyometrics: 'Full body', cardio: 'Cardio',
};
export const regionOf = (group = '') => REGION_OF[String(group).toLowerCase()] || null;

// A muscle group as shown on screen. "Back" the muscle and "Back" the button are
// different words in Arabic, so the muscle has its own key.
export const groupLabel = (group) => (group === 'Back' ? t('Back (muscle)') : t(group));
