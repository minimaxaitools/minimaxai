// query.js - Parse filter chips from search queries (e.g. model:opus outcome:worked starred:true)

export function parseQueryChips(queryStr) {
  if (!queryStr) return { chips: {}, rawQuery: '' };

  const chips = {};
  const terms = [];

  const tokens = queryStr.split(/\s+/);
  for (const token of tokens) {
    if (token.includes(':')) {
      const [key, val] = token.split(':');
      const k = key.toLowerCase();
      if (k === 'model') chips.model = val;
      else if (k === 'project') chips.project = val;
      else if (k === 'thread') chips.thread = val;
      else if (k === 'outcome') chips.outcome = val;
      else if (k === 'starred') chips.starred = val === 'true' || val === '1';
      else if (k === 'lang') chips.lang = val;
      else terms.push(token);
    } else {
      terms.push(token);
    }
  }

  return {
    chips,
    rawQuery: terms.join(' ')
  };
}
