import { AISharingPreference } from "./ecosystem/updates.jsx";
import React, { lazy, Suspense, useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  Clock3,
  Search,
  Layers,
  MoreHorizontal,
  BarChart3,
  Bell,
  Check,
  ChevronRight,
  Download,
  FileText,
  Home,
  MessageCircle,
  Settings,
  Shield,
  User,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { MotionProvider, MovingIndicator, useSectionReveal } from "./motion.jsx";
import { watchViewport } from "./viewport.js";
import { MotionDetails } from "./motion.jsx";
import { useAppRoute } from "./navigation.js";
import { AccountGate, AccountSettings } from "./ecosystem/accounts.jsx";
import { connection, connectedCommand, unsavedAction, retryUnsent, discardUnsent } from "./ecosystem/connection.js";
import { command } from "./ecosystem/actions.js";
import { CoachingMemory } from "./ecosystem/memory.jsx";

import { AppContext } from "./context.js";
import { useWorkspaceSave } from "./workspace-save.js";
import {
  useWorkspace,
  dayKey,
  uid,
  deleteDeviceFile,
  download,
  attentionFor,
  shortDate,
  scheduleDay,
} from "./store.js";
import { newClient } from "./seed.js";
import {
  Avatar,
  BrandLogo,
  Button,
  Empty,
  Field,
  Heading,
  IconButton,
  Mark,
  Modal,
  Notice,
} from "./ui.jsx";
import { Plan, Progress, Nutrition } from "./client.jsx";
import { Appearance, ConnectedDevices } from "./preferences.jsx";
import { openDevicesOnReturn } from "./wearables.jsx";
import { ResumeWorkout } from "./resume.jsx";
import { IntakeFlow } from "./IntakeFlow.jsx";
import { EditorialHome, SessionDetail, SessionSearch, Splash } from "./editorial.jsx";
import { ExerciseDetail } from "./ExerciseDetail.jsx";
import { BrandMark, leaveBoot } from "./BrandMark.jsx";
import { findExercise } from "./exercise-stats.js";
const welcomePortrait = "/design/campaign-welcome-v2.webp";
import { CoachHome } from "./communication.jsx";
const coachPage = (name) => lazy(() => import('./coach.jsx').then(module => ({ default: module[name] })));
const Dashboard = coachPage('Dashboard');
const Clients = coachPage('Clients');
const Programs = coachPage('Programs');
const Inbox = coachPage('Inbox');
const Business = coachPage('Business');
import { Workout, ShareWorkout, makeDraft } from "./workout.jsx";
import "./tokens.css";
import "./avalen.css";
import "./refinements.css";
import "./workout-logger.css";
import "./reference-design.css";
import "./editorial.css";
import "./product-refinements.css";
import "./checkins.css";
import "./ecosystem/ecosystem.css";
import "./motion.css";
import "./essential-flows.css";
import "./experience-polish.css";
import "./finish.css";
import "./exercise.css";
import "./logger-premium.css";
import "./assistant.css";
import "./food-scan.css";
import "./polish.css";
import "./payments.css";
import { ClientPayments } from "./payments.jsx";
import { AvalenAssistant } from "./AvalenAssistant.jsx";


const clientNav = [
  ["today", "Home", Home],
  ["plan", "Train", Layers],
  ["nutrition", "Nutrition", Utensils],
  ["progress", "Progress", BarChart3],
  ["you", "More", MoreHorizontal],
];
const coachNav = [
  ["dashboard", "Dashboard", Home],
  ["clients", "Clients", Users],
  ["programs", "Programs", FileText],
  ["inbox", "Inbox", MessageCircle],
  ["business", "Business", BarChart3],
];
function savedRole() {
  try { return sessionStorage.getItem('avalen.role') === 'coach' ? 'coach' : 'client'; }
  catch { return 'client'; }
}
function App() {
  useEffect(watchViewport, []);
  const { data, update, storageError, recovery } = useWorkspace();
  const bottomNav = useRef(null);
  const [route,visit] = useAppRoute(savedRole());
  const { screen, subtab, selectedClientId, clientTab } = route;
  const role = connection()?.user.role || route.role;
  const [accountSettings,setAccountSettings]=useState(false);
  useEffect(()=>{if(connection() && route.role!==role) visit({role,screen:role==='coach'?'dashboard':'today',subtab:'',clientTab:'Overview'} ,true);},[route.role,role]);
  const setSubtab = subtab => visit({ ...route, subtab });
  const setClientTab = clientTab => visit({ ...route, clientTab });
  const [toast,setToast] = useState(null);
  function notify(message, undo = null) { setToast({ message, undo, id: uid() }); }
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(null),8000); return () => clearTimeout(timer); } },[toast]);
  useEffect(() => { try { sessionStorage.setItem('avalen.role',role); } catch {} },[role]);
  const [search, setSearch] = useState(false);
  const [welcomePreview, setWelcomePreview] = useState(() => new URLSearchParams(location.search).get('preview') === 'welcome');
  const [splash, setSplash] = useState(() => {
    try { return !sessionStorage.getItem('avalen.editorial.splash') || new URLSearchParams(location.search).get('preview') === 'splash'; } catch { return true; }
  });
  const [curtainUp, setCurtainUp] = useState(false);
  useEffect(() => { if (!splash) leaveBoot(); }, []);
  function dismissSplash() {
    try { sessionStorage.setItem('avalen.editorial.splash', 'seen'); } catch {}
    setSplash(false);
  }
  const [intakeOpen, setIntakeOpen] = useState(() => { try { return sessionStorage.getItem('avalen.intake.open') === '1'; } catch { return false; } });
  function closeIntake() {
    try { sessionStorage.removeItem('avalen.intake.open'); } catch {}
    setIntakeOpen(false);
  }
  const [workout, setWorkout] = useState(false),
    [share, setShare] = useState(null),
    [messageContext, setMessageContext] = useState(null),
    [notifications, setNotifications] = useState(false);
  const client = data.clients.find(c => c.id === data.activeClientId) || data.clients[0];
  const scheduledDetail = route.date && scheduleDay(client, route.date);
  const detailDay = scheduledDetail?.id === route.sessionId ? scheduledDetail : client.program.days.find(day => day.id === route.sessionId);
  const sessionDetail = detailDay ? { day: detailDay, date: route.date } : null;
  const viewedClient = role === 'coach' && selectedClientId ? data.clients.find(item => item.id === selectedClientId) || client : client;
  const exerciseDetail = findExercise(data, viewedClient, route.exercise);
  const [navigatingBack,setNavigatingBack]=useState(false);
  function closeSession() {
    if (history.state?.avalenParent) {setNavigatingBack(true);history.back();}
    else visit({ ...route, sessionId: null, date: null }, true);
  }
  function closeExercise() {
    if (history.state?.avalenParent) {setNavigatingBack(true);history.back();}
    else visit({ ...route, exercise: null }, true);
  }
  const nav = role === 'coach' ? coachNav : clientNav;
  useSectionReveal(`${role}:${screen}:${subtab}:${route.clientTab}`, (!splash || curtainUp) && data.onboarded && !welcomePreview && !sessionDetail && !exerciseDetail);
  function navigate(page, tab = '') {
    if (role === 'client' && page === 'plan' && tab === 'Nutrition') { page = 'nutrition'; tab = ''; }
    visit({ ...route, screen: page, subtab: tab, viewDate: page === screen ? route.viewDate : null, sessionId: null, date: null, exercise: null, selectedClientId: page === 'clients' ? null : selectedClientId });
  }
  function changeRole(role) {
    setMessageContext(null);
    visit({ role, screen: role === 'coach' ? 'dashboard' : 'today', subtab: '', selectedClientId: null, clientTab: 'Overview', sessionId: null, date: null });
  }
  function selectClient(id, tab = 'Overview') {
    visit({ ...route, screen: 'clients', selectedClientId: id, clientTab: tab, subtab:id === selectedClientId ? route.subtab : '', sessionId: null, date: null, exercise: null });
  }
  function ask(title, text = "", clientId = client.id) {
    if (role === 'coach' && data.clients.some(item => item.id === clientId)) update(d => { d.activeClientId = clientId; });
    setMessageContext({ title, text, clientId });
    navigate(role === "coach" ? "inbox" : "coach", "Messages");
  }
  function viewSession(day, date) {
    visit({ ...route, sessionId: day.id, date: date || null });
  }
  async function openWorkout(day, date) {
    if (
      date !== dayKey() ||
      data.sessions.some((s) => s.clientId === client.id && s.date === date)
    )
      return;
    if (data.drafts[client.id]) { resumeWorkout(); return; }
    const result = await update((d) => (d.drafts[client.id] = makeDraft(d, client, day, date)));
    if (!result?.error) setWorkout(true);
  }
  async function resumeWorkout() {
    if (!data.drafts[client.id]) return;
    if (data.drafts[client.id].pausedAt) {
      const result = await update((d) => {
        const draft = d.drafts[client.id];
        draft.startedAt += Date.now() - draft.pausedAt;
        delete draft.pausedAt;
      });
      if (result?.error) return;
    }
    setWorkout(true);
  }
  async function pauseWorkout() {
    const result = await update((d) => {
      if (d.drafts[client.id]) d.drafts[client.id].pausedAt = Date.now();
    });
    if(result?.error) return false;
    setWorkout(false);
    return true;
  }
  useEffect(() => {
    function leaveOverlay() {
      setNavigatingBack(false);setSearch(false); setNotifications(false); setShare(null);
      if (workout) pauseWorkout();
    }
    window.addEventListener('popstate',leaveOverlay);
    return () => window.removeEventListener('popstate',leaveOverlay);
  },[workout,client.id]);
  async function runAction(action,clientId,payload,key) {
    if(connection())return connectedCommand({action,clientId,payload},key);
    const actor={role,id:'device-preview',client_id:role==='client'?client.id:null};command(structuredClone(data),actor,{action,clientId,payload});const result=await update(d=>command(d,actor,{action,clientId,payload}));if(result?.error)throw new Error(result.error);if(action==='form.delete'){const row=data.formSubmissions.find(r=>r.id===payload.id);if(row)await deleteDeviceFile(row.file.id);}
  }
  const context = {
    runAction,
    data,
    update,
    client,
    role,
    screen,
    notify,
    navigate,
    subtab,
    setSubtab,
    viewDate: route.viewDate,
    setViewDate: viewDate => visit({ ...route, viewDate }),
    openTrainingDate: viewDate => visit({...route, screen:'plan', subtab:'Training', viewDate, sessionId:null, date:null, exercise:null}),
    openExercise: exercise => visit({ ...route, exercise }),
    selectedClientId,
    selectClient,
    clientTab,
    setClientTab,
    openWorkout,
    viewSession,
    resumeWorkout,
    openShare: setShare,
    ask,
    messageContext,
    setMessageContext,
    intakeDue: role === 'client' && !client.intake && (client.needsIntake || Boolean(connection())),
    openIntake: () => setIntakeOpen(true),
  };
  const unread = data.messages.filter(
    (m) =>
      (role === 'coach' || m.clientId === client.id) &&
      m.from === (role === "coach" ? "client" : "coach") &&
      !m.read,
  ).length;
  useEffect(() => {
    document.documentElement.dataset.motion = data.settings.reducedMotion
      ? "reduced"
      : "full";
    document.title = `${data.coach.brand} · ${role === "coach" ? "Coach workspace" : "Your coaching"}`;
  }, [data.settings.reducedMotion, data.coach.brand, role]);
  useEffect(() => {
    if (!recovery && data.settings.designVersion !== 'editorial-v1') {
      update(d => { d.settings.theme = 'dark'; d.settings.designVersion = 'editorial-v1'; });
    }
  }, [data.settings.designVersion, recovery]);
  useEffect(() => {
    const theme = data.settings.theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f5f5f3' : '#000000');
    try { localStorage.setItem('avalen.appearance', theme); } catch {}
  }, [data.settings.theme]);
  if (recovery) return (
    <div className="error-screen">
      <Mark large />
      <h1>Your records come first.</h1>
      <p role="alert">{recovery.message}</p>
      {recovery.raw !== null && <Button onClick={() => download(new Blob([recovery.raw], { type: 'application/json' }), 'avalen-recovery.json')}>Download recovery copy</Button>}
      <Button secondary onClick={() => location.reload()}>Try loading again</Button>
    </div>
  );
  return (
    <AppContext.Provider value={context}>
      <MotionProvider value={`${role}:${role === 'coach' ? selectedClientId || 'workspace' : client.id}:${route.viewDate || dayKey()}`}>
      {splash && <Splash onLift={() => setCurtainUp(true)} onDone={dismissSplash} preview={new URLSearchParams(location.search).get('preview') === 'splash'}/>}
      {splash && !curtainUp ? null : !data.onboarded || welcomePreview ? (
        <Welcome onDismiss={() => setWelcomePreview(false)} onJoined={() => setIntakeOpen(true)}/>
      ) : (
        <div className={`app-shell role-${role} ${sessionDetail ? 'viewing-session' : ''} ${exerciseDetail ? 'viewing-exercise' : ''}`}>
          <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); const main = document.getElementById('main-content'); main?.focus(); main?.scrollIntoView({behavior:'instant'}); }}>Skip to content</a>
          <aside className="desktop-sidebar">
            <div className="sidebar-brand">
              <BrandLogo brand={data.coach} />
              <span>{data.coach.brand}</span>
            </div>
            <span className="eyebrow">
              {role === "coach" ? "COACH WORKSPACE" : "YOUR COACHING"}
            </span>
            <nav aria-label="Workspace navigation">
              {nav.map(([id, label, Icon]) => (
                <button
                  key={id}
                  aria-label={label}
                  aria-current={screen === id ? 'page' : undefined}
                  className={screen === id || (role === "client" && id === "you" && screen === "coach") ? "active" : ""}
                  onClick={() => navigate(id)}
                >
                  <Icon size={19} />
                  {label}
                  {id === (role === "coach" ? "inbox" : "you") &&
                    unread > 0 && <i>{unread}</i>}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <div className="workspace-label">
                <span />
                {connection()?'Connected workspace':'Local workspace'}
              </div>
              <p>
                Thoughtful coaching.
                <br />
                Meaningful progress.
              </p>
              <small>{connection()?'Saved to your private account':'Saved on this device'}</small>
            </div>
          </aside>
          <div className={`app-content ${role === 'client' && data.drafts[client.id] ? 'has-workout' : ''}`}>
            <header className="app-header">
              <div className="header-identity">
                <button className="profile-button" aria-label={role === 'coach' ? 'Coach brand settings' : 'Your profile'} onClick={() => navigate(role === 'coach' ? 'business' : 'you', role === 'coach' ? 'Brand' : '')}><Avatar name={role === 'coach' ? data.coach.name : client.name}/></button>
                <span className="header-wordmark">AVALEN</span>
                {connection()?<button className="text-link" onClick={()=>setAccountSettings(true)}>Account</button>:<label className="role-select"><select aria-label="Workspace role" value={role} onChange={e => changeRole(e.target.value)}><option value="client">Client</option><option value="coach">Coach</option></select></label>}
              </div>
              <div className="header-actions">{role === 'client' && <><IconButton label="Search sessions" disabled={navigatingBack} onClick={()=>setSearch(true)}><Search size={22}/></IconButton></>}<IconButton label={role === "client" ? "Coach messages" : "Notifications"} onClick={()=>role === "client" ? navigate("coach","Messages") : setNotifications(true)}>{role === "client" ? <MessageCircle size={20}/> : <Bell size={20}/>}{unread > 0 && <i className="notification-dot"/>}</IconButton></div>
            </header>
            <main
              key={`${screen}-${client.id}`}
              className={`page page-${screen}`}
              id="main-content"
              tabIndex={-1}
            >
              {storageError && <Notice>{storageError}{unsavedAction()&&<div className="button-row"><Button small onClick={async()=>{try{await retryUnsent();notify('Action saved. Reload this view before repeating it.');}catch(e){notify(e.message);}}}>Retry unsaved action</Button><Button small secondary onClick={()=>download(new Blob([JSON.stringify(unsavedAction(),null,2)],{type:'application/json'}),'avalen-unsaved-action.json')}>Download recovery copy</Button><button className="text-link muted" onClick={()=>{discardUnsent();notify('Unconfirmed action removed from this device. Reload to check the server before entering it again.');}}>Discard local retry</button></div>}</Notice>}
              <Suspense fallback={<div className="route-loader" role="status" aria-label="Loading workspace" aria-busy="true"><BrandMark/></div>}>
              {exerciseDetail ? <ExerciseDetail key={exerciseDetail.name} exercise={exerciseDetail} client={viewedClient} coachView={role === 'coach'} onBack={closeExercise}/> : sessionDetail ? <SessionDetail key={sessionDetail.day.id} session={sessionDetail} onBack={closeSession}/> : screen === "today" ? (
                <EditorialHome />
              ) : screen === "plan" ? (
                <Plan />
              ) : screen === "nutrition" ? (
                <><Heading title="Nutrition." subtitle="Your coach’s plan. Your daily progress."/><Nutrition /></>
              ) : screen === "progress" ? (
                <Progress />
              ) : screen === "coach" ? (
                <CoachHome />
              ) : screen === "you" ? (
                <You />
              ) : screen === "dashboard" ? (
                <Dashboard />
              ) : screen === "clients" ? (
                <Clients />
              ) : screen === "programs" ? (
                <Programs />
              ) : screen === "inbox" ? (
                <Inbox />
              ) : (
                <Business />
              )}
              </Suspense>
              <footer className="page-footer">
                {connection()?'Connected workspace · Private account':`${data.demo ? "Demo workspace" : "Local workspace"} · Saved on this device`}
              </footer>
            </main>
            {role === 'client' && screen !== 'today' && !(screen === 'plan' && ['', 'Training'].includes(subtab) && (!route.viewDate || route.viewDate === dayKey())) && data.drafts[client.id] && <ResumeWorkout compact />}
            <nav ref={bottomNav} className="bottom-nav" aria-label="Main navigation" style={{'--nav-count': nav.length}}>
              
              <MovingIndicator container={bottomNav} value={screen} selector='[aria-current="page"]' className="motion-nav-indicator"/>
              {nav.map(([id, label, Icon]) => (
                <button
                  key={id}
                  aria-label={label}
                  aria-description={id === (role === "coach" ? "inbox" : "you") && unread > 0 ? `${unread} unread messages` : undefined}
                  aria-current={screen === id || (role === "client" && id === "you" && screen === "coach") ? "page" : undefined}
                  className={screen === id || (role === "client" && id === "you" && screen === "coach") ? "active" : ""}
                  onClick={() => navigate(id)}
                >
                  <Icon size={21} strokeWidth={screen === id ? 2.4 : 1.5} />
                  <span>{label}</span>
                  {id === (role === "coach" ? "inbox" : "you") && unread > 0 && <i aria-label={`${unread} unread messages`}>{unread}</i>}
                </button>
              ))}
            </nav>
            <AvalenAssistant/>
          </div>
        </div>
      )}
      {intakeOpen && role === 'client' && <IntakeFlow onClose={closeIntake}/>}
      {accountSettings && <AccountSettings onClose={()=>setAccountSettings(false)}/>}
      {search && <SessionSearch onClose={() => setSearch(false)}/>}
      {toast && <div className="app-toast" role="status" key={toast.id}><Check size={17}/><span>{toast.message}</span>{toast.undo && <button onClick={() => { toast.undo(); setToast(null); }}>Undo</button>}<button aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={17}/></button></div>}
      {workout && (
        <Workout
          onClose={pauseWorkout}
          onFinish={(id) => {
            setWorkout(false);
            setShare({ sessionId: id, celebrate: true });
          }}
        />
      )}
      {share && (!share.sessionId || data.sessions.some(s=>s.id===share.sessionId)) && (
        <ShareWorkout
          celebrate={Boolean(share.celebrate)}
          session={
            share.sessionId
              ? data.sessions.find((s) => s.id === share.sessionId)
              : share
          }
          onClose={() => setShare(null)}
        />
      )}
      {notifications && (
        <Modal title="Your updates" onClose={() => setNotifications(false)}>
          {role === "coach"
            ? data.clients.flatMap((c) =>
                attentionFor(data, c).map((f) => (
                  <button
                    className="simple-row"
                    key={c.id + f.key}
                    onClick={() => {
                      setNotifications(false);
                      selectClient(c.id, f.tab);
                    }}
                  >
                    <span>
                      <b>{c.name}</b>
                      <small className={f.tone}>{f.title}</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                )),
              )
            : data.messages
                .filter((m) => m.clientId === client.id && m.from === "coach")
                .slice(-5)
                .reverse()
                .map((m) => (
                  <button
                    className="simple-row"
                    key={m.id}
                    onClick={() => {
                      setNotifications(false);
                      navigate("coach", "Messages");
                    }}
                  >
                    <MessageCircle size={19} />
                    <span>
                      <b>From your coach</b>
                      <small>{m.text.slice(0, 95)}</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))}
          <Notice>
            In-app updates only. Push notifications are not enabled in this
            local preview.
          </Notice>
        </Modal>
      )}
      </MotionProvider>
    </AppContext.Provider>
  );
}

