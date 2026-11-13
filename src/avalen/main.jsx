import { AISharingPreference } from "./ecosystem/updates.jsx";
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
import { AccountGate, AccountSettings, SignOutSection } from "./ecosystem/accounts.jsx";
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
              {noClients ? <FirstClient onAccount={() => setAccountSettings(true)} /> : exerciseDetail ? <ExerciseDetail key={exerciseDetail.name} exercise={exerciseDetail} client={viewedClient} coachView={role === 'coach'} onBack={closeExercise}/> : sessionDetail ? <SessionDetail key={sessionDetail.day.id} session={sessionDetail} onBack={closeSession}/> : screen === "today" ? (
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
            <nav ref={bottomNav} className={`bottom-nav ${noClients ? 'is-hidden' : ''}`} aria-label={t('Main navigation')} style={{'--nav-count': nav.length}}>
              
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

function Welcome({ onDismiss, onJoined }) {
  const { data, update } = React.useContext(AppContext);
  const {save, saving, error:saveError} = useWorkspaceSave();
  const [join, setJoin] = useState(false), [error, setError] = useState(''), [privacy, setPrivacy] = useState(false);
  async function explore() { if (await save(d => d.onboarded = true)) onDismiss(); }
  return <div className="editorial-welcome">
    <img className="editorial-welcome-photo" src={welcomePortrait} alt={t('Athlete preparing for training')}/>
    <div className="editorial-welcome-shade"/>
    <div className="editorial-welcome-wordmark">AVALEN</div>
    <div className="editorial-welcome-content motion-stage"><p className="welcome-greeting">{data.onboarded ? t('Welcome {name}!', {name: data.clients.find(c => c.id === data.activeClientId)?.name.split(' ')[0]}) : t('A little about you. A lot of possibility.')}</p><h1>{lines(t('Realize your\npotential.'))}</h1><p className="welcome-description">{lines(t('Your training. Your goals. Your coach.\nA more personal way to move forward.'))}</p><div className="welcome-time"><Clock3 size={19}/><span>{t('Make it yours in less than 1 minute')}</span></div><p className="welcome-privacy">{t('Your information stays on this device.')} <button onClick={() => setPrivacy(true)}>{t('Your privacy')}</button></p><Button aria-label={t('Get Started')} disabled={saving} onClick={() => data.onboarded ? onDismiss() : setJoin(true)}>{t('Let’s go')}</Button><button className="welcome-skip" aria-label={t('Explore demo')} disabled={saving} onClick={explore}>{t('Skip for now')}</button>{saveError && <p className="error" role="alert">{saveError}</p>}</div>
    {join && <Modal title={t('Make it personal.')} onClose={() => setJoin(false)} canClose={!saving}><p className="muted">{t('Join your coach’s preview with code')} <b>00000</b>.</p><form onSubmit={async e => {
      e.preventDefault(); const fields = new FormData(e.currentTarget);
      if (fields.get('code') !== '00000') { setError(t('Use 00000 for this preview.')); return; }
      if (!String(fields.get('name')).trim()) { setError(t('Please enter your name.')); return; }
      const c = newClient(fields.get('name').trim(), fields.get('email').trim());
      c.created = dayKey(); c.schedule = c.schedule.filter(s => s.date >= dayKey()); c.goal = fields.get('goal'); c.needsIntake = true;
      if (await save(d => { d.clients.push(c); d.activeClientId = c.id; d.onboarded = true; d.demo = false; })) { onDismiss(); onJoined(); }
    }}><fieldset className="save-fields" disabled={saving}><Field label={t('Your name')} name="name" autoComplete="name" required maxLength={70}/><Field label={t('Email')} name="email" type="email" autoComplete="email" required/><Field label={t('Your focus')}><select name="goal" defaultValue="Build strength"><option value="Build strength">{t('Build strength')}</option><option value="Improve fitness">{t('Improve fitness')}</option><option value="Build a consistent routine">{t('Build a consistent routine')}</option><option value="Improve body composition">{t('Improve body composition')}</option></select></Field><Field label={t('Coach code')} name="code" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} required placeholder="00000"/>{error && <p className="error" role="alert">{error}</p>}{saveError && <p className="error" role="alert">{saveError}</p>}<Button type="submit">{saving ? t('Saving profile…') : t('Join my coach')} <ArrowRight size={18}/></Button><p className="fine-print muted">{t('Local preview. Your entries are saved on this device.')}</p></fieldset></form></Modal>}
    {privacy && <Modal title={t('Your privacy')} onClose={() => setPrivacy(false)}><p className="account-legal-links"><a href="/privacy.html" target="_blank" rel="noreferrer">{t('Privacy policy')}</a> · <a href="/support.html" target="_blank" rel="noreferrer">{t('Help & support')}</a></p><p>{t('This preview saves your profile and training records in this browser on this device. It does not send your information to a coach or connect to a health account.')}</p><p>{t('You can export your records from More. Starting a fresh test profile keeps existing profiles and their records.')}</p><Button onClick={() => setPrivacy(false)}>{t('Got it')}</Button></Modal>}
  </div>;
}

// A new coach before their first client: their code, a way to check for new clients
// or add one directly, and the settings they need.
function FirstClient({ onAccount }) {
  const { data } = React.useContext(AppContext);
  const { save, saving, error: saveError } = useWorkspaceSave();
  const [adding, setAdding] = useState(false), [checking, setChecking] = useState(false), [note, setNote] = useState('');
  async function check() {
    setChecking(true); setNote('');
    try { const fresh = await refreshConnection(); if (!fresh?.data?.clients?.length) setNote(t('No one has joined yet. New clients also appear here automatically.')); }
    catch (e) { setNote(e.message); }
    finally { setChecking(false); }
  }
  return (
    <>
      <Heading title={t('Welcome, {name}.', { name: (data.coach.name || '').split(' ')[0] })} subtitle={t('Your first client is one code away.')} />
      <CoachCodeCard />
      <section className="card first-client">
        <SectionHead title={t('Waiting for your first client')} />
        <p className="muted">{t('When a client joins with your code, they appear here and your full coaching workspace opens.')}</p>
        <Button secondary disabled={checking || !connection()} onClick={check}>{checking ? t('Checking…') : t('Check for new clients')}</Button>
        {note && <p className="muted" role="status">{note}</p>}
        <button type="button" className="text-link" onClick={() => setAdding(true)}>{t('Or add a client yourself')}</button>
      </section>
      <Appearance />
      <div className="card list">
        {connection() && <button className="simple-row" onClick={onAccount}><Shield size={19} /><span><b>{t('Account')}</b><small>{t('Sign in details, privacy and sign out')}</small></span><ChevronRight size={16} /></button>}
        <a className="simple-row" href="/support.html" target="_blank" rel="noreferrer"><MessageCircle size={19} /><span><b>{t('Help & support')}</b><small>{t('Questions, problems and feedback')}</small></span><ChevronRight size={16} /></a>
      </div>
      <SignOutSection />
      {adding && (
        <Modal title={t('Add a client')} onClose={() => setAdding(false)} canClose={!saving}>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const fields = new FormData(e.currentTarget), c = newClient(String(fields.get('name')).trim(), String(fields.get('email')).trim());
            c.created = dayKey();
            c.schedule = c.schedule.filter((s) => s.date >= dayKey());
            if (await save((d) => { d.clients.push(c); d.activeClientId = c.id; })) setAdding(false);
          }}>
            <fieldset className="save-fields" disabled={saving}>
              <Field label={t('Full name')} name="name" required maxLength={80} />
              <Field label={t('Email')} name="email" type="email" required />
              {saveError && <p className="error" role="alert">{saveError}</p>}
              <Button type="submit">{saving ? t('Creating client…') : t('Create client')}</Button>
            </fieldset>
          </form>
        </Modal>
      )}
    </>
  );
}

