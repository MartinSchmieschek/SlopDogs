// SlopDogs kennel list · row on a phone (below 768 px). Meta and data run under the title over the full width,
// the action buttons keep 44 px targets on 28 px of row height, the stars turn compact (Follie spec, decision 6).
return [
    '@media (max-width:767px){',
    ".row{grid-template-columns:32px minmax(0,1fr) auto;grid-template-areas:'no main act' 'no meta meta' 'no data data';",
    'column-gap:var(--s2);row-gap:2px}',
    '.main{display:contents}.line1{grid-area:main;display:block;align-self:center}',
    '.line1 .emoji{margin-right:6px;vertical-align:-2px}.line1 .sd-chip{margin:2px 0 2px 6px}',
    '.meta{grid-area:meta;margin-top:0}.act{align-self:start;margin:-8px 0}.no{align-self:start;padding-top:4px}',
    '.name{font-size:18px;line-height:20px}.data{flex-wrap:wrap;gap:0 var(--s3)}.plaque,.when{min-width:0}',
    '.stars svg,.stars .full{display:none}.stars .compact{display:inline}',
    '}',
].join('');
