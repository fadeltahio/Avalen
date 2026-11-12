import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  Bookmark,
  BrainCircuit,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleEllipsis,
  ClipboardCheck,
  Copy,
  CreditCard,
  Download,
  Clock3,
  Dumbbell,
  Flame,
  FileText,
  Home as HomeIcon,
  Heart,
  Image as ImageIcon,
  LayoutDashboard,
  Lock,
  MessageCircle,
  Minus,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Target,
  TimerReset,
  TrendingUp,
  Utensils,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react";
import athleteImage from "./assets/campaign-athlete.webp";
import onboardingIllustration from "./assets/onboarding-coach-client-v2.jpg";
import upperStrengthCover from "./assets/cover-upper-editorial.svg";
import lowerStrengthCover from "./assets/cover-lower-editorial.svg";
import pullPowerCover from "./assets/cover-pull-editorial.svg";
import conditioningCover from "./assets/cover-conditioning-editorial.svg";
import recoveryCover from "./assets/cover-recovery-editorial.svg";
import shareStrengthRack from "./assets/share-strength-rack-v2.jpg";
import shareTrackDawn from "./assets/share-track-dawn-v2.jpg";
import shareDumbbellsStudio from "./assets/share-dumbbells-studio-v2.jpg";
import shareRecovery from "./assets/share-recovery-v2.jpg";
import shareNightGym from "./assets/share-night-gym-v2.jpg";
import "./styles.css";

const DEFAULT_ACCENT = "#6c32ff";
const ACCENTS = [DEFAULT_ACCENT, "#2563eb", "#ef5f5f", "#15a58b"];
const PLATFORM_BRAND = "AVELN";
const DEFAULT_BRAND = {
  name: "YEHIA ATHLETICS",
  logo: null,
  showName: true,
};
const BrandContext = createContext({
  brand: DEFAULT_BRAND,
  setBrand: () => {},
});

const WORKOUT_COVERS = [
  { id: "upper", label: "Aubergine field", image: upperStrengthCover },
  { id: "lower", label: "Graphite arc", image: lowerStrengthCover },
  { id: "pull", label: "Violet cadence", image: pullPowerCover },
  { id: "conditioning", label: "Copper motion", image: conditioningCover },
  { id: "recovery", label: "Ivory current", image: recoveryCover },
];

const PROGRAMME_DAYS = [
  {
    id: "day01",
    day: "DAY 01",
    title: "Upper Strength",
    count: "5 exercises",
    detail: "Bench press · Row · OHP · Pulldown · Triceps",
    defaultCover: "upper",
  },
  {
    id: "day02",
    day: "DAY 02",
    title: "Lower Strength",
    count: "4 exercises",
    detail: "Back squat · RDL · Lunge · Calf raise",
    defaultCover: "lower",
  },
  {
    id: "day03",
    day: "DAY 03",
    title: "Upper Volume",
    count: "6 exercises",
    detail: "Incline press · Cable row · Lateral raise + 3",
    defaultCover: "pull",
  },
  {
    id: "day04",
    day: "DAY 04",
    title: "Lower Volume",
    count: "5 exercises",
    detail: "Deadlift · Leg press · Split squat + 2",
    defaultCover: "conditioning",
  },
];

const DEFAULT_PROGRAMME_COVERS = Object.fromEntries(
  PROGRAMME_DAYS.map((day) => [day.id, day.defaultCover]),
);

function resolveCover(coverId, customImage) {
  if (coverId === "custom" && customImage) return customImage;
  return (
    WORKOUT_COVERS.find((cover) => cover.id === coverId)?.image ||
    lowerStrengthCover
  );
}

function coverForCalendarDay(day, programmeCovers, customCovers) {
  if (day.title === "Recovery Day" || day.title === "Weekly Check-in")
    return recoveryCover;
  if (day.title === "Conditioning") return conditioningCover;
  const programmeDay = PROGRAMME_DAYS.find((item) => item.title === day.title);
  if (!programmeDay) return pullPowerCover;
  return resolveCover(
    programmeCovers[programmeDay.id],
    customCovers[programmeDay.id],
  );
}

const calendarTemplates = [
  {
    title: "Upper Strength",
    meta: "5 exercises · 58 min",
    status: "complete",
    result: { sets: 18, volume: "4,120 kg", duration: "58:24", prs: 1 },
  },
  { title: "Recovery Day", meta: "8,240 steps · mobility", status: "rest" },
  {
    title: "Lower Volume",
    meta: "5 exercises · 64 min",
    status: "complete",
    result: { sets: 19, volume: "5,060 kg", duration: "64:12", prs: 0 },
  },
  { title: "Conditioning", meta: "Intervals · 32 min", status: "missed" },
  {
    title: "Upper Volume",
    meta: "5 exercises · 61 min",
    status: "complete",
    result: { sets: 17, volume: "3,880 kg", duration: "61:03", prs: 0 },
  },
  { title: "Recovery Day", meta: "9,120 steps · mobility", status: "rest" },
  {
    title: "Weekly Check-in",
    meta: "Weight, photos and reflection",
    status: "complete",
    result: { sets: "—", volume: "Check-in", duration: "6:40", prs: 0 },
  },
  {
    title: "Upper Strength",
    meta: "5 exercises · 56 min",
    status: "complete",
    result: { sets: 18, volume: "4,340 kg", duration: "56:48", prs: 1 },
  },
  { title: "Recovery Day", meta: "7,840 steps · mobility", status: "rest" },
  {
    title: "Lower Volume",
    meta: "5 exercises · 62 min",
    status: "complete",
    result: { sets: 19, volume: "5,240 kg", duration: "62:18", prs: 0 },
  },
  {
    title: "Upper Strength",
    meta: "5 exercises · 54 min",
    status: "complete",
    result: { sets: 18, volume: "4,480 kg", duration: "54:31", prs: 1 },
  },
  { title: "Lower Strength", meta: "4 exercises · 50 min", status: "today" },
  { title: "Recovery Day", meta: "Walk and mobility", status: "future" },
  { title: "Weekly Check-in", meta: "Due by 18:00", status: "future" },
];
const calendarDays = calendarTemplates.map((item, index) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + index - 11);
  return {
    ...item,
    id: date.toISOString().slice(0, 10),
    day: new Intl.DateTimeFormat("en", { weekday: "narrow" }).format(date),
    number: String(date.getDate()).padStart(2, "0"),
    label: new Intl.DateTimeFormat("en", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    })
      .format(date)
      .toUpperCase(),
  };
});
const TODAY_ID = calendarDays.find((item) => item.status === "today").id;
const CURRENT_DATE_LABEL = new Intl.DateTimeFormat("en", {
  weekday: "long",
  day: "2-digit",
  month: "long",
})
  .format(new Date())
  .toUpperCase();
const CURRENT_MONTH_LABEL = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
}).format(new Date());

const navItems = [
  { id: "home", label: "Today", icon: HomeIcon },
  { id: "train", label: "Train", icon: Dumbbell },
  { id: "fuel", label: "Fuel", icon: Utensils },
  { id: "progress", label: "Progress", icon: BarChart3 },
  { id: "coach", label: "Coach", icon: MessageCircle },
];

const exercises = [
  {
    name: "Barbell back squat",
    group: "Lower body",
    sets: 4,
    reps: "6–8",
    load: 85,
    last: "82.5 × 8",
  },
  {
    name: "Romanian deadlift",
    group: "Hamstrings",
    sets: 3,
    reps: "8–10",
    load: 72.5,
    last: "70 × 10",
  },
  {
    name: "Walking lunge",
    group: "Lower body",
    sets: 3,
    reps: "10 / side",
    load: 24,
    last: "22 × 10",
  },
  {
    name: "Seated calf raise",
    group: "Calves",
    sets: 3,
    reps: "12–15",
    load: 55,
    last: "52.5 × 14",
  },
];

const initialMeals = [
  {
    id: 1,
    time: "08:15",
    name: "Greek yoghurt bowl",
    meta: "Breakfast · manual",
    kcal: 440,
    p: 32,
    c: 52,
    f: 11,
    fibre: 8,
    ingredients: ["Greek yoghurt", "Oats", "Blueberries", "Honey", "Almonds"],
  },
  {
    id: 2,
    time: "13:05",
    name: "Chicken rice plate",
    meta: "Lunch · photo estimate",
    kcal: 620,
    p: 48,
    c: 71,
    f: 16,
    fibre: 6,
    ingredients: [
      "Grilled chicken",
      "Basmati rice",
      "Mixed vegetables",
      "Tahini dressing",
    ],
  },
];

const DEFAULT_MESSAGES = [
  {
    id: 1,
    from: "coach",
    text: "Morning Ahmed — I checked yesterday’s videos. Your bracing is much cleaner.",
    at: "08:42",
  },
  {
    id: 2,
    from: "coach",
    text: "For today: keep the squat at RPE 8. If the pause stays crisp, add 2.5 kg on the final set.",
    at: "08:43",
  },
  {
    id: 3,
    from: "me",
    text: "Got it. Energy feels good today too.",
    at: "08:51",
  },
];
const NEW_CLIENT_MESSAGES = [
  {
    id: 1,
    from: "coach",
    text: "Welcome — your programme is ready. Message me here whenever you need context or an adjustment.",
    at: "Now",
  },
];

