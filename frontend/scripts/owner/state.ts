export type WorkspaceView = 'inquiries' | 'clients' | 'privacy' | 'content';
export const workspace = {
  actorRole: 'staff' as 'owner' | 'staff',
  sessionVersion: 0,
  view: 'inquiries' as WorkspaceView,
};
export const testEnvironment = document.body.dataset.testEnvironment === 'true';
