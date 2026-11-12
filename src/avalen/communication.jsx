import {useEditDraft} from './edit-draft.jsx';
import {useMotionReduced} from './motion.jsx';
import {connection} from './ecosystem/connection.js';
import {AudioPlayer} from './ecosystem/recording.jsx';
import { Checkins } from "./checkins.jsx";
export { Checkins } from "./checkins.jsx";
import { checkinSchedule } from "./checkin-model.js";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  Check,
  CheckCheck,
  Heart,
  MessageCircle,
  Paperclip,
  Send,
  Plus,
  X,
  ArrowDown,
  ChevronRight,
} from "lucide-react";
import { useApp } from "./context.js";
import {
  uid,
  dayKey,
  shortDate,
  saveFile,
  decision,
  metrics,
} from "./store.js";
import {
  Avatar,
  Button,
  Empty,
  Field,
  Heading,
  IconButton,
  IMAGES,
  Media,
  Modal,
  Notice,
  SectionHead,
  Stat,
  Tabs,
} from "./ui.jsx";

export function CoachHome() {
  const { data, client, subtab, setSubtab, ask } = useApp();
  const tab = ["Overview", "Feed", "Messages", "Check-in"].includes(subtab)
    ? subtab
    : "Overview";
  const checkinDue = checkinSchedule(client,data.checkins);
  const latest = data.checkins.filter((c) => c.clientId === client.id).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  return (
    <>
      <Heading title="Your coach" />
      <Tabs
        items={["Overview", "Feed", "Messages", "Check-in"]}
        value={tab}
        onChange={setSubtab}
      />
      {tab === "Overview" ? (
        <>
          <section className="card coach-profile">
            <Avatar name={data.coach.name} size="large" />
            <div>
              <span className="eyebrow">YOUR COACH</span>
              <h2>{data.coach.name}</h2>
              <p>{data.coach.brand} coaching</p>
            </div>
            <Button small secondary onClick={() => setSubtab("Messages")}>
              <MessageCircle size={17} />
              Message
            </Button>
          </section>
          <section className="card program-title">
            <span className="eyebrow">YOUR MEMBERSHIP</span>
            <h2>{client.subscription.plan}</h2>
            <p>
              {client.program.name} · {client.program.phase}
            </p>
            <div className="two-stats">
              <div>
                <strong>
                  {client.subscription.currency}{" "}
                  {client.subscription.amount.toLocaleString()}
                </strong>
                <small>per billing period</small>
              </div>
              <div>
                <strong>{shortDate(client.subscription.nextDate)}</strong>
                <small>Next payment · {client.subscription.status}</small>
              </div>
            </div>
            <p className="fine-print muted">
              Payment details are recorded by your coach. No automatic charge is
              enabled.
            </p>
          </section>
          <section className="card">
            <SectionHead title="Your check-in" />
            <p>
              {latest?.response ||
                "Take a moment to reflect. Your check-in helps your coach adapt the plan to your life."}
            </p>
            <Button secondary onClick={() => setSubtab("Check-in")}>
              {latest?.date === dayKey()
                ? "View today’s check-in"
                : checkinDue.due ? "Complete your check-in" : `Next check-in · ${shortDate(checkinDue.dueDate)}`}
              <ArrowRight size={16} />
            </Button>
          </section>
          <Feed limit={1} />
        </>
      ) : tab === "Feed" ? (
        <Feed />
      ) : tab === "Messages" ? (
        <Messages clientId={client.id} />
      ) : (
        <Checkins clientId={client.id} />
      )}
    </>
  );
}