// The coach's More: the same settings a client finds under More, for the coach.
function CoachMore({ onAccount }) {
  const { data, update, navigate } = React.useContext(AppContext);
  return (
    <>
      <Heading title={t('You')} />
      <section className="card you-profile">
        <Avatar name={data.coach.name} size="large" />
        <h2>{t(data.coach.name)}</h2>
        <p>{data.coach.brand}</p>
        <Button secondary small onClick={() => navigate("business", "Brand")}>{t('Brand & business')}</Button>
      </section>
      <CoachCodeCard />
      <Appearance />
      <div className="card list">
        <label className="simple-row">
          <Settings size={19} />
          <span>
            <b>{t('Reduce motion')}</b>
            <small>{t('Keep transitions minimal')}</small>
          </span>
          <input type="checkbox" role="switch" checked={data.settings.reducedMotion} onChange={(e) => update((d) => (d.settings.reducedMotion = e.target.checked))} />
        </label>
        {connection() ? <button className="simple-row" onClick={onAccount}><Shield size={19} /><span><b>{t('Account')}</b><small>{t('Sign in details, privacy and sign out')}</small></span><ChevronRight size={16} /></button>
          : <a className="simple-row" href="/?connected=1"><Shield size={19} /><span><b>{t('Account & connection')}</b><small>{t('Connect a private coaching workspace')}</small></span><ChevronRight size={16} /></a>}
        <a className="simple-row" href="/privacy.html" target="_blank" rel="noreferrer"><FileText size={19} /><span><b>{t('Privacy policy')}</b><small>{t('Understand how your data is stored')}</small></span><ChevronRight size={16} /></a>
        <a className="simple-row" href="/support.html" target="_blank" rel="noreferrer"><MessageCircle size={19} /><span><b>{t('Help & support')}</b><small>{t('Questions, problems and feedback')}</small></span><ChevronRight size={16} /></a>
      </div>
      <SignOutSection />
    </>
  );
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
      <Heading title={t('You')} />
      <section className="card you-profile">
        <Avatar name={client.name} size="large" />
        <h2>{t(client.name)}</h2>
        <p>{client.goal}</p>
        <Button secondary small onClick={() => setEdit(true)}>
          {t('Edit profile')}
        </Button>
      </section>
      <ClientPayments />
      <button className="more-coach-shortcut" onClick={() => navigate("coach", "Overview")}><MessageCircle size={20}/><span>{t('Your coach')}<small>{t('Messages, check-ins and membership')}</small></span><ChevronRight size={18}/></button>

      <MotionDetails className="settings-disclosure"><summary>{t('Coaching updates')}<ChevronRight size={18}/></summary><CoachingMemory clientId={client.id} compact/></MotionDetails>
      {connection() && <AISharingPreference/>}
      <Appearance />
      {!connection() && <MotionDetails className="settings-disclosure"><summary>{t('Account & connection')}<ChevronRight size={18}/></summary><a className="simple-row" href="/?connected=1">{t('Connect a private coaching workspace')} <ArrowRight size={18}/></a></MotionDetails>}
      <MotionDetails className="settings-disclosure" open={openDevicesOnReturn() || undefined}><summary>{t('Connected devices')}<small>{t('Sleep, recovery and activity from your wearable')}</small><ChevronRight size={18}/></summary><ConnectedDevices /></MotionDetails>
      <div className="card list">
        <button className="simple-row" onClick={() => setPrivacy(true)}>
          <Shield size={19} />
          <span>
            <b>{connection()?t('Privacy & your recordings'):t('Privacy & this preview')}</b>
            <small>{t('Understand how your data is stored')}</small>
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
            <b>{t('Export my data')}</b>
            <small>{t('JSON records · media files are downloaded separately')}</small>
          </span>
          <ChevronRight size={16} />
        </button>
        <label className="simple-row">
          <Settings size={19} />
          <span>
            <b>{t('Reduce motion')}</b>
            <small>{t('Keep transitions minimal')}</small>
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
        <h3>{t('Test another perspective')}</h3>
        <p className="muted">
          {t('Preview a client, or use the role selector at the top to explore the coach workspace. This switch is for testing only.')}
        </p>
        <Field label={t('Client preview')}>
          <select
            value={client.id}
            onChange={(e) => update((d) => (d.activeClientId = e.target.value))}
          >
            {data.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {t(c.name)}
              </option>
            ))}
          </select>
        </Field>
        <Button secondary onClick={() => setReset(true)}>
          {t('Start a fresh test profile')}
        </Button>
      </section>}
      <SignOutSection />
      {edit && (
        <Modal title={t('Your profile')} onClose={() => setEdit(false)} canClose={!saving}>
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
            <Button type="submit">{saving ? t('Saving profile…') : t('Save profile')}</Button>
            </fieldset>
          </form>
        </Modal>
      )}
      {reset && (
        <Modal title={t('A clean start')} onClose={() => setReset(false)}>
          <p>
            {t('Create a new profile with no workout, food or progress history. Existing profiles and their records will be kept.')}
          </p>
          <Button
            onClick={() => {
              update((d) => (d.onboarded = false));
              setReset(false);
            }}
          >
            {t('Return to Get Started')}
          </Button>
        </Modal>
      )}
      {privacy && (
        <Modal
          title={connection() ? t('Your private coaching data') : t('Your data in this preview')}
          onClose={() => setPrivacy(false)}
        >
          <p className="account-legal-links"><a href="/privacy.html" target="_blank" rel="noreferrer">{t('Privacy policy')}</a> · <a href="/support.html" target="_blank" rel="noreferrer">{t('Help & support')}</a></p>
          {connection()?<><h3>{t('Your private coaching workspace')}</h3><p>{t('Your records are stored by this Avalen service. Your account and assigned coach can access your coaching records; private coach notes stay with the coach. Recordings are retained until their displayed expiry date and can be deleted from FormLab. Unpublished editor drafts can remain on this device.')}</p><p>{t('AI and transcription receive evidence or recordings only when configured and you explicitly allow the request. In-app reminders are active; external notifications and wearables need configured services.')}</p></>:<><h3>{t('Local, not cloud-connected')}</h3>
          <p>
            {t('Your records are saved in this browser. Uploaded photos, videos and PDFs are stored on this device. Anyone with access to this browser profile can access them.')}
          </p>
          <h3>{t('Use test data only')}</h3>
          <p>
            {t('The coach/client switch and code 00000 are demo tools, not authentication. Don’t use this version for real private health records.')}
          </p>
          <h3>{t('What isn’t connected yet')}</h3>
          <p>
            {t('Secure sign-in, cloud sync, real payments, push notifications, wearable imports and AI food/report recognition require production services. App-store submission also requires a native build and a full security and privacy review.')}
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
