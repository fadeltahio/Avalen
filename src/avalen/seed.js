import { uid as id } from "./id.js";
import { itemsTotals, mealItem } from "./portions.js";
// Demonstration records are date-relative and clearly separated from new clients.
const key = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const ago = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return key(d);
};
export const LIBRARY = [
  {
    name: "Bench press",
    group: "Chest",
    sets: 3,
    reps: 10,
    weight: 60,
    rest: 90,
    rpe: 8,
    rir: 2,
    tempo: "3-1-1",
    notes: "Keep your feet planted. Lower with control.",
    kind: "Standard",
  },
  {
    name: "Incline dumbbell press",
    group: "Chest",
    sets: 3,
    reps: 10,
    weight: 22.5,
    rest: 90,
    rpe: 8,
    rir: 2,
    tempo: "2-0-1",
    notes: "Keep wrists stacked over elbows.",
    kind: "Standard",
  },
  {
    name: "Seated cable row",
    group: "Back",
    sets: 3,
    reps: 12,
    weight: 45,
    rest: 75,
    rpe: 8,
    rir: 2,
    tempo: "2-1-1",
    notes: "Pull toward your lower ribs.",
    kind: "Standard",
  },
  {
    name: "Lateral raise",
    group: "Shoulders",
    sets: 3,
    reps: 15,
    weight: 7.5,
    rest: 60,
    rpe: 8,
    rir: 2,
    tempo: "2-0-2",
    notes: "Lead with elbows, shoulders relaxed.",
    kind: "Standard",
  },
  {
    name: "Triceps pushdown",
    group: "Arms",
    sets: 3,
    reps: 12,
    weight: 20,
    rest: 60,
    rpe: 8,
    rir: 2,
    tempo: "2-0-1",
    notes: "Keep upper arms still.",
    kind: "Standard",
  },
  {
    name: "Back squat",
    group: "Legs",
    sets: 4,
    reps: 8,
    weight: 85,
    rest: 90,
    rpe: 8,
    rir: 2,
    tempo: "3-1-1",
    notes: "Brace before each rep.",
    kind: "Standard",
  },
  {
    name: "Romanian deadlift",
    group: "Hamstrings",
    sets: 3,
    reps: 10,
    weight: 70,
    rest: 90,
    rpe: 8,
    rir: 2,
    tempo: "3-0-1",
    notes: "Hinge at the hips, keep the bar close.",
    kind: "Standard",
  },
  {
    name: "Walking lunge",
    group: "Legs",
    sets: 3,
    reps: 10,
    weight: 20,
    rest: 60,
    rpe: 8,
    rir: 2,
    tempo: "2-0-1",
    notes: "Ten reps per side.",
    kind: "Per side",
  },
  {
    name: "Calf raise",
    group: "Calves",
    sets: 3,
    reps: 15,
    weight: 40,
    rest: 60,
    rpe: 8,
    rir: 2,
    tempo: "2-1-2",
    notes: "Pause at the top.",
    kind: "Standard",
  },
  {
    name: "Push-up",
    group: "Chest",
    sets: 3,
    reps: 12,
    weight: 0,
    rest: 60,
    rpe: 7,
    rir: 3,
    tempo: "2-0-1",
    notes: "Move as one unit.",
    kind: "Standard",
  },
  {
    name: "Bodyweight squat",
    group: "Legs",
    sets: 3,
    reps: 15,
    weight: 0,
    rest: 60,
    rpe: 7,
    rir: 3,
    tempo: "3-0-1",
    notes: "Move through a comfortable range.",
    kind: "Standard",
  },
];
// Starter foods. Each portion is a household unit and its weight, so a plan reads
// as what to put on the plate ("1 egg · 50 g"). Values are per that portion.
export const FOODS = [
  { name: "Grilled chicken breast", portion: "1 fillet · 150 g", kcal: 248, p: 46, c: 0, f: 5 },
  { name: "Cooked brown rice", portion: "1 cup · 195 g", kcal: 216, p: 5, c: 45, f: 2 },
  { name: "Greek yogurt", portion: "1 cup · 200 g", kcal: 146, p: 20, c: 8, f: 4 },
  { name: "Rolled oats", portion: "⅔ cup · 60 g", kcal: 228, p: 8, c: 38, f: 5 },
  { name: "Banana", portion: "1 banana · 118 g", kcal: 105, p: 1, c: 27, f: 0 },
  { name: "Eggs", portion: "1 egg · 50 g", kcal: 72, p: 6.3, c: 0.4, f: 4.8 },
  { name: "Salmon", portion: "1 fillet · 150 g", kcal: 310, p: 33, c: 0, f: 19 },
  { name: "Avocado", portion: "½ avocado · 100 g", kcal: 160, p: 2, c: 9, f: 15 },
  { name: "Broccoli", portion: "1 cup · 90 g", kcal: 31, p: 2.5, c: 6, f: 0.3 },
  { name: "Olive oil", portion: "1 tbsp · 14 g", kcal: 119, p: 0, c: 0, f: 14 },
  { name: "Boiled potatoes", portion: "1 potato · 170 g", kcal: 148, p: 3.2, c: 34, f: 0.2 },
  { name: "Green salad", portion: "1 bowl · 150 g", kcal: 25, p: 1.5, c: 4.5, f: 0.3 },
];
// A planned meal made of library foods with amounts; its totals are their sum.
function planMeal(name, description, foods) {
  const items = foods.map(([food, servings]) => mealItem(FOODS.find((f) => f.name === food), servings));
  return { name, description, items, ...itemsTotals(items) };
}
export function defaultProgram() {
  return {
    id: id(),
    name: "Strength foundations",
    phase: "Build · phase 2",
    weeks: 12,
    progression:
      "When every set reaches the top of the rep range, review a 2.5 kg increase.",
    days: [
      {
        id: "upper-a",
        name: "Upper Body A",
        cover: 0,
        minutes: 45,
        exercises: LIBRARY.slice(0, 5).map((e) => ({ ...e, id: id() })),
      },
      {
        id: "lower-a",
        name: "Lower Body A",
        cover: 1,
        minutes: 50,
        exercises: LIBRARY.slice(5, 9).map((e) => ({ ...e, id: id() })),
      },
      {
        id: "upper-b",
        name: "Upper Body B",
        cover: 2,
        minutes: 45,
        exercises: [LIBRARY[2], LIBRARY[1], LIBRARY[3], LIBRARY[4]].map(
          (e) => ({ ...e, id: id() }),
        ),
      },
      {
        id: "lower-b",
        name: "Lower Body B",
        cover: 3,
        minutes: 40,
        exercises: LIBRARY.slice(6, 9).map((e) => ({ ...e, id: id() })),
      },
    ],
  };
}
export function newClient(
  name = "Jordan Williams",
  email = "jordan@example.com",
  clientId = id(),
) {
  const program = defaultProgram();
  return {
    id: clientId,
    name,
    email,
    goal: "Build strength & improve body composition",
    program,
    programEnd: ago(42),
    created: ago(-84),
    paused: false,
    nutrition: {
      mode: "Flexible",
      kcal: 2500,
      p: 180,
      c: 280,
      f: 75,
      meals: [
        planMeal("Breakfast", "Oats, yogurt & fruit", [["Rolled oats", 1], ["Greek yogurt", 1], ["Banana", 1]]),
        planMeal("Lunch", "Chicken, rice & vegetables", [["Grilled chicken breast", 1], ["Cooked brown rice", 1.5], ["Broccoli", 1], ["Olive oil", 1]]),
        planMeal("Dinner", "Salmon, potatoes & greens", [["Salmon", 1], ["Boiled potatoes", 1.5], ["Green salad", 1], ["Olive oil", 0.5]]),
      ],
    },
    habits: [
      {
        id: "steps",
        name: "Daily steps",
        target: 10000,
        unit: "steps",
        step: 1000,
      },
      { id: "water", name: "Drink water", target: 2.5, unit: "L", step: 0.25 },
      { id: "sleep", name: "Sleep", target: 8, unit: "hours", step: 0.5 },
      { id: "mobility", name: "Mobility", target: 10, unit: "min", step: 5 },
    ],
    schedule: Array.from({ length: 84 }, (_, i) => i - 56)
      .filter(
        (n) =>
          [1, 2, 4, 6].includes(new Date(`${ago(n)}T12:00:00`).getDay()) ||
          n === 0,
      )
      .map((n, i) => ({
        date: ago(n),
        dayId: n === 0 ? "upper-a" : program.days[i % 4].id,
      })),
    subscription: {
      amount: 2500,
      currency: "EGP",
      status: "Active",
      nextDate: ago(15),
      plan: "Premium coaching",
      method: "Not connected",
    },
    travel: null,
  };
}
export function createWorkspace() {
  const clients = [
    "Jordan Williams",
    "Maya Chen",
    "Liam Parker",
    "Sophie Williams",
    "Noah Patel",
    "Emma Rodriguez",
  ].map((n, i) =>
    newClient(n, `${n.split(" ")[0].toLowerCase()}@example.com`, "client-" + i),
  );
  let legacy;
  try {
    legacy = JSON.parse(localStorage.getItem("coachos.profile.v2"));
  } catch {}
  if (legacy?.name) {
    clients[0].name = legacy.name;
    clients[0].email = legacy.email;
  }
  clients[4].programEnd = ago(4);
  clients[5].subscription.status = "Overdue";
  clients[5].subscription.nextDate = ago(-4);
  const d = {
    version: 1,
    demo: true,
    onboarded: false,
    activeClientId: clients[0].id,
    coach: { name: "Alex Morgan", brand: "Avalen", logo: null },
    clients,
    sessions: [],
    foodLogs: [],
    measurements: [],
    habitLogs: [],
    checkins: [],
    messages: [],
    posts: [],
    photos: [],
    documents: [],
    inbodies: [],
    timeline: [],
    dismissed: [],
    drafts: {},
    templates: [],
    library: LIBRARY.map((e) => ({ ...e, id: id() })),
    savedReplies: [
      "Great work this week. Keep the same approach for the next seven days.",
      "Thanks for flagging this. Let’s adjust the movement before your next session.",
    ],
    savedViews: [],
    leads: [],
    forms: [],
    automations: [],
    settings: { units: "kg", theme: "dark", designVersion: "editorial-v1", reducedMotion: false, notifications: true },
    favorites: [],
  };
  clients.forEach((c, index) => {
    c.schedule
      .filter((s) => s.date < ago(0))
      .forEach((s, j) => {
        if ((index === 2 && j % 3 === 0) || (index === 0 && j % 9 === 0))
          return;
        const day = c.program.days.find((x) => x.id === s.dayId),
          sets = day.exercises.flatMap((e) =>
            Array.from({ length: e.sets }, (_, n) => ({
              name: e.name,
              exerciseId: e.id,
              set: n + 1,
              weight: Math.max(0, e.weight - (30 - j) * 0.25),
              reps: e.reps,
              kind: e.kind,
              skipped: false,
            })),
          );
        d.sessions.push({
          id: id(),
          clientId: c.id,
          date: s.date,
          dayId: day.id,
          title: day.name,
          sets,
          startedAt: new Date(s.date + "T17:00:00").getTime(),
          finishedAt: s.date + "T17:45:00",
          duration: 2700,
          prs: j % 7 === 0 ? [day.exercises[0].name] : [],
        });
      });
    for (let w = 0; w < 9; w++)
      d.measurements.push({
        id: id(),
        clientId: c.id,
        date: ago(-56 + w * 7),
        weight:
          index === 1 ? 76.2 + (w % 2) * 0.1 : round(82 + index * 2 - w * 0.6),
        waist: round(91 - w * 0.45),
        chest: 100,
        bodyFat: round(23 - w * 0.35),
      });
    for (let n = -27; n <= 0; n++) {
      const k = index === 4 && n % 3 !== 0 ? 1650 : 2400 + (n % 3) * 40;
      d.foodLogs.push({
        id: id(),
        clientId: c.id,
        date: ago(n),
        name: n === 0 ? "Breakfast & lunch" : "Daily meal log",
        meal: "Lunch",
        portion: "Logged meals",
        kcal: n === 0 ? 1620 : k,
        p: n === 0 ? 118 : 174,
        c: n === 0 ? 175 : 263,
        f: n === 0 ? 50 : 72,
      });
      d.habitLogs.push({
        clientId: c.id,
        date: ago(n),
        values: {
          steps: n === 0 ? 8432 : 8500 + (n % 4) * 500,
          water: n === 0 ? 1.8 : 2.5,
          sleep: 7.5,
          mobility: 10,
        },
      });
    }
    [14, index === 3 ? 10 : 5].forEach((n) =>
      d.checkins.push({
        id: id(),
        clientId: c.id,
        date: ago(-n),
        scores: {
          Mood: 4,
          Sleep: 3,
          Energy: 4,
          Hunger: 3,
          Stress: 2,
          Training: 4,
          Nutrition: 4,
        },
        wins: "I kept my training consistent.",
        struggles: "Getting enough sleep on work nights.",
        note: "Feeling stronger this month.",
        reviewed: index !== 0,
        response: "",
        photos: [],
      }),
    );
    d.messages.push({
      id: id(),
      clientId: c.id,
      from: "coach",
      text: "Your new training block is ready. Focus on controlled reps and let me know how the first session feels.",
      at: ago(-1) + "T10:00:00",
      read: false,
    });
  });
  d.posts = [
    {
      id: id(),
      title: "Consistency over perfection.",
      text: "Some weeks feel effortless. Others ask a little more of you. Show up, keep the basics simple, and let small wins add up.",
      at: ago(-1) + "T09:00:00",
      likes: [],
      saved: [],
      image: 4,
    },
    {
      id: id(),
      title: "Three cues for your next strength session",
      text: "Brace before each rep. Control the lowering phase. Finish with one or two good reps in reserve. Quality comes first.",
      at: ago(-3) + "T10:00:00",
      likes: [],
      saved: [],
      image: 0,
    },
  ];
  d.timeline = [
    {
      id: id(),
      clientId: clients[0].id,
      title: "Calories adjusted",
      detail:
        "2,650 → 2,500 kcal. Coach note: adjust intake to match the current training phase.",
      at: ago(-8) + "T09:00:00",
      by: "coach",
    },
  ];
  // Demo payments: six months of coaching fees recorded by the coach (cash and
  // transfers only, so nothing implies a connected Paymob account).
  const month = (back) => { const at = new Date(); at.setDate(1); at.setMonth(at.getMonth() - back); return key(at).slice(0, 7); };
  const methods = ["instapay", "cash", "bank", "instapay", "wallet", "instapay"];
  d.payments = [];
  clients.forEach((c, index) => {
    for (let back = 5; back >= 1; back--) {
      if (index === 4 && back === 5) continue;
      d.payments.push({ id: id(), clientId: c.id, amount: c.subscription.amount, currency: c.subscription.currency, label: "Monthly coaching", period: month(back), dueDate: null, status: "paid", method: methods[(index + back) % methods.length], verified: false, paidAt: `${month(back)}-0${(index % 5) + 3}T12:00:00.000Z`, createdAt: `${month(back)}-0${(index % 5) + 3}T12:00:00.000Z` });
    }
    const current = month(0);
    if (index <= 2) d.payments.push({ id: id(), clientId: c.id, amount: c.subscription.amount, currency: c.subscription.currency, label: "Monthly coaching", period: current, dueDate: null, status: "paid", method: methods[index], verified: false, paidAt: `${ago(-index - 1)}T12:00:00.000Z`, createdAt: `${ago(-index - 1)}T12:00:00.000Z` });
    if (index === 3) d.payments.push({ id: id(), clientId: c.id, amount: c.subscription.amount, currency: c.subscription.currency, label: "Monthly coaching", period: current, dueDate: ago(5), status: "due", method: null, verified: false, paidAt: null, createdAt: `${ago(-2)}T09:00:00.000Z` });
    if (index === 5) d.payments.push({ id: id(), clientId: c.id, amount: c.subscription.amount, currency: c.subscription.currency, label: "Monthly coaching", period: current, dueDate: ago(-4), status: "due", method: null, verified: false, paidAt: null, createdAt: `${ago(-9)}T09:00:00.000Z` });
  });
  d.nutritionDays = [];
  for (const food of d.foodLogs) {
    if (d.nutritionDays.some(day => day.clientId === food.clientId && day.date === food.date)) continue;
    const client = clients.find(c => c.id === food.clientId);
    d.nutritionDays.push({ clientId: client.id, date: food.date, complete: food.date < ago(0), target: Object.fromEntries(['kcal','p','c','f'].map(k => [k,client.nutrition[k]])) });
  }
  return d;
}
const round = (n) => Math.round(n * 10) / 10;
