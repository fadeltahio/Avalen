import React from 'react';
import {Check,Moon,Sun} from 'lucide-react';
import {useApp} from './context.js';
import {SectionHead} from './ui.jsx';
import {WearableConnections} from './wearables.jsx';
import {LANGUAGES,language,setLanguage,t} from './i18n.js';

export function Appearance(){
 const {data,update}=useApp();
 const theme=data.settings.theme||'dark';
 return <section className="card appearance-settings"><SectionHead title={t('Appearance')}/><p>{t('A different light. The same focus.')}</p><div className="theme-options" role="group" aria-label={t('Colour theme')}>{[['dark',t('Dark'),Moon,t('Black, white and full focus')],['light',t('Light'),Sun,t('A clean, lighter canvas')]].map(([id,label,Icon,description])=><button key={id} className={`theme-option ${id} ${theme===id?'selected':''}`} aria-pressed={theme===id} onClick={()=>update(d=>d.settings.theme=id)}><div className="theme-miniature" aria-hidden="true"><i/><span/><div><i/><i/><i/></div></div><div className="theme-option-label"><Icon size={16}/><b>{label}</b>{theme===id&&<Check size={16}/>}</div><small>{description}</small></button>)}</div><small className="muted">{t('Black is the default. Your choice is saved on this device.')}</small>
 <h3 className="language-heading">{t('Language')}</h3><div className="language-options" role="group" aria-label={t('Language')}>{Object.entries(LANGUAGES).map(([id,l])=><button key={id} lang={id} dir={l.dir} className={`language-option ${language()===id?'selected':''}`} aria-pressed={language()===id} onClick={()=>setLanguage(id)}><b>{t(l.name)}</b>{language()===id&&<Check size={16}/>}</button>)}</div></section>;
}

// Wearable connections, sharing and manual readings live in wearables.jsx.
export function ConnectedDevices(){
 return <WearableConnections/>;
}
