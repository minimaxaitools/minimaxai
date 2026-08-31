// playbook.js - F5.2 Playbook sequence execution engine

import { compileTemplate } from './templates.js';
import { db } from '../db/db.js';

export async function getPlaybookStepPrompt(playbook, stepIndex, contextData = {}) {
  if (!playbook || !playbook.steps || !playbook.steps[stepIndex]) {
    return '';
  }

  const stepDef = playbook.steps[stepIndex];
  if (stepDef.prompt) {
    return compileTemplate(stepDef.prompt, contextData);
  }

  if (stepDef.templateName) {
    const template = await db.templates.where('name').equals(stepDef.templateName).first();
    if (template) {
      return compileTemplate(template.body, contextData);
    }
  }

  return stepDef.title || '';
}