function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Unable to persist ${key}`, error);
    }
  }, [key, value]);
  return [value, setValue];
}

function useModalLifecycle(onClose) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      const dialog = document.querySelector('[role="dialog"]');
      dialog
        ?.querySelector(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        )
        ?.focus();
    });
    function handleKey(event) {
      if (event.key === "Escape") onCloseRef.current?.();
    }
    window.addEventListener("keydown", handleKey);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, []);
}

function BrandMark({ compact = false }) {
  const { brand } = useContext(BrandContext);
  const [beforeSlash, afterSlash] = (brand.name || DEFAULT_BRAND.name).split(
    "/",
  );
  return (
    <div
      className={`brand-mark ${compact ? "compact" : ""} ${brand.logo ? "custom-brand-mark" : ""}`}
      aria-label={brand.name || "Coach OS"}
    >
      {brand.logo ? (
        <img src={brand.logo} alt="" />
      ) : (
        <span className="brand-glyph">
          <i /> <i /> <i />
        </span>
      )}
      {brand.showName !== false && (
        <span>
          {beforeSlash}
          {afterSlash !== undefined && (
            <>
              <span className="slash">/</span>
              {afterSlash}
            </>
          )}
        </span>
      )}
    </div>
  );
}

function PlatformMark({ compact = false, muted = false }) {
  return (
    <div
      className={`platform-mark ${compact ? "compact" : ""} ${muted ? "muted" : ""}`}
      aria-label={PLATFORM_BRAND}
    >
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M5 25.5 15.8 5 27 25.5" />
        <path d="m10.5 20 5.3-10 5.5 10" />
        <path d="M8.1 20h15.6" />
      </svg>
      <span>{PLATFORM_BRAND}</span>
    </div>
  );
}

function PlatformIntro({ onEnter }) {
  return (
    <div className="intro-page">
      <img
        className="intro-image"
        src={onboardingIllustration}
        alt="Client and coach celebrating progress together"
      />
      <div className="intro-shade" />
      <div className="intro-top">
        <PlatformMark />
      </div>
      <div className="intro-copy">
        <span className="eyebrow">YOUR COACHING, CONNECTED</span>
        <h1>
          Your journey.
          <br />
          <em>Real results.</em>
        </h1>
        <p>
          Workouts, nutrition, progress and support from your coach. All in one
          place.
        </p>
        <button className="primary-button" onClick={onEnter}>
          Enter your programme <ArrowRight size={18} />
        </button>
        <div className="intro-foot">
          <span>COACHING BY</span> YEHIA ATHLETICS
        </div>
      </div>
    </div>
  );
}

const ONBOARDING_STEPS = [
  {
    id: "goal",
    label: "Your main goal",
    hint: "Your coach can adjust this later.",
    options: [
      "Build strength",
      "Lose body fat",
      "Recompose",
      "Improve performance",
    ],
  },
  {
    id: "experience",
    label: "Training experience",
    hint: "This helps set your starting volume.",
    options: ["Just starting", "6–18 months", "2–4 years", "5+ years"],
  },
  {
    id: "days",
    label: "Training days each week",
    hint: "Choose a realistic rhythm.",
    options: ["2 days", "3 days", "4 days", "5 days"],
  },
  {
    id: "equipment",
    label: "Where do you train?",
    hint: "Your programme will match your equipment.",
    options: ["Full gym", "Home gym", "Dumbbells only", "Bodyweight"],
  },
];

function FirstRun({ onComplete, onCoach }) {
  const [stage, setStage] = useState("intro");
  const [code, setCode] = useState("");
  const [codeState, setCodeState] = useState("idle");
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const currentStep = ONBOARDING_STEPS[step];

  function validateCode(event) {
    event.preventDefault();
    setCodeState(code === "00000" ? "valid" : "invalid");
  }

  function submitProfile(event) {
    event.preventDefault();
    if (!profile.name.trim() || !/^\S+@\S+\.\S+$/.test(profile.email)) return;
    setStage("onboard");
  }

  function chooseAnswer(value) {
    const nextAnswers = { ...answers, [currentStep.id]: value };
    setAnswers(nextAnswers);
    if (step < ONBOARDING_STEPS.length - 1)
      window.setTimeout(() => setStep((value) => value + 1), 180);
    else window.setTimeout(() => setStage("welcome"), 180);
  }

  function goBack() {
    if (stage === "invite") setStage("intro");
    else if (stage === "profile") setStage("invite");
    else if (stage === "onboard" && step > 0) setStep((value) => value - 1);
    else if (stage === "onboard") setStage("profile");
  }

  return (
    <div className="first-run-shell" style={{ "--accent": DEFAULT_ACCENT }}>
      <aside className="first-run-brand">
        <PlatformMark />
        <div>
          <span className="eyebrow light">COACHING, PERSONALISED</span>
          <h1>
            Your plan.
            <br />
            One clear day
            <br />
            at a time.
          </h1>
          <p>
            Training, nutrition, progress and direct access to your coach in one
            focused place.
          </p>
        </div>
        <small>AVELN · PRIVATE CLIENT ACCESS</small>
      </aside>
      <main className="first-run-main">
        {stage !== "intro" && stage !== "welcome" && (
          <button
            className="first-run-back"
            onClick={goBack}
            aria-label="Go back"
          >
            <ArrowLeft size={19} />
          </button>
        )}
        {stage === "intro" && (
          <section className="entry-panel entry-welcome reveal">
            <PlatformMark compact />
            <span className="eyebrow">PRIVATE COACHING · BY INVITATION</span>
            <h2>
              Your journey.
              <br />
              Our coaching.
              <br />
              <em>Real results.</em>
            </h2>
            <p>
              Workouts, nutrition, progress and support from your coach. All in
              one place.
            </p>
            <img
              className="entry-illustration"
              src={onboardingIllustration}
              alt="Client and coach celebrating progress together"
            />
            <button
              className="entry-primary"
              onClick={() => setStage("invite")}
            >
              Get started <ArrowRight size={18} />
            </button>
            <button className="coach-entry-link" onClick={onCoach}>
              I’m a coach <ArrowRight size={15} />
            </button>
            <div className="entry-trust">
              <ShieldCheck size={15} />
              <span>
                Your health and coaching data stays private to you and your
                coach.
              </span>
            </div>
          </section>
        )}
        {stage === "invite" && (
          <section className="entry-panel invite-panel reveal">
            <span className="eyebrow">STEP 1 · CONNECT YOUR COACH</span>
            <h2>Enter your invite code.</h2>
            <p>Your coach provides this when they add you to their roster.</p>
            <form onSubmit={validateCode}>
              <label htmlFor="invite-code">5-digit access code</label>
              <input
                id="invite-code"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 5));
                  setCodeState("idle");
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="00000"
                maxLength="5"
                aria-describedby="invite-help invite-error"
                autoFocus
              />
              <small id="invite-help">
                For this prototype, use <b>00000</b>.
              </small>
              {codeState === "invalid" && (
                <div id="invite-error" className="entry-error" role="alert">
                  That code wasn't recognised. Try 00000.
                </div>
              )}
              <button className="entry-primary" disabled={code.length !== 5}>
                Find my coach <ArrowRight size={18} />
              </button>
            </form>
            {codeState === "valid" && (
              <div className="invite-coach-card reveal">
                <div>YA</div>
                <span>
                  <small>YOU'RE JOINING</small>
                  <b>Yehia Athletics</b>
                  <em>Yehia Kamal · Strength & body composition</em>
                </span>
                <CheckCircle2 size={22} />
                <button onClick={() => setStage("profile")}>
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            )}
          </section>
        )}
        {stage === "profile" && (
          <section className="entry-panel reveal">
            <span className="eyebrow">STEP 2 · YOUR ACCOUNT</span>
            <h2>Let’s set up your space.</h2>
            <p>
              No password is stored in this prototype. Production authentication
              will use a secure identity service.
            </p>
            <form className="profile-form" onSubmit={submitProfile}>
              <label htmlFor="client-name">Full name</label>
              <input
                id="client-name"
                value={profile.name}
                onChange={(event) =>
                  setProfile((value) => ({
                    ...value,
                    name: event.target.value.slice(0, 60),
                  }))
                }
                autoComplete="name"
                placeholder="Ahmed Hassan"
                required
              />
              <label htmlFor="client-email">Email address</label>
              <input
                id="client-email"
                type="email"
                value={profile.email}
                onChange={(event) =>
                  setProfile((value) => ({
                    ...value,
                    email: event.target.value.slice(0, 120),
                  }))
                }
                autoComplete="email"
                inputMode="email"
                placeholder="ahmed@example.com"
                required
              />
              <button className="entry-primary">
                Continue <ArrowRight size={18} />
              </button>
            </form>
          </section>
        )}
        {stage === "onboard" && (
          <section className="entry-panel onboard-panel reveal" key={step}>
            <div className="onboard-progress">
              <span>
                SETUP {step + 1} OF {ONBOARDING_STEPS.length}
              </span>
              <i>
                <b
                  style={{
                    width: `${((step + 1) / ONBOARDING_STEPS.length) * 100}%`,
                  }}
                />
              </i>
            </div>
            <span className="eyebrow">PERSONALISE YOUR PLAN</span>
            <h2>{currentStep.label}</h2>
            <p>{currentStep.hint}</p>
            <div className="onboard-options">
              {currentStep.options.map((option) => (
                <button
                  key={option}
                  className={answers[currentStep.id] === option ? "active" : ""}
                  onClick={() => chooseAnswer(option)}
                >
                  <span>{option}</span>
                  <i>
                    {answers[currentStep.id] === option ? (
                      <Check size={15} />
                    ) : (
                      <ArrowRight size={15} />
                    )}
                  </i>
                </button>
              ))}
            </div>
          </section>
        )}
        {stage === "welcome" && (
          <section className="entry-panel welcome-panel reveal">
            <div className="welcome-mark">
              <Check size={30} />
            </div>
            <span className="eyebrow">YOU'RE CONNECTED</span>
            <h2>Welcome, {profile.name.trim().split(" ")[0]}.</h2>
            <p>
              Yehia’s programme is ready. Your client app starts clean, and
              everything you log will build your progress from here.
            </p>
            <div className="welcome-summary">
              <span>
                <small>COACH</small>
                <b>Yehia Kamal</b>
              </span>
              <span>
                <small>GOAL</small>
                <b>{answers.goal}</b>
              </span>
              <span>
                <small>SCHEDULE</small>
                <b>{answers.days} weekly</b>
              </span>
            </div>
            <button
              className="entry-primary"
              onClick={() => onComplete({ ...profile, answers })}
            >
              Enter my programme <ArrowRight size={18} />
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

function AppHeader({
  onSettings,
  onNotifications,
  initials = "AH",
  notificationCount = 2,
}) {
  return (
    <header className="app-header">
      <div className="client-brand-lockup">
        <BrandMark compact />
        <small>powered by AVELN</small>
      </div>
      <div className="header-actions">
        <button
          className="icon-button notification"
          aria-label="Notifications"
          onClick={onNotifications}
        >
          <Bell size={19} strokeWidth={1.8} />
          {notificationCount > 0 && <span />}
        </button>
        <button
          className="avatar-button"
          onClick={onSettings}
          aria-label="Open settings"
        >
          {initials}
        </button>
      </div>
    </header>
  );
}

function DayRail({ selected, onSelect }) {
  const railRef = useRef(null);
  const dragRef = useRef({
    active: false,
    startX: 0,
    startScroll: 0,
    moved: false,
  });
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    railRef.current?.querySelector(".active")?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [selected]);
  function startDrag(event) {
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startScroll: railRef.current.scrollLeft,
      moved: false,
    };
    setDragging(true);
  }
  function moveDrag(event) {
    if (!dragRef.current.active) return;
    const distance = event.clientX - dragRef.current.startX;
    if (Math.abs(distance) > 8 && !dragRef.current.moved) {
      dragRef.current.moved = true;
      railRef.current.setPointerCapture?.(event.pointerId);
    }
    railRef.current.scrollLeft = dragRef.current.startScroll - distance * 1.15;
  }
  function endDrag(event) {
    if (dragRef.current.moved) event.preventDefault();
    railRef.current.releasePointerCapture?.(event.pointerId);
    dragRef.current.active = false;
    window.setTimeout(() => {
      dragRef.current.moved = false;
    }, 0);
    setDragging(false);
  }
  return (
    <section className="calendar-block">
      <div className="calendar-toolbar">
        <span>{CURRENT_MONTH_LABEL}</span>
        <b>Swipe through days</b>
      </div>
      <div
        className={`day-rail ${dragging ? "dragging" : ""}`}
        ref={railRef}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {calendarDays.map((item) => (
          <button
            onClick={() => onSelect(item.id)}
            className={`day-pill ${selected === item.id ? "active" : ""} ${item.status}`}
            key={item.id}
            aria-label={item.label}
          >
            <span>{item.day}</span>
            <b>{item.number}</b>
            {item.status === "complete" && <i />}
            {item.status === "missed" && <i className="missed-dot" />}
          </button>
        ))}
      </div>
    </section>
  );
}

function Home({
  onStartWorkout,
  onNavigate,
  onShare,
  programmeCovers,
  customCovers,
  firstName = "Ahmed",
}) {
  const [selectedDay, setSelectedDay] = useState(TODAY_ID);
  const day =
    calendarDays.find((item) => item.id === selectedDay) ||
    calendarDays.find((item) => item.status === "today");
  const isToday = day.status === "today";
  const isPast = day.status === "complete";
  const isRest = day.status === "rest";
  const isMissed = day.status === "missed";
  const isFuture = day.status === "future";
  const result = day.result || {
    sets: 16,
    volume: "3,760 kg",
    duration: "52:10",
    prs: 0,
  };

  const workoutAction = isToday
    ? onStartWorkout
    : isPast
      ? onShare
      : isRest
        ? () => setSelectedDay(TODAY_ID)
        : undefined;
  const workoutStatus = isToday
    ? "Ready to start"
    : isPast
      ? "Completed · tap for result"
      : isMissed
        ? "Not logged"
        : isRest
          ? "Recovery day"
          : "Unlocks on training day";

  return (
    <div className="screen home-screen reference-home">
      <section className="home-greeting block-pad reveal">
        <div>
          <span>Good morning,</span>
          <h1>
            {firstName} <em>👋</em>
          </h1>
        </div>
        <button
          className="home-profile-shortcut"
          onClick={() => onNavigate("coach")}
          aria-label="Open your coaching hub"
        >
          AH
        </button>
      </section>

      <section className="home-streak-card reveal reveal-delay-1">
        <header>
          <span className="streak-icon">
            <Flame size={19} />
          </span>
          <div>
            <strong>18</strong>
            <small>day streak</small>
          </div>
          <b>Best: 24 days</b>
        </header>
        <DayRail selected={selectedDay} onSelect={setSelectedDay} />
      </section>

      <section className="reference-section today-plan reveal reveal-delay-2">
        <div className="reference-section-head">
          <h2>Today’s Plan</h2>
          <span>Week 6 of 12</span>
        </div>

        <button
          className={`home-plan-row workout-plan-row ${isPast ? "complete" : ""} ${isMissed ? "missed" : ""}`}
          onClick={workoutAction}
          disabled={isFuture || isMissed}
        >
          <span className="plan-row-icon workout">
            <Dumbbell size={18} />
          </span>
          <span className="plan-row-copy">
            <small>WORKOUT</small>
            <b>{day.title}</b>
            <em>{workoutStatus}</em>
          </span>
          <span className="plan-row-meta">
            {isPast ? (
              <CheckCircle2 size={19} />
            ) : isFuture ? (
              <Lock size={17} />
            ) : (
              <ChevronRight size={19} />
            )}
          </span>
        </button>

        {isPast && (
          <div className="home-result-strip">
            <span>
              <b>{result.sets}</b>
              <small>sets</small>
            </span>
            <span>
              <b>{result.volume}</b>
              <small>volume</small>
            </span>
            <span>
              <b>{result.duration}</b>
              <small>duration</small>
            </span>
          </div>
        )}

        <button className="home-plan-row" onClick={() => onNavigate("fuel")}>
          <span className="plan-row-icon nutrition">
            <Utensils size={18} />
          </span>
          <span className="plan-row-copy">
            <small>NUTRITION</small>
            <b>1,060 / 2,400 kcal</b>
            <em>91% plan adherence</em>
          </span>
          <span className="plan-row-meta">
            <ChevronRight size={19} />
          </span>
        </button>

        <button className="home-plan-row" onClick={() => onNavigate("coach")}>
          <span className="plan-row-icon checkin">
            <ClipboardCheck size={18} />
          </span>
          <span className="plan-row-copy">
            <small>CHECK-IN</small>
            <b>Weekly check-in due</b>
            <em>About 3 minutes</em>
          </span>
          <span className="plan-row-meta">
            <ChevronRight size={19} />
          </span>
        </button>
      </section>

      <section className="home-week-card reveal reveal-delay-3">
        <div className="reference-section-head">
          <h2>Progress This Week</h2>
          <button onClick={() => onNavigate("progress")}>View details</button>
        </div>
        <div className="home-week-stats">
          <span>
            <b>3 / 4</b>
            <small>Workouts</small>
          </span>
          <span>
            <b>91%</b>
            <small>Nutrition</small>
          </span>
          <span>
            <b>−0.6 kg</b>
            <small>Weight</small>
          </span>
        </div>
        <div className="home-week-progress">
          <i />
        </div>
        <p>75% of your weekly plan is complete.</p>
      </section>

      <section className="home-coach-update reveal">
        <div className="coach-avatar">
          YK
          <span className="online-dot" />
        </div>
        <div>
          <small>YOUR COACH · 8 MIN AGO</small>
          <b>Depth looked much better this week.</b>
          <p>Own the pause today—the load can wait.</p>
        </div>
        <button onClick={() => onNavigate("coach")} aria-label="Reply to coach">
          <ChevronRight size={18} />
        </button>
      </section>
    </div>
  );
}

function Train({ onStartWorkout, programmeCovers, customCovers }) {
  return (
    <div className="screen train-screen">
      <section className="page-title block-pad reveal">
        <span className="eyebrow">Your programme · Week 6 of 12</span>
        <h1>Your training.</h1>
        <p>Strength block · four sessions this week</p>
      </section>

      <section className="plan-progress block-pad reveal reveal-delay-1">
        <div className="section-title">
          <span>Week progress</span>
          <b>75%</b>
        </div>
        <div className="session-dots">
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={n < 4 ? "done" : "current"}>
              {n < 4 ? <Check size={13} /> : n}
            </span>
          ))}
        </div>
        <div className="session-labels">
          <span>UPPER</span>
          <span>LOWER</span>
          <span>UPPER</span>
          <span>LOWER</span>
        </div>
      </section>

      <section className="next-session reveal reveal-delay-2">
        <img
          src={resolveCover(programmeCovers.day02, customCovers.day02)}
          alt="Lower strength workout cover"
        />
        <div className="next-session-shade" />
        <div className="session-number">04</div>
        <div className="next-session-copy">
          <span className="eyebrow">UP NEXT · TODAY</span>
          <h2>Lower strength</h2>
          <p>4 exercises · est. 50 min</p>
        </div>
        <button onClick={onStartWorkout} aria-label="Start workout">
          <ArrowRight />
        </button>
      </section>

      <section className="exercise-list block-pad">
        <div className="section-title">
          <span>Session plan</span>
          <b>
            {exercises.reduce((sum, exercise) => sum + exercise.sets, 0)} SETS
          </b>
        </div>
        {exercises.map((exercise, index) => (
          <article className="exercise-row" key={exercise.name}>
            <span className="exercise-index">0{index + 1}</span>
            <div className="exercise-main">
              <h3>{exercise.name}</h3>
              <p>
                {exercise.group} · {exercise.sets} × {exercise.reps}
              </p>
              <div>
                <span>LAST {exercise.last}</span>
                <span>NEXT {exercise.load} KG</span>
              </div>
            </div>
            <button
              className="exercise-options"
              onClick={onStartWorkout}
              aria-label={`Open ${exercise.name} in workout`}
            >
              <MoreHorizontal size={20} />
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}

function Fuel({ meals, setMeals }) {
  const [showAdd, setShowAdd] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const total = meals.reduce((sum, meal) => sum + meal.kcal, 0);
  const macros = meals.reduce(
    (sum, meal) => ({
      p: sum.p + Number(meal.p || 0),
      c: sum.c + Number(meal.c || 0),
      f: sum.f + Number(meal.f || 0),
    }),
    { p: 0, c: 0, f: 0 },
  );
  const remaining = 2400 - total;
  function quickAdd(meal) {
    setMeals((current) => [
      ...current,
      {
        ...meal,
        id: Date.now(),
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
    setShowAdd(false);
  }
  return (
    <div className="screen fuel-screen">
      <section className="page-title block-pad reveal fuel-page-title">
        <span className="eyebrow">TODAY · NUTRITION PLAN</span>
        <h1>Nutrition</h1>
        <p>Track meals and stay close to your daily targets.</p>
      </section>
      <section className="fuel-hero block-pad reveal">
        <span className="eyebrow">
          DAILY NUTRITION ·{" "}
          {new Intl.DateTimeFormat("en", { weekday: "long" })
            .format(new Date())
            .toUpperCase()}
        </span>
        <div className="calorie-display">
          <strong>{remaining.toLocaleString()}</strong>
          <span>
            kcal
            <br />
            remaining
          </span>
        </div>
        <div className="fuel-bar">
          <i style={{ width: `${Math.min(100, total / 24)}%` }} />
        </div>
        <div className="fuel-targets">
          <span>{total.toLocaleString()} EATEN</span>
          <span>2,400 TARGET</span>
        </div>
      </section>

      <section className="macro-grid reveal reveal-delay-1">
        <Macro
          label="Protein"
          value={macros.p}
          target="170g"
          percent={(macros.p / 170) * 100}
        />
        <Macro
          label="Carbs"
          value={macros.c}
          target="260g"
          percent={(macros.c / 260) * 100}
        />
        <Macro
          label="Fat"
          value={macros.f}
          target="70g"
          percent={(macros.f / 70) * 100}
        />
      </section>

      <section className="meal-log block-pad reveal reveal-delay-2">
        <div className="section-title">
          <span>Today's log</span>
          <button onClick={() => setShowAdd(true)}>
            <Plus size={15} /> ADD MEAL
          </button>
        </div>
        {meals.map((meal) => (
          <article
            className="meal-row"
            key={meal.id}
            role="button"
            tabIndex="0"
            onClick={() => setSelectedMeal(meal)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelectedMeal(meal);
              }
            }}
          >
            <time>{meal.time}</time>
            <div>
              <h3>{meal.name}</h3>
              <p>{meal.meta}</p>
              <span>{meal.p}g protein</span>
            </div>
            <strong>
              {meal.kcal}
              <small> kcal</small>
            </strong>
            <button
              className="remove-meal"
              onClick={(event) => {
                event.stopPropagation();
                setMeals((all) => all.filter((m) => m.id !== meal.id));
              }}
              aria-label={`Remove ${meal.name}`}
            >
              <X size={14} />
            </button>
          </article>
        ))}
        <button className="add-meal-card" onClick={() => setShowAdd(true)}>
          <Plus size={20} />
          <span>Log your next meal</span>
          <small>Photo or manual entry</small>
        </button>
      </section>

      <section className="nutrition-note block-pad">
        <span className="eyebrow">FROM YEHIA</span>
        <p>
          Keep 40–50g of carbs for after training. Recovery is part of the
          session.
        </p>
      </section>
      {showAdd && (
        <MealSheet onClose={() => setShowAdd(false)} onAdd={quickAdd} />
      )}
      {selectedMeal && (
        <FoodDetailSheet
          meal={selectedMeal}
          onClose={() => setSelectedMeal(null)}
          onUpdate={(updated) => {
            setMeals((all) =>
              all.map((meal) => (meal.id === updated.id ? updated : meal)),
            );
            setSelectedMeal(updated);
          }}
        />
      )}
    </div>
  );
}

function Macro({ label, value, target, percent }) {
  return (
    <div
      className="macro"
      style={{ "--macro": `${Math.min(100, Math.max(0, percent))}%` }}
    >
      <span>{label}</span>
      <strong>
        {Math.round(value)}
        <small>g</small>
      </strong>
      <div>
        <i />
      </div>
      <small>of {target}</small>
    </div>
  );
}

function MealSheet({ onClose, onAdd }) {
  useModalLifecycle(onClose);
  return (
    <div
      className="sheet-backdrop"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Add a meal"
    >
      <div
        className="bottom-sheet"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-head">
          <div>
            <span className="eyebrow">QUICK LOG</span>
            <h2>Add a meal</h2>
          </div>
          <button onClick={onClose} aria-label="Close meal logger">
            <X />
          </button>
        </div>
        <button
          className="photo-log"
          onClick={() =>
            onAdd({
              name: "Photo meal estimate",
              meta: "Snack · photo estimate",
              kcal: 510,
              p: 36,
              c: 49,
              f: 19,
              fibre: 7,
              ingredients: ["Photo estimate — tap to edit ingredients"],
            })
          }
        >
          <span>
            <ImageIcon size={22} />
          </span>
          <div>
            <b>Scan with camera</b>
            <small>AI estimates calories and macros</small>
          </div>
          <Sparkles size={17} />
        </button>
        <span className="or-label">OR ADD A RECENT MEAL</span>
        {[
          {
            name: "Chicken rice plate",
            meta: "Lunch · manual",
            kcal: 620,
            p: 48,
            c: 71,
            f: 16,
            fibre: 6,
            ingredients: ["Chicken", "Rice", "Vegetables", "Tahini"],
          },
          {
            name: "Protein oats",
            meta: "Breakfast · manual",
            kcal: 485,
            p: 38,
            c: 57,
            f: 12,
            fibre: 9,
            ingredients: ["Oats", "Whey protein", "Banana", "Milk"],
          },
          {
            name: "Beef wrap",
            meta: "Dinner · manual",
            kcal: 710,
            p: 52,
            c: 68,
            f: 26,
            fibre: 8,
            ingredients: ["Lean beef", "Flatbread", "Salad", "Yoghurt sauce"],
          },
        ].map((meal) => (
          <button
            className="recent-meal"
            key={meal.name}
            onClick={() => onAdd(meal)}
          >
            <div>
              <b>{meal.name}</b>
              <span>{meal.p}g protein</span>
            </div>
            <strong>{meal.kcal} kcal</strong>
            <Plus size={17} />
          </button>
        ))}
      </div>
    </div>
  );
}

function FoodDetailSheet({ meal, onClose, onUpdate }) {
  useModalLifecycle(onClose);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    kcal: meal.kcal,
    p: meal.p,
    c: meal.c ?? Math.max(0, Math.round((meal.kcal - meal.p * 4 - 14 * 9) / 4)),
    f: meal.f ?? 14,
  });
  const carbs = draft.c;
  const fat = draft.f;
  const fibre = meal.fibre ?? 6;
  const ingredients = meal.ingredients || [
    "Ingredients were not recorded for this entry",
  ];
  return (
    <div
      className="sheet-backdrop food-detail-backdrop"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Nutrition details for ${meal.name}`}
    >
      <div
        className="bottom-sheet food-detail-sheet"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-head">
          <div>
            <span className="eyebrow">NUTRITION DETAIL</span>
            <h2>{meal.name}</h2>
            <p>
              {meal.meta} · {meal.time}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close nutrition details">
            <X />
          </button>
        </div>
        {editing ? (
          <div className="nutrition-edit-grid">
            {[
              ["kcal", "Calories", "kcal"],
              ["p", "Protein", "g"],
              ["c", "Carbs", "g"],
              ["f", "Fat", "g"],
            ].map(([key, label, unit]) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  type="number"
                  min="0"
                  max={key === "kcal" ? 4000 : 500}
                  value={draft[key]}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      [key]: Math.max(0, Number(event.target.value)),
                    }))
                  }
                />
                <small>{unit}</small>
              </label>
            ))}
          </div>
        ) : (
          <>
            <div className="food-calorie-hero">
              <strong>{draft.kcal}</strong>
              <span>KCAL</span>
              <div>
                <b>{Math.round(draft.kcal / 24)}%</b>
                <small>of daily target</small>
              </div>
            </div>
            <div className="food-macro-detail">
              <div>
                <span>PROTEIN</span>
                <strong>
                  {draft.p}
                  <small>g</small>
                </strong>
                <i>
                  <b style={{ width: `${Math.min(100, draft.p / 1.7)}%` }} />
                </i>
              </div>
              <div>
                <span>CARBS</span>
                <strong>
                  {carbs}
                  <small>g</small>
                </strong>
                <i>
                  <b style={{ width: `${Math.min(100, carbs / 2.6)}%` }} />
                </i>
              </div>
              <div>
                <span>FAT</span>
                <strong>
                  {fat}
                  <small>g</small>
                </strong>
                <i>
                  <b style={{ width: `${Math.min(100, fat / 0.7)}%` }} />
                </i>
              </div>
            </div>
          </>
        )}
        <div className="food-secondary">
          <span>
            <small>FIBRE</small>
            <b>{fibre}g</b>
          </span>
          <span>
            <small>SOURCE</small>
            <b>{meal.meta.includes("photo") ? "AI estimate" : "Manual log"}</b>
          </span>
        </div>
        <div className="ingredient-list">
          <span className="eyebrow">WHAT'S IN IT</span>
          {ingredients.map((item, index) => (
            <div key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{item}</b>
            </div>
          ))}
        </div>
        <button
          className="edit-nutrition"
          onClick={() => {
            if (editing) onUpdate({ ...meal, ...draft });
            setEditing((value) => !value);
          }}
        >
          {editing ? "Save nutrition values" : "Edit nutrition values"}{" "}
          {editing ? <Check size={15} /> : <ArrowRight size={15} />}
        </button>
      </div>
    </div>
  );
}

