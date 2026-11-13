import React, {lazy, Suspense} from 'react';
import { t } from './i18n.js';
const TechniqueReview = lazy(() => import('./ecosystem/formlab.jsx').then(module => ({default:module.FormLab})));
export function FormLab(props) {
  return <Suspense fallback={<div className="feature-loading" role="status" aria-label={t('Loading technique review')}><span className="skeleton"/><p>{t('Opening technique review…')}</p></div>}><TechniqueReview {...props}/></Suspense>;
}
