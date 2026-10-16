// Pricing, work examples, and people share a small editor; business routes stay
// in backend/. All values are validated again by the server before publishing.
import type { PublicSiteContent } from '../../../shared/site-content/defaults';
import { byId, make } from './ui';
import { attachImagePicker } from './image-picker';

type Catalog = 'plans' | 'portfolio' | 'team';
type Field = {
  key: string;
  label: string;
  max?: number;
  multiline?: boolean;
  lines?: boolean;
  flag?: boolean;
  choices?: string[];
};
const fields: Record<Catalog, Field[]> = {
  plans: [
    { key: 'name', label: 'Package name', max: 60 },
    { key: 'price', label: 'Displayed price', max: 60 },
    { key: 'period', label: 'Billing period', max: 40 },
    { key: 'description', label: 'Who it fits', max: 240, multiline: true },
    { key: 'features', label: 'Package features · one per line', max: 808, lines: true },
    { key: 'featured', label: 'Highlight this package', flag: true },
    { key: 'published', label: 'Publish this package', flag: true },
  ],
  portfolio: [
    { key: 'title', label: 'Work title', max: 120 },
    { key: 'category', label: 'Work category', max: 80 },
    { key: 'description', label: 'Work description', max: 500, multiline: true },
    { key: 'image', label: 'Work image', max: 180 },
    { key: 'outcome', label: 'Scope or verified outcome', max: 600, multiline: true },
    { key: 'kind', label: 'Work type', choices: ['example', 'case-study'] },
    {
      key: 'approved',
      label: 'Owner has verified the client result and permission to publish',
      flag: true,
    },
    { key: 'published', label: 'Publish this work entry', flag: true },
  ],
  team: [
    { key: 'name', label: 'Team member name', max: 120 },
    { key: 'role', label: 'Team member role', max: 100 },
    { key: 'bio', label: 'Team introduction', max: 500, multiline: true },
    { key: 'image', label: 'Portrait image', max: 180 },
    { key: 'published', label: 'Publish this team member', flag: true },
  ],
};
const titles: Record<Catalog, string> = {
  plans: 'Package',
  portfolio: 'Work entry',
  team: 'Team member',
};
export function renderCatalog(content: PublicSiteContent, changed: () => void) {
  for (const kind of ['plans', 'portfolio', 'team'] as Catalog[]) {
    const container = byId<HTMLElement>('cms-' + kind);
    container.replaceChildren();
    for (const [index, entry] of content[kind].entries()) {
      const item = entry as unknown as Record<string, unknown>;
      const card = make('article', 'cms-item-card');
      card.dataset.catalogId = String(item.id);
      card.dataset.catalogKind = kind;
      const head = make('div', 'cms-item-heading');
      head.append(make('strong', '', titles[kind] + ' ' + (index + 1)));
      const actions = make('div', 'cms-item-actions');
      for (const [text, direction] of [
        ['Move up', -1],
        ['Move down', 1],
      ] as const) {
        const move = make('button', 'cms-small-button', direction < 0 ? '↑' : '↓');
        move.type = 'button';
        move.setAttribute('aria-label', text + ' ' + titles[kind].toLowerCase());
        move.addEventListener('click', () => {
          const sibling = direction < 0 ? card.previousElementSibling : card.nextElementSibling;
          if (sibling) {
            container.insertBefore(card, direction < 0 ? sibling : sibling.nextElementSibling);
            changed();
          }
        });
        actions.append(move);
      }
      const remove = make('button', 'cms-remove-button', 'Remove');
      remove.type = 'button';
      remove.addEventListener('click', () => {
        card.remove();
        changed();
      });
      actions.append(remove);
      head.append(actions);
      card.append(head);
      for (const field of fields[kind]) {
        const label = make('label', field.flag ? 'cms-checkbox-label' : 'cms-field');
        let control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        if (field.choices) {
          const select = make('select', 'cms-input');
          for (const choice of field.choices) {
            const option = make(
              'option',
              '',
              choice === 'case-study' ? 'Verified client case study' : 'Illustrative engagement',
            );
            option.value = choice;
            select.append(option);
          }
          select.value = String(item[field.key]);
          control = select;
        } else if (field.multiline || field.lines) {
          const area = make('textarea', 'cms-input');
          area.value = field.lines
            ? (item[field.key] as string[]).join('\n')
            : String(item[field.key] || '');
          area.maxLength = field.max!;
          area.rows = 3;
          control = area;
        } else {
          const input = make('input', 'cms-input');
          input.type = field.flag ? 'checkbox' : 'text';
          if (field.flag) input.checked = Boolean(item[field.key]);
          else {
            input.value = String(item[field.key] || '');
            input.maxLength = field.max!;
          }
          control = input;
        }
        control.dataset.catalogField = field.key;
        if (field.flag) label.append(control, document.createTextNode(' ' + field.label));
        else label.append(make('span', '', field.label), control);
        control.addEventListener('input', changed);
        control.addEventListener('change', changed);
        card.append(label);
        if (field.key === 'image') {
          attachImagePicker(control as HTMLInputElement);
          const help = make(
            'small',
            'cms-image-help',
            'Choose an approved website image. Ask your website team when you need to add a new photo.',
          );
          card.append(help);
          const image = make('img', 'cms-image-preview');
          image.alt = 'Image preview';
          image.width = 200;
          image.height = 130;
          const update = () => {
            const value = (control as HTMLInputElement).value;
            image.hidden = !/^\/images\/[a-zA-Z0-9/_-]+\.(webp|png|jpe?g|avif)$/.test(value);
            if (!image.hidden) image.src = value;
          };
          update();
          control.addEventListener('change', update);
          card.append(image);
        }
      }
      container.append(card);
    }
    if (!content[kind].length)
      container.append(
        make('p', 'loading-state', 'No ' + kind + ' yet. Add an entry when you are ready.'),
      );
  }
}
export function collectCatalog(): Pick<PublicSiteContent, 'plans' | 'portfolio' | 'team'> {
  const result: Record<string, unknown[]> = { plans: [], portfolio: [], team: [] };
  for (const kind of ['plans', 'portfolio', 'team'] as Catalog[]) {
    for (const card of document.querySelectorAll<HTMLElement>(
      '[data-catalog-kind="' + kind + '"]',
    )) {
      const item: Record<string, unknown> = { id: card.dataset.catalogId };
      for (const field of fields[kind]) {
        const control = card.querySelector<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >('[data-catalog-field="' + field.key + '"]')!;
        item[field.key] = field.flag
          ? (control as HTMLInputElement).checked
          : field.lines
            ? control.value
                .split(/\r?\n/)
                .map((x) => x.trim())
                .filter(Boolean)
            : control.value.trim();
      }
      result[kind].push(item);
    }
  }
  return result as unknown as Pick<PublicSiteContent, 'plans' | 'portfolio' | 'team'>;
}
export function emptyCatalogItem(kind: Catalog) {
  const common = { id: crypto.randomUUID().replaceAll('-', ''), published: false };
  if (kind === 'plans')
    return {
      ...common,
      name: 'New package',
      price: 'By agreement',
      period: '',
      description: 'Describe who this package supports.',
      features: ['Agreed scope'],
      featured: false,
    };
  if (kind === 'portfolio')
    return {
      ...common,
      title: 'New work example',
      category: 'Business support',
      description: 'Describe the agreed work.',
      image: '/images/service-admin.webp',
      outcome: 'Explain the scope or verified outcome.',
      kind: 'example' as const,
      approved: false,
    };
  return {
    ...common,
    name: 'New team member',
    role: 'Virtual assistant',
    bio: 'Add an approved introduction.',
    image: '/images/collaboration.webp',
  };
}