function Welcome({ onDismiss, onJoined }) {
  const { data, update } = React.useContext(AppContext);
  const {save, saving, error:saveError} = useWorkspaceSave();
  const [join, setJoin] = useState(false), [error, setError] = useState(''), [privacy, setPrivacy] = useState(false);
  async function explore() { if (await save(d => d.onboarded = true)) onDismiss(); }
  return <div className="editorial-welcome">
    <img className="editorial-welcome-photo" src={welcomePortrait} alt="Athlete preparing for training"/>
    <div className="editorial-welcome-shade"/>
    <div className="editorial-welcome-wordmark">AVALEN</div>
    <div className="editorial-welcome-content motion-stage"><p className="welcome-greeting">{data.onboarded ? `Welcome ${data.clients.find(c => c.id === data.activeClientId)?.name.split(' ')[0]}!` : 'A little about you. A lot of possibility.'}</p><h1>Realize your<br/>potential.</h1><p className="welcome-description">Your training. Your goals. Your coach.<br/>A more personal way to move forward.</p><div className="welcome-time"><Clock3 size={19}/><span>Make it yours in less than 1 minute</span></div><p className="welcome-privacy">Your information stays on this device. <button onClick={() => setPrivacy(true)}>Your privacy</button></p><Button aria-label="Get Started" disabled={saving} onClick={() => data.onboarded ? onDismiss() : setJoin(true)}>Let’s go</Button><button className="welcome-skip" aria-label="Explore demo" disabled={saving} onClick={explore}>Skip for now</button>{saveError && <p className="error" role="alert">{saveError}</p>}</div>
    {join && <Modal title="Make it personal." onClose={() => setJoin(false)} canClose={!saving}><p className="muted">Join your coach’s preview with code <b>00000</b>.</p><form onSubmit={async e => {
      e.preventDefault(); const fields = new FormData(e.currentTarget);
      if (fields.get('code') !== '00000') { setError('Use 00000 for this preview.'); return; }
      if (!String(fields.get('name')).trim()) { setError('Please enter your name.'); return; }
      const c = newClient(fields.get('name').trim(), fields.get('email').trim());
      c.created = dayKey(); c.schedule = c.schedule.filter(s => s.date >= dayKey()); c.goal = fields.get('goal'); c.needsIntake = true;
      if (await save(d => { d.clients.push(c); d.activeClientId = c.id; d.onboarded = true; d.demo = false; })) { onDismiss(); onJoined(); }
    }}><fieldset className="save-fields" disabled={saving}><Field label="Your name" name="name" autoComplete="name" required maxLength={70}/><Field label="Email" name="email" type="email" autoComplete="email" required/><Field label="Your focus"><select name="goal" defaultValue="Build strength"><option>Build strength</option><option>Improve fitness</option><option>Build a consistent routine</option><option>Improve body composition</option></select></Field><Field label="Coach code" name="code" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} required placeholder="00000"/>{error && <p className="error" role="alert">{error}</p>}{saveError && <p className="error" role="alert">{saveError}</p>}<Button type="submit">{saving ? "Saving profile…" : "Join my coach"} <ArrowRight size={18}/></Button><p className="fine-print muted">Local preview. Your entries are saved on this device.</p></fieldset></form></Modal>}
    {privacy && <Modal title="Your privacy" onClose={() => setPrivacy(false)}><p className="account-legal-links"><a href="/privacy.html" target="_blank" rel="noreferrer">Privacy policy</a> · <a href="/support.html" target="_blank" rel="noreferrer">Help & support</a></p><p>This preview saves your profile and training records in this browser on this device. It does not send your information to a coach or connect to a health account.</p><p>You can export your records from More. Starting a fresh test profile keeps existing profiles and their records.</p><Button onClick={() => setPrivacy(false)}>Got it</Button></Modal>}
  </div>;
}

