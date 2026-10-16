import type { PublicSiteContent, SiteSettings } from '../../../shared/site-content/defaults';
import { api, ContentValidationError } from './api';
import { showContentSection } from './content-navigation';
import { byId, formatDate, make, setAlert } from './ui';
import { renderCatalog, collectCatalog, emptyCatalogItem } from './catalog-editor';
import { workspace } from './state';
import { confirmAction } from './confirm';
import { attachImagePicker } from './image-picker';

let contentDirty = false;
let publishing = false;
let editVersion = 0;
let contentRequestVersion = 0;
function updateDraftState() {
  const state = document.getElementById('content-draft-status');
  if (state) {
    state.textContent = contentDirty
      ? 'You have unpublished changes.'
      : 'Your changes are up to date.';
    state.classList.toggle('is-dirty', contentDirty);
  }
  const save = document.getElementById('save-site-content') as HTMLButtonElement | null;
  if (save) save.disabled = publishing || !contentDirty;
}
export function markContentDirty() {
  contentDirty = true;
  ++editVersion;
  updateDraftState();
}
export function hasContentDraft() {
  return contentDirty;
}
export function discardContentDraft() {
  contentDirty = false;
  ++editVersion;
  updateDraftState();
}
export async function handleLiveContentChange() {
  if (publishing) return;
  if (contentDirty) {
    byId<HTMLElement>('content-update-notice').hidden = false;
    return;
  }
  await loadSiteContent();
}

let siteContent: PublicSiteContent | null = null;
let siteContentRevision = 0;
let siteContentUpdatedAt: number | null = null;

const editableSettings: Array<{
  key: keyof SiteSettings;
  label: string;
  maxLength: number;
  multiline?: boolean;
  inputType?: string;
}> = [
  { key: 'businessName', label: 'Business name', maxLength: 100 },
  { key: 'shortName', label: 'Short brand name', maxLength: 50 },
  { key: 'eyebrow', label: 'Brand line', maxLength: 100 },
  { key: 'email', label: 'Public email (optional)', maxLength: 254, inputType: 'email' },
  {
    key: 'privacyEmail',
    label: 'Privacy contact email (optional)',
    maxLength: 254,
    inputType: 'email',
  },
  { key: 'location', label: 'Location or service area', maxLength: 160 },
  { key: 'privacyNoticeVersion', label: 'Privacy notice version', maxLength: 50 },
  { key: 'homeEyebrow', label: 'Home page eyebrow', maxLength: 100 },
  { key: 'homeHeadline', label: 'Home page heading', maxLength: 150 },
  { key: 'homeEmphasis', label: 'Home page emphasized phrase', maxLength: 100 },
  { key: 'homeLede', label: 'Home page introduction', maxLength: 500, multiline: true },
  { key: 'homePrimaryCta', label: 'Primary button text', maxLength: 70 },
  { key: 'homeSecondaryCta', label: 'Secondary button text', maxLength: 70 },
  { key: 'servicesEyebrow', label: 'Services page eyebrow', maxLength: 100 },
  { key: 'servicesHeadline', label: 'Services page heading', maxLength: 150 },
  { key: 'servicesEmphasis', label: 'Services page emphasized phrase', maxLength: 100 },
  { key: 'servicesLead', label: 'Services page introduction', maxLength: 500, multiline: true },
  { key: 'aboutEyebrow', label: 'About page eyebrow', maxLength: 100 },
  { key: 'aboutHeadline', label: 'About page heading', maxLength: 150 },
  { key: 'aboutEmphasis', label: 'About page emphasized phrase', maxLength: 100 },
  { key: 'aboutLead', label: 'About page introduction', maxLength: 500, multiline: true },
  { key: 'approachEyebrow', label: 'Approach page eyebrow', maxLength: 100 },
  { key: 'approachHeadline', label: 'Approach page heading', maxLength: 150 },
  { key: 'approachEmphasis', label: 'Approach page emphasized phrase', maxLength: 100 },
  { key: 'approachLead', label: 'Approach page introduction', maxLength: 500, multiline: true },
  { key: 'contactEyebrow', label: 'Contact page eyebrow', maxLength: 100 },
  { key: 'contactHeadline', label: 'Contact page heading', maxLength: 100 },
  { key: 'contactEmphasis', label: 'Contact page emphasized phrase', maxLength: 100 },
  { key: 'contactLead', label: 'Contact page introduction', maxLength: 500, multiline: true },
  { key: 'footerTagline', label: 'Footer tagline', maxLength: 180, multiline: true },
  { key: 'pricingNote', label: 'Pricing scope and terms', maxLength: 600, multiline: true },
  { key: 'portfolioLead', label: 'Portfolio introduction', maxLength: 500, multiline: true },
];

