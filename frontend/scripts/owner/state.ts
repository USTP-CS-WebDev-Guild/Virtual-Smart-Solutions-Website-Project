export type WorkspaceView =
  'overview' | 'inquiries' | 'clients' | 'privacy' | 'content' | 'settings';
export const workspace = {
  actorRole: 'staff' as 'owner' | 'staff',
  sessionVersion: 0,
  view: 'overview' as WorkspaceView,
};
export const testEnvironment = document.body.dataset.testEnvironment === 'true';
