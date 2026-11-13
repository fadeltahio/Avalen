// A client's training tab: today's or a chosen day's workout, the exercises in
// it, the programme overview, and the daily habits tab beside it.
import { useState } from 'react';
import { ArrowRight, ChevronRight, Clock3, Dumbbell, MessageCircle, TrendingUp } from 'lucide-react';
import { MotionDetails } from '../motion.jsx';
import { useApp } from '../context.js';
import { dayKey, offsetDay, scheduleDay, shortDate, sum, useFile } from '../store.js';
import { groupLabel } from '../exercise-catalogue.js';
import { ExerciseMedia, exerciseImage } from '../ExerciseMedia.jsx';
import { FormLab } from '../formlab-entry.jsx';
import { SmartSchedule } from '../ecosystem/scheduling.jsx';
import { Button, Calendar, Empty, Heading, Modal, Notice, SectionHead, Stat, Tabs } from '../ui.jsx';
import { t } from '../i18n.js';
import { Habits } from './Habits.jsx';

export function Plan() {
  const { subtab, setSubtab, client } = useApp();
  const tab = ["Training", "Habits", "FormLab"].includes(subtab)
    ? subtab
    : "Training";
  return (
    <>
      <Heading title={t('Your plan.')} />
      <Tabs
        items={["Training", "Habits", "FormLab"]}
        value={tab}
        onChange={setSubtab}
      />
      {tab === "Training" ? (
        <Training />
      ) : tab==='FormLab'?<FormLab client={client}/>: (
        <Habits />
      )}
    </>
  );
}

function Training() {
  const { data, client, openWorkout, openShare, ask, viewSession, viewDate, setViewDate, openExercise } = useApp();
  const date = viewDate || dayKey(), setDate = setViewDate;
  const day = scheduleDay(client, date);
  const draft = data.drafts[client.id];
  const [detail, setDetail] = useState(null);
  const done = data.sessions.find(
    (s) => s.clientId === client.id && s.date === date,
  );
  return (
    <>
      <Calendar
        selected={date}
        onChange={setDate}
        client={client}
        sessions={data.sessions}
      />
      {day ? (
        <>
          <SectionHead
            title={day.name}
            action={
              <span className="muted">{t('{length} exercises', { length: day.exercises.length })}</span>
            }
          />
          <div className="training-start-action">
            <Button
              aria-label={draft && date === dayKey() ? t('Resume workout: {title}', { title: draft.title }) : undefined} disabled={!done && date !== dayKey()}
              onClick={() => (done ? openShare(done) : openWorkout(day, date))}
            >
              {done
                ? t('View workout result')
                : date > dayKey()
                  ? "Available on " + shortDate(date)
                  : date < dayKey()
                    ? t('Workout not logged')
                    : draft ? t('Resume workout') : t('Start Workout')}
              <ArrowRight size={16} />
            </Button>
          </div>
          <button className="training-detail-link" onClick={() => viewSession(day,date)}><span>{t('View session details')}</span><ArrowRight size={17}/></button>
          <div className="card list training-exercise-list">
            {day.exercises.map((e, i) => (
              <button
                className="exercise-row"
                key={e.id}
                onClick={() => setDetail(e)}
              >
                <span className="exercise-photo-number"><ExerciseThumbnail exercise={e}/><i>{String(i + 1).padStart(2,'0')}</i></span>
                <span className="exercise-row-copy">
                  <span className="exercise-group">{e.group ? groupLabel(e.group) : t('Training')}{e.videoFile && <span className="coach-demo-label"> {t('· Coach video')}</span>}</span>
                  <b>{t(e.name)}</b>
                  <small className="exercise-prescription"><strong>{e.sets} × {e.reps} {e.kind === 'Duration' ? 'sec' : 'reps'}</strong><span><Clock3 size={11}/>{e.rest}{t('s rest')}</span></small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>

        </>
      ) : (
        <Empty
          icon={Dumbbell}
          title={t('A planned rest day')}
          detail={t('Recovery is part of the programme. Your habits are still here for you.')}
        />
      )}
      <MotionDetails className="programme-overview"><summary><span>{t('About your programme')}<small>{t(client.program.name)} · {client.program.phase}</small></span><ChevronRight size={18}/></summary>
      <div className="card program-title">
        <span className="eyebrow">{client.program.phase}</span>
        <h2>{t(client.program.name)}</h2>
        <p>
          {client.program.weeks}{t('-week programme · through')}{" "}
          {shortDate(client.programEnd)}
        </p>
        {client.program.progression && <p className="program-progression"><TrendingUp size={15}/>{client.program.progression}</p>}
        {client.travel &&
          date >= client.travel.start &&
          date <= client.travel.end && (
            <Notice>
              {t('Travel plan active. Your regular plan resumes')}{" "}
              {shortDate(offsetDay(1, client.travel.end))}.
            </Notice>
          )}
      </div>
      </MotionDetails>
      <SmartSchedule client={client}/>
      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <ExerciseMedia exercise={detail}/>
          <FormLab client={client} exercise={detail} compact/>
          <p className="exercise-coach-cue"><span>{t('COACH’S CUE')}</span>{detail.notes || t('Ask your coach for technique guidance.')}</p>
          <div className="three-stats">
            <Stat
              label={detail.kind === 'Duration' ? t('Sets × seconds') : t('Sets × reps')}
              value={`${detail.sets} × ${detail.reps}`}
            />
            <Stat label={t('Tempo')} value={detail.tempo || "—"} />
            <Stat label={t('Reps in reserve')} value={detail.rir ?? "—"} />
          </div>
          <div className="exercise-sheet-actions">
            <Button
              onClick={() => {
                const name = detail.name;
                setDetail(null);
                openExercise(name);
              }}
            >
              {t('Progress & history')} <ArrowRight size={16} />
            </Button>
            <Button
              secondary
              onClick={() => {
                setDetail(null);
                ask(`${detail.name} · ${day.name}`);
              }}
            >
              {t('Ask coach')} <MessageCircle size={16} />
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}


export function ExerciseThumbnail({ exercise }) {
  const url = useFile(exercise.imageFile?.id);
  return <img className="exercise-thumb" src={url || exerciseImage(exercise)} alt={t('{name} exercise', { name: exercise.name })} loading="lazy" decoding="async"/>;
}

