import { DEFAULT_SITE_CONTENT } from '../../shared/site-content/defaults';

export const settings = DEFAULT_SITE_CONTENT.settings;

export const site = {
  name: settings.businessName,
  shortName: settings.shortName,
  eyebrow: settings.eyebrow,
  email: settings.email,
  privacyEmail: settings.privacyEmail,
  location: settings.location,
  baseUrl: import.meta.env.PUBLIC_SITE_URL || '',
  noticeVersion: settings.privacyNoticeVersion,
};

export const serviceItems = DEFAULT_SITE_CONTENT.services.map((service, index) => ({
  number: String(index + 1).padStart(2, '0'),
  title: service.title,
  description: service.description,
  examples: service.examples,
}));