function cmsField(
  parent: HTMLElement,
  labelText: string,
  value: string,
  maxLength: number,
  multiline = false,
  inputType = 'text',
): HTMLInputElement | HTMLTextAreaElement {
  const label = make('label', 'cms-field');
  label.append(make('span', '', labelText));
  const control = multiline
    ? (make('textarea', 'cms-input') as HTMLTextAreaElement)
    : (make('input', 'cms-input') as HTMLInputElement);
  if (control instanceof HTMLInputElement) control.type = inputType;
  control.value = value;
  control.maxLength = maxLength;
  label.append(control);
  parent.append(label);
  return control;
}

function updateContentRevisionLabel(updatedAt: number | null) {
  byId<HTMLElement>('content-revision').textContent = updatedAt
    ? `Revision ${siteContentRevision} · saved ${formatDate(updatedAt)}`
    : 'First save · no live changes yet';
}

function renderSiteContentEditor(content: PublicSiteContent, updatedAt: number | null) {
  contentDirty = false;
  updateDraftState();
  byId<HTMLElement>('content-update-notice').hidden = true;
  const settingsContainer = byId<HTMLElement>('cms-settings-fields');
  const openGroups = new Map(
    Array.from(settingsContainer.querySelectorAll<HTMLDetailsElement>('[data-settings-group]')).map(
      (group) => [group.dataset.settingsGroup!, group.open],
    ),
  );
  settingsContainer.replaceChildren();
  const groups = new Map<string, HTMLElement>();
  const groupFor = (key: string): [string, string] => {
    if (key.startsWith('home')) return ['home', 'Home page'];
    if (key.startsWith('services') || key === 'pricingNote')
      return ['services', 'Services & pricing'];
    if (key.startsWith('about')) return ['about', 'About page'];
    if (key.startsWith('approach')) return ['approach', 'Approach page'];
    if (key.startsWith('contact')) return ['contact', 'Contact page'];
    if (key.startsWith('portfolio')) return ['portfolio', 'Our work page'];
    if (key.startsWith('footer')) return ['footer', 'Footer'];
    return ['business', 'Business details & contact'];
  };
  for (const field of editableSettings) {
    const [id, title] = groupFor(field.key);
    if (!groups.has(id)) {
      const section = make('details', 'cms-settings-group');
      section.dataset.settingsGroup = id;
      section.open = openGroups.get(id) ?? id === 'business';
      section.append(make('summary', '', title));
      const grid = make('div', 'cms-group-fields');
      section.append(grid);
      groups.set(id, grid);
      settingsContainer.append(section);
    }
    const control = cmsField(
      groups.get(id)!,
      field.label,
      content.settings[field.key],
      field.maxLength,
      Boolean(field.multiline),
      field.inputType || 'text',
    );
    control.dataset.setting = field.key;
  }

  const servicesContainer = byId<HTMLElement>('cms-services');
  servicesContainer.replaceChildren();
  content.services.forEach((service, index) => {
    const card = make('article', 'cms-item-card cms-service-card');
    card.dataset.contentId = service.id;
    const heading = make('div', 'cms-item-heading');
    heading.append(make('strong', '', `Service ${String(index + 1).padStart(2, '0')}`));
    const actions = make('div', 'cms-item-actions');
    const moveUp = make('button', 'cms-small-button', '↑') as HTMLButtonElement;
    moveUp.type = 'button';
    moveUp.setAttribute('aria-label', 'Move service up');
    moveUp.disabled = index === 0;
    moveUp.addEventListener('click', () => {
      markContentDirty();
      const previous = card.previousElementSibling;
      if (previous) servicesContainer.insertBefore(card, previous);
      renumberCmsItems(servicesContainer, 'Service');
    });
    const moveDown = make('button', 'cms-small-button', '↓') as HTMLButtonElement;
    moveDown.type = 'button';
    moveDown.setAttribute('aria-label', 'Move service down');
    moveDown.disabled = index === content.services.length - 1;
    moveDown.addEventListener('click', () => {
      markContentDirty();
      const next = card.nextElementSibling;
      if (next) servicesContainer.insertBefore(next, card);
      renumberCmsItems(servicesContainer, 'Service');
    });
    const remove = make('button', 'cms-remove-button', 'Remove') as HTMLButtonElement;
    remove.type = 'button';
    remove.addEventListener('click', () => {
      markContentDirty();
      card.remove();
      renumberCmsItems(servicesContainer, 'Service');
    });
    actions.append(moveUp, moveDown, remove);
    heading.append(actions);
    card.append(heading);
    const title = cmsField(card, 'Service name', service.title, 100);
    title.dataset.serviceField = 'title';
    const description = cmsField(card, 'Description', service.description, 500, true);
    description.dataset.serviceField = 'description';
    const image = cmsField(card, 'Service image', service.image, 180);
    image.dataset.serviceField = 'image';
    attachImagePicker(image as HTMLInputElement);
    const examples = cmsField(
      card,
      'Examples · one per line',
      service.examples.join('\n'),
      640,
      true,
    );
    examples.dataset.serviceField = 'examples';
    const visibility = make('label', 'cms-checkbox-label');
    const published = make('input') as HTMLInputElement;
    published.type = 'checkbox';
    published.checked = service.published;
    published.dataset.serviceField = 'published';
    visibility.append(
      published,
      document.createTextNode(' Show this service on the public website'),
    );
    card.append(visibility);
    servicesContainer.append(card);
  });

  const faqsContainer = byId<HTMLElement>('cms-faqs');
  faqsContainer.replaceChildren();
  content.faqs.forEach((faq, index) => {
    const card = make('article', 'cms-item-card cms-faq-card');
    card.dataset.contentId = faq.id;
    const heading = make('div', 'cms-item-heading');
    heading.append(make('strong', '', `Question ${String(index + 1).padStart(2, '0')}`));
    const remove = make('button', 'cms-remove-button', 'Remove') as HTMLButtonElement;
    remove.type = 'button';
    remove.addEventListener('click', () => {
      markContentDirty();
      card.remove();
    });
    heading.append(remove);
    card.append(heading);
    const question = cmsField(card, 'Question', faq.question, 180);
    question.dataset.faqField = 'question';
    const answer = cmsField(card, 'Answer', faq.answer, 1200, true);
    answer.dataset.faqField = 'answer';
    const visibility = make('label', 'cms-checkbox-label');
    const published = make('input') as HTMLInputElement;
    published.type = 'checkbox';
    published.checked = faq.published;
    published.dataset.faqField = 'published';
    visibility.append(published, document.createTextNode(' Publish this answer'));
    card.append(visibility);
    faqsContainer.append(card);
  });
  renderCatalog(content, markContentDirty);
  updateContentRevisionLabel(updatedAt);
}

