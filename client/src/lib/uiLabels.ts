const UI_LABELS: Record<string, string> = {
  dao: 'Chama',
  daos: 'Chamas',
  createDao: 'Create Chama',
  proposals: 'Decisions',
  proposal: 'Decision',
  members: 'Members',
  treasury: 'Treasury',
  contributions: 'Contributions',
  meetings: 'Meetings'
};

// Additional friendly labels
UI_LABELS['governance'] = 'Decision Style';
UI_LABELS['createGroup'] = 'Create Chama';

export function t(key: string) {
  return UI_LABELS[key] ?? key;
}

export default UI_LABELS;