function You() {
  const { data, client, update, navigate } = React.useContext(AppContext);
  const {save, saving, error:saveError} = useWorkspaceSave();
  const [edit, setEdit] = useState(false),
    [reset, setReset] = useState(false),
    [privacy, setPrivacy] = useState(false),
    [form, setForm] = useState({
      name: client.name,
      email: client.email,
      goal: client.goal,
    });
  return (
    <>
      <Heading title="You" />
      <section className="card you-profile">
        <Avatar name={client.name} size="large" />
        <h2>{client.name}</h2>
        <p>{client.goal}</p>
        <Button secondary small onClick={() => setEdit(true)}>
          Edit profile
        </Button>
      </section>
      <ClientPayments />
      <button className="more-coach-shortcut" onClick={() => navigate("coach", "Overview")}><MessageCircle size={20}/><span>Your coach<small>Messages, check-ins and membership</small></span><ChevronRight size={18}/></button>

      <MotionDetails className="settings-disclosure"><summary>Coaching updates<ChevronRight size={18}/></summary><CoachingMemory clientId={client.id} compact/></MotionDetails>
      {connection() && <AISharingPreference/>}
      <Appearance />
      {!connection() && <MotionDetails className="settings-disclosure"><summary>Account & connection<ChevronRight size={18}/></summary><a className="simple-row" href="/?connected=1">Connect a private coaching workspace <ArrowRight size={18}/></a></MotionDetails>}
      <MotionDetails className="settings-disclosure" open={openDevicesOnReturn() || undefined}><summary>Connected devices<small>Sleep, recovery and activity from your wearable</small><ChevronRight size={18}/></summary><ConnectedDevices /></MotionDetails>
      <div className="card list">
        <button className="simple-row" onClick={() => setPrivacy(true)}>
          <Shield size={19} />
          <span>
            <b>{connection()?'Privacy & your recordings':'Privacy & this preview'}</b>
            <small>Understand how your data is stored</small>
          </span>
          <ChevronRight size={16} />
        </button>
        <button
          className="simple-row"
          onClick={() => {
            const mine = {
              profile: client,
              exportedAt: new Date().toISOString(),
            };
            for (const k of [
              "sessions",
              "foodLogs",
              "measurements",
              "habitLogs",
              "checkins",
              "messages",
              "photos",
              "documents",
              "inbodies",
              "timeline",
              "activityLogs",
              "nutritionDays",
              "formSubmissions","scheduleProposals","notifications",
            ])
              mine[k] = (data[k] || []).filter((x) => x.clientId === client.id);
            download(
              new Blob([JSON.stringify(mine, null, 2)], {
                type: "application/json",
              }),
              "avalen-my-data.json",
            );
          }}
        >
          <Download size={19} />
          <span>
            <b>Export my data</b>
            <small>JSON records · media files are downloaded separately</small>
          </span>
          <ChevronRight size={16} />
        </button>
        <label className="simple-row">
          <Settings size={19} />
          <span>
            <b>Reduce motion</b>
            <small>Keep transitions minimal</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={data.settings.reducedMotion}
            onChange={(e) =>
              update((d) => (d.settings.reducedMotion = e.target.checked))
            }
          />
        </label>
      </div>
      {!connection() && <section className="card">
        <h3>Test another perspective</h3>
        <p className="muted">
          Preview a client, or use the role selector at the top to explore the
          coach workspace. This switch is for testing only.
        </p>
        <Field label="Client preview">
          <select
            value={client.id}
            onChange={(e) => update((d) => (d.activeClientId = e.target.value))}
          >
            {data.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Button secondary onClick={() => setReset(true)}>
          Start a fresh test profile
        </Button>
      </section>}
      {edit && (
        <Modal title="Your profile" onClose={() => setEdit(false)} canClose={!saving}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await save((d) =>
                Object.assign(
                  d.clients.find((c) => c.id === client.id),
                  Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])),
                ),
              )) setEdit(false);
            }}
          >
            <fieldset className="save-fields" disabled={saving}>
            {[
              ["name", "Full name"],
              ["email", "Email"],
              ["goal", "Your goal"],
            ].map(([k, label]) => (
              <Field
                key={k}
                label={label}
                required
                type={k === "email" ? "email" : "text"}
                value={form[k]}
                maxLength={k === "goal" ? 200 : 80}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            ))}
            {saveError && <p className="error" role="alert">{saveError}</p>}
            <Button type="submit">{saving ? 'Saving profile…' : 'Save profile'}</Button>
            </fieldset>
          </form>
        </Modal>
      )}
      {reset && (
        <Modal title="A clean start" onClose={() => setReset(false)}>
          <p>
            Create a new profile with no workout, food or progress history.
            Existing profiles and their records will be kept.
          </p>
          <Button
            onClick={() => {
              update((d) => (d.onboarded = false));
              setReset(false);
            }}
          >
            Return to Get Started
          </Button>
        </Modal>
      )}
      {privacy && (
        <Modal
          title={connection() ? "Your private coaching data" : "Your data in this preview"}
          onClose={() => setPrivacy(false)}
        >
          <p className="account-legal-links"><a href="/privacy.html" target="_blank" rel="noreferrer">Privacy policy</a> · <a href="/support.html" target="_blank" rel="noreferrer">Help & support</a></p>
          {connection()?<><h3>Your private coaching workspace</h3><p>Your records are stored by this Avalen service. Your account and assigned coach can access your coaching records; private coach notes stay with the coach. Recordings are retained until their displayed expiry date and can be deleted from FormLab. Unpublished editor drafts can remain on this device.</p><p>AI and transcription receive evidence or recordings only when configured and you explicitly allow the request. In-app reminders are active; external notifications and wearables need configured services.</p></>:<><h3>Local, not cloud-connected</h3>
          <p>
            Your records are saved in this browser. Uploaded photos, videos and
            PDFs are stored on this device. Anyone with access to this browser
            profile can access them.
          </p>
          <h3>Use test data only</h3>
          <p>
            The coach/client switch and code 00000 are demo tools, not
            authentication. Don’t use this version for real private health
            records.
          </p>
          <h3>What isn’t connected yet</h3>
          <p>
            Secure sign-in, cloud sync, real payments, push notifications,
            wearable imports and AI food/report recognition require production
            services. App-store submission also requires a native build and a
            full security and privacy review.
          </p></>}
        </Modal>
      )}
    </>
  );
}

class ErrorBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch() {
    leaveBoot();
  }
  render() {
    return this.state.error ? (
      <div className="error-screen">
        <Mark large />
        <h1>Let’s get you back on track.</h1>
        <p>
          The screen couldn’t load. Your saved records haven’t been cleared.
        </p>
        <Button onClick={() => location.reload()}>Reload app</Button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <AccountGate><App /></AccountGate>
  </ErrorBoundary>,
);