function renumberCmsItems(container: HTMLElement, label: string) {
  const cards = Array.from(container.querySelectorAll<HTMLElement>('.cms-service-card'));
  cards.forEach((card, index) => {
    const heading = card.querySelector<HTMLElement>('.cms-item-heading > strong');
    if (heading) heading.textContent = `${label} ${String(index + 1).padStart(2, '0')}`;
    const buttons = card.querySelectorAll<HTMLButtonElement>('.cms-item-actions button');
    if (buttons[0]) buttons[0].disabled = index === 0;
    if (buttons[1]) buttons[1].disabled = index === cards.length - 1;
  });
  container
    .querySelectorAll<HTMLElement>('.cms-faq-card .cms-item-heading > strong')
    .forEach((heading, index) => {
      heading.textContent = `${label} ${String(index + 1).padStart(2, '0')}`;
    });
}

export async function loadSiteContent() {
  const session = workspace.sessionVersion;
  const request = ++contentRequestVersion;
  const edits = editVersion;
  const result = await api<{
    content: PublicSiteContent;
    revision: number;
    updatedAt: number | null;
  }>('/api/admin/site-content');
  if (
    session !== workspace.sessionVersion ||
    byId<HTMLElement>('admin-app').hidden ||
    request !== contentRequestVersion ||
    edits !== editVersion
  )
    return;
  siteContent = result.content;
  siteContentRevision = result.revision;
  siteContentUpdatedAt = result.updatedAt;
  renderSiteContentEditor(result.content, result.updatedAt);
}

