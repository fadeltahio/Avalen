import { AISharingPreference } from "./ecosystem/updates.jsx";
import { deviceTimezone } from "./ecosystem/time.js";
import React, { lazy, Suspense, useEffect, useMemo, useState, useRef } from "react";
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
import { AccountGate, AccountSettings, CoachlessHome, SignOutSection } from "./ecosystem/accounts.jsx";
import { connection, connectedCommand, unsavedAction, retryUnsent, discardUnsent, refreshConnection } from "./ecosystem/connection.js";
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
  SectionHead,
  IconButton,
  Mark,
  Modal,
  Notice,
} from "./ui.jsx";
import { Plan, Progress, Nutrition } from "./client.jsx";
import { Appearance, ConnectedDevices } from "./preferences.jsx";
import { CoachCodeCard } from "./CoachCode.jsx";
import { openDevicesOnReturn } from "./wearables.jsx";
import { t, lines } from "./i18n.js";
import { startDomTranslation } from "./i18n-dom.js";
import { ResumeWorkout } from "./resume.jsx";
import { IntakeFlow } from "./IntakeFlow.jsx";
import { EditorialHome, SessionDetail, SessionSearch, Splash } from "./editorial.jsx";
import { ExerciseDetail } from "./ExerciseDetail.jsx";
import { BrandMark, leaveBoot } from "./BrandMark.jsx";
import { findExercise } from "./exercise-stats.js";
import { CoachHome } from "./communication.jsx";
import { Welcome } from "./more/Welcome.jsx";
import { FirstClient } from "./more/FirstClient.jsx";
import { CoachMore } from "./more/CoachMore.jsx";
import { You } from "./more/You.jsx";
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
import "./native.css";
import "./rtl.css";
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
  ["dashboard", "Home", Home],
  ["clients", "Clients", Users],
  ["programs", "Programs", FileText],
  ["inbox", "Inbox", MessageCircle],
  ["business", "Business", BarChart3],
  ["more", "More", MoreHorizontal],
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
  // A new coach account has no clients until the first one joins; the screens below
  // read an active client, so they get a stand-in and only the first-client screen shows.
  const noClients = !data.clients.length;
  const standIn = useMemo(() => ({ ...newClient('', ''), id: 'no-client' }), []);
  const client = data.clients.find(c => c.id === data.activeClientId) || data.clients[0] || standIn;
  // Records the client's own time zone from their phone (again if they travel), so
  // check-in days and reminders follow their clock instead of UTC.
  useEffect(() => {
    if (role !== 'client' || noClients || recovery || data.coachless) return;
    const zone = deviceTimezone();
    if (client.timezone !== zone) update(d => { const own = d.clients.find(c => c.id === client.id); if (own) own.timezone = zone; });
  }, [role, client.id, client.timezone, noClients, recovery]);
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
      <h1>{t('Your records come first.')}</h1>
      <p role="alert">{recovery.message}</p>
      {recovery.raw !== null && <Button onClick={() => download(new Blob([recovery.raw], { type: 'application/json' }), 'avalen-recovery.json')}>{t('Download recovery copy')}</Button>}
      <Button secondary onClick={() => location.reload()}>{t('Try loading again')}</Button>
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
          <div className="status-bar-scrim" aria-hidden="true"/>
          <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); const main = document.getElementById('main-content'); main?.focus(); main?.scrollIntoView({behavior:'instant'}); }}>{t('Skip to content')}</a>
          <aside className="desktop-sidebar">
            <div className="sidebar-brand">
              <BrandLogo brand={data.coach} />
              <span>{data.coach.brand}</span>
            </div>
            <span className="eyebrow">
              {role === "coach" ? t('COACH WORKSPACE') : t('YOUR COACHING')}
            </span>
            <nav aria-label={t('Workspace navigation')}>
              {nav.map(([id, label, Icon]) => (
                <button
                  key={id}
                  aria-label={t(label)}
                  aria-current={screen === id ? 'page' : undefined}
                  className={screen === id || (role === "client" && id === "you" && screen === "coach") ? "active" : ""}
                  onClick={() => navigate(id)}
                >
                  <Icon size={19} />
                  {t(label)}
                  {id === (role === "coach" ? "inbox" : "you") &&
                    unread > 0 && <i>{unread}</i>}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <div className="workspace-label">
                <span />
                {connection()?t('Connected workspace'):t('Local workspace')}
              </div>
              <p>
                {t('Thoughtful coaching.')}
                <br />
                {t('Meaningful progress.')}
              </p>
              <small>{connection()?t('Saved to your private account'):t('Saved on this device')}</small>
            </div>
          </aside>
          <div className={`app-content ${role === 'client' && data.drafts[client.id] ? 'has-workout' : ''}`}>
            <header className="app-header">
              <div className="header-identity">
                <button className="profile-button" aria-label={role === 'coach' ? t('Coach brand settings') : t('Your profile')} onClick={() => navigate(role === 'coach' ? 'business' : 'you', role === 'coach' ? 'Brand' : '')}><Avatar name={role === 'coach' ? data.coach.name : client.name}/></button>
                <span className="header-wordmark">AVALEN</span>
                {connection()?<button className="text-link" onClick={()=>setAccountSettings(true)}>{t('Account')}</button>:<label className="role-select"><select aria-label={t('Workspace role')} value={role} onChange={e => changeRole(e.target.value)}><option value="client">{t('Client')}</option><option value="coach">{t('Coach')}</option></select></label>}
              </div>
              <div className="header-actions">{role === 'client' && <><IconButton label={t('Search sessions')} disabled={navigatingBack} onClick={()=>setSearch(true)}><Search size={22}/></IconButton></>}<IconButton label={role === "client" ? t('Coach messages') : t('Notifications')} onClick={()=>role === "client" ? navigate("coach","Messages") : setNotifications(true)}>{role === "client" ? <MessageCircle size={20}/> : <Bell size={20}/>}{unread > 0 && <i className="notification-dot"/>}</IconButton></div>
            </header>
            <main
              key={`${screen}-${client.id}`}
              className={`page page-${screen}`}
              id="main-content"
              tabIndex={-1}
            >
              {storageError && <Notice>{storageError}{unsavedAction()&&<div className="button-row"><Button small onClick={async()=>{try{await retryUnsent();notify(t('Action saved. Reload this view before repeating it.'));}catch(e){notify(e.message);}}}>{t('Retry unsaved action')}</Button><Button small secondary onClick={()=>download(new Blob([JSON.stringify(unsavedAction(),null,2)],{type:'application/json'}),'avalen-unsaved-action.json')}>{t('Download recovery copy')}</Button><button className="text-link muted" onClick={()=>{discardUnsent();notify(t('Unconfirmed action removed from this device. Reload to check the server before entering it again.'));}}>{t('Discard local retry')}</button></div>}</Notice>}
              <Suspense fallback={<div className="route-loader" role="status" aria-label={t('Loading workspace')} aria-busy="true"><BrandMark/></div>}>
              {data.coachless ? <CoachlessHome coachless={data.coachless} /> : noClients ? <FirstClient onAccount={() => setAccountSettings(true)} /> : exerciseDetail ? <ExerciseDetail key={exerciseDetail.name} exercise={exerciseDetail} client={viewedClient} coachView={role === 'coach'} onBack={closeExercise}/> : sessionDetail ? <SessionDetail key={sessionDetail.day.id} session={sessionDetail} onBack={closeSession}/> : screen === "today" ? (
                <EditorialHome />
              ) : screen === "plan" ? (
                <Plan />
              ) : screen === "nutrition" ? (
                <><Heading title={t('Nutrition.')} subtitle={t('Your coach’s plan. Your daily progress.')}/><Nutrition /></>
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
              ) : screen === "more" ? (
                <CoachMore onAccount={() => setAccountSettings(true)} />
              ) : (
                <Business />
              )}
              </Suspense>
              <footer className="page-footer">
                {connection()?t('Connected workspace · Private account'):t('{value} · Saved on this device', { value: data.demo ? "Demo workspace" : "Local workspace" })}
              </footer>
            </main>
            {role === 'client' && screen !== 'today' && !(screen === 'plan' && ['', 'Training'].includes(subtab) && (!route.viewDate || route.viewDate === dayKey())) && data.drafts[client.id] && <ResumeWorkout compact />}
            <nav ref={bottomNav} className={`bottom-nav ${noClients || data.coachless ? 'is-hidden' : ''}`} aria-label={t('Main navigation')} style={{'--nav-count': nav.length}}>
              
              <MovingIndicator container={bottomNav} value={screen} selector='[aria-current="page"]' className="motion-nav-indicator"/>
              {nav.map(([id, label, Icon]) => (
                <button
                  key={id}
                  aria-label={t(label)}
                  aria-description={id === (role === "coach" ? "inbox" : "you") && unread > 0 ? `${unread} unread messages` : undefined}
                  aria-current={screen === id || (role === "client" && id === "you" && screen === "coach") ? "page" : undefined}
                  className={screen === id || (role === "client" && id === "you" && screen === "coach") ? "active" : ""}
                  onClick={() => navigate(id)}
                >
                  <Icon size={21} strokeWidth={screen === id ? 2.4 : 1.5} />
                  <span>{t(label)}</span>
                  {id === (role === "coach" ? "inbox" : "you") && unread > 0 && <i aria-label={t('{unread} unread messages', { unread })}>{unread}</i>}
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
      {toast && <div className="app-toast" role="status" key={toast.id}><Check size={17}/><span>{toast.message}</span>{toast.undo && <button onClick={() => { toast.undo(); setToast(null); }}>{t('Undo')}</button>}<button aria-label={t('Dismiss notification')} onClick={() => setToast(null)}><X size={17}/></button></div>}
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
        <Modal title={t('Your updates')} onClose={() => setNotifications(false)}>
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
                      <b>{t(c.name)}</b>
                      <small className={f.tone}>{t(f.title)}</small>
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
                      <b>{t('From your coach')}</b>
                      <small>{m.text.slice(0, 95)}</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))}
          <Notice>
            {t('In-app updates only. Push notifications are not enabled in this local preview.')}
          </Notice>
        </Modal>
      )}
      </MotionProvider>
    </AppContext.Provider>
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
        <h1>{t('Let’s get you back on track.')}</h1>
        <p>
          {t('The screen couldn’t load. Your saved records haven’t been cleared.')}
        </p>
        <Button onClick={() => location.reload()}>{t('Reload app')}</Button>
      </div>
    ) : (
      this.props.children
    );
  }
}
startDomTranslation();
createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <AccountGate><App /></AccountGate>
  </ErrorBoundary>,
);