export function Feed({ coach = false, limit }) {
  const { data, client, update } = useApp();
  const [compose, setCompose] = useState(false),
    [form, setForm] = useState({ title: "", text: "", image: 0 }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false), [publishing, setPublishing] = useState(false);
  const uploadLock = useRef(false);
  const actorId = coach ? `coach:${data.coach.id || "workspace"}` : client.id;
  const posts = limit ? data.posts.slice(0, limit) : data.posts;
  function toggle(id, key) {
    update((d) => {
      const post = d.posts.find((p) => p.id === id);
      post[key] = post[key].includes(actorId)
        ? post[key].filter((x) => x !== actorId)
        : [...post[key], actorId];
    });
  }
  return (
    <>
      <SectionHead
        title={coach ? "Member feed" : "From your coach"}
        action={
          coach ? (
            <button className="text-link" onClick={() => setCompose(true)}>
              <Plus size={16} />
              New post
            </button>
          ) : (
            <span className="pill">Members only</span>
          )
        }
      />
      {posts.map((p) => (
        <article className="card feed-post" key={p.id}>
          <div className="feed-author">
            <Avatar name={data.coach.name} />
            <span>
              <b>{data.coach.name}</b>
              <small>
                {new Date(p.at).toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                })}{" "}
                · Members only
              </small>
            </span>
          </div>
          <div className="feed-image">
            {p.file ? (
              <Media fileId={p.file.id} type={p.file.type} alt={p.title} />
            ) : (
              <img src={IMAGES[p.image]} alt="Training environment" loading="lazy" decoding="async" />
            )}
          </div>
          <h2>{p.title}</h2>
          <p className="preserve-lines">{p.text}</p>
          <div className="feed-actions">
            <button
              aria-label="Like post"
              aria-pressed={p.likes.includes(actorId)}
              onClick={() => toggle(p.id, "likes")}
            >
              <Heart
                size={18}
                fill={p.likes.includes(actorId) ? "currentColor" : "none"}
              />
              {p.likes.length}
            </button>
            <button
              aria-label="Save post"
              aria-pressed={p.saved.includes(actorId)}
              onClick={() => toggle(p.id, "saved")}
            >
              <Bookmark
                size={18}
                fill={p.saved.includes(actorId) ? "currentColor" : "none"}
              />
              {p.saved.includes(actorId) ? "Saved" : "Save"}
            </button>
          </div>
        </article>
      ))}
      {!posts.length && (
        <Empty
          title="A little inspiration, soon"
          detail="Your coach’s member posts will appear here."
        />
      )}
      {compose && (
        <Modal
          title="Share with your members"
          canClose={!busy && !publishing}
          onClose={() => { if (!uploadLock.current) setCompose(false); }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (uploadLock.current) return;
              if (!form.title.trim() || !form.text.trim()) {
                setError("Add a title and a message before publishing.");
                return;
              }
              uploadLock.current = true; setPublishing(true); setError('');
              const result = await update((d) =>
                d.posts.unshift({
                  ...form,
                  title: form.title.trim(),
                  text: form.text.trim(),
                  id: uid(),
                  at: new Date().toISOString(),
                  likes: [],
                  saved: [],
                }),
              );
              uploadLock.current = false; setPublishing(false);
              if (result?.error) {setError(result.error); return;}
              setCompose(false);
              setError("");
              setForm({ title: "", text: "", image: 0 });
            }}
          >
            <Field
              label="Title"
              required
              maxLength={100}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Field label="Post">
              <textarea
                required
                maxLength={4000}
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
              />
            </Field>
            <Field label="Cover">
              <select
                disabled={busy}
                value={form.image}
                onChange={(e) =>
                  setForm({
                    ...form,
                    image: Number(e.target.value),
                    file: null,
                  })
                }
              >
                {[
                  "Strength",
                  "Dumbbells",
                  "Track",
                  "Recovery",
                  "Night gym",
                ].map((n, i) => (
                  <option value={i} key={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <label className="upload-zone">
              Upload a photo or video
              <input
                type="file"
                disabled={busy}
                accept="image/*,video/*"
                onChange={async (e) => {
                  const input = e.currentTarget;
                  const selected = input.files?.[0];
                  if (!selected || uploadLock.current) return;
                  uploadLock.current = true;
                  setBusy(true);
                  setError("");
                    try {
                      const file = await saveFile(selected, {scope:'workspace',
                        types: ["image/", "video/"],
                        maxMB: 30,
                      });
                      setForm((current) => ({ ...current, file }));
                    } catch (e) {
                      setError(e.message);
                    } finally {
                      uploadLock.current = false;
                      setBusy(false);
                      input.value = "";
                    }
                }}
              />
            </label>
            {form.file && <p>{form.file.name}</p>}
            {busy && <p role="status">Saving attachment…</p>}
            {error && <p className="error" role="alert">{error}</p>}
            <Button type="submit" disabled={busy || publishing}>
              {publishing ? "Publishing…" : busy ? "Saving attachment…" : "Publish to members"} <Send size={16} />
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}

export function Messages({clientId, coach = false}) {
  const {data, update, messageContext, setMessageContext} = useApp();
  const draft = useEditDraft(`message.${connection()?.user?.id || 'device'}.${coach ? 'coach' : 'client'}.${clientId}`, {text:'', file:null});
  const {text, file} = draft.value;
  const [error, setError] = useState(''), [uploading, setUploading] = useState(false), [sending, setSending] = useState(false), [newMessages, setNewMessages] = useState(false);
  const uploadLock = useRef(false), sendLock = useRef(false), thread = useRef(null), composer = useRef(null), nearBottom = useRef(true), previousThread = useRef('');
  const reduced = useMotionReduced();
  const ownRole = coach ? 'coach' : 'client';
  const person = coach ? data.clients.find(client => client.id === clientId)?.name : data.coach.name;
  const messages = data.messages.filter(message => message.clientId === clientId).sort((a, b) => a.at.localeCompare(b.at));
  const setText = value => draft.setValue(previous => ({...previous, text:value}));
  const setFile = value => draft.setValue(previous => ({...previous, file:value}));
  useEffect(() => {
    if (messages.some(message => message.from !== ownRole && !message.read))
      update(workspace => workspace.messages.filter(message => message.clientId === clientId && message.from !== ownRole).forEach(message => {message.read = true;}));
  }, [clientId, coach, messages.length]);
  useEffect(() => {
    if (messageContext && (!messageContext.clientId || messageContext.clientId === clientId) && messageContext.text)
      draft.setValue(previous => ({...previous, text:previous.text || messageContext.text}));
  }, [messageContext]);
  useLayoutEffect(() => {
    const element = composer.current;
    if (element) {element.style.height = 'auto'; element.style.height = `${Math.min(120, element.scrollHeight)}px`;}
  }, [text]);
  function latest(instant = false) {
    thread.current?.scrollTo({top:thread.current.scrollHeight, behavior:instant || reduced ? 'instant' : 'smooth'});
    nearBottom.current = true; setNewMessages(false);
  }
  useLayoutEffect(() => {
    const key = `${clientId}:${ownRole}`;
    const initial = previousThread.current !== key;
    if (initial || nearBottom.current || messages.at(-1)?.from === ownRole) latest(initial);
    else setNewMessages(true);
    previousThread.current = key;
  }, [clientId, coach, messages.length]);
  async function send(event) {
    event.preventDefault();
    if (uploadLock.current || sendLock.current || (!text.trim() && !file)) return;
    sendLock.current = true; setSending(true); setError('');
    const message = {id:uid(), clientId, from:ownRole, text:text.trim(), file, context:!messageContext?.clientId || messageContext.clientId === clientId ? messageContext?.title || '' : '', at:new Date().toISOString(), read:false};
    try {
      const result = await update(workspace => workspace.messages.push(message));
      if (result?.error) throw new Error(result.error);
      draft.clear(); setMessageContext(null); latest(); composer.current?.focus();
    } catch (issue) {setError(issue.message || 'Your message was not sent. Your draft is still here.');}
    finally {sendLock.current = false; setSending(false);}
  }
  return <section className="card messages refined-messages" aria-label={`Conversation with ${person}`}>
    <div className="conversation-heading"><Avatar name={person || 'Coach'}/><span><h2>{person}</h2><small>{coach ? 'Client conversation' : 'Your coach'}</small></span><span className="conversation-privacy">Private</span></div>
    <div ref={thread} className="message-thread" role="log" aria-label="Conversation history" aria-relevant="additions" onScroll={() => {const element = thread.current; nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 60; if (nearBottom.current) setNewMessages(false);}} onLoadCapture={() => {if (nearBottom.current) latest(true);}}>
      {messages.map((message, index) => <React.Fragment key={message.id}>
        {(!index || dayKey(new Date(messages[index - 1].at)) !== dayKey(new Date(message.at))) && <div className="message-date"><span>{dayKey(new Date(message.at)) === dayKey() ? 'Today' : new Date(message.at).toLocaleDateString('en', {month:'short', day:'numeric'})}</span></div>}
        <div className={`message ${message.from === ownRole ? 'mine' : ''}`}>
          {message.context && <blockquote>{message.context}</blockquote>}
          {message.text && <p>{message.text}</p>}<AudioPlayer file={message.audio}/>
          {message.file && <Media fileId={message.file.id} type={message.file.type} alt={message.file.name}/>}
          <small><time dateTime={message.at}>{new Date(message.at).toLocaleTimeString('en', {hour:'numeric', minute:'2-digit'})}</time>{message.from === ownRole && (message.read ? <CheckCheck size={12} aria-label="Read"/> : <Check size={12} aria-label="Saved"/>)}</small>
        </div>
      </React.Fragment>)}
      {!messages.length && <Empty icon={MessageCircle} title="Start the conversation" detail="Questions, small wins, or a technique check—send it here."/>}
    </div>
    {newMessages && <button className="message-jump" onClick={() => latest()}><ArrowDown size={15}/>Jump to latest</button>}
    {coach && <details className="saved-replies"><summary>Saved replies<ChevronRight size={14}/></summary><Field label="Quick reply"><select defaultValue="" onChange={event => {setText(event.target.value); event.target.value = ''; composer.current?.focus();}}><option value="" disabled>Choose a saved reply</option>{data.savedReplies.map(reply => <option key={reply}>{reply}</option>)}</select></Field></details>}
    {messageContext?.title && (!messageContext.clientId || messageContext.clientId === clientId) && <Notice>About: {messageContext.title} <button className="text-link" onClick={() => setMessageContext(null)}>Remove</button></Notice>}
    {file && <div className="message-attachment"><Paperclip size={16}/><span>{file.name}</span><IconButton label="Remove attachment" disabled={sending} onClick={() => setFile(null)}><X size={17}/></IconButton></div>}
    <form className="message-compose" onSubmit={send} aria-busy={sending}>
      <label className="icon-btn upload-inline" aria-label="Attach photo, video or audio"><Paperclip size={19}/><input type="file" disabled={uploading || sending} accept="image/*,video/*,audio/*" onChange={async event => {
        const input = event.currentTarget, selected = input.files?.[0]; if (!selected || uploadLock.current) return;
        uploadLock.current = true; setUploading(true); setError('');
        try {setFile(await saveFile(selected, {types:['image/', 'video/', 'audio/'], maxMB:30, clientId}));}
        catch (issue) {setError(issue.message);} finally {uploadLock.current = false; setUploading(false); input.value = '';}
      }}/></label>
      <textarea ref={composer} aria-label="Message" rows={1} value={text} maxLength={4000} disabled={sending} placeholder="Write a message…" onChange={event => setText(event.target.value)} onKeyDown={event => {if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) send(event);}}/>
      <IconButton label={sending ? 'Sending message' : 'Send message'} type="submit" disabled={uploading || sending || (!text.trim() && !file)}><Send size={19}/></IconButton>
    </form>
    <div className="message-status" role="status">{uploading ? 'Saving attachment…' : sending ? 'Saving message…' : text || file ? 'Draft saved on this device' : connection() ? 'Saved to your private coaching account' : 'Device preview · messages stay on this device'}</div>
    {(error || draft.error) && <p className="error" role="alert">{error || draft.error}</p>}
  </section>;
}