function collectSiteContent(): PublicSiteContent | null {
  if (!siteContent) return null;
  const settings = { ...siteContent.settings };
  for (const control of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    '[data-setting]',
  )) {
    const key = control.dataset.setting as keyof SiteSettings | undefined;
    if (key) settings[key] = control.value.trim();
  }
  const services = Array.from(document.querySelectorAll<HTMLElement>('.cms-service-card')).map(
    (card) => {
      const getField = (key: string) =>
        card.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-service-field="${key}"]`);
      const published = card.querySelector<HTMLInputElement>('[data-service-field="published"]');
      return {
        id: card.dataset.contentId || crypto.randomUUID().replaceAll('-', ''),
        title: getField('title')?.value.trim() || '',
        description: getField('description')?.value.trim() || '',
        image: getField('image')?.value.trim() || '/images/service-admin.webp',
        examples: (getField('examples')?.value || '')
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean),
        published: published?.checked ?? false,
      };
    },
  );
  const faqs = Array.from(document.querySelectorAll<HTMLElement>('.cms-faq-card')).map((card) => {
    const getField = (key: string) =>
      card.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-faq-field="${key}"]`);
    const published = card.querySelector<HTMLInputElement>('[data-faq-field="published"]');
    return {
      id: card.dataset.contentId || crypto.randomUUID().replaceAll('-', ''),
      question: getField('question')?.value.trim() || '',
      answer: getField('answer')?.value.trim() || '',
      published: published?.checked ?? false,
    };
  });
  return { settings, services, faqs, ...collectCatalog() };
}

export function addCmsService() {
  const draft = collectSiteContent();
  if (!draft) return;
  draft.services.push({
    id: crypto.randomUUID().replaceAll('-', ''),
    title: '',
    description: '',
    image: '/images/service-admin.webp',
    examples: [],
    published: false,
  });
  renderSiteContentEditor(draft, siteContentUpdatedAt);
  markContentDirty();
}

export function addCmsFaq() {
  const draft = collectSiteContent();
  if (!draft) return;
  draft.faqs.push({
    id: crypto.randomUUID().replaceAll('-', ''),
    question: '',
    answer: '',
    published: false,
  });
  renderSiteContentEditor(draft, siteContentUpdatedAt);
  markContentDirty();
}

export async function saveSiteContent() {
  const content = collectSiteContent();
  if (!content || !contentDirty || publishing) return;
  const invalid = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      '#content-view input,#content-view textarea',
    ),
  ).find((control) => !control.checkValidity());
  if (invalid) {
    const section = invalid.closest<HTMLElement>('[data-editor-section]')?.dataset.editorSection;
    if (section) showContentSection(section);
    const group = invalid.closest('details');
    if (group) group.open = true;
    invalid.reportValidity();
    setAlert('Please review the highlighted field before publishing.', 'error');
    return;
  }
  publishing = true;
  const session = workspace.sessionVersion;
  const request = ++contentRequestVersion;
  const edits = editVersion;
  const controls = new Map(
    Array.from(
      document.querySelectorAll<
        HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement
      >('#content-view input,#content-view textarea,#content-view select,#content-view button'),
    ).map((control) => [control, control.disabled]),
  );
  for (const control of controls.keys()) control.disabled = true;
  const button = byId<HTMLButtonElement>('save-site-content');
  button.disabled = true;
  try {
    const result = await api<{
      content: PublicSiteContent;
      revision: number;
      updatedAt: number | null;
    }>('/api/admin/site-content', {
      method: 'PUT',
      body: JSON.stringify({ revision: siteContentRevision, content }),
    });
    if (
      session !== workspace.sessionVersion ||
      request !== contentRequestVersion ||
      edits !== editVersion ||
      byId<HTMLElement>('admin-app').hidden
    )
      return;
    siteContent = result.content;
    siteContentRevision = result.revision;
    siteContentUpdatedAt = result.updatedAt;
    renderSiteContentEditor(result.content, result.updatedAt);
    setAlert('Website content saved and published.', 'success');
  } catch (error) {
    if (session !== workspace.sessionVersion) return;
    if (error instanceof ContentValidationError) showContentSection(error.section);
    const message =
      error instanceof Error && error.message === 'content_revision_conflict'
        ? 'Someone saved newer content. Reload the editor before making another change.'
        : error instanceof Error
          ? error.message
          : 'Could not save website content.';
    setAlert(message, 'error');
  } finally {
    if (session === workspace.sessionVersion) {
      for (const [control, disabled] of controls) {
        if (control.isConnected) control.disabled = disabled;
      }
      publishing = false;
      updateDraftState();
    }
  }
}

