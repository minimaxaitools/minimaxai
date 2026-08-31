// templates.js - Template variable parsing & compilation engine

export function parseVariables(templateBody) {
  if (!templateBody) return [];
  const matches = [...templateBody.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)];
  const vars = new Set();
  for (const m of matches) {
    vars.add(m[1]);
  }
  return Array.from(vars);
}

export function compileTemplate(templateBody, values = {}) {
  if (!templateBody) return '';
  return templateBody.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, varName) => {
    return values[varName] !== undefined ? values[varName] : match;
  });
}