function Progress({ onShare }) {
  const allWeights = [
    84.2, 84.0, 83.8, 83.6, 83.2, 83.0, 82.7, 82.6, 82.2, 81.9, 81.7, 81.4,
  ];
  const allWeekLabels = [
    "05 Jul",
    "12 Jul",
    "19 Jul",
    "26 Jul",
    "02 Aug",
    "09 Aug",
    "16 Aug",
    "23 Aug",
    "30 Aug",
    "06 Sep",
    "13 Sep",
    "Today",
  ];
  const [range, setRange] = useState(12);
  const weights = allWeights.slice(-range);
  const weekLabels = allWeekLabels.slice(-range);
  const points = weights.map((value, index) => ({
    x: index * (286 / (weights.length - 1)),
    y:
      12 +
      ((Math.max(...weights) - value) /
        Math.max(0.1, Math.max(...weights) - Math.min(...weights))) *
        76,
  }));
  const chartPoints = points.map(({ x, y }) => `${x},${y}`).join(" ");
  const [selectedPoint, setSelectedPoint] = useState(weights.length - 1);
  const [scrubbing, setScrubbing] = useState(false);
  const chartRef = useRef(null);
  const activePoint = points[selectedPoint];
  const consistency = Array.from({ length: 56 }, (_, index) => {
    if ([10, 24, 39, 47].includes(index)) return "missed";
    if ([6, 13, 20, 27, 34, 41, 48, 55].includes(index))
      return "nutrition-only";
    if ([4, 16, 30, 44, 51].includes(index)) return "training-only";
    return "both";
  });
  function scrubChart(event) {
    const rect = chartRef.current.getBoundingClientRect();
    const chartX = Math.max(
      0,
      Math.min(286, ((event.clientX - rect.left) / rect.width) * 286),
    );
    const next = Math.round((chartX / 286) * (weights.length - 1));
    if (next !== selectedPoint) {
      setSelectedPoint(next);
      navigator.vibrate?.(8);
    }
  }
  function beginScrub(event) {
    setScrubbing(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    scrubChart(event);
  }
  return (
    <div className="screen progress-screen">
      <section className="page-title block-pad reveal">
        <span className="eyebrow">Six weeks of progress</span>
        <h1>Your progress.</h1>
      </section>
      <section className="weight-panel block-pad reveal reveal-delay-1">
        <div className="section-title">
          <span>Body weight</span>
          <button
            onClick={() => {
              const next = range === 12 ? 6 : 12;
              setRange(next);
              setSelectedPoint(next - 1);
            }}
          >
            {range} WEEKS <ChevronRight size={14} />
          </button>
        </div>
        <div className="weight-main">
          <strong>{weights[selectedPoint].toFixed(1)}</strong>
          <span>KG</span>
          <div>
            <b>
              {selectedPoint === 0
                ? "Starting point"
                : `${(weights[selectedPoint] - weights[0]).toFixed(1)} kg`}
            </b>
            <small>
              {weekLabels[selectedPoint]} · week {selectedPoint + 1}
            </small>
          </div>
        </div>
        <div className={`chart-wrap ${scrubbing ? "scrubbing" : ""}`}>
          <span className="chart-label top">
            {Math.max(...weights).toFixed(1)}
          </span>
          <span className="chart-label bottom">
            {Math.min(...weights).toFixed(1)}
          </span>
          <svg
            ref={chartRef}
            viewBox="0 0 286 105"
            role="slider"
            tabIndex="0"
            aria-label={`Body weight ${weights[selectedPoint].toFixed(1)} kilograms on ${weekLabels[selectedPoint]}`}
            aria-valuemin="0"
            aria-valuemax={weights.length - 1}
            aria-valuenow={selectedPoint}
            onPointerDown={beginScrub}
            onPointerMove={(event) => {
              if (scrubbing) scrubChart(event);
            }}
            onPointerUp={() => setScrubbing(false)}
            onPointerCancel={() => setScrubbing(false)}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft")
                setSelectedPoint((value) => Math.max(0, value - 1));
              if (event.key === "ArrowRight")
                setSelectedPoint((value) =>
                  Math.min(weights.length - 1, value + 1),
                );
            }}
          >
            <defs>
              <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity=".28" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={`M ${chartPoints} L 286 105 L 0 105 Z`}
              fill="url(#area)"
            />
            <polyline
              points={chartPoints}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line
              className="scrub-line"
              x1={activePoint.x}
              y1="5"
              x2={activePoint.x}
              y2="96"
            />
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r="4"
              fill="var(--accent)"
            />
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r="9"
              fill="none"
              stroke="var(--accent)"
              opacity=".35"
            />
            <g
              className="chart-tooltip"
              transform={`translate(${Math.max(2, Math.min(238, activePoint.x - 24))},${Math.max(1, activePoint.y - 34)})`}
            >
              <rect width="48" height="23" />
              <text x="24" y="10">
                {weights[selectedPoint].toFixed(1)} KG
              </text>
              <text className="tooltip-date" x="24" y="18">
                {weekLabels[selectedPoint].toUpperCase()}
              </text>
            </g>
          </svg>
          <div className="chart-dates">
            <span>{weekLabels[0].toUpperCase()}</span>
            <span>
              {weekLabels[
                Math.floor((weekLabels.length - 1) / 3)
              ].toUpperCase()}
            </span>
            <span>
              {weekLabels[
                Math.floor(((weekLabels.length - 1) * 2) / 3)
              ].toUpperCase()}
            </span>
            <span>{weekLabels.at(-1).toUpperCase()}</span>
          </div>
          <div className="chart-touch-hint">
            <span>
              <i /> DRAG ACROSS THE LINE
            </span>
            <b>HAPTIC WEEK SCRUB</b>
          </div>
        </div>
      </section>
      <section className="progress-stats">
        <div>
          <span className="eyebrow">STRENGTH</span>
          <strong>
            +11<span>%</span>
          </strong>
          <p>Estimated squat 1RM</p>
        </div>
        <div>
          <span className="eyebrow">ADHERENCE</span>
          <strong>
            91<span>%</span>
          </strong>
          <p>Last 30 days</p>
        </div>
      </section>
      <section className="consistency block-pad">
        <div className="section-title">
          <span>Consistency</span>
          <b>TRAINING + NUTRITION</b>
        </div>
        <div className="heatmap">
          {consistency.map((state, index) => (
            <i
              key={index}
              className={state}
              title={
                state === "both"
                  ? "Training and nutrition hit"
                  : state === "training-only"
                    ? "Workout complete, nutrition off target"
                    : state === "nutrition-only"
                      ? "Nutrition hit, no workout planned"
                      : "No workout or nutrition log"
              }
            />
          ))}
        </div>
        <div className="consistency-legend">
          <span>
            <i className="both" />
            <b>Both hit</b>
          </span>
          <span>
            <i className="training-only" />
            <b>Workout only</b>
          </span>
          <span>
            <i className="nutrition-only" />
            <b>Nutrition only</b>
          </span>
          <span>
            <i className="missed" />
            <b>No log</b>
          </span>
        </div>
        <p className="consistency-read">
          Most days are aligned. Orange days show training completed while
          nutrition finished outside target; grey simply means nothing was
          recorded.
        </p>
      </section>
      <section className="recent-workouts block-pad">
        <div className="section-title">
          <span>Recent workouts</span>
          <b>TAP TO SHARE</b>
        </div>
        {[
          {
            title: "Upper Strength",
            date: "15 Aug",
            volume: "4,480 kg",
            time: "54:31",
            pr: true,
          },
          {
            title: "Lower Volume",
            date: "14 Aug",
            volume: "5,240 kg",
            time: "62:18",
            pr: false,
          },
        ].map((workout, index) => (
          <article key={workout.title}>
            <img
              src={index === 0 ? upperStrengthCover : lowerStrengthCover}
              alt=""
            />
            <div className="recent-workout-shade" />
            <div className="recent-workout-copy">
              <span>{workout.date} · COMPLETE</span>
              <h3>{workout.title}</h3>
              <div>
                <b>
                  {workout.volume}
                  <small>volume</small>
                </b>
                <b>
                  {workout.time}
                  <small>duration</small>
                </b>
                {workout.pr && (
                  <em>
                    <Zap size={11} /> PR
                  </em>
                )}
              </div>
            </div>
            <button onClick={onShare} aria-label={`Share ${workout.title}`}>
              <Share2 size={16} />
            </button>
          </article>
        ))}
      </section>
      <button className="share-progress block-pad" onClick={onShare}>
        <div>
          <Sparkles size={20} />
          <span>
            <b>Share your progress</b>
            <small>Create an Instagram-ready story</small>
          </span>
        </div>
        <ArrowRight />
      </button>
    </div>
  );
}

const COACH_FEED_POSTS = [
  {
    id: "squat-cues",
    type: "COACH VIDEO",
    title: "The 3 squat cues I want you using this week",
    excerpt:
      "A four-minute breakdown for stronger positioning, cleaner depth and more confidence under the bar.",
    meta: "4 min watch · Posted today",
    likes: 18,
    art: "violet",
    icon: Dumbbell,
    fresh: true,
  },
  {
    id: "eating-out",
    type: "NUTRITION PLAYBOOK",
    title: "Eating out without losing the week",
    excerpt:
      "My simple plate framework, ordering rules and the one thing I never want you compensating for tomorrow.",
    meta: "6 min read · 24 Aug",
    likes: 31,
    art: "coral",
    icon: Utensils,
  },
  {
    id: "client-qa",
    type: "MEMBER ANNOUNCEMENT",
    title: "September client Q&A is now live",
    excerpt:
      "Send your questions before Friday. I’ll cover training plateaus, meal timing and staying consistent while travelling.",
    meta: "Live session · 03 Sep, 19:00",
    likes: 12,
    art: "midnight",
    icon: Bell,
  },
];

