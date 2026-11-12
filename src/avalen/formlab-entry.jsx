import React, {lazy, Suspense} from 'react';
const TechniqueReview = lazy(() => import('./ecosystem/formlab.jsx').then(module => ({default:module.FormLab})));
export function FormLab(props) {
  return <Suspense fallback={<div className="feature-loading" role="status" aria-label="Loading technique review"><span className="skeleton"/><p>Opening technique review…</p></div>}><TechniqueReview {...props}/></Suspense>;
}
