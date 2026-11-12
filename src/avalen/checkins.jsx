import { VoiceRecording,AudioPlayer } from './ecosystem/recording.jsx';
import { checkinSummary } from './ecosystem/checkin-service.js';
import { zonedDay } from './ecosystem/time.js';
import React, { useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Check, Plus, Settings, Trash2, Upload } from 'lucide-react';
import { useApp } from './context.js';
import { dayKey, offsetDay, shortDate, uid, decision, saveFile } from './store.js';
import { Button, Empty, Field, LineChart, Media, Modal, Notice, SectionHead, Tabs } from './ui.jsx';
import { useEditDraft, EditSaveBar } from './edit-draft.jsx';
import { answerFor, hasAnswer, checkinPlanFor, checkinSchedule, checkinPlanError, checkinError, schemaFor, saveCheckin, checkinTrend, trendFields } from './checkin-model.js';

function CheckinSettings({ client, onClose }) {
  const { update, notify, data } = useApp();
  const editor = useEditDraft(`checkin-plan.${client.id}`, checkinPlanFor(client));
  const plan = editor.value;
  const [error, setError] = useState('');
  const change = (id,patch) => editor.setValue(p=>({...p,fields:p.fields.map(f=>f.id===id?{...f,...patch}:f)}));
  const next = checkinSchedule({...client,checkinPlan:plan},data.checkins);
  async function submit(e) {
    e.preventDefault(); const issue=checkinPlanError(plan); if(issue){setError(issue);return;}
    const saved={...structuredClone(plan),intervalDays:Number(plan.intervalDays)};
    const result=await update(d=>{ d.clients.find(c=>c.id===client.id).checkinPlan=saved; decision(d,client.id,'Check-in plan updated',`Every ${saved.intervalDays} days · ${saved.fields.filter(f=>f.enabled).length} fields requested.`); });
    if(result?.error){setError(result.error);return;}
    editor.clear(saved); notify?.('Check-in plan saved'); onClose();
  }
  return <Modal title={`${client.name.split(' ')[0]}’s check-in settings`} onClose={onClose} wide className="checkin-settings">
    <form onSubmit={submit}>
      <p className="muted">Choose what this client reports and how often. Past check-ins keep their original questions and answers.</p>
      <div className="form-grid"><Field label="Repeat every (days)" type="number" required min="1" max="365" step="1" value={plan.intervalDays} onChange={e=>editor.setValue(p=>({...p,intervalDays:e.target.value,scheduleMode:Number(e.target.value)===7?p.scheduleMode:'rolling'}))}/><Field label="First check-in date" type="date" required value={plan.startDate} onChange={e=>editor.setValue(p=>({...p,startDate:e.target.value}))}/></div>
      {Number.isInteger(Number(plan.intervalDays)) && Number(plan.intervalDays)>0 && <div className="checkin-next-preview"><CalendarDays size={18}/><span>Next check-in: <b>{shortDate(next.dueDate)}</b> · then every {plan.intervalDays} days {plan.scheduleMode==='weekly'?'on the chosen weekday.':'after a submission.'}</span></div>}
      {Number(plan.intervalDays)===7 && <div className="form-grid"><Field label="Weekly scheduling"><select value={plan.scheduleMode || 'rolling'} onChange={e=>editor.setValue(p=>({...p,scheduleMode:e.target.value,preferredWeekday:p.preferredWeekday ?? 1}))}><option value="rolling">Every 7 days after submission</option><option value="weekly">Fixed weekly day</option></select></Field>{plan.scheduleMode==='weekly'&&<Field label="Preferred check-in day"><select value={plan.preferredWeekday ?? 1} onChange={e=>editor.setValue(p=>({...p,preferredWeekday:Number(e.target.value)}))}>{['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d,i)=><option key={d} value={i}>{d}</option>)}</select></Field>}</div>}<div className="form-grid"><Field label="Client timezone" value={plan.timezone || 'UTC'} placeholder="Africa/Cairo" onChange={e=>editor.setValue(p=>({...p,timezone:e.target.value}))}/><Field label="Local reminder time" type="time" value={plan.reminderTime || '18:00'} onChange={e=>editor.setValue(p=>({...p,reminderTime:e.target.value}))}/></div><label className="checkbox-row"><input type="checkbox" checked={plan.reminders!==false} onChange={e=>editor.setValue(p=>({...p,reminders:e.target.checked,timezone:p.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}))}/>In-app reminders when due</label><p className="fine-print muted">For weekly check-ins, choose the preferred weekday using the first check-in date. Every {plan.intervalDays} days remains your cadence. External push and email need a delivery service.</p><SectionHead title="What to include"/>
      <div className="checkin-field-settings">{plan.fields.map(f=><div className={`checkin-field-setting ${f.enabled?'enabled':''}`} key={f.id}>
        <div className="checkin-field-toggle"><label><input type="checkbox" checked={f.enabled} onChange={e=>change(f.id,{enabled:e.target.checked})}/><span>{f.label || 'New question'}<small>{f.type==='number'?`Number${f.unit?` · ${f.unit}`:''}`:f.type==='rating'?'Rating · 1–5':f.type==='photos'?'Photos':'Written answer'}</small></span></label><label className="checkin-required"><input type="checkbox" disabled={!f.enabled} checked={Boolean(f.required)} onChange={e=>change(f.id,{required:e.target.checked})} aria-label={`Require ${f.label || 'new question'}`}/>Required</label></div>
        {f.enabled && <details open={!f.builtin || undefined}><summary>Edit question</summary><Field label={`Label for ${f.label || 'new question'}`} required maxLength={100} value={f.label} onChange={e=>change(f.id,{label:e.target.value})}/>{!f.builtin && f.type==='number' && <div className="form-grid"><Field label={`Unit for ${f.label || 'new question'}`} maxLength={20} value={f.unit || ''} placeholder="e.g. minutes" onChange={e=>change(f.id,{unit:e.target.value})}/><Field label={`Minimum for ${f.label || 'new question'}`} type="number" step="any" required value={f.min} onChange={e=>change(f.id,{min:e.target.value})}/><Field label={`Maximum for ${f.label || 'new question'}`} type="number" step="any" required value={f.max} onChange={e=>change(f.id,{max:e.target.value})}/></div>}{!f.builtin && <button type="button" className="text-link red" onClick={()=>editor.setValue(p=>({...p,fields:p.fields.filter(x=>x.id!==f.id)}))}><Trash2 size={14}/>Remove question</button>}</details>}
      </div>)}</div>
      <div className="checkin-add-question"><span>Add a custom question</span>{[['number','Number'],['rating','Rating'],['text','Text']].map(([type,label])=><Button secondary small key={type} onClick={()=>editor.setValue(p=>({...p,fields:[...p.fields,{id:uid(),label:'',type,unit:type==='rating'?'/ 5':'',min:type==='rating'?1:0,max:type==='rating'?5:100000,enabled:true,required:false}]}))}><Plus size={15}/>{label}</Button>)}</div>
      {error && <p role="alert" className="error">{error}</p>}
      <EditSaveBar draft={editor} label="Save check-in plan"/>
    </form>
  </Modal>;
}

function CheckinTrends({ client, rows }) {
  const { data } = useApp();
  const fields=trendFields(client,rows).filter(f=>f.enabled || checkinTrend(data,client.id,f).length);
  const [metric,setMetric]=useState('weight|number|kg'),[period,setPeriod]=useState('90 days');
  const field=fields.find(f=>f.seriesKey===metric) || fields[0];
  if(!field)return null;
  const all=checkinTrend(data,client.id,field);
  const points=all.filter(p=>period==='All time' || p.date>=offsetDay(period==='30 days'?-29:-89));
  const delta=points.length>1?Math.round((points.at(-1).value-points[0].value)*10)/10:null;
  return <section className="card checkin-trends" aria-label="Check-in trends">
    <SectionHead title="Trends over time"/>
    <div className="checkin-trend-controls"><Field label="Trend metric"><select value={field.seriesKey} onChange={e=>setMetric(e.target.value)}>{fields.map(f=><option key={f.seriesKey} value={f.seriesKey}>{f.label}{f.unit?` (${f.unit})`:''}</option>)}</select></Field><Tabs items={['30 days','90 days','All time']} value={period} onChange={setPeriod} label="Trend period"/></div>
    {points.length?<><div className="checkin-trend-stats"><span><small>Latest</small><b>{points.at(-1).value.toLocaleString()} <em>{field.unit}</em></b></span><span><small>Change in this period</small><b>{delta===null?'—':`${delta>0?'+':''}${delta}`} <em>{delta===null?'':field.unit}</em></b></span><span><small>Entries</small><b>{points.length}</b></span></div><LineChart key={field.seriesKey} records={points} field="value" label={field.label} unit={field.unit || ''} timeScale domain={field.type==='rating'?[1,5]:undefined}/>{points.length===1 && <p className="fine-print muted">One entry so far. A trend will appear after the next recorded value.</p>}<details className="checkin-values"><summary>View recorded values</summary><table><thead><tr><th>Date</th><th>{field.label}</th><th>Source</th></tr></thead><tbody>{[...points].reverse().map(p=><tr key={p.date}><td>{shortDate(p.date)}</td><td>{p.value} {field.unit}</td><td>{p.source}</td></tr>)}</tbody></table></details></>:<Empty title={`No ${field.label.toLowerCase()} entries yet`} detail="Submitted values will appear here over time. Missing answers are never plotted as zero."/>}
    <p className="fine-print muted">{field.measurementKey?'Includes check-ins and existing measurement logs. A check-in takes precedence for the same date.':'Based on submitted check-in answers.'} Dates are spaced by elapsed time.</p>
  </section>;
}

function CheckinForm({ row, client, onClose }) {
  const { data,update,notify,runAction }=useApp();
  const editor=useEditDraft(`checkin-entry.${client.id}.${row.date}.${row.submittedAt || 'new'}.${JSON.stringify(row.schema)}`, row);
  const form=editor.value, setForm=editor.setValue;
  const [error,setError]=useState(''),[uploading,setUploading]=useState(false),[voiceBusy,setVoiceBusy]=useState(false);
  const lock=useRef(false),submitted=useRef(false);
  const requiredFields=form.schema.filter(field=>field.required);
  const requiredAnswered=requiredFields.filter(field=>hasAnswer(form.answers[field.id])).length;
  const mergedNote=form.schema.find(f=>f.id==='note' && f.builtin && f.label==='Anything else for your coach?');
  const setAnswer=(id,value)=>setForm(f=>({...f,answers:{...f.answers,[id]:value}}));
  // Photos are always optional. When the coach hasn't asked for them, they sit with the update.
  const photoField=form.schema.find(f=>f.type==='photos'), extraPhotos=photoField?[]:(form.answers.photos || []);
  async function upload(e,field) {
    const input=e.currentTarget,files=[...input.files || []];if(!files.length || lock.current)return;
    if(files.length+(form.answers[field.id]?.length || 0)>4){setError('Choose up to four progress photos.');input.value='';return;}
    lock.current=true;setUploading(true);setError('');
    try{const photos=[];for(const file of files)photos.push(await saveFile(file,{clientId:client.id}));setForm(f=>({...f,answers:{...f.answers,[field.id]:[...(f.answers[field.id] || []),...photos]}}));}catch(e){setError(e.message);}finally{lock.current=false;setUploading(false);input.value='';}
  }
  async function send(e) {
    e.preventDefault();if(lock.current || submitted.current)return;if(voiceBusy){setError('Finish saving your recording before sending.');return;}
    const issue=checkinError(form.schema,form.answers);if(issue){setError(issue);return;}
    submitted.current=true;setUploading(true);setError('');
    try{await runAction('checkin.submit',client.id,{...form,transcript:form.audio?.transcript ?? form.transcript});editor.clear(row);notify?.('Check-in sent to your coach');onClose();}catch(e){submitted.current=false;setError(e.message);}finally{setUploading(false);}
  }
  return <Modal title="Your check-in" className="checkin-form" canClose={!uploading && !voiceBusy} onClose={onClose}>
    <form onSubmit={send}><fieldset className="checkin-answers" aria-label="Check-in answers" disabled={uploading}><p className="muted">{shortDate(form.date)} · A quick update and your coach’s requested measurements. Required fields are marked.</p>
      <div className="checkin-form-progress" role="status"><span className="checkin-progress-dot" aria-hidden="true"/>{requiredFields.length ? `${requiredAnswered} of ${requiredFields.length} required fields filled` : "No required fields"}<span>{editor.dirty ? 'Draft saved on this device' : 'Measurements first. Your update comes next.'}</span></div>
      {form.schema.filter(f=>!mergedNote || f.id!==mergedNote.id).sort((a,b)=>Number(b.required)-Number(a.required) || Number(b.type==='number')-Number(a.type==='number')).map(f=>{
        const value=form.answers[f.id] ?? '';
        const previous=data.checkins.filter(r=>r.clientId===client.id && r.date<form.date).sort((a,b)=>b.date.localeCompare(a.date)).map(r=>answerFor(r,f)).find(hasAnswer);
        return <div className="checkin-answer-field" key={f.id}>
          {f.required && <span className="checkin-field-required">Required</span>}
          {f.type==='number'?<><Field label={`${f.label}${f.unit?` (${f.unit})`:''}`} type="number" min={f.min ?? 0} max={f.max ?? 100000} step="any" inputMode="decimal" required={Boolean(f.required)} value={value} placeholder="Enter your reading" onChange={e=>setAnswer(f.id,e.target.value)}/>{hasAnswer(previous) && <small className="muted">Previous check-in: {previous} {f.unit}</small>}</>:f.type==='rating'?<div className="score-field"><label>{f.label}<small>{['Hunger','Stress'].includes(f.legacyKey)?'1 = low · 5 = high':'1 = low / difficult · 5 = high / great'}</small></label><div role="group" aria-label={f.label}>{[1,2,3,4,5].map(n=><button type="button" key={n} aria-label={`${f.label}: ${n}`} aria-pressed={Number(value)===n} onClick={()=>setAnswer(f.id,value===n?'':n)}>{n}</button>)}</div></div>:f.type==='text'?<Field label={f.label}><textarea required={Boolean(f.required)} maxLength={2000} value={value} onChange={e=>setAnswer(f.id,e.target.value)}/></Field>:<><label className="upload-zone"><Upload size={20}/><b>{f.label}</b><small>Up to 4 photos</small><input type="file" accept="image/*" multiple disabled={uploading} aria-label={f.label} onChange={e=>upload(e,f)}/></label><div className="checkin-photos">{(value || []).map(photo=><div key={photo.id}><Media fileId={photo.id} alt="Check-in progress photo"/><button type="button" aria-label={`Remove ${photo.name}`} onClick={()=>setAnswer(f.id,value.filter(p=>p.id!==photo.id))}><Trash2 size={15}/></button></div>)}</div></>}
        </div>;
      })}
      <div className="checkin-reflection"><h3>Your update</h3>
      <Field label={mergedNote?.required?"Your update (required)":"Your update (optional)"}><textarea required={Boolean(mergedNote?.required)} value={form.updateText || (mergedNote?form.answers.note:'') || ''} maxLength={2000} placeholder="How are you feeling? What should your coach know?" onChange={e=>setForm(f=>({...f,updateText:e.target.value,answers:mergedNote?{...f.answers,note:e.target.value}:f.answers}))}/></Field>
      <details className="checkin-voice-disclosure" open={Boolean(form.audio) || undefined}><summary>Add a voice update<span>Optional · up to 60 seconds</span></summary><VoiceRecording value={form.audio} onBusyChange={setVoiceBusy} clientId={client.id} onChange={audio=>setForm(f=>({...f,audio}))}/></details>
      {!photoField && <details className="checkin-voice-disclosure checkin-photo-disclosure" open={extraPhotos.length>0 || undefined}><summary>Add progress photos<span>Optional · up to 4 photos</span></summary><label className="upload-zone"><Upload size={20}/><b>Choose photos</b><small>Private to you and your coach</small><input type="file" accept="image/*" multiple disabled={uploading} aria-label="Add progress photos" onChange={e=>upload(e,{id:'photos'})}/></label>{extraPhotos.length>0 && <div className="checkin-photos">{extraPhotos.map(photo=><div key={photo.id}><Media fileId={photo.id} alt="Check-in progress photo"/><button type="button" aria-label={`Remove ${photo.name}`} onClick={()=>setAnswer('photos',extraPhotos.filter(p=>p.id!==photo.id))}><Trash2 size={15}/></button></div>)}</div>}</details>}</div>
      {editor.error && <p role="alert" className="error">{editor.error}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="checkin-submit"><small>Every {client.checkinPlan?.intervalDays || 7} days · set by your coach.</small><Button type="submit" disabled={uploading || voiceBusy}>{uploading ? submitted.current ? 'Sending check-in…' : 'Saving photos…' : 'Send check-in'}<ArrowRight size={16}/></Button></div>
    </fieldset></form>
  </Modal>;
}

export function Checkins({ clientId, coach=false }) {
  const { data,update,notify,runAction }=useApp();
  const client=data.clients.find(c=>c.id===clientId);
  const rows=data.checkins.filter(c=>c.clientId===clientId).sort((a,b)=>b.date.localeCompare(a.date));
  const [form,setForm]=useState(null),[selectedId,setSelectedId]=useState(null),[response,setResponse]=useState(''),[settings,setSettings]=useState(false),[reviewAudio,setReviewAudio]=useState(null),[reviewError,setReviewError]=useState(''),[reviewBusy,setReviewBusy]=useState(false),[reviewVoiceBusy,setReviewVoiceBusy]=useState(false),[followUp,setFollowUp]=useState(false),[filter,setFilter]=useState('All');
  const plan=checkinPlanFor(client),schedule=checkinSchedule(client,rows),today=rows.find(r=>r.date===zonedDay(client.checkinPlan?.timezone || 'UTC'));
  const selected=rows.find(r=>r.id===selectedId);
  function start() {
    const schema=today?.schema || plan.fields.filter(f=>f.enabled).map(f=>structuredClone(f));
    setForm({...today,id:today?.id || uid(),clientId,date:dayKey(),schema,answers:Object.fromEntries(schema.map(f=>[f.id,today?answerFor(today,f):f.type==='photos'?[]:''])),reviewed:false,response:today?.response || ''});
  }
  return <div className="checkins-workspace">
    <SectionHead title={coach?'Check-in review':'Your check-ins'} action={coach?<Button secondary small onClick={()=>setSettings(true)}><Settings size={16}/>Check-in settings</Button>:<Button small onClick={start}>{today?'Edit today’s check-in':'Start check-in'}<Plus size={15}/></Button>}/>
    <div className={`checkin-schedule ${schedule.overdue?'overdue':''}`}><CalendarDays size={22}/><span><b>{today?'Today’s check-in submitted':schedule.daysUntil===0?'Check-in due today':schedule.overdue?`Check-in ${Math.abs(schedule.daysUntil)} ${Math.abs(schedule.daysUntil)===1?'day':'days'} overdue`:`Next check-in · ${shortDate(schedule.dueDate)}`}</b><small>Every {schedule.intervalDays} {schedule.intervalDays===1?'day':'days'} · {plan.fields.filter(f=>f.enabled).length} fields requested{today?` · next ${shortDate(schedule.dueDate)}`:''}</small></span></div>
    <CheckinTrends client={client} rows={rows}/>
    <SectionHead title="Check-in history"/>
    <Field label="Check-in status"><select value={filter} onChange={e=>setFilter(e.target.value)}>{['All','Pending review','Reviewed','Follow-up'].map(f=><option key={f}>{f}</option>)}</select></Field>
    {rows.filter(r=>filter==='All' || filter==='Pending review'&&!r.reviewed || filter==='Reviewed'&&r.reviewed || filter==='Follow-up'&&r.followUp).map(r=><button className="card checkin-summary" key={r.id} onClick={()=>{setSelectedId(r.id);setResponse(r.response || '');setReviewAudio(r.responseAudio || null);setReviewError('');setFollowUp(Boolean(r.followUp));}}><span className={`status-icon ${r.reviewed?'green':'amber'}`}><Check size={18}/></span><span><b>{shortDate(r.date)}</b><small>{r.reviewed?'Reviewed by coach':'Waiting for review'}{hasAnswer(answerFor(r,{id:'weight'}))?` · ${answerFor(r,{id:'weight'})} kg`:''}</small></span><ArrowRight size={17}/></button>)}
    {!rows.length && <Empty title="Your first check-in" detail="Your coach’s requested measurements and answers will build a clear history here."/>}
    {settings && <CheckinSettings key={client.id} client={client} onClose={()=>setSettings(false)}/>}
    {form && <CheckinForm row={form} client={client} onClose={()=>setForm(null)}/>}
    {selected && <Modal title={`${client.name.split(' ')[0]}’s check-in · ${shortDate(selected.date)}`} onClose={()=>setSelectedId(null)}>
      <AudioPlayer file={selected.audio}/>{selected.updateText&&<Notice><b>Client update</b><p>{selected.updateText}</p></Notice>}{selected.transcript&&<Notice><b>Transcript · reviewed by client</b><p>{selected.transcript}</p></Notice>}<CheckinBrief summary={selected.summary || checkinSummary(data,selected)}/>
      <div className="checkin-review-answers">{schemaFor(selected).map(f=>{
        const value=answerFor(selected,f);if(!hasAnswer(value))return null;
        const previous=rows.filter(r=>r.date<selected.date).map(r=>answerFor(r,f)).find(hasAnswer);
        return <div key={f.id} className={`checkin-review-answer ${f.type}`}><h3>{f.label}</h3>{f.type==='photos'?<div className="checkin-photos">{value.map(photo=><Media key={photo.id} fileId={photo.id} alt="Check-in progress photo"/>)}</div>:<p>{value} {f.unit || ''}</p>}{['number','rating'].includes(f.type) && hasAnswer(previous) && <small>Previous: {previous} {f.unit || ''}</small>}</div>;
      })}</div>
      {coach?<form onSubmit={async e=>{e.preventDefault();setReviewBusy(true);setReviewError('');try{await runAction('checkin.review',clientId,{id:selected.id,response,audio:reviewAudio,followUp});setSelectedId(null);notify?.('Check-in reviewed');}catch(e){setReviewError(e.message);}finally{setReviewBusy(false);}}}><Field label="Feedback to client"><textarea maxLength={4000} value={response} onChange={e=>setResponse(e.target.value)} placeholder="Your next step, and why…"/></Field><VoiceRecording onBusyChange={setReviewVoiceBusy} value={reviewAudio} clientId={clientId} onChange={setReviewAudio} label="Voice feedback"/><label className="checkbox-row"><input type="checkbox" checked={followUp} onChange={e=>setFollowUp(e.target.checked)}/>Needs a follow-up</label>{reviewError&&<p role="alert" className="error">{reviewError}</p>}<Button disabled={reviewBusy || reviewVoiceBusy} type="submit">{reviewBusy?'Saving review…':'Complete review'} <Check size={16}/></Button></form>:<><AudioPlayer file={selected.responseAudio}/>{selected.response && <Notice><b>{selected.reviewed?'Your coach’s feedback':'Previous feedback · your updated check-in is awaiting review'}</b><p>{selected.response}</p></Notice>}</>}

    </Modal>}
  </div>;
}

export function CheckinBrief({summary}){return <section className="checkin-brief"><small className="eyebrow">{summary.source}</small><p className="fine-print muted">{summary.start} – {summary.end}</p><h4>Client reported</h4>{summary.reported.length?<ul>{summary.reported.map((x,i)=><li key={i}>{x}</li>)}</ul>:<p className="muted">No written or numeric answers. Listen to any attached recording.</p>}<h4>Recorded activity</h4><ul>{summary.measured.map((x,i)=><li key={i}>{x}</li>)}</ul><h4>Suggested review · rule based</h4><p>{summary.suggestion}</p><small className="muted">{summary.limitations}</small></section>;}

export function CheckinQueue(){const {data,selectClient}=useApp();const [status,setStatus]=useState('Pending review'),[sort,setSort]=useState('Oldest first');const rows=data.clients.flatMap(client=>{const schedule=checkinSchedule(client,data.checkins);return [...data.checkins.filter(r=>r.clientId===client.id).map(r=>({client,date:r.date,status:r.followUp?'Follow-up':r.reviewed?'Reviewed':'Pending review',id:r.id})),...(schedule.overdue?[{client,date:schedule.dueDate,status:'Missed',id:`missed-${client.id}`}]:[])];}).filter(r=>status==='All' || r.status===status).sort((a,b)=>sort==='Client name'?a.client.name.localeCompare(b.client.name):sort==='Newest first'?b.date.localeCompare(a.date):a.date.localeCompare(b.date));return <section className="card"><SectionHead title="Check-in review queue"/><div className="coach-inbox-filter"><Field label="Queue status"><select value={status} onChange={e=>setStatus(e.target.value)}>{['Pending review','Follow-up','Missed','Reviewed','All'].map(s=><option key={s}>{s}</option>)}</select></Field><Field label="Sort queue"><select value={sort} onChange={e=>setSort(e.target.value)}>{['Oldest first','Newest first','Client name'].map(s=><option key={s}>{s}</option>)}</select></Field></div>{rows.slice(0,20).map(r=><button className="simple-row" key={r.id} onClick={()=>selectClient(r.client.id,'Check-ins')}><span><b>{r.client.name}</b><small>{shortDate(r.date)} · {r.status}</small></span><ArrowRight size={16}/></button>)}{!rows.length&&<p className="muted">No check-ins in this queue.</p>}</section>;}