function Coach({ messages, setMessages, onNavigate }) {
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [tab, setTab] = useState("overview");
  const [liked, setLiked] = useState({});
  const [saved, setSaved] = useState({});
  const [billingOpen, setBillingOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinSent, setCheckinSent] = useState(false);
  const [energy, setEnergy] = useState("Good");
  const [checkinNote, setCheckinNote] = useState("");
  const [resourceOpen, setResourceOpen] = useState(null);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  function showNotice(message) {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2400);
  }

  function addCallToCalendar() {
    const calendar = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//AVELN//Coaching Call//EN",
      "BEGIN:VEVENT",
      "UID:yehia-call-20260827@aveln.app",
      "DTSTAMP:20260825T090000Z",
      "DTSTART:20260827T183000",
      "DTEND:20260827T190000",
      "SUMMARY:Coaching call with Yehia Kamal",
      "DESCRIPTION:Monthly progress review and programme adjustments.",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([calendar], { type: "text/calendar;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "coaching-call-yehia.ics";
    link.click();
    URL.revokeObjectURL(url);
    showNotice("Coaching call added to your calendar download.");
  }

  function submitCheckin(event) {
    event.preventDefault();
    setCheckinSent(true);
    setCheckinOpen(false);
    showNotice("Weekly pulse sent privately to Yehia.");
  }

  function sendMessage(event) {
    event.preventDefault();
    if (!draft.trim() && !attachment) return;
    setMessages((all) => [
      ...all,
      {
        id: Date.now(),
        from: "me",
        text: draft.trim() || "Shared an image",
        attachment: attachment?.name,
        at: "Now",
      },
    ]);
    setDraft("");
    setAttachment(null);
  }

  const resources = [
    {
      id: "technique",
      icon: Dumbbell,
      title: "Technique library",
      detail: "12 coach-selected exercise videos for your current block.",
    },
    {
      id: "meals",
      icon: Utensils,
      title: "Meal framework",
      detail: "Portions, substitutions and eating-out rules for your target.",
    },
    {
      id: "checkin-guide",
      icon: FileText,
      title: "Check-in guide",
      detail: "How to take useful photos and write a better weekly reflection.",
    },
  ];

  return (
    <div className={`screen coach-screen coach-hub-screen tab-${tab}`}>
      <section className="coach-profile coach-hub-profile block-pad reveal">
        <div className="large-avatar">
          YK
          <span />
        </div>
        <div>
          <span className="eyebrow">YOUR COACH</span>
          <h1>Yehia Kamal</h1>
          <p>Strength & body composition</p>
        </div>
        <ShieldCheck size={19} aria-label="Private coaching conversation" />
      </section>
      <div className="coach-hub-tabs" role="tablist" aria-label="Coach hub">
        {[
          ["overview", "Overview"],
          ["feed", "Members feed"],
          ["chat", "Chat"],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
            {id === "feed" && <i />}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="coach-hub-overview reveal">
          <section className="membership-hero">
            <div className="membership-hero-top">
              <span>YOUR ACTIVE PROGRAMME</span>
              <b>
                <i /> IN PROGRESS
              </b>
            </div>
            <div className="membership-programme">
              <div>
                <small>12-WEEK COACHING BLOCK</small>
                <h2>Body Recomposition</h2>
                <p>Strength foundation · tailored nutrition · weekly review</p>
              </div>
              <div
                className="programme-ring"
                aria-label="Programme 50 percent complete"
              >
                <strong>6</strong>
                <span>of 12</span>
              </div>
            </div>
            <div className="programme-progress">
              <i />
            </div>
            <footer>
              <span>Next phase review after 2 more sessions</span>
              <button onClick={() => onNavigate("train")}>
                Open programme <ArrowRight size={15} />
              </button>
            </footer>
          </section>

          <section className="coaching-pulse">
            <div className="hub-section-title">
              <div>
                <span>COACHING PULSE</span>
                <h2>What’s next</h2>
              </div>
              <b>3 ITEMS</b>
            </div>
            <article>
              <span className="pulse-icon checkin">
                <ClipboardCheck size={18} />
              </span>
              <div>
                <small>SUNDAY · 30 AUGUST</small>
                <b>
                  {checkinSent ? "Weekly check-in sent" : "Weekly check-in"}
                </b>
                <p>
                  {checkinSent
                    ? "Yehia will review your update next."
                    : "Share energy, adherence and anything your coach should know."}
                </p>
              </div>
              {checkinSent ? (
                <span className="pulse-complete">
                  <Check size={15} />
                </span>
              ) : (
                <button onClick={() => setCheckinOpen((value) => !value)}>
                  {checkinOpen ? "Close" : "Start"}
                </button>
              )}
            </article>
            {checkinOpen && (
              <form className="quick-checkin" onSubmit={submitCheckin}>
                <label>How is your energy?</label>
                <div>
                  {["Low", "Good", "High"].map((value) => (
                    <button
                      type="button"
                      className={energy === value ? "active" : ""}
                      onClick={() => setEnergy(value)}
                      key={value}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <textarea
                  value={checkinNote}
                  onChange={(event) => setCheckinNote(event.target.value)}
                  placeholder="Anything Yehia should know this week?"
                  aria-label="Weekly check-in note"
                />
                <button className="submit-pulse">
                  Send private pulse <Send size={14} />
                </button>
              </form>
            )}
            <article>
              <span className="pulse-icon call">
                <CalendarDays size={18} />
              </span>
              <div>
                <small>THURSDAY · 27 AUGUST · 18:30</small>
                <b>Monthly coaching call</b>
                <p>
                  Progress review, questions and your next programme
                  adjustments.
                </p>
              </div>
              <button
                onClick={addCallToCalendar}
                aria-label="Add coaching call to calendar"
              >
                Add
              </button>
            </article>
            <article>
              <span className="pulse-icon payment">
                <CreditCard size={18} />
              </span>
              <div>
                <small>NEXT PAYMENT · 01 SEPTEMBER</small>
                <b>EGP 2,500 · Premium coaching</b>
                <p>Active subscription · Mastercard ending 2048</p>
              </div>
              <button onClick={() => setBillingOpen((value) => !value)}>
                {billingOpen ? "Hide" : "View"}
              </button>
            </article>
            {billingOpen && (
              <div className="billing-details">
                <div>
                  <span>Billing cycle</span>
                  <b>Monthly</b>
                </div>
                <div>
                  <span>Next charge</span>
                  <b>01 Sep · EGP 2,500</b>
                </div>
                <div>
                  <span>Payment method</span>
                  <b>•••• 2048</b>
                </div>
                <button
                  onClick={() =>
                    showNotice("Invoice history opened for this prototype.")
                  }
                >
                  View invoice history <ArrowRight size={14} />
                </button>
              </div>
            )}
          </section>

          <section className="latest-coach-post">
            <div className="hub-section-title">
              <div>
                <span>MEMBERS ONLY</span>
                <h2>Latest from Yehia</h2>
              </div>
              <button onClick={() => setTab("feed")}>View feed</button>
            </div>
            <button className="latest-post-card" onClick={() => setTab("feed")}>
              <span>
                <Dumbbell size={22} />
                <i>04:12</i>
              </span>
              <div>
                <small>NEW COACH VIDEO</small>
                <b>The 3 squat cues I want you using this week</b>
                <p>Made specifically for this training block.</p>
              </div>
              <ArrowRight size={18} />
            </button>
          </section>

          <section className="member-resources">
            <div className="hub-section-title">
              <div>
                <span>YOUR LIBRARY</span>
                <h2>Member resources</h2>
              </div>
            </div>
            {resources.map(({ id, icon: Icon, title, detail }) => (
              <article className={resourceOpen === id ? "open" : ""} key={id}>
                <button
                  onClick={() =>
                    setResourceOpen(resourceOpen === id ? null : id)
                  }
                >
                  <span>
                    <Icon size={18} />
                  </span>
                  <div>
                    <b>{title}</b>
                    <small>{detail}</small>
                  </div>
                  <ChevronRight size={17} />
                </button>
                {resourceOpen === id && (
                  <div className="resource-detail">
                    <p>
                      {detail} This resource stays available while your coaching
                      membership is active.
                    </p>
                    <button
                      onClick={() =>
                        showNotice(`${title} saved for offline access.`)
                      }
                    >
                      <Download size={14} /> Save for offline
                    </button>
                  </div>
                )}
              </article>
            ))}
          </section>

          <button className="message-coach-cta" onClick={() => setTab("chat")}>
            <span>
              <MessageCircle size={20} />
              <i />
            </span>
            <div>
              <b>Ask Yehia anything</b>
              <small>Online · usually replies in 20 min</small>
            </div>
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {tab === "feed" && (
        <section className="coach-member-feed reveal">
          <header>
            <span className="eyebrow">PRIVATE MEMBER FEED</span>
            <h2>From your coach.</h2>
            <p>
              Guidance, lessons and announcements shared only with Yehia’s
              active clients.
            </p>
          </header>
          {COACH_FEED_POSTS.map((post) => {
            const Icon = post.icon;
            return (
              <article className="feed-post" key={post.id}>
                <div className={`feed-post-art ${post.art}`}>
                  <Icon size={33} />
                  <span>{post.type}</span>
                  {post.fresh && <b>NEW</b>}
                </div>
                <div className="feed-post-body">
                  <div className="feed-author">
                    <span>YK</span>
                    <div>
                      <b>Yehia Kamal</b>
                      <small>{post.meta}</small>
                    </div>
                  </div>
                  <h3>{post.title}</h3>
                  <p>{post.excerpt}</p>
                  <div className="feed-post-actions">
                    <button
                      className={liked[post.id] ? "active" : ""}
                      onClick={() =>
                        setLiked((value) => ({
                          ...value,
                          [post.id]: !value[post.id],
                        }))
                      }
                      aria-label={`${liked[post.id] ? "Unlike" : "Like"} ${post.title}`}
                    >
                      <Heart
                        size={16}
                        fill={liked[post.id] ? "currentColor" : "none"}
                      />
                      {post.likes + (liked[post.id] ? 1 : 0)}
                    </button>
                    <button
                      onClick={() => {
                        setTab("chat");
                        setDraft(`About “${post.title}” — `);
                      }}
                    >
                      <MessageCircle size={16} /> Ask coach
                    </button>
                    <button
                      className={saved[post.id] ? "active" : ""}
                      onClick={() =>
                        setSaved((value) => ({
                          ...value,
                          [post.id]: !value[post.id],
                        }))
                      }
                      aria-label={`${saved[post.id] ? "Remove" : "Save"} ${post.title}`}
                    >
                      <Bookmark
                        size={16}
                        fill={saved[post.id] ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {tab === "chat" && (
        <>
          <div className="availability coach-hub-availability">
            <i /> ONLINE · USUALLY REPLIES IN 20 MIN
          </div>
          <section className="messages coach-hub-messages block-pad reveal">
            <div className="chat-privacy">
              <ShieldCheck size={15} />
              <span>Private between you and Yehia</span>
            </div>
            <div className="date-divider">
              <span>Today</span>
            </div>
            {messages.map((message) => (
              <div className={`message ${message.from}`} key={message.id}>
                {message.from === "coach" && (
                  <div className="mini-avatar">YK</div>
                )}
                <div>
                  {message.attachment && (
                    <em className="message-attachment">
                      <ImageIcon size={14} />
                      {message.attachment}
                    </em>
                  )}
                  <p>{message.text}</p>
                  <span>
                    {message.at}
                    {message.from === "me" && <Check size={12} />}
                  </span>
                </div>
              </div>
            ))}
          </section>
          <form
            className="message-form coach-hub-message-form"
            onSubmit={sendMessage}
          >
            <label className="attach-message" aria-label="Attach image">
              <Plus size={21} />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file && file.size <= 8 * 1024 * 1024) setAttachment(file);
                }}
              />
            </label>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Message Yehia…"
              aria-label="Message Yehia"
            />
            <button
              type="submit"
              className="send-button"
              aria-label="Send message"
            >
              <Send size={17} />
            </button>
            {attachment && (
              <button
                type="button"
                className="attachment-chip"
                onClick={() => setAttachment(null)}
              >
                {attachment.name}
                <X size={12} />
              </button>
            )}
          </form>
        </>
      )}

      {notice && (
        <div className="coach-hub-toast" role="status">
          <CheckCircle2 size={16} />
          {notice}
        </div>
      )}
    </div>
  );
}

function WorkoutSession({ onClose, onShare }) {
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setNumber, setSetNumber] = useState(1);
  const [weight, setWeight] = useState(85);
  const [reps, setReps] = useState(8);
  const [logged, setLogged] = useState([]);
  const [rest, setRest] = useState(null);
  const [complete, setComplete] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [substitutions, setSubstitutions] = useState({});
  const [exitConfirm, setExitConfirm] = useState(false);
  const exercise = substitutions[exerciseIndex] || exercises[exerciseIndex];
  const alternatives =
    exercise.group === "Lower body"
      ? ["Hack squat", "Leg press", "Goblet squat"]
      : exercise.group === "Hamstrings"
        ? ["Cable pull-through", "Hip thrust", "45° back extension"]
        : ["Machine variation", "Cable variation", "Bodyweight variation"];
  const elapsedLabel = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  useModalLifecycle(() => (logged.length ? setExitConfirm(true) : onClose()));

  useEffect(() => {
    if (rest === null || rest <= 0) return;
    const timer = window.setInterval(
      () => setRest((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [rest]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setElapsed((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);

  function logSet() {
    setLogged((all) => [
      ...all,
      { exercise: exercise.name, set: setNumber, weight, reps },
    ]);
    if (setNumber < exercise.sets) setSetNumber((n) => n + 1);
    else if (exerciseIndex < exercises.length - 1) {
      setExerciseIndex((n) => n + 1);
      setSetNumber(1);
    } else setComplete(true);
    setRest(45);
  }

  if (complete) {
    return (
      <div className="session-overlay complete-screen">
        <div className="complete-mark">
          <Check size={38} />
        </div>
        <span className="eyebrow light">SESSION COMPLETE</span>
        <h1>
          Work
          <br />
          banked.
        </h1>
        <p>Lower strength · {CURRENT_DATE_LABEL}</p>
        <div className="complete-grid">
          <div>
            <strong>{logged.length}</strong>
            <span>sets logged</span>
          </div>
          <div>
            <strong>
              {Math.round(
                logged.reduce((sum, set) => sum + set.weight * set.reps, 0),
              ).toLocaleString()}
            </strong>
            <span>kg volume</span>
          </div>
          <div>
            <strong>{elapsedLabel}</strong>
            <span>duration</span>
          </div>
        </div>
        <div className="pr-banner">
          <Zap size={19} />
          <div>
            <b>New personal best</b>
            <span>Back squat · 85 kg × 8</span>
          </div>
        </div>
        <button className="share-session-button" onClick={onShare}>
          <Share2 size={18} /> Share workout result
        </button>
        <button className="primary-button" onClick={onClose}>
          Back to today <ArrowRight size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="session-overlay">
      <header className="session-header">
        <button
          onClick={() => (logged.length ? setExitConfirm(true) : onClose())}
          aria-label="Close workout"
        >
          <X />
        </button>
        <div>
          <span>LOWER STRENGTH</span>
          <b>{elapsedLabel}</b>
        </div>
        <button
          onClick={() => setExitConfirm(true)}
          aria-label="Session options"
        >
          <CircleEllipsis />
        </button>
      </header>
      <div className="session-progress">
        <i
          style={{
            width: `${((exerciseIndex + setNumber / exercise.sets) / exercises.length) * 100}%`,
          }}
        />
      </div>
      <main className="session-body">
        <div className="exercise-counter">
          <span>
            EXERCISE {exerciseIndex + 1} OF {exercises.length}
          </span>
          <button onClick={() => setShowAlternatives(true)}>SWAP</button>
        </div>
        <h1>{exercise.name}</h1>
        <p>
          {exercise.sets} sets · {exercise.reps} reps · 90 sec rest
        </p>
        <div className="set-indicator">
          {Array.from({ length: exercise.sets }, (_, i) => (
            <span
              className={
                i + 1 < setNumber ? "done" : i + 1 === setNumber ? "active" : ""
              }
              key={i}
            >
              {i + 1 < setNumber ? <Check size={14} /> : i + 1}
            </span>
          ))}
        </div>
        <div className="input-labels">
          <span>WEIGHT · KG</span>
          <span>REPS</span>
        </div>
        <div className="set-inputs">
          <NumberControl value={weight} onChange={setWeight} step={2.5} />
          <NumberControl value={reps} onChange={setReps} step={1} />
        </div>
        <div className="last-performance">
          <span>LAST PERFORMANCE</span>
          <b>
            {exercise.last} <ArrowRight size={14} />
          </b>
        </div>
        <button className="log-set" onClick={logSet}>
          <span>Log set {setNumber}</span>
          <Check />
        </button>
        {logged.length > 0 && (
          <div className="logged-sets">
            <span className="eyebrow">LOGGED THIS SESSION</span>
            {logged.slice(-3).map((set, i) => (
              <div key={i}>
                <span>{set.exercise}</span>
                <b>
                  {set.weight} kg × {set.reps}
                </b>
              </div>
            ))}
          </div>
        )}
      </main>
      {rest !== null && rest > 0 && (
        <div className="rest-panel">
          <div className="rest-copy">
            <TimerReset />
            <div>
              <span>RESTING</span>
              <strong>0:{String(rest).padStart(2, "0")}</strong>
            </div>
          </div>
          <div>
            <button onClick={() => setRest((n) => n + 15)}>+15</button>
            <button onClick={() => setRest(0)}>SKIP</button>
          </div>
        </div>
      )}
      {showAlternatives && (
        <div
          className="session-choice-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Swap exercise"
        >
          <header>
            <div>
              <span className="eyebrow">COACH-APPROVED</span>
              <h2>Swap {exercise.name}</h2>
            </div>
            <button
              onClick={() => setShowAlternatives(false)}
              aria-label="Close exercise alternatives"
            >
              <X />
            </button>
          </header>
          <p>Choose an alternative with the same training intent.</p>
          {alternatives.map((name) => (
            <button
              key={name}
              onClick={() => {
                setSubstitutions((value) => ({
                  ...value,
                  [exerciseIndex]: {
                    ...exercises[exerciseIndex],
                    name,
                    last: "Not logged",
                  },
                }));
                setShowAlternatives(false);
              }}
            >
              <span>
                <b>{name}</b>
                <small>
                  {exercise.group} · {exercise.sets} × {exercise.reps}
                </small>
              </span>
              <ArrowRight size={16} />
            </button>
          ))}
        </div>
      )}
      {exitConfirm && (
        <div
          className="session-choice-panel exit-choice"
          role="dialog"
          aria-modal="true"
          aria-label="Workout options"
        >
          <header>
            <div>
              <span className="eyebrow">SESSION IN PROGRESS</span>
              <h2>Pause or leave?</h2>
            </div>
            <button
              onClick={() => setExitConfirm(false)}
              aria-label="Return to workout"
            >
              <X />
            </button>
          </header>
          <p>
            Your logged sets remain in this prototype until you leave the
            session.
          </p>
          <button onClick={() => setExitConfirm(false)}>
            <span>
              <b>Continue workout</b>
              <small>Return to the current set</small>
            </span>
            <ArrowRight size={16} />
          </button>
          <button className="danger-option" onClick={onClose}>
            <span>
              <b>Discard and leave</b>
              <small>This session will not be saved</small>
            </span>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function NumberControl({ value, onChange, step }) {
  return (
    <div className="number-control">
      <button
        onClick={() => onChange((n) => Math.max(0, n - step))}
        aria-label={`Decrease by ${step}`}
      >
        <Minus />
      </button>
      <strong aria-live="polite">{value}</strong>
      <button
        onClick={() => onChange((n) => n + step)}
        aria-label={`Increase by ${step}`}
      >
        <Plus />
      </button>
    </div>
  );
}

function NotificationsSheet({ onClose }) {
  useModalLifecycle(onClose);
  const [items, setItems] = useState([
    {
      id: 1,
      kind: "coach",
      title: "Yehia reviewed your squat",
      detail: "“Depth is much better. Keep the pause today.”",
      time: "8 min",
    },
    {
      id: 2,
      kind: "win",
      title: "12-day consistency run",
      detail: "Training and nutrition are aligned.",
      time: "Today",
    },
    {
      id: 3,
      kind: "checkin",
      title: "Weekly check-in tomorrow",
      detail: "Weight, reflection and progress photos.",
      time: "1 day",
    },
  ]);
  return (
    <div
      className="settings-panel notifications-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Notifications"
    >
      <header>
        <button onClick={onClose} aria-label="Close notifications">
          <ArrowLeft />
        </button>
        <h2>Notifications</h2>
        <button onClick={() => setItems([])} className="clear-notifications">
          Clear
        </button>
      </header>
      <div className="notification-heading">
        <span className="eyebrow">INBOX</span>
        <h1>{items.length ? "What’s new." : "You’re all caught up."}</h1>
        <p>
          {items.length
            ? `${items.length} updates from your programme and coach.`
            : "New coaching updates will appear here."}
        </p>
      </div>
      <section className="notification-list">
        {items.map((item) => (
          <article key={item.id}>
            <span className={`notification-kind ${item.kind}`}>
              {item.kind === "coach" ? (
                <MessageCircle size={17} />
              ) : item.kind === "win" ? (
                <Zap size={17} />
              ) : (
                <ClipboardCheck size={17} />
              )}
            </span>
            <div>
              <b>{item.title}</b>
              <p>{item.detail}</p>
              <small>{item.time}</small>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function SettingsSheet({
  onClose,
  accent,
  setAccent,
  onIntro,
  profile,
  onSignOut,
}) {
  useModalLifecycle(onClose);
  const [section, setSection] = useState(null);
  const [reminders, setReminders] = useState({
    workout: true,
    nutrition: true,
    checkin: true,
    coach: true,
    wins: true,
  });
  const [targetWeight, setTargetWeight] = useState(78);
  const [units, setUnits] = useState("Metric");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const initials = (profile.name || "Ahmed Hassan")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const title = section || "Profile & settings";
  return (
    <div
      className={`settings-panel ${reduceMotion ? "reduce-motion" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header>
        <button
          onClick={() => (section ? setSection(null) : onClose())}
          aria-label={section ? "Back to settings" : "Close settings"}
        >
          <ArrowLeft />
        </button>
        <h2>{title}</h2>
        <span />
      </header>
      {!section && (
        <>
          <div className="settings-profile">
            <div className="profile-avatar">{initials}</div>
            <div>
              <h1>{profile.name || "Ahmed Hassan"}</h1>
              <p>{profile.email || "ahmed@example.com"}</p>
            </div>
          </div>
          <section>
            <span className="eyebrow">COACH BRAND</span>
            <div className="coach-brand-row">
              <div className="brand-logo-small">YA</div>
              <div>
                <b>Yehia Athletics</b>
                <span>Coach · Yehia Kamal</span>
              </div>
              <span className="connected">CONNECTED</span>
            </div>
          </section>
          <section>
            <span className="eyebrow">LIVE ACCENT</span>
            <p className="settings-help">
              This is the coach-controlled white-label colour.
            </p>
            <div className="accent-picker">
              {ACCENTS.map((color) => (
                <button
                  key={color}
                  className={accent === color ? "active" : ""}
                  style={{ "--swatch": color }}
                  onClick={() => setAccent(color)}
                  aria-label={`Use ${color} accent`}
                >
                  {accent === color && <Check size={16} />}
                </button>
              ))}
            </div>
          </section>
          <section className="settings-links">
            {[
              [Bell, "Notifications", "5 enabled"],
              [Target, "Goals & targets", `${targetWeight} kg`],
              [Dumbbell, "Training preferences", units],
              [Settings, "App settings", ""],
            ].map(([Icon, label, value]) => (
              <button key={label} onClick={() => setSection(label)}>
                <Icon size={19} />
                <span>{label}</span>
                <small>{value}</small>
                <ChevronRight size={17} />
              </button>
            ))}
          </section>
          <button className="view-intro" onClick={onIntro}>
            View brand introduction
          </button>
          <button className="sign-out-button" onClick={onSignOut}>
            Sign out & reset prototype
          </button>
          <div className="settings-version">
            <BrandMark compact />
            <span>VERSION 1.0 · COACHOS.V3</span>
          </div>
        </>
      )}
      {section === "Notifications" && (
        <section className="preference-page">
          <span className="eyebrow">REMINDERS</span>
          <p>Choose which updates can notify you.</p>
          {[
            ["workout", "Workout reminder", "Daily at 17:30"],
            [
              "nutrition",
              "Nutrition reminder",
              "If a meal is missing by 21:00",
            ],
            ["checkin", "Check-in reminder", "Every Friday"],
            ["coach", "Posts from Yehia", "Team feed and direct notes"],
            ["wins", "PRs and milestones", "Streaks, records and wins"],
          ].map(([id, label, detail]) => (
            <button
              key={id}
              role="switch"
              aria-checked={reminders[id]}
              onClick={() =>
                setReminders((value) => ({ ...value, [id]: !value[id] }))
              }
            >
              <span>
                <b>{label}</b>
                <small>{detail}</small>
              </span>
              <i className={reminders[id] ? "on" : ""}>
                <em />
              </i>
            </button>
          ))}
        </section>
      )}
      {section === "Goals & targets" && (
        <section className="preference-page">
          <span className="eyebrow">CURRENT GOAL</span>
          <h2>Body recomposition</h2>
          <p>
            Your coach controls programme targets. You can update your preferred
            goal weight here.
          </p>
          <label className="setting-number">
            <span>Target weight</span>
            <input
              type="number"
              min="35"
              max="250"
              value={targetWeight}
              onChange={(event) =>
                setTargetWeight(
                  Math.max(35, Math.min(250, Number(event.target.value))),
                )
              }
            />
            <small>kg</small>
          </label>
          <div className="privacy-note">
            <ShieldCheck size={17} />
            <span>Changes are shared only with your assigned coach.</span>
          </div>
        </section>
      )}
      {section === "Training preferences" && (
        <section className="preference-page">
          <span className="eyebrow">MEASUREMENT UNITS</span>
          <h2>How numbers appear.</h2>
          <p>Your logged history remains unchanged when units switch.</p>
          <div className="setting-segmented">
            {["Metric", "Imperial"].map((item) => (
              <button
                className={units === item ? "active" : ""}
                onClick={() => setUnits(item)}
                key={item}
              >
                {item}
                {units === item && <Check size={14} />}
              </button>
            ))}
          </div>
        </section>
      )}
      {section === "App settings" && (
        <section className="preference-page">
          <span className="eyebrow">ACCESSIBILITY & PRIVACY</span>
          <h2>Make the app comfortable.</h2>
          <button
            role="switch"
            aria-checked={reduceMotion}
            onClick={() => setReduceMotion((value) => !value)}
          >
            <span>
              <b>Reduce motion</b>
              <small>Minimise screen transitions and animated feedback</small>
            </span>
            <i className={reduceMotion ? "on" : ""}>
              <em />
            </i>
          </button>
          <div className="privacy-note">
            <ShieldCheck size={17} />
            <span>
              This prototype stores data only in this browser. It does not
              transmit your entries to a server.
            </span>
          </div>
          <div className="data-summary">
            <b>Prototype data controls</b>
            <p>
              Reset removes your local profile, meal logs, messages and
              preferences from this browser.
            </p>
            {confirmReset ? (
              <div>
                <button onClick={() => setConfirmReset(false)}>Cancel</button>
                <button onClick={onSignOut}>Confirm reset</button>
              </div>
            ) : (
              <button onClick={() => setConfirmReset(true)}>
                Reset all local data
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav">
      {navItems.map(({ id, label, icon: Icon }) => (
        <button
          className={active === id ? "active" : ""}
          onClick={() => onChange(id)}
          key={id}
        >
          <Icon size={20} strokeWidth={active === id ? 2.3 : 1.7} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function DesktopRail({
  screen,
  setScreen,
  accent,
  setAccent,
  onIntro,
  onCoach,
}) {
  return (
    <aside className="desktop-rail">
      <PlatformMark />
      <div className="desktop-statement">
        <span className="eyebrow light">PRIVATE COACHING, BEAUTIFULLY RUN</span>
        <h1>
          Every detail,
          <br />
          in rhythm.
        </h1>
        <p>
          A premium white-label client experience for ambitious coaches and the
          people who trust them.
        </p>
      </div>
      <div className="rail-nav">
        {navItems.map(({ id, label }) => (
          <button
            className={screen === id ? "active" : ""}
            onClick={() => setScreen(id)}
            key={id}
          >
            <span>0{navItems.findIndex((item) => item.id === id) + 1}</span>
            {label}
            <ArrowRight size={16} />
          </button>
        ))}
      </div>
      <div className="rail-footer">
        <span>WHITE-LABEL PREVIEW</span>
        <div>
          {ACCENTS.map((color) => (
            <button
              aria-label={`Change accent to ${color}`}
              key={color}
              onClick={() => setAccent(color)}
              className={accent === color ? "active" : ""}
              style={{ "--swatch": color }}
            />
          ))}
        </div>
        <button className="rail-intro" onClick={onIntro}>
          VIEW INTRO
        </button>
        <button className="rail-coach" onClick={onCoach}>
          COACH VIEW <ArrowRight size={12} />
        </button>
      </div>
    </aside>
  );
}

function ShareStudio({ onClose, accent }) {
  useModalLifecycle(onClose);
  const { brand } = useContext(BrandContext);
  const [theme, setTheme] = useState("rack");
  const [copied, setCopied] = useState(false);
  const themes = [
    { id: "rack", label: "Strength", image: shareStrengthRack },
    { id: "track", label: "Track", image: shareTrackDawn },
    { id: "dumbbells", label: "Dumbbells", image: shareDumbbellsStudio },
    { id: "recovery", label: "Recovery", image: shareRecovery },
    { id: "night", label: "Night gym", image: shareNightGym },
  ];

  async function renderStory(share = false) {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    await document.fonts.ready;
    const background =
      themes.find((item) => item.id === theme)?.image || lowerStrengthCover;
    const image = new Image();
    image.src = background;
    await image.decode();
    const scale = Math.max(
      canvas.width / image.width,
      canvas.height / image.height,
    );
    const width = image.width * scale;
    const height = image.height * scale;
    ctx.drawImage(
      image,
      (canvas.width - width) / 2,
      (canvas.height - height) / 2,
      width,
      height,
    );
    const shade = ctx.createLinearGradient(0, 0, 0, canvas.height);
    shade.addColorStop(0, "rgba(7,8,8,.16)");
    shade.addColorStop(0.42, "rgba(7,8,8,.28)");
    shade.addColorStop(1, "rgba(7,8,8,.97)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f7f5ef";
    if (brand.logo) {
      const logo = new Image();
      logo.src = brand.logo;
      await logo.decode();
      const logoScale = Math.min(190 / logo.width, 66 / logo.height);
      ctx.drawImage(
        logo,
        76,
        55,
        logo.width * logoScale,
        logo.height * logoScale,
      );
      if (brand.showName !== false) {
        ctx.font = "700 32px Space Grotesk";
        ctx.fillText(brand.name, 76 + logo.width * logoScale + 24, 101);
      }
    } else {
      ctx.font = "700 40px Space Grotesk";
      ctx.fillText(brand.name || DEFAULT_BRAND.name, 76, 110);
    }
    ctx.fillStyle = "rgba(247,245,239,.48)";
    ctx.font = "700 16px Space Grotesk";
    ctx.fillText("POWERED BY AVELN", 76, 145);
    ctx.font = "700 24px Space Grotesk";
    ctx.fillStyle = accent;
    ctx.fillText("YEHIA ATHLETICS · WEEK 06", 76, 1040);
    ctx.fillStyle = "#f7f5ef";
    ctx.font = "500 112px Space Grotesk";
    ctx.fillText("LOWER", 70, 1190);
    ctx.fillText("STRENGTH", 70, 1300);
    ctx.strokeStyle = "rgba(255,255,255,.25)";
    ctx.beginPath();
    ctx.moveTo(76, 1380);
    ctx.lineTo(1004, 1380);
    ctx.stroke();
    const stats = [
      ["47:18", "DURATION"],
      ["2,840", "KG VOLUME"],
      ["01", "NEW PR"],
    ];
    stats.forEach(([value, label], index) => {
      const x = 76 + index * 310;
      ctx.fillStyle = "#f7f5ef";
      ctx.font = "600 58px Space Grotesk";
      ctx.fillText(value, x, 1490);
      ctx.fillStyle = "rgba(247,245,239,.58)";
      ctx.font = "700 18px Space Grotesk";
      ctx.fillText(label, x, 1532);
    });
    ctx.fillStyle = accent;
    ctx.fillRect(76, 1640, 928, 3);
    ctx.fillStyle = "#f7f5ef";
    ctx.font = "500 34px Space Grotesk";
    ctx.fillText("Work banked. Keep moving.", 76, 1715);
    ctx.fillStyle = "rgba(247,245,239,.5)";
    ctx.font = "500 20px Space Grotesk";
    ctx.fillText(
      `@AHMED.TRAINS  ·  ${new Intl.DateTimeFormat("en", { day: "2-digit", month: "long" }).format(new Date()).toUpperCase()}`,
      76,
      1795,
    );
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png", 1),
    );
    const file = new File([blob], "workout-lower-strength.png", {
      type: "image/png",
    });
    if (share && navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: `Lower Strength · ${brand.name}`,
        text: "Work banked. Lower Strength with Yehia Athletics.",
        files: [file],
      });
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyCaption() {
    await navigator.clipboard?.writeText(
      "Lower Strength ✓\n47:18 · 2,840 kg volume · New squat PR\n\nCoached by @yehiaathletics #CoachOS",
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="share-studio">
      <header>
        <button onClick={onClose} aria-label="Close share studio">
          <X />
        </button>
        <div>
          <span>SHARE STUDIO</span>
          <b>Workout story</b>
        </div>
        <button onClick={copyCaption} aria-label="Copy caption">
          {copied ? <Check size={19} /> : <Copy size={19} />}
        </button>
      </header>
      <div className="share-stage">
        <div className={`story-card theme-${theme}`}>
          <img
            src={themes.find((item) => item.id === theme)?.image}
            alt={`${themes.find((item) => item.id === theme)?.label} story background`}
          />
          <div className="story-shade" />
          <div className="story-brand">
            <BrandMark compact />
            <span>POWERED BY AVELN</span>
          </div>
          <div className="story-content">
            <span>WORKOUT COMPLETE · WEEK 06</span>
            <h1>
              Lower
              <br />
              Strength
            </h1>
            <div className="story-stats">
              <div>
                <b>47:18</b>
                <small>duration</small>
              </div>
              <div>
                <b>2,840</b>
                <small>kg volume</small>
              </div>
              <div>
                <b>01</b>
                <small>new PR</small>
              </div>
            </div>
            <p>Work banked. Keep moving.</p>
          </div>
        </div>
      </div>
      <div className="share-controls">
        <span className="eyebrow">CHOOSE A BACKGROUND</span>
        <div className="theme-picker">
          {themes.map((item) => (
            <button
              key={item.id}
              onClick={() => setTheme(item.id)}
              className={`${item.id} ${theme === item.id ? "active" : ""}`}
            >
              <i style={{ backgroundImage: `url(${item.image})` }} />
              {item.label}
            </button>
          ))}
        </div>
        <div className="share-quality">
          <span>9:16 STORY</span>
          <span>1080 × 1920</span>
          <span>COACH BRANDED</span>
        </div>
        <button className="share-native" onClick={() => renderStory(true)}>
          <Share2 size={18} /> Share to Instagram / apps
        </button>
        <button className="download-story" onClick={() => renderStory(false)}>
          <Download size={17} /> Download 1080 × 1920 PNG
        </button>
      </div>
    </div>
  );
}

const coachClients = [
  {
    initials: "AH",
    name: "Ahmed Hassan",
    plan: "Body recomposition",
    adherence: 91,
    training: 86,
    nutrition: 91,
    checkins: 100,
    weight: "81.4 kg",
    change: "−2.8 kg",
    flag: "Check-in due",
    progress: "Progressing",
    subscription: "Paid",
    renews: "01 Sep",
    inbodies: 3,
    tone: "purple",
  },
  {
    initials: "MN",
    name: "Mariam Nassar",
    plan: "Strength foundation",
    adherence: 96,
    training: 100,
    nutrition: 94,
    checkins: 100,
    weight: "64.2 kg",
    change: "+1.1 kg",
    flag: "On track",
    progress: "Progressing",
    subscription: "Paid",
    renews: "04 Sep",
    inbodies: 2,
    tone: "mint",
  },
  {
    initials: "OK",
    name: "Omar Khalil",
    plan: "Fat loss",
    adherence: 72,
    training: 63,
    nutrition: 58,
    checkins: 50,
    weight: "92.8 kg",
    change: "−4.3 kg",
    flag: "Needs attention",
    progress: "Stalled",
    subscription: "Payment due",
    renews: "18 Aug",
    inbodies: 4,
    tone: "orange",
  },
  {
    initials: "LS",
    name: "Lina Samir",
    plan: "Performance",
    adherence: 88,
    training: 92,
    nutrition: 84,
    checkins: 100,
    weight: "59.7 kg",
    change: "+0.4 kg",
    flag: "Video review",
    progress: "On target",
    subscription: "Paid",
    renews: "11 Sep",
    inbodies: 2,
    tone: "blue",
  },
];

function CoachOverview({ onOpenClient, onNotice }) {
  const attention = coachClients.filter((client) => client.flag !== "On track");
  return (
    <div className="coach-overview-view">
      <section className="coach-metrics">
        <div>
          <span>
            <Users size={17} /> ACTIVE CLIENTS
          </span>
          <strong>24</strong>
          <small>of 30 seats</small>
        </div>
        <div>
          <span>
            <ClipboardCheck size={17} /> CHECK-INS
          </span>
          <strong>06</strong>
          <small>waiting for review</small>
        </div>
        <div>
          <span>
            <TrendingUp size={17} /> ADHERENCE
          </span>
          <strong>
            88<em>%</em>
          </strong>
          <small>training 86 · nutrition 89</small>
        </div>
        <div>
          <span>
            <CreditCard size={17} /> MONTHLY REVENUE
          </span>
          <strong>
            47.5<em>K</em>
          </strong>
          <small>EGP · 2 payments due</small>
        </div>
      </section>
      <div className="triage-layout">
        <section className="triage-board">
          <div className="console-section-head">
            <div>
              <span className="eyebrow">AI TRIAGE · UPDATED NOW</span>
              <h2>3 clients need you today</h2>
              <p>Sorted by impact and time off track.</p>
            </div>
            <button
              onClick={() =>
                onNotice(
                  "Triage rules opened · attention is ranked by adherence, check-ins and stalled progress.",
                )
              }
            >
              TRIAGE RULES <SlidersHorizontal size={14} />
            </button>
          </div>
          {attention.map((client, index) => (
            <article className="triage-card" key={client.name}>
              <span className={`triage-rank ${index === 1 ? "urgent" : ""}`}>
                0{index + 1}
              </span>
              <span className={`client-initials ${client.tone}`}>
                {client.initials}
              </span>
              <div className="triage-client">
                <b>{client.name}</b>
                <small>
                  {client.plan} · {client.progress}
                </small>
              </div>
              <div className="triage-reason">
                <span>{client.flag}</span>
                <p>
                  {client.name === "Omar Khalil"
                    ? "Training 63%, nutrition 58%, weight unchanged for 16 days."
                    : client.name === "Ahmed Hassan"
                      ? "Weekly check-in is due today; training remains on plan."
                      : "New technique video is waiting for review."}
                </p>
              </div>
              <button onClick={() => onOpenClient(client)}>
                {client.name === "Omar Khalil" ? "Adjust plan" : "Open client"}{" "}
                <ArrowRight size={14} />
              </button>
              <button
                className="triage-message"
                aria-label={`Message ${client.name}`}
                onClick={() =>
                  onNotice(`Message thread opened for ${client.name}.`)
                }
              >
                <MessageCircle size={15} />
              </button>
            </article>
          ))}
          <div className="good-news">
            <div>
              <Zap size={18} />
              <span>
                <b>Good news worth celebrating</b>
                <small>
                  Mariam hit a deadlift PR · Lina completed 4/4 sessions
                </small>
              </span>
            </div>
            <button
              onClick={() =>
                onNotice("Celebration drafted for the client feed.")
              }
            >
              Celebrate <ArrowRight size={14} />
            </button>
          </div>
        </section>
        <aside className="coach-day-panel">
          <div className="console-section-head">
            <div>
              <span className="eyebrow">PORTFOLIO HEALTH</span>
              <h2>At a glance</h2>
            </div>
          </div>
          <div className="health-ring">
            <strong>18</strong>
            <span>ON TRACK</span>
          </div>
          <div className="health-key">
            <span>
              <i className="healthy" />
              18 progressing
            </span>
            <span>
              <i className="watch" />4 need watching
            </span>
            <span>
              <i className="stalled" />2 stalled
            </span>
          </div>
          <div className="adherence-split">
            <span>
              WORKOUTS <b>86%</b>
              <i>
                <em style={{ width: "86%" }} />
              </i>
            </span>
            <span>
              NUTRITION <b>89%</b>
              <i>
                <em style={{ width: "89%" }} />
              </i>
            </span>
            <span>
              CHECK-INS <b>92%</b>
              <i>
                <em style={{ width: "92%" }} />
              </i>
            </span>
          </div>
          <div className="today-mini-schedule">
            <span className="eyebrow">NEXT UP</span>
            <b>15:30 · Mariam Nassar</b>
            <small>Weekly check-in · video call</small>
            <button onClick={() => onNotice("Today’s schedule opened.")}>
              Open schedule <ArrowRight size={13} />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function WorkoutCoverPicker({
  day,
  selectedId,
  customImage,
  onSelect,
  onCustom,
  onClose,
}) {
  const [uploadError, setUploadError] = useState("");
  useModalLifecycle(onClose);
  function chooseFromGallery(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 8 * 1024 * 1024
    ) {
      setUploadError("Use a JPG, PNG or WebP image under 8 MB.");
      event.target.value = "";
      return;
    }
    setUploadError("");
    const reader = new FileReader();
    reader.onload = () => onCustom(reader.result);
    reader.readAsDataURL(file);
  }
  return (
    <div
      className="cover-picker-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Choose cover for ${day.title}`}
    >
      <section className="cover-picker">
        <header>
          <div>
            <span className="eyebrow">SESSION COVER · {day.day}</span>
            <h2>{day.title}</h2>
            <p>Choose what the client sees on Today and Train.</p>
          </div>
          <button onClick={onClose} aria-label="Close cover picker">
            <X size={19} />
          </button>
        </header>
        <div className="cover-picker-preview">
          <img
            src={resolveCover(selectedId, customImage)}
            alt="Selected workout cover preview"
          />
          <div>
            <span>CLIENT PREVIEW</span>
            <b>{day.title}</b>
            <small>{day.count} · Week 06</small>
          </div>
        </div>
        <div className="cover-preset-heading">
          <span className="eyebrow">AVELN PRESETS</span>
          <small>5 PEOPLE-FREE COVERS</small>
        </div>
        <div className="cover-preset-grid">
          {WORKOUT_COVERS.map((cover) => (
            <button
              key={cover.id}
              className={selectedId === cover.id ? "active" : ""}
              aria-pressed={selectedId === cover.id}
              onClick={() => onSelect(cover.id)}
            >
              <img src={cover.image} alt="" />
              <span>{cover.label}</span>
              {selectedId === cover.id && (
                <i>
                  <Check size={11} />
                </i>
              )}
            </button>
          ))}
        </div>
        <label
          className={`cover-gallery-option ${selectedId === "custom" ? "active" : ""}`}
        >
          <ImageIcon size={19} />
          <span>
            <b>Choose from gallery</b>
            <small>JPG, PNG or WebP · maximum 8 MB</small>
          </span>
          <Upload size={16} />
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={chooseFromGallery}
          />
        </label>
        {uploadError && (
          <div className="cover-upload-error" role="alert">
            {uploadError}
          </div>
        )}
        <footer>
          <span>
            <Zap size={13} /> Changes appear in the client app instantly.
          </span>
          <button onClick={onClose}>
            Done <Check size={14} />
          </button>
        </footer>
      </section>
    </div>
  );
}

function ClientCommandCenter({
  selected,
  setSelected,
  query,
  programmeCovers,
  setProgrammeCovers,
  customCovers,
  setCustomCovers,
  onNotice,
}) {
  const [tab, setTab] = useState("Overview");
  const [filter, setFilter] = useState("All");
  const [coverEditor, setCoverEditor] = useState(null);
  const [calories, setCalories] = useState(2400);
  const [protein, setProtein] = useState(170);
  const [documents, setDocuments] = useState([
    {
      name: "InBody_15_Aug.pdf",
      type: "InBody",
      date: "15 Aug",
      size: "1.8 MB",
    },
    {
      name: "InBody_18_Jun.pdf",
      type: "InBody",
      date: "18 Jun",
      size: "1.6 MB",
    },
    {
      name: "Bloodwork_July.pdf",
      type: "Lab report",
      date: "08 Jul",
      size: "840 KB",
    },
  ]);
  const visible = coachClients.filter(
    (client) =>
      client.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "All" ||
        (filter === "Attention" && client.flag !== "On track") ||
        client.progress === filter),
  );
  const tabs = [
    "Overview",
    "Plan",
    "Nutrition",
    "Check-ins",
    "Progress",
    "Documents",
  ];
  function addDocument(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) {
      onNotice("Upload blocked · use PDF, JPG or PNG under 10 MB.");
      event.target.value = "";
      return;
    }
    setDocuments((items) => [
      {
        name: file.name.slice(0, 100),
        type: file.name.toLowerCase().includes("inbody")
          ? "InBody"
          : "Client file",
        date: "Today",
        size: `${Math.max(0.1, file.size / 1024 / 1024).toFixed(1)} MB`,
      },
      ...items,
    ]);
    onNotice(
      `${file.name.slice(0, 60)} added to ${selected.name}'s private files.`,
    );
  }
  return (
    <div className="client-command">
      <aside className="command-roster">
        <div className="roster-head">
          <span className="eyebrow">24 ACTIVE CLIENTS</span>
          <h2>Client roster</h2>
          <div className="roster-filters">
            {["All", "Attention", "Stalled", "Progressing"].map((item) => (
              <button
                className={filter === item ? "active" : ""}
                onClick={() => setFilter(item)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        {visible.map((client) => (
          <button
            className={`command-client ${selected.name === client.name ? "active" : ""}`}
            onClick={() => {
              setSelected(client);
              setTab("Overview");
            }}
            key={client.name}
          >
            <span className={`client-initials ${client.tone}`}>
              {client.initials}
            </span>
            <span>
              <b>{client.name}</b>
              <small>{client.plan}</small>
            </span>
            <em className={client.progress === "Stalled" ? "stalled" : ""}>
              {client.progress}
            </em>
            <strong>{client.adherence}%</strong>
          </button>
        ))}
      </aside>
      <section className="client-command-main">
        <header className="command-client-header">
          <div className={`client-initials ${selected.tone}`}>
            {selected.initials}
          </div>
          <div>
            <span className="eyebrow">CLIENT · WEEK 06</span>
            <h1>{selected.name}</h1>
            <p>
              {selected.plan} · {selected.weight} · {selected.change}
            </p>
          </div>
          <span
            className={`progress-status ${selected.progress === "Stalled" ? "stalled" : ""}`}
          >
            <i />
            {selected.progress}
          </span>
          <button
            onClick={() =>
              onNotice(`Message thread opened for ${selected.name}.`)
            }
          >
            <MessageCircle size={16} /> Message
          </button>
          <button
            aria-label={`More options for ${selected.name}`}
            onClick={() =>
              onNotice(
                "Client actions · archive, pause and export are protected operations in production.",
              )
            }
          >
            <MoreHorizontal size={17} />
          </button>
        </header>
        <nav className="client-command-tabs">
          {tabs.map((item) => (
            <button
              onClick={() => setTab(item)}
              className={tab === item ? "active" : ""}
              key={item}
            >
              {item}
              {item === "Documents" && <span>{documents.length}</span>}
            </button>
          ))}
        </nav>
        <div className="command-tab-content">
          {tab === "Overview" && (
            <div className="client-overview-grid">
              <section className="why-flagged">
                <div className="console-section-head">
                  <div>
                    <span className="eyebrow">COACHOS SIGNAL</span>
                    <h2>
                      {selected.flag === "On track"
                        ? "Everything is moving"
                        : "Why this client is flagged"}
                    </h2>
                  </div>
                  <BrainCircuit size={20} />
                </div>
                <div className="signal-reasons">
                  {selected.progress === "Stalled" ? (
                    <>
                      <span>
                        <i />
                        Weight has not moved beyond ±0.3 kg for 16 days.
                      </span>
                      <span>
                        <i />
                        Nutrition adherence fell from 76% to 58%.
                      </span>
                      <span>
                        <i />
                        Two lower-body sessions were missed.
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        <i />
                        Training adherence is {selected.training}% over four
                        weeks.
                      </span>
                      <span>
                        <i />
                        Nutrition is averaging {selected.nutrition}% against
                        target.
                      </span>
                      <span>
                        <i />
                        Strength trend remains positive.
                      </span>
                    </>
                  )}
                </div>
                <div>
                  <button onClick={() => setTab("Plan")}>
                    Adjust plan <ArrowRight size={14} />
                  </button>
                  <button
                    onClick={() =>
                      onNotice("Signal dismissed for this review cycle.")
                    }
                  >
                    Dismiss signal
                  </button>
                </div>
              </section>
              <section className="client-adherence-panel">
                <span className="eyebrow">LAST 4 WEEKS</span>
                <h2>Adherence</h2>
                {[
                  ["Training", selected.training],
                  ["Nutrition", selected.nutrition],
                  ["Check-ins", selected.checkins],
                ].map(([label, value]) => (
                  <div className="command-adherence" key={label}>
                    <span>
                      {label}
                      <b>{value}%</b>
                    </span>
                    <i>
                      <em style={{ width: `${value}%` }} />
                    </i>
                  </div>
                ))}
              </section>
              <section className="client-progress-panel">
                <div className="console-section-head">
                  <div>
                    <span className="eyebrow">BODY WEIGHT</span>
                    <h2>
                      {selected.weight} <small>{selected.change}</small>
                    </h2>
                  </div>
                  <button onClick={() => setTab("Progress")}>
                    FULL PROGRESS <ArrowRight size={13} />
                  </button>
                </div>
                <svg
                  viewBox="0 0 560 120"
                  aria-label="Client body weight trend"
                >
                  <defs>
                    <linearGradient id="coachArea" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0"
                        stopColor="var(--accent)"
                        stopOpacity=".25"
                      />
                      <stop
                        offset="1"
                        stopColor="var(--accent)"
                        stopOpacity="0"
                      />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 18 L70 25 L140 34 L210 42 L280 55 L350 63 L420 79 L490 86 L560 102 L560 120 L0 120Z"
                    fill="url(#coachArea)"
                  />
                  <polyline
                    points="0,18 70,25 140,34 210,42 280,55 350,63 420,79 490,86 560,102"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2"
                  />
                </svg>
              </section>
              <section className="client-business-card">
                <span className="eyebrow">SUBSCRIPTION</span>
                <div>
                  <strong>Pro coaching</strong>
                  <em className={selected.subscription !== "Paid" ? "due" : ""}>
                    {selected.subscription}
                  </em>
                </div>
                <p>EGP 2,000 / month · renews {selected.renews}</p>
                <button
                  onClick={() =>
                    onNotice(
                      "Subscription details opened · payment changes require confirmation in production.",
                    )
                  }
                >
                  Manage subscription <ArrowRight size={13} />
                </button>
              </section>
            </div>
          )}
          {tab === "Plan" && (
            <div className="plan-editor">
              <div className="editor-heading">
                <div>
                  <span className="eyebrow">ASSIGNED PROGRAMME</span>
                  <h2>Strength Base · Phase 2</h2>
                  <p>Week 06 of 12 · 4 sessions per week</p>
                </div>
                <button
                  onClick={() =>
                    onNotice(
                      "A new training day was added to the draft programme.",
                    )
                  }
                >
                  <Plus size={15} /> Add training day
                </button>
              </div>
              {PROGRAMME_DAYS.map((day) => (
                <article className="programme-day-row" key={day.id}>
                  <button
                    className="programme-cover-thumb"
                    onClick={() => setCoverEditor(day)}
                    aria-label={`Choose cover for ${day.title}`}
                  >
                    <img
                      src={resolveCover(
                        programmeCovers[day.id],
                        customCovers[day.id],
                      )}
                      alt=""
                    />
                    <ImageIcon size={14} />
                  </button>
                  <span>{day.day}</span>
                  <div>
                    <b>{day.title}</b>
                    <small>{day.detail}</small>
                  </div>
                  <em>{day.count}</em>
                  <button onClick={() => setCoverEditor(day)}>
                    <ImageIcon size={15} /> Cover
                  </button>
                  <button
                    onClick={() => onNotice(`${day.title} editor opened.`)}
                  >
                    <SlidersHorizontal size={15} /> Edit
                  </button>
                  <button
                    aria-label={`More options for ${day.title}`}
                    onClick={() =>
                      onNotice(
                        `${day.title} can be duplicated, reordered or removed.`,
                      )
                    }
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </article>
              ))}
              <div className="editor-foot">
                <span>
                  <Zap size={12} /> Covers and plan changes publish instantly to{" "}
                  {selected.name}'s app.
                </span>
                <button
                  onClick={() =>
                    onNotice("Programme duplicated as an editable draft.")
                  }
                >
                  Duplicate programme
                </button>
              </div>
            </div>
          )}
          {tab === "Nutrition" && (
            <div className="nutrition-editor">
              <div className="editor-heading">
                <div>
                  <span className="eyebrow">LIVE NUTRITION PLAN</span>
                  <h2>Targets & meal structure</h2>
                  <p>
                    Every change updates the client's Fuel screen instantly.
                  </p>
                </div>
                <button
                  onClick={() =>
                    onNotice(
                      "CoachOS reviewed the last four weeks and prepared the adjustment below.",
                    )
                  }
                >
                  <BrainCircuit size={16} /> Suggest adjustment
                </button>
              </div>
              <div className="target-editor">
                <label>
                  <span>CALORIES</span>
                  <input
                    aria-label="Calories target"
                    type="number"
                    min="1000"
                    max="6000"
                    value={calories}
                    onChange={(event) => setCalories(event.target.value)}
                  />
                  <small>kcal</small>
                </label>
                <label>
                  <span>PROTEIN</span>
                  <input
                    aria-label="Protein target"
                    type="number"
                    min="20"
                    max="400"
                    value={protein}
                    onChange={(event) => setProtein(event.target.value)}
                  />
                  <small>g</small>
                </label>
                <label>
                  <span>CARBS</span>
                  <input
                    aria-label="Carbohydrate target"
                    type="number"
                    value="260"
                    readOnly
                  />
                  <small>g</small>
                </label>
                <label>
                  <span>FAT</span>
                  <input
                    aria-label="Fat target"
                    type="number"
                    value="70"
                    readOnly
                  />
                  <small>g</small>
                </label>
              </div>
              <div className="nutrition-coach-insight">
                <BrainCircuit size={20} />
                <div>
                  <b>CoachOS suggestion</b>
                  <p>
                    Weight is moving at 0.46 kg/week with stable strength. Keep
                    calories unchanged; consider moving 30g carbs to the
                    post-workout meal.
                  </p>
                </div>
                <button
                  onClick={() =>
                    onNotice(
                      "Suggested meal timing applied and published to the client app.",
                    )
                  }
                >
                  Apply
                </button>
              </div>
              <section className="meal-structure">
                <div className="console-section-head">
                  <div>
                    <span className="eyebrow">MEAL STRUCTURE</span>
                    <h2>4 meals · flexible plan</h2>
                  </div>
                  <button
                    onClick={() =>
                      onNotice("A new meal slot was added to the plan draft.")
                    }
                  >
                    <Plus size={14} /> ADD MEAL
                  </button>
                </div>
                {[
                  ["Breakfast", "520 kcal", "40P · 58C · 14F"],
                  ["Lunch", "680 kcal", "50P · 82C · 17F"],
                  ["Pre / post training", "560 kcal", "38P · 78C · 10F"],
                  ["Dinner", "640 kcal", "42P · 42C · 29F"],
                ].map((meal) => (
                  <button
                    key={meal[0]}
                    onClick={() =>
                      onNotice(`${meal[0]} targets opened for editing.`)
                    }
                  >
                    <span>{meal[0]}</span>
                    <b>{meal[1]}</b>
                    <small>{meal[2]}</small>
                    <ChevronRight size={15} />
                  </button>
                ))}
              </section>
            </div>
          )}
          {tab === "Check-ins" && (
            <div className="client-checkin-history">
              <div className="editor-heading">
                <div>
                  <span className="eyebrow">CHECK-IN HISTORY</span>
                  <h2>6 submitted · 5 reviewed</h2>
                </div>
                <button
                  onClick={() =>
                    onNotice("Latest check-in opened in the review queue.")
                  }
                >
                  <ClipboardCheck size={15} /> Review latest
                </button>
              </div>
              {[
                [
                  "Week 06",
                  "Today · waiting",
                  "81.4 kg",
                  "Energy good · Sleep fair",
                ],
                [
                  "Week 05",
                  "09 Aug · reviewed",
                  "81.9 kg",
                  "Energy good · Sleep good",
                ],
                [
                  "Week 04",
                  "02 Aug · reviewed",
                  "82.2 kg",
                  "Energy fair · Sleep good",
                ],
              ].map((item, index) => (
                <article key={item[0]}>
                  <span className={index === 0 ? "waiting" : ""}>
                    {index === 0 ? "NEW" : <Check size={13} />}
                  </span>
                  <div>
                    <b>{item[0]}</b>
                    <small>{item[1]}</small>
                  </div>
                  <strong>{item[2]}</strong>
                  <p>{item[3]}</p>
                  <button
                    aria-label={`Open ${item[0]} check-in`}
                    onClick={() => onNotice(`${item[0]} check-in opened.`)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </article>
              ))}
            </div>
          )}
          {tab === "Progress" && (
            <InBodyWorkspace
              client={selected}
              onDocuments={() => setTab("Documents")}
            />
          )}
          {tab === "Documents" && (
            <div className="documents-workspace">
              <div className="editor-heading">
                <div>
                  <span className="eyebrow">CLIENT FILES</span>
                  <h2>Documents & InBody scans</h2>
                  <p>PDFs, lab reports, meal plans and progress records.</p>
                </div>
                <label className="upload-file">
                  <Upload size={15} /> Upload file
                  <input
                    type="file"
                    accept=".pdf,image/jpeg,image/png"
                    onChange={addDocument}
                  />
                </label>
              </div>
              <div className="document-drop">
                <Upload size={24} />
                <b>Choose Upload file above</b>
                <span>PDF, JPG or PNG · maximum 10 MB in production</span>
              </div>
              <div className="document-list-head">
                <span>FILE</span>
                <span>TYPE</span>
                <span>DATE</span>
                <span>SIZE</span>
              </div>
              {documents.map((file) => (
                <article
                  className="document-row"
                  key={`${file.name}${file.date}`}
                >
                  <FileText size={18} />
                  <div>
                    <b>{file.name}</b>
                    <small>
                      {file.type === "InBody"
                        ? "Included in AI body-composition analysis"
                        : "Client document"}
                    </small>
                  </div>
                  <em>{file.type}</em>
                  <time>{file.date}</time>
                  <span>{file.size}</span>
                  <button
                    aria-label={`More options for ${file.name}`}
                    onClick={() => onNotice(`${file.name} options opened.`)}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
      {coverEditor && (
        <WorkoutCoverPicker
          day={coverEditor}
          selectedId={programmeCovers[coverEditor.id]}
          customImage={customCovers[coverEditor.id]}
          onSelect={(coverId) =>
            setProgrammeCovers((current) => ({
              ...current,
              [coverEditor.id]: coverId,
            }))
          }
          onCustom={(image) => {
            setCustomCovers((current) => ({
              ...current,
              [coverEditor.id]: image,
            }));
            setProgrammeCovers((current) => ({
              ...current,
              [coverEditor.id]: "custom",
            }));
          }}
          onClose={() => setCoverEditor(null)}
        />
      )}
    </div>
  );
}

function InBodyWorkspace({ client, onDocuments }) {
  return (
    <div className="inbody-workspace">
      <div className="editor-heading">
        <div>
          <span className="eyebrow">AI BODY COMPOSITION</span>
          <h2>{client.inbodies} InBody scans compared</h2>
          <p>CoachOS extracted and normalized the uploaded reports.</p>
        </div>
        <button onClick={onDocuments}>
          <Upload size={15} /> Add InBody PDF
        </button>
      </div>
      <section className="inbody-ai-summary">
        <BrainCircuit size={22} />
        <div>
          <b>Clear positive recomposition</b>
          <p>
            Across 12 weeks, body fat fell 3.2 percentage points while skeletal
            muscle increased 1.8 kg. The latest rate is healthy; no plan change
            is recommended.
          </p>
        </div>
        <span>HIGH CONFIDENCE</span>
      </section>
      <div className="inbody-kpis">
        <div>
          <span>BODY FAT</span>
          <strong>
            18.6<small>%</small>
          </strong>
          <em>−3.2 pts</em>
        </div>
        <div>
          <span>SKELETAL MUSCLE</span>
          <strong>
            36.8<small> kg</small>
          </strong>
          <em>+1.8 kg</em>
        </div>
        <div>
          <span>VISCERAL FAT</span>
          <strong>07</strong>
          <em>−2 levels</em>
        </div>
        <div>
          <span>BODY SCORE</span>
          <strong>
            82<small>/100</small>
          </strong>
          <em>+8 points</em>
        </div>
      </div>
      <section className="inbody-chart">
        <div className="console-section-head">
          <div>
            <span className="eyebrow">12-WEEK CHANGE</span>
            <h2>Fat down. Muscle up.</h2>
          </div>
          <div className="inbody-legend">
            <span>
              <i className="fat" />
              Body fat %
            </span>
            <span>
              <i className="muscle" />
              Muscle kg
            </span>
          </div>
        </div>
        <svg
          viewBox="0 0 720 240"
          aria-label="Body fat decreasing and skeletal muscle increasing across three InBody scans"
        >
          <g className="chart-grid">
            <line x1="0" y1="40" x2="720" y2="40" />
            <line x1="0" y1="100" x2="720" y2="100" />
            <line x1="0" y1="160" x2="720" y2="160" />
            <line x1="0" y1="220" x2="720" y2="220" />
          </g>
          <polyline className="fat-line" points="20,55 350,105 700,175" />
          <polyline className="muscle-line" points="20,190 350,140 700,72" />
          <g className="inbody-points">
            <circle className="fat" cx="20" cy="55" r="5" />
            <circle className="fat" cx="350" cy="105" r="5" />
            <circle className="fat" cx="700" cy="175" r="5" />
            <circle className="muscle" cx="20" cy="190" r="5" />
            <circle className="muscle" cx="350" cy="140" r="5" />
            <circle className="muscle" cx="700" cy="72" r="5" />
          </g>
        </svg>
        <div className="inbody-dates">
          <span>18 MAY</span>
          <span>18 JUN</span>
          <span>15 AUG</span>
        </div>
      </section>
      <div className="inbody-reports">
        {[
          ["15 Aug", "Latest scan", "82 score"],
          ["18 Jun", "Midpoint", "77 score"],
          ["18 May", "Baseline", "74 score"],
        ].map((item, index) => (
          <button key={item[0]} onClick={onDocuments}>
            <FileText size={17} />
            <span>
              <b>{item[0]}</b>
              <small>{item[1]}</small>
            </span>
            <em>{item[2]}</em>
            {index === 0 && <i>LATEST</i>}
            <ChevronRight size={15} />
          </button>
        ))}
      </div>
    </div>
  );
}

function CoachProgrammeWorkspace({ onNotice }) {
  return (
    <div className="wide-coach-view">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">PROGRAMME LIBRARY</span>
          <h2>Build once. Adapt per client.</h2>
          <p>6 active templates assigned across 24 clients.</p>
        </div>
        <button onClick={() => onNotice("New programme draft created.")}>
          <Plus size={16} /> New programme
        </button>
      </div>
      <div className="programme-grid">
        {[
          ["Strength Base", "12 weeks", "11 clients", "4 days"],
          ["Body Recomposition", "16 weeks", "7 clients", "4 days"],
          ["Performance", "8 weeks", "4 clients", "5 days"],
          ["Foundation", "6 weeks", "2 clients", "3 days"],
        ].map((program, index) => (
          <article key={program[0]}>
            <span>0{index + 1}</span>
            <div className="programme-icon">
              <Dumbbell size={22} />
            </div>
            <h3>{program[0]}</h3>
            <p>
              {program[1]} · {program[3]}
            </p>
            <div>
              <b>{program[2]}</b>
              <small>currently assigned</small>
            </div>
            <button
              onClick={() => onNotice(`${program[0]} opened for editing.`)}
            >
              Edit programme <ArrowRight size={14} />
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

function CoachCheckinWorkspace({ onNotice }) {
  const [reviewed, setReviewed] = useState([]);
  return (
    <div className="wide-coach-view">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">REVIEW QUEUE</span>
          <h2>{6 - reviewed.length} check-ins waiting</h2>
          <p>Sorted by attention signals, then submission time.</p>
        </div>
        <button
          onClick={() =>
            onNotice("Queue filters opened · priority order preserved.")
          }
        >
          <SlidersHorizontal size={15} /> Filter queue
        </button>
      </div>
      <div className="checkin-review-grid">
        {coachClients.slice(0, 3).map((client, index) => (
          <article
            className={reviewed.includes(client.name) ? "reviewed" : ""}
            key={client.name}
          >
            <header>
              <span className={`client-initials ${client.tone}`}>
                {client.initials}
              </span>
              <div>
                <b>{client.name}</b>
                <small>
                  Week {6 - index} · {index ? "1h ago" : "18 min ago"}
                </small>
              </div>
              <em>{client.progress}</em>
            </header>
            <div className="review-metrics">
              <span>
                <small>WEIGHT</small>
                <b>{client.weight}</b>
              </span>
              <span>
                <small>ENERGY</small>
                <b>{4 - index}/5</b>
              </span>
              <span>
                <small>SLEEP</small>
                <b>{index ? "Good" : "Fair"}</b>
              </span>
              <span>
                <small>ADHERENCE</small>
                <b>{client.adherence}%</b>
              </span>
            </div>
            <p>
              “Training felt strong. Sleep could be better, but nutrition was
              mostly consistent this week.”
            </p>
            <textarea
              aria-label={`Feedback for ${client.name}`}
              placeholder="Write feedback to the client…"
            />
            <div>
              <button
                onClick={() =>
                  onNotice(`Voice note recorder opened for ${client.name}.`)
                }
              >
                <MessageCircle size={14} /> Voice note
              </button>
              <button
                disabled={reviewed.includes(client.name)}
                onClick={() => {
                  setReviewed((items) => [...items, client.name]);
                  onNotice(`${client.name}'s check-in marked reviewed.`);
                }}
              >
                <Check size={14} />{" "}
                {reviewed.includes(client.name) ? "Reviewed" : "Mark reviewed"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function BrandStudio({ brand, setBrand, onNotice }) {
  const [draft, setDraft] = useState(brand);
  const [error, setError] = useState("");

  function chooseLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 1.5 * 1024 * 1024
    ) {
      setError("Use a PNG, JPG or WebP logo smaller than 1.5 MB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((value) => ({ ...value, logo: reader.result }));
      setError("");
    };
    reader.onerror = () =>
      setError("That logo could not be read. Try another file.");
    reader.readAsDataURL(file);
  }

  function publish() {
    const name = draft.name.trim().slice(0, 28) || DEFAULT_BRAND.name;
    setBrand({ ...draft, name });
    setDraft((value) => ({ ...value, name }));
    onNotice("Client branding published across the app and workout stories.");
  }

  function reset() {
    setDraft(DEFAULT_BRAND);
    setBrand(DEFAULT_BRAND);
    setError("");
    onNotice("Client branding reset to Coach/OS.");
  }

  return (
    <section className="brand-studio">
      <div className="brand-studio-copy">
        <span className="eyebrow">CLIENT APP BRANDING</span>
        <h2>Your identity, carried through.</h2>
        <p>
          Publish your logo and coaching name to the client header, onboarding
          and shareable workout results.
        </p>
        <div className="brand-platform-note">
          <ShieldCheck size={17} />
          <span>
            <b>In-app branding is fully changeable.</b>
            <small>
              The installed iPhone or Android icon remains the platform icon
              unless a separate white-label app is shipped.
            </small>
          </span>
        </div>
      </div>
      <div className="brand-editor-card">
        <div className="brand-live-preview">
          <span>CLIENT HEADER PREVIEW</span>
          <div>
            {draft.logo ? (
              <img src={draft.logo} alt="Uploaded brand preview" />
            ) : (
              <span className="brand-glyph">
                <i />
                <i />
                <i />
              </span>
            )}
            {draft.showName !== false && (
              <strong>{draft.name || DEFAULT_BRAND.name}</strong>
            )}
          </div>
          <small>Changes remain private until you publish.</small>
        </div>
        <label className="brand-name-field">
          <span>Client-facing name</span>
          <input
            value={draft.name}
            maxLength="28"
            onChange={(event) =>
              setDraft((value) => ({ ...value, name: event.target.value }))
            }
            placeholder="Yehia Athletics"
          />
        </label>
        <div className="brand-editor-actions">
          <label>
            <Upload size={16} />
            <span>
              <b>{draft.logo ? "Replace logo" : "Upload logo"}</b>
              <small>PNG, JPG or WebP · 1.5 MB max</small>
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={chooseLogo}
            />
          </label>
          {draft.logo && (
            <button
              onClick={() => setDraft((value) => ({ ...value, logo: null }))}
            >
              <X size={15} /> Remove
            </button>
          )}
        </div>
        <label className="brand-name-toggle">
          <span>
            <b>Show coaching name</b>
            <small>Display the name beside the uploaded logo.</small>
          </span>
          <input
            type="checkbox"
            checked={draft.showName !== false}
            onChange={(event) =>
              setDraft((value) => ({
                ...value,
                showName: event.target.checked,
              }))
            }
          />
        </label>
        {error && (
          <div className="brand-error" role="alert">
            {error}
          </div>
        )}
        <div className="brand-publish-row">
          <button onClick={reset}>Reset to Coach/OS</button>
          <button onClick={publish}>
            <Check size={15} /> Publish branding
          </button>
        </div>
      </div>
    </section>
  );
}

function CoachContentWorkspace({ onNotice, brand, setBrand }) {
  const [post, setPost] = useState("");
  const [celebrated, setCelebrated] = useState([]);
  return (
    <div className="wide-coach-view">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">COACH FEED</span>
          <h2>Keep clients coached.</h2>
          <p>Posts, voice notes and celebrations appear in every client app.</p>
        </div>
        <button
          onClick={() => {
            setPost("");
            onNotice("Fresh post ready.");
          }}
        >
          <Plus size={16} /> New post
        </button>
      </div>
      <BrandStudio brand={brand} setBrand={setBrand} onNotice={onNotice} />
      <div className="content-console">
        <section className="content-composer">
          <span className="eyebrow">POST TO ALL CLIENTS</span>
          <textarea
            aria-label="Post to all clients"
            value={post}
            onChange={(event) => setPost(event.target.value.slice(0, 500))}
            placeholder="Share an update, lesson or reminder…"
          />
          <div>
            <button onClick={() => onNotice("Photo picker opened.")}>
              <ImageIcon size={15} /> Photo
            </button>
            <button onClick={() => onNotice("Voice note recorder opened.")}>
              <MessageCircle size={15} /> Voice note
            </button>
            <button
              disabled={!post.trim()}
              onClick={() => {
                onNotice("Post published to all active clients.");
                setPost("");
              }}
            >
              Publish <ArrowRight size={14} />
            </button>
          </div>
        </section>
        <section className="celebration-list">
          <div className="console-section-head">
            <div>
              <span className="eyebrow">MOMENTS</span>
              <h2>Ready to celebrate</h2>
            </div>
          </div>
          {[
            ["Mariam Nassar", "Deadlift PR · 105 kg"],
            ["Ahmed Hassan", "12-day adherence run"],
            ["Lina Samir", "Completed 4/4 sessions"],
          ].map((item) => (
            <button
              key={item[0]}
              disabled={celebrated.includes(item[0])}
              onClick={() => {
                setCelebrated((items) => [...items, item[0]]);
                onNotice(`${item[0]}'s celebration published.`);
              }}
            >
              <Zap size={16} />
              <span>
                <b>{item[0]}</b>
                <small>{item[1]}</small>
              </span>
              <em>{celebrated.includes(item[0]) ? "Posted" : "Celebrate"}</em>
              <ArrowRight size={14} />
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}

function CoachBusinessWorkspace({ onNotice }) {
  function exportBilling() {
    const csv = [
      "Client,Plan,Amount,Next payment,Status",
      ...coachClients.map(
        (client) =>
          `"${client.name}",Pro coaching,2000,"${client.renews}","${client.subscription}"`,
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "coachos-billing.csv";
    link.click();
    URL.revokeObjectURL(url);
    onNotice("Billing CSV exported.");
  }
  return (
    <div className="wide-coach-view">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">SUBSCRIPTIONS</span>
          <h2>EGP 47,500 recurring</h2>
          <p>24 active clients · 2 payments need attention.</p>
        </div>
        <button onClick={exportBilling}>
          <Download size={15} /> Export billing
        </button>
      </div>
      <div className="business-kpis">
        <div>
          <span>MONTHLY REVENUE</span>
          <strong>47.5K</strong>
          <small>+8.4% vs July</small>
        </div>
        <div>
          <span>COLLECTION RATE</span>
          <strong>95.8%</strong>
          <small>23 of 24 paid</small>
        </div>
        <div>
          <span>AVG. CLIENT VALUE</span>
          <strong>1,980</strong>
          <small>EGP per month</small>
        </div>
      </div>
      <section className="subscription-table">
        <header>
          <span>CLIENT</span>
          <span>PLAN</span>
          <span>AMOUNT</span>
          <span>NEXT PAYMENT</span>
          <span>STATUS</span>
          <span />
        </header>
        {coachClients.map((client) => (
          <article key={client.name}>
            <span className={`client-initials ${client.tone}`}>
              {client.initials}
            </span>
            <div>
              <b>{client.name}</b>
              <small>{client.plan}</small>
            </div>
            <span>Pro coaching</span>
            <strong>EGP 2,000</strong>
            <time>{client.renews}</time>
            <em className={client.subscription !== "Paid" ? "due" : ""}>
              {client.subscription}
            </em>
            <button
              aria-label={`Billing options for ${client.name}`}
              onClick={() =>
                onNotice(`Billing details opened for ${client.name}.`)
              }
            >
              <MoreHorizontal size={16} />
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}

function CoachConsole({
  onClientView,
  onMobileApp,
  programmeCovers,
  setProgrammeCovers,
  customCovers,
  setCustomCovers,
  brand,
  setBrand,
}) {
  const [section, setSection] = useState("Overview");
  const [selected, setSelected] = useState(coachClients[0]);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const coachNav = [
    [LayoutDashboard, "Overview"],
    [Users, "Clients"],
    [Dumbbell, "Programmes"],
    [ClipboardCheck, "Check-ins"],
    [MessageCircle, "Content"],
    [CreditCard, "Business"],
  ];
  function openClient(client) {
    setSelected(client);
    setSection("Clients");
  }
  function showNotice(message) {
    setNotice(message);
    window.clearTimeout(showNotice.timer);
    showNotice.timer = window.setTimeout(() => setNotice(""), 2600);
  }
  const page =
    section === "Overview" ? (
      <CoachOverview onOpenClient={openClient} onNotice={showNotice} />
    ) : section === "Clients" ? (
      <ClientCommandCenter
        key={selected.name}
        selected={selected}
        setSelected={setSelected}
        query={query}
        programmeCovers={programmeCovers}
        setProgrammeCovers={setProgrammeCovers}
        customCovers={customCovers}
        setCustomCovers={setCustomCovers}
        onNotice={showNotice}
      />
    ) : section === "Programmes" ? (
      <CoachProgrammeWorkspace onNotice={showNotice} />
    ) : section === "Check-ins" ? (
      <CoachCheckinWorkspace onNotice={showNotice} />
    ) : section === "Content" ? (
      <CoachContentWorkspace
        onNotice={showNotice}
        brand={brand}
        setBrand={setBrand}
      />
    ) : (
      <CoachBusinessWorkspace onNotice={showNotice} />
    );
  return (
    <div className="coach-console">
      <aside className="coach-sidebar">
        <PlatformMark />
        <div className="coach-identity">
          <div>YK</div>
          <span>
            <b>Yehia Kamal</b>
            <small>YEHIA ATHLETICS</small>
          </span>
        </div>
        <nav>
          {coachNav.map(([Icon, label]) => (
            <button
              key={label}
              className={section === label ? "active" : ""}
              onClick={() => setSection(label)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === "Check-ins" && <i>6</i>}
              {label === "Business" && <i className="billing-alert">2</i>}
            </button>
          ))}
        </nav>
        <div className="coach-sidebar-bottom">
          <button onClick={onClientView}>
            <ArrowLeft size={17} /> Client app preview
          </button>
          <span>AVELN · PRO</span>
        </div>
      </aside>
      <main className="coach-main">
        <header className="coach-topbar">
          <div>
            <span className="eyebrow">{CURRENT_DATE_LABEL}</span>
            <h1>
              {section === "Overview" ? "Good afternoon, Yehia." : section}
            </h1>
          </div>
          <div className="coach-top-actions">
            <button className="mobile-app-link" onClick={onMobileApp}>
              <Smartphone size={17} /> Coach app
            </button>
            <label>
              <Search size={17} />
              <input
                aria-label="Search clients"
                placeholder="Search clients"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button
              className="coach-bell"
              aria-label="Coach notifications"
              onClick={() =>
                showNotice(
                  "You have 6 check-ins and 2 payments needing attention.",
                )
              }
            >
              <Bell size={19} />
              <i />
            </button>
            <button
              className="add-client"
              onClick={() =>
                showNotice("Client invitation created · test code 00000.")
              }
            >
              <Plus size={17} /> Add client
            </button>
          </div>
        </header>
        {page}
      </main>
      {notice && (
        <div className="coach-toast" role="status">
          <CheckCircle2 size={17} />
          {notice}
        </div>
      )}
    </div>
  );
}

function CoachMobileApp({ onClientView, onDesktopSite }) {
  const [screen, setScreen] = useState("today");
  const [selectedClient, setSelectedClient] = useState(null);
  const mobileNav = [
    [HomeIcon, "today", "Today"],
    [Users, "clients", "Clients"],
    [ClipboardCheck, "checkins", "Check-ins"],
    [MessageCircle, "inbox", "Inbox"],
  ];
  const attention = coachClients.filter((client) => client.flag !== "On track");

  function CoachToday() {
    return (
      <div className="coach-mobile-screen">
        <section className="coach-mobile-greeting block-pad">
          <span className="eyebrow">{CURRENT_DATE_LABEL}</span>
          <h1>
            Good afternoon,
            <br />
            Yehia.
          </h1>
          <p>Three clients need your attention.</p>
        </section>
        <section className="coach-mobile-pulse">
          <div>
            <strong>24</strong>
            <span>
              active
              <br />
              clients
            </span>
          </div>
          <div>
            <strong>06</strong>
            <span>
              check-ins
              <br />
              to review
            </span>
          </div>
          <div>
            <strong>
              88<small>%</small>
            </strong>
            <span>
              average
              <br />
              adherence
            </span>
          </div>
        </section>
        <section className="mobile-attention block-pad">
          <div className="section-title">
            <span>Needs you today</span>
            <button onClick={() => setScreen("clients")}>
              VIEW ALL <ArrowRight size={13} />
            </button>
          </div>
          {attention.map((client) => (
            <button key={client.name} onClick={() => setSelectedClient(client)}>
              <span className={`client-initials ${client.tone}`}>
                {client.initials}
              </span>
              <span>
                <b>{client.name}</b>
                <small>
                  {client.flag} · {client.plan}
                </small>
              </span>
              <em>{client.adherence}%</em>
              <ChevronRight size={16} />
            </button>
          ))}
        </section>
        <section className="coach-mobile-feature">
          <img src={athleteImage} alt="Ahmed's training review" />
          <div />
          <span>UP NEXT · 17:00</span>
          <h2>
            Ahmed's
            <br />
            programme review
          </h2>
          <p>Lower strength · Week 06</p>
          <button onClick={() => setSelectedClient(coachClients[0])}>
            Open client <ArrowRight size={16} />
          </button>
        </section>
        <section className="mobile-schedule block-pad">
          <div className="section-title">
            <span>Today</span>
            <b>3 EVENTS</b>
          </div>
          {[
            ["15:30", "Mariam · check-in"],
            ["17:00", "Ahmed · review"],
            ["18:30", "Omar · coaching call"],
          ].map(([time, event]) => (
            <div key={time}>
              <time>{time}</time>
              <i />
              <span>{event}</span>
            </div>
          ))}
        </section>
      </div>
    );
  }

  function ClientList() {
    return (
      <div className="coach-mobile-screen">
        <section className="coach-mobile-page block-pad">
          <span className="eyebrow">CLIENT ROSTER</span>
          <h1>Your people.</h1>
          <label>
            <Search size={16} />
            <input placeholder="Search 24 clients" />
          </label>
        </section>
        <section className="mobile-client-list">
          {coachClients.map((client) => (
            <button key={client.name} onClick={() => setSelectedClient(client)}>
              <span className={`client-initials ${client.tone}`}>
                {client.initials}
              </span>
              <span>
                <b>{client.name}</b>
                <small>
                  {client.plan} · {client.weight}
                </small>
              </span>
              <em
                className={client.flag === "Needs attention" ? "attention" : ""}
              >
                {client.flag}
              </em>
              <ChevronRight size={16} />
            </button>
          ))}
        </section>
      </div>
    );
  }

  function CheckinList() {
    return (
      <div className="coach-mobile-screen">
        <section className="coach-mobile-page block-pad">
          <span className="eyebrow">WEEKLY REVIEWS</span>
          <h1>Check-ins.</h1>
          <p>6 waiting · oldest 2h ago</p>
        </section>
        <section className="mobile-checkins block-pad">
          {coachClients.slice(0, 3).map((client, index) => (
            <article key={client.name}>
              <div>
                <span className={`client-initials ${client.tone}`}>
                  {client.initials}
                </span>
                <span>
                  <b>{client.name}</b>
                  <small>
                    Week {6 - index} · {index ? "1h" : "18 min"} ago
                  </small>
                </span>
                <em>{index ? "NEW" : "PRIORITY"}</em>
              </div>
              <div>
                <span>
                  <small>WEIGHT</small>
                  <b>{client.weight}</b>
                </span>
                <span>
                  <small>ENERGY</small>
                  <b>{4 - index}/5</b>
                </span>
                <span>
                  <small>ADHERENCE</small>
                  <b>{client.adherence}%</b>
                </span>
              </div>
              <p>
                “Training felt strong this week. Sleep could be better, but
                nutrition was consistent.”
              </p>
              <button onClick={() => setSelectedClient(client)}>
                Review check-in <ArrowRight size={15} />
              </button>
            </article>
          ))}
        </section>
      </div>
    );
  }

  function Inbox() {
    return (
      <div className="coach-mobile-screen">
        <section className="coach-mobile-page block-pad">
          <span className="eyebrow">MESSAGES</span>
          <h1>Inbox.</h1>
          <p>4 unread conversations</p>
        </section>
        <section className="mobile-inbox">
          {coachClients.map((client, index) => (
            <button key={client.name} onClick={() => setSelectedClient(client)}>
              <span className={`client-initials ${client.tone}`}>
                {client.initials}
                {index < 2 && <i />}
              </span>
              <span>
                <b>{client.name}</b>
                <small>
                  {index === 0
                    ? "Energy feels good today too."
                    : index === 1
                      ? "Uploaded a new form video."
                      : "Thanks coach, understood."}
                </small>
              </span>
              <time>{index ? "1h" : "8m"}</time>
            </button>
          ))}
        </section>
      </div>
    );
  }

  const mobilePage =
    screen === "today" ? (
      <CoachToday />
    ) : screen === "clients" ? (
      <ClientList />
    ) : screen === "checkins" ? (
      <CheckinList />
    ) : (
      <Inbox />
    );
  return (
    <div className="product-stage coach-app-stage">
      <aside className="desktop-rail coach-app-rail">
        <PlatformMark />
        <div className="desktop-statement">
          <span className="eyebrow light">COACH COMPANION APP</span>
          <h1>
            Your business.
            <br />
            In your pocket.
          </h1>
          <p>
            Review check-ins, message clients and keep the day moving from
            anywhere.
          </p>
        </div>
        <button className="switch-desktop" onClick={onDesktopSite}>
          <LayoutDashboard size={17} /> Open desktop site{" "}
          <ArrowRight size={16} />
        </button>
        <button className="switch-client" onClick={onClientView}>
          <ArrowLeft size={15} /> Back to client app
        </button>
      </aside>
      <div className="phone-wrap">
        <div className="phone-shell coach-phone">
          <header className="coach-app-header">
            <PlatformMark compact />
            <div>
              <button onClick={onDesktopSite} aria-label="Open desktop site">
                <LayoutDashboard size={18} />
              </button>
              <button
                className="coach-avatar-mobile"
                onClick={onDesktopSite}
                aria-label="Open coach profile on desktop"
              >
                YK
              </button>
            </div>
          </header>
          <main className="app-scroll" key={screen}>
            {mobilePage}
          </main>
          <nav className="bottom-nav coach-mobile-nav">
            {mobileNav.map(([Icon, id, label]) => (
              <button
                key={id}
                className={screen === id ? "active" : ""}
                onClick={() => setScreen(id)}
              >
                <Icon size={20} />
                <span>{label}</span>
                {id === "checkins" && <i>6</i>}
              </button>
            ))}
          </nav>
          {selectedClient && (
            <div className="mobile-client-detail">
              <header>
                <button
                  onClick={() => setSelectedClient(null)}
                  aria-label="Back to coach app"
                >
                  <ArrowLeft />
                </button>
                <span>CLIENT</span>
                <span />
              </header>
              <div className="mobile-client-hero">
                <img src={athleteImage} alt={selectedClient.name} />
                <div />
                <span>{selectedClient.initials}</span>
                <h1>{selectedClient.name}</h1>
                <p>{selectedClient.plan} · Week 06</p>
              </div>
              <div className="mobile-client-stats">
                <div>
                  <strong>{selectedClient.weight}</strong>
                  <span>current weight</span>
                </div>
                <div>
                  <strong>{selectedClient.change}</strong>
                  <span>total change</span>
                </div>
                <div>
                  <strong>{selectedClient.adherence}%</strong>
                  <span>adherence</span>
                </div>
              </div>
              <div className="mobile-client-actions">
                <button
                  onClick={() => {
                    setSelectedClient(null);
                    setScreen("inbox");
                  }}
                >
                  <MessageCircle size={17} /> Message
                </button>
                <button
                  onClick={() => {
                    setSelectedClient(null);
                    setScreen("checkins");
                  }}
                >
                  <ClipboardCheck size={17} /> Review check-in
                </button>
              </div>
              <section>
                <span className="eyebrow">THIS WEEK</span>
                <div className="client-week-row">
                  <span>Training</span>
                  <b>3 of 4 sessions</b>
                </div>
                <div className="client-week-row">
                  <span>Nutrition</span>
                  <b>91% adherence</b>
                </div>
                <div className="client-week-row">
                  <span>Latest note</span>
                  <b>Energy feels good</b>
                </div>
              </section>
            </div>
          )}
        </div>
        <div className="device-caption">
          <span>COACH APP · LIVE PROTOTYPE</span>
          <button onClick={onDesktopSite}>
            DESKTOP SITE <ArrowRight size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

function App({ brand, setBrand }) {
  const [role, setRole] = useState(() =>
    new URLSearchParams(window.location.search).get("view") === "coach"
      ? "coach"
      : "client",
  );
  const [account, setAccount] = usePersistentState("coachos.account.v3", {
    signedIn: false,
  });
  const [profile, setProfile] = usePersistentState("coachos.profile.v2", {
    name: "Ahmed Hassan",
    email: "ahmed@example.com",
    answers: {},
  });
  const [coachSurface, setCoachSurface] = useState(() =>
    window.innerWidth <= 900 ? "mobile" : "desktop",
  );
  const [screen, setScreen] = useState("home");
  const [intro, setIntro] = useState(false);
  const [settings, setSettings] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [session, setSession] = useState(false);
  const [share, setShare] = useState(false);
  const [accent, setAccent] = usePersistentState(
    "coachos.accent.v5",
    DEFAULT_ACCENT,
  );
  const [programmeCovers, setProgrammeCovers] = usePersistentState(
    "coachos.programme-covers.v1",
    DEFAULT_PROGRAMME_COVERS,
  );
  const [customCovers, setCustomCovers] = useState({});
  const [meals, setMeals] = usePersistentState("coachos.meals.v2", []);
  const [messages, setMessages] = usePersistentState(
    "coachos.messages.v3",
    NEW_CLIENT_MESSAGES,
  );
  const firstName = profile.name?.trim().split(/\s+/)[0] || "Ahmed";
  const initials =
    profile.name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "AH";
  const page = useMemo(() => {
    if (screen === "home")
      return (
        <Home
          onStartWorkout={() => setSession(true)}
          onNavigate={setScreen}
          onShare={() => setShare(true)}
          programmeCovers={programmeCovers}
          customCovers={customCovers}
          firstName={firstName}
        />
      );
    if (screen === "train")
      return (
        <Train
          onStartWorkout={() => setSession(true)}
          programmeCovers={programmeCovers}
          customCovers={customCovers}
        />
      );
    if (screen === "fuel") return <Fuel meals={meals} setMeals={setMeals} />;
    if (screen === "progress")
      return <Progress onShare={() => setShare(true)} />;
    return (
      <Coach
        messages={messages}
        setMessages={setMessages}
        onNavigate={setScreen}
      />
    );
  }, [screen, meals, messages, programmeCovers, customCovers, firstName]);

  function openCoach(surface) {
    setCoachSurface(
      surface || (window.innerWidth <= 900 ? "mobile" : "desktop"),
    );
    setRole("coach");
  }

  function finishOnboarding(nextProfile) {
    setProfile(nextProfile);
    setMeals([]);
    setMessages(NEW_CLIENT_MESSAGES);
    setProgrammeCovers(DEFAULT_PROGRAMME_COVERS);
    setCustomCovers({});
    setAccent(DEFAULT_ACCENT);
    setScreen("home");
    setAccount({ signedIn: true });
  }

  function resetPrototype() {
    setSettings(false);
    setNotifications(false);
    setMeals([]);
    setMessages(NEW_CLIENT_MESSAGES);
    setProgrammeCovers(DEFAULT_PROGRAMME_COVERS);
    setCustomCovers({});
    setAccent(DEFAULT_ACCENT);
    setProfile({
      name: "Ahmed Hassan",
      email: "ahmed@example.com",
      answers: {},
    });
    setScreen("home");
    setAccount({ signedIn: false });
  }

  if (role === "client" && !account.signedIn)
    return (
      <FirstRun onComplete={finishOnboarding} onCoach={() => openCoach()} />
    );

  if (role === "coach") {
    const openClientPreview = () => {
      setAccount({ signedIn: true, preview: true });
      setRole("client");
    };
    if (coachSurface === "mobile")
      return (
        <div style={{ "--accent": accent }}>
          <CoachMobileApp
            onClientView={openClientPreview}
            onDesktopSite={() => setCoachSurface("desktop")}
          />
        </div>
      );
    return (
      <div className="product-stage coach-stage" style={{ "--accent": accent }}>
        <CoachConsole
          onClientView={openClientPreview}
          onMobileApp={() => setCoachSurface("mobile")}
          programmeCovers={programmeCovers}
          setProgrammeCovers={setProgrammeCovers}
          customCovers={customCovers}
          setCustomCovers={setCustomCovers}
          brand={brand}
          setBrand={setBrand}
        />
      </div>
    );
  }

  return (
    <div className="product-stage client-stage" style={{ "--accent": accent }}>
      <DesktopRail
        screen={screen}
        setScreen={setScreen}
        accent={accent}
        setAccent={setAccent}
        onIntro={() => setIntro(true)}
        onCoach={() => openCoach("desktop")}
      />
      <div className="phone-wrap">
        <div className="phone-shell">
          <AppHeader
            onSettings={() => setSettings(true)}
            onNotifications={() => setNotifications(true)}
            initials={initials}
          />
          <main className="app-scroll" key={screen}>
            {page}
          </main>
          <BottomNav active={screen} onChange={setScreen} />
          {settings && (
            <SettingsSheet
              onClose={() => setSettings(false)}
              accent={accent}
              setAccent={setAccent}
              profile={profile}
              onSignOut={resetPrototype}
              onIntro={() => {
                setSettings(false);
                setIntro(true);
              }}
            />
          )}
          {notifications && (
            <NotificationsSheet onClose={() => setNotifications(false)} />
          )}
          {session && (
            <WorkoutSession
              onClose={() => setSession(false)}
              onShare={() => {
                setSession(false);
                setShare(true);
              }}
            />
          )}
          {share && (
            <ShareStudio onClose={() => setShare(false)} accent={accent} />
          )}
          {intro && <PlatformIntro onEnter={() => setIntro(false)} />}
        </div>
        <div className="device-caption">
          <span>CLIENT APP · LIVE PROTOTYPE</span>
          <span>402 × 874</span>
        </div>
      </div>
    </div>
  );
}

function Root() {
  const [brand, setBrand] = usePersistentState(
    "aveln.client-brand.v1",
    DEFAULT_BRAND,
  );
  return (
    <BrandContext.Provider value={{ brand, setBrand }}>
      <App brand={brand} setBrand={setBrand} />
    </BrandContext.Provider>
  );
}

createRoot(document.getElementById("root")).render(<Root />);
