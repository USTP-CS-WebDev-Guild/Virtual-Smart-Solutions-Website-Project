import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE_CONTENT } from '../../shared/site-content/defaults';
import {
  publicSiteContentSchema,
  saveSiteContentSchema,
} from '../../shared/site-content/validation';

describe('site content validation', () => {
  it('accepts the shipped business content', () => {
    expect(publicSiteContentSchema.safeParse(DEFAULT_SITE_CONTENT).success).toBe(true);
  });
  it('requires a published service', () => {
    const content = structuredClone(DEFAULT_SITE_CONTENT);
    content.services = content.services.map((service) => ({ ...service, published: false }));
    expect(publicSiteContentSchema.safeParse(content).success).toBe(false);
  });
  it('rejects duplicate service titles and duplicate IDs', () => {
    const duplicateTitle = structuredClone(DEFAULT_SITE_CONTENT);
    duplicateTitle.services[1]!.title = duplicateTitle.services[0]!.title;
    expect(publicSiteContentSchema.safeParse(duplicateTitle).success).toBe(false);
    const duplicateId = structuredClone(DEFAULT_SITE_CONTENT);
    duplicateId.services[1]!.id = duplicateId.services[0]!.id;
    expect(publicSiteContentSchema.safeParse(duplicateId).success).toBe(false);
  });
  it('requires a non-negative revision before publishing', () => {
    expect(
      saveSiteContentSchema.safeParse({ revision: 0, content: DEFAULT_SITE_CONTENT }).success,
    ).toBe(true);
    expect(
      saveSiteContentSchema.safeParse({ revision: -1, content: DEFAULT_SITE_CONTENT }).success,
    ).toBe(false);
  });
});
