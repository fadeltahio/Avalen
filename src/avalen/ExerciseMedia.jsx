import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, Repeat2, Volume2, VolumeX } from 'lucide-react';
import { useFile } from './store.js';
import { IMAGES } from './ui.jsx';
import images from './exercise-images.json';

import { t } from './i18n.js';
import { useMotionReduced } from './motion.jsx';
import { catalogueExercise } from './exercise-catalogue.js';
export function exerciseImage(exercise) {
  return images[exercise.name]?.src || catalogueExercise(exercise.name)?.frames[1] || IMAGES[['Chest', 'Back', 'Shoulders', 'Arms'].includes(exercise.group) ? 0 : 1];
}
// The two library positions of a built-in exercise, unless the coach attached their own media.
export function exerciseFrames(exercise) {
  if (exercise.videoFile || exercise.imageFile) return null;
  return images[exercise.name]?.frames || catalogueExercise(exercise.name)?.frames || null;
}

export function ExerciseMedia({ exercise, live = false, className = '' }) {
  const photo = useFile(exercise.imageFile?.id);
  const video = useFile(exercise.videoFile?.id);
  const ref = useRef(null);
  const [failed, setFailed] = useState(null);
  const [failedPhoto, setFailedPhoto] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const canPlay = Boolean(video && video !== failed);
  // Built-in exercises without a coach photo or video loop between the two library
  // positions. With reduced motion the picture stays still and a button switches it.
  const frames = exerciseFrames(exercise);
  const reduced = useMotionReduced();
  const [otherPose, setOtherPose] = useState(false);
  useEffect(() => {
    setMuted(true);
    if (live && canPlay) ref.current?.play().catch(() => setPlaying(false));
  }, [exercise.id, video, live, canPlay]);
  return <div className={`exercise-media ${live ? 'live' : ''} ${frames ? 'has-frames' : ''} ${className}`}>
    <img src={photo && photo !== failedPhoto ? photo : exerciseImage(exercise)} alt={t('{name} exercise', { name: exercise.name })} decoding="async" loading={live ? 'eager' : 'lazy'} onError={() => { if (photo) setFailedPhoto(photo); }} />
    {frames && <img className={`exercise-media-flip ${reduced ? 'is-still' : ''} ${reduced && otherPose ? 'is-shown' : ''}`} src={frames[0]} alt="" aria-hidden="true" decoding="async" loading={live ? 'eager' : 'lazy'} />}
    {frames && reduced && <button type="button" className="exercise-pose-toggle" aria-pressed={otherPose} aria-label={t('Show the other position')} onClick={() => setOtherPose(!otherPose)}><Repeat2 size={17}/></button>}
    {canPlay && <video key={exercise.videoFile.id} ref={ref} src={video} poster={photo || exerciseImage(exercise)} autoPlay={live} muted={muted} loop playsInline preload={live ? 'auto' : 'metadata'} controls={!live} aria-label={t('{name} coach video', { name: exercise.name })} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setFailed(video)} />}
    {live && <><div className="exercise-media-shade" />{canPlay && <div className="exercise-video-controls"><button type="button" aria-label={playing ? t('Pause exercise video') : t('Play exercise video')} onClick={() => { if (ref.current.paused) ref.current.play().catch(() => setPlaying(false)); else ref.current.pause(); }}>{playing ? <Pause size={19}/> : <Play size={19}/>}</button><button type="button" aria-label={muted ? t('Unmute exercise video') : t('Mute exercise video')} onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={19}/> : <Volume2 size={19}/>}</button></div>}</>}
    {live && <span className="exercise-media-caption">{exercise.videoFile ? video === null || failed === video ? t('Video unavailable · showing exercise image') : !video ? t('Loading coach video…') : t('Coach demonstration') : exercise.imageFile && photo === null ? t('Photo unavailable · showing library image') : frames ? t('Start and end positions') : images[exercise.name] || photo ? t('Exercise reference') : t('Group cover · coach photo can be added')}</span>}
  </div>;
}
