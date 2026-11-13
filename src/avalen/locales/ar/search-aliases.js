// Extra Arabic words that find a built-in exercise in search: the plain-Arabic
// name, other common gym spellings and short forms. Shown nowhere; search only.
export default {
  'Bench press': ['ضغط البنش', 'ضغط الصدر', 'بنش'],
  'Incline dumbbell press': ['ضغط الدمبل على البنش المائل', 'ضغط مائل', 'انكلاين', 'إنكلاين'],
  'Seated cable row': ['سحب الكيبل جلوسًا', 'سحب أرضي', 'تجديف', 'كيبل رو'],
  'Lateral raise': ['رفرفة جانبية', 'رفع جانبي', 'لاترال'],
  'Triceps pushdown': ['دفع الترايسبس بالكيبل', 'ترايسبس', 'تراي', 'بوش داون'],
  'Back squat': ['سكوات خلفي', 'قرفصاء', 'سكوات', 'سكوات بالبار'],
  'Romanian deadlift': ['رفعة ميتة رومانية', 'رفعة ميتة', 'ديدلفت روماني', 'ار دي ال', 'RDL'],
  'Walking lunge': ['طعن بالمشي', 'طعنات', 'لانجز', 'ووكينغ لانجز', 'لانجز بالمشي'],
  'Calf raise': ['رفع السمانة', 'سمانة', 'كالف'],
  'Push-up': ['تمرين الضغط', 'ضغط', 'بوش اب'],
  'Bodyweight squat': ['قرفصاء', 'بودي ويت سكوات', 'اير سكوات', 'سكوات'],
};

// Plain-Arabic words for the parts of an exercise name, so everyday Arabic finds the
// gym-style names of every built-in and catalogue exercise ("ضغط مائل" finds
// "Incline dumbbell press"). Matched against the English name.
const TERMS = [
  [/press|push-up/, 'ضغط'], [/\brows?\b/, 'تجديف سحب'], [/squat/, 'قرفصاء'], [/deadlift/, 'رفعة ميتة'],
  [/curl/, 'ثني'], [/\bfly\b|crossover|pec deck/, 'تفتيح رفرفة'], [/raise/, 'رفع'], [/extension/, 'مد'],
  [/lunge|split squat/, 'طعن'], [/pull-up|chin-up|muscle-up/, 'عقلة'], [/pulldown|pull-through|pull-apart/, 'سحب'],
  [/\bdips?\b/, 'متوازي'], [/plank/, 'ثبات'], [/crunch|sit-up|v-up|rollout|leg raise|knee raise/, 'بطن'],
  [/shrug/, 'ترابيس'], [/bench/, 'بنش'], [/incline/, 'مائل'], [/decline/, 'منحدر'], [/single|one-arm|single-leg/, 'واحد'],
  [/dumbbell/, 'دمبلز'], [/barbell/, 'بار'], [/cable/, 'كابل'], [/machine|plate-loaded/, 'جهاز'],
  [/kettlebell/, 'كيتلبل'], [/hip thrust|glute|kickback/, 'مؤخرة أرداف'], [/calf/, 'سمانة'],
  [/jump|hop/, 'قفز'], [/run|treadmill/, 'جري مشاية'], [/walk/, 'مشي'], [/bike/, 'دراجة'], [/rope/, 'حبل'],
  [/rotation|twist|wood chop/, 'دوران'], [/clean|snatch|jerk/, 'رفع أولمبي'], [/carry|farmer/, 'حمل'],
];
export function termsFor(name) {
  const lower = String(name).toLowerCase();
  return TERMS.filter(([pattern]) => pattern.test(lower)).map(([, words]) => words);
}
