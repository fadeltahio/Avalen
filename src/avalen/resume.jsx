import React from 'react';
import {ArrowUpRight,ArrowRight,Check,Clock3,Play} from 'lucide-react';
import {useApp} from './context.js';
import {shortDate,dayKey,useFile} from './store.js';
import {exerciseImage} from './ExerciseMedia.jsx';
import {Button} from './ui.jsx';

import { t } from './i18n.js';
export function ResumeWorkout({compact=false}){
 const {data,client,resumeWorkout}=useApp();const draft=data.drafts[client.id];
 const currentExercise=draft?.exercises?.[draft.index];
 const photo=useFile(compact ? null : currentExercise?.imageFile?.id);
 if(!draft)return null;
 const finished=draft.sets.filter(s=>!s.skipped).length,total=draft.exercises.reduce((n,e)=>n+Number(e.sets),0),handled=draft.sets.length;
 const progress=Math.min(100,handled/(total||1)*100),exercise=draft.exercises[draft.index];
 const minutes=Math.max(0,Math.floor(((draft.pausedAt||Date.now())-draft.startedAt)/60000));
 const currentSets=draft.sets.filter(s=>s.exerciseId===exercise?.id).length;
 const next=currentSets<(exercise?.sets||0)?exercise:[...draft.exercises.slice(draft.index+1),...draft.exercises.slice(0,draft.index)].find(e=>draft.sets.filter(s=>s.exerciseId===e.id).length<e.sets);
 if(compact)return <button className="resume-dock" onClick={resumeWorkout} aria-label={t('Resume workout: {title}', { title: draft.title })}><span className="resume-play"><Play size={17} fill="currentColor"/></span><span><small>{t('WORKOUT IN PROGRESS')}</small><b>{t(draft.title)}</b><em>{t('{finished} sets logged · saved', { finished })}</em></span><ArrowUpRight size={20}/><i style={{transform:`scaleX(${progress/100})`}}/></button>;
 return <section className="resume-card" aria-label={t('Workout in progress')} style={{'--resume-image':`url(${photo || exerciseImage(exercise || {})})`}}>
  <div className="resume-card-top"><span className="session-status"><i/>{t('SESSION IN PROGRESS')}</span><span><Check size={12}/>{t('Saved')}</span></div>
  <h2>{t(draft.title)}</h2>
  <p className="resume-date">{draft.date!==dayKey()?t('Started {shortDate} · ', { shortDate: shortDate(draft.date) }):''}{minutes} {t('min so far')}</p>
  <div className="resume-stats"><span><b>{finished}<small> / {total}</small></b>{t('sets logged')}</span><span><b>{Math.round(progress)}<small>%</small></b>{t('session progress')}</span></div>
  <div className="resume-progress" role="progressbar" aria-label={t('Workout progress')} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><i style={{transform:`scaleX(${progress / 100})`}}/></div>
  <Button onClick={resumeWorkout}><span className="action-orb" aria-hidden="true"><ArrowRight size={20}/></span>{t('Resume workout')} <ArrowUpRight size={16}/></Button>
  <div className="resume-next">{next && <ResumeExercisePhoto exercise={next}/>}<div><span>{next?t('CONTINUE WITH'):t('THE FINISH LINE')}</span><b>{next?.name||t('Review your session & finish')}</b>{next && <small>{next.group || t('Training')} · {next.sets} × {next.reps} {next.kind === 'Duration' ? 'sec' : 'reps'}</small>}</div></div>
 </section>;
}

function ResumeExercisePhoto({exercise}) {
 const photo=useFile(exercise.imageFile?.id);
 return <img src={photo || exerciseImage(exercise)} alt="" decoding="async"/>;
}