type ContentHistoryItem = {
  id: string;
  revision: number;
  actorEmail: string;
  action: string;
  createdAt: number;
};

export async function loadContentHistory() {
  const session = workspace.sessionVersion;
  const panel = byId<HTMLElement>('content-history');
  panel.replaceChildren(make('div', 'loading-state', 'Loading revisions…'));
  const result = await api<{ history: ContentHistoryItem[] }>('/api/admin/site-content/history');
  if (session !== workspace.sessionVersion || byId<HTMLElement>('admin-app').hidden) return;
  panel.replaceChildren();
  if (!result.history.length) {
    panel.append(make('p', 'loading-state', 'No content changes have been published yet.'));
    return;
  }
  for (const entry of result.history) {
    const row = make('article', 'content-history-row');
    const details = make('div', '');
    details.append(make('strong', '', `Revision ${entry.revision}`));
    details.append(make('small', '', `${formatDate(entry.createdAt)} · ${entry.actorEmail}`));
    const restore = make(
      'button',
      'cms-secondary-button',
      'Restore as new revision',
    ) as HTMLButtonElement;
    restore.type = 'button';
    restore.disabled = entry.revision === siteContentRevision;
    restore.addEventListener('click', () => {
      void restoreContentRevision(entry.revision, restore);
    });
    row.append(details, restore);
    panel.append(row);
  }
}

async function restoreContentRevision(revision: number, button: HTMLButtonElement) {
  if (publishing) return;
  if (
    !(await confirmAction(
      'Restore revision ' + revision + '?',
      'This replaces the current website content and publishes the selected revision. Any unpublished changes in this editor will be discarded.',
      'Restore and publish',
    ))
  )
    return;
  if (publishing) return;
  publishing = true;
  const session = workspace.sessionVersion;
  const controls = new Map(
    Array.from(
      document.querySelectorAll<
        HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement
      >('#content-view input,#content-view textarea,#content-view select,#content-view button'),
    ).map((control) => [control, control.disabled]),
  );
  for (const control of controls.keys()) control.disabled = true;
  button.disabled = true;
  try {
    const snapshot = await api<{ content: PublicSiteContent }>(
      '/api/admin/site-content/history/' + revision,
    );
    if (session !== workspace.sessionVersion || byId<HTMLElement>('admin-app').hidden) return;
    const saved = await api<{
      content: PublicSiteContent;
      revision: number;
      updatedAt: number | null;
    }>('/api/admin/site-content', {
      method: 'PUT',
      body: JSON.stringify({ revision: siteContentRevision, content: snapshot.content }),
    });
    if (session !== workspace.sessionVersion || byId<HTMLElement>('admin-app').hidden) return;
    siteContent = saved.content;
    siteContentRevision = saved.revision;
    siteContentUpdatedAt = saved.updatedAt;
    renderSiteContentEditor(saved.content, saved.updatedAt);
    setAlert(
      `Revision ${revision} restored and published as revision ${saved.revision}.`,
      'success',
    );
    await loadContentHistory();
  } catch (error) {
    if (error instanceof ContentValidationError) showContentSection(error.section);
    const message =
      error instanceof Error && error.message === 'content_revision_conflict'
        ? 'Someone saved newer content. Reload the editor before restoring this version.'
        : error instanceof Error
          ? error.message
          : 'Could not restore that revision.';
    if (session === workspace.sessionVersion) setAlert(message, 'error');
  } finally {
    if (session === workspace.sessionVersion) {
      for (const [control, disabled] of controls)
        if (control.isConnected) control.disabled = disabled;
      publishing = false;
      updateDraftState();
    }
  }
}

export function addCmsCatalog(kind: 'plans' | 'portfolio' | 'team') {
  const draft = collectSiteContent();
  if (!draft) return;
  (draft[kind] as unknown[]).push(emptyCatalogItem(kind));
  renderSiteContentEditor(draft, siteContentUpdatedAt);
  markContentDirty();
}

window.addEventListener('vss-session-closed', () => {
  ++contentRequestVersion;
  ++editVersion;
  contentDirty = false;
  publishing = false;
  siteContent = null;
  siteContentRevision = 0;
  siteContentUpdatedAt = null;
});
