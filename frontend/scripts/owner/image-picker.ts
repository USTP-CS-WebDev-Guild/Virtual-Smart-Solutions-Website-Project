import { make } from './ui';

// Approved files shipped with the website. Students can add assets here after
// the business owner approves a photo; owners choose readable names in the UI.
const images = [
  ['/images/service-admin.webp', 'Desk & administration'],
  ['/images/service-data.webp', 'Data & organization'],
  ['/images/service-social.webp', 'Social media & marketing'],
  ['/images/service-books.webp', 'Books & financial records'],
  ['/images/service-calls.webp', 'Calls & appointments'],
  ['/images/collaboration.webp', 'Team collaboration'],
  ['/images/remote-work.webp', 'Remote working'],
  ['/images/hero-team.webp', 'Team at work'],
  ['/images/founder.jpg', 'Founder portrait'],
  ['/images/marketing-lead.jpg', 'Marketing lead portrait'],
];
export function attachImagePicker(input: HTMLInputElement) {
  const label = input.parentElement;
  if (!label) return;
  const select = make('select', 'cms-input');
  select.setAttribute('aria-label', label.querySelector('span')?.textContent || 'Choose image');
  if (!images.some(([path]) => path === input.value)) {
    const current = make('option', '', 'Current image');
    current.value = input.value;
    select.append(current);
  }
  for (const [path, text] of images) {
    const option = make('option', '', text);
    option.value = path!;
    select.append(option);
  }
  select.value = input.value;
  input.type = 'hidden';
  label.append(select);
  select.addEventListener('change', () => {
    input.value = select.value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
