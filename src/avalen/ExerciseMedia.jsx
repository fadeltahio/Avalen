import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useFile } from './store.js';
import { IMAGES } from './ui.jsx';
import images from './exercise-images.json';

export function exerciseImage(exercise) {
  return images[exercise.name]?.src || IMAGES[['Chest', 'Back', 'Shoulders', 'Arms'].includes(exercise.group) ? 0 : 1];
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
  useEffect(() => {
    setMuted(true);
    if (live && canPlay) ref.current?.play().catch(() => setPlaying(false));
  }, [exercise.id, video, live, canPlay]);
  return <div className={`exercise-media ${live ? 'live' : ''} ${className}`}>
    <img src={photo && photo !== failedPhoto ? photo : exerciseImage(exercise)} alt={`${exercise.name} exercise`} decoding="async" loading={live ? 'eager' : 'lazy'} onError={() => { if (photo) setFailedPhoto(photo); }} />
    {canPlay && <video key={exercise.videoFile.id} ref={ref} src={video} poster={photo || exerciseImage(exercise)} autoPlay={live} muted={muted} loop playsInline preload={live ? 'auto' : 'metadata'} controls={!live} aria-label={`${exercise.name} coach video`} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setFailed(video)} />}
    {live && <><div className="exercise-media-shade" />{canPlay && <div className="exercise-video-controls"><button type="button" aria-label={playing ? 'Pause exercise video' : 'Play exercise video'} onClick={() => { if (ref.current.paused) ref.current.play().catch(() => setPlaying(false)); else ref.current.pause(); }}>{playing ? <Pause size={19}/> : <Play size={19}/>}</button><button type="button" aria-label={muted ? 'Unmute exercise video' : 'Mute exercise video'} onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={19}/> : <Volume2 size={19}/>}</button></div>}</>}
    {live && <span className="exercise-media-caption">{exercise.videoFile ? video === null || failed === video ? 'Video unavailable · showing exercise image' : !video ? 'Loading coach video…' : 'Coach demonstration' : exercise.imageFile && photo === null ? 'Photo unavailable · showing library image' : images[exercise.name] || photo ? 'Exercise reference' : 'Group cover · coach photo can be added'}</span>}
  </div>;
}
