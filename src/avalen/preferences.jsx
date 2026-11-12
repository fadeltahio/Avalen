import React from 'react';
import {Check,Moon,Sun} from 'lucide-react';
import {useApp} from './context.js';
import {SectionHead} from './ui.jsx';
import {WearableConnections} from './wearables.jsx';

export function Appearance(){
 const {data,update}=useApp();
 const theme=data.settings.theme||'dark';
 return <section className="card appearance-settings"><SectionHead title="Appearance"/><p>A different light. The same focus.</p><div className="theme-options" role="group" aria-label="Colour theme">{[['dark','Dark',Moon,'Black, white and full focus'],['light','Light',Sun,'A clean, lighter canvas']].map(([id,label,Icon,description])=><button key={id} className={`theme-option ${id} ${theme===id?'selected':''}`} aria-pressed={theme===id} onClick={()=>update(d=>d.settings.theme=id)}><div className="theme-miniature" aria-hidden="true"><i/><span/><div><i/><i/><i/></div></div><div className="theme-option-label"><Icon size={16}/><b>{label}</b>{theme===id&&<Check size={16}/>}</div><small>{description}</small></button>)}</div><small className="muted">Black is the default. Your choice is saved on this device.</small></section>;
}

// Wearable connections, sharing and manual readings live in wearables.jsx.
export function ConnectedDevices(){
 return <WearableConnections/>;
}
