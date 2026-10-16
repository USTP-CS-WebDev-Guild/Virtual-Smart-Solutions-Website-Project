import { DEFAULT_SITE_CONTENT, type PublicSiteContent } from '../../shared/site-content/defaults';
import { publicSiteContentSchema } from '../../shared/site-content/validation';
import { createDatabase } from '../lib/database';

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

type ContentRecord = {
  content: PublicSiteContent;
  revision: number;
  updatedAt: number | null;
  updatedBy: string | null;
};

export async function readSiteContent(
  db: ReturnType<typeof createDatabase>,
): Promise<ContentRecord> {
  const { data, error } = await db
    .from('site_content')
    .select('revision,content,updated_by,updated_at')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw new Error('site_content_read_failed');
  if (!data)
    return { content: copy(DEFAULT_SITE_CONTENT), revision: 0, updatedAt: null, updatedBy: null };
  const parsed = publicSiteContentSchema.safeParse(data.content);
  if (!parsed.success) throw new Error('site_content_invalid');
  return {
    content: parsed.data as PublicSiteContent,
    revision: data.revision,
    updatedAt: data.updated_at,
    updatedBy: data.updated_by,
  };
}

export function publicContent(record: ContentRecord) {
  return {
    content: {
      settings: record.content.settings,
      services: record.content.services.filter((service) => service.published),
      faqs: record.content.faqs.filter((faq) => faq.published),
      plans: record.content.plans.filter((item) => item.published),
      portfolio: record.content.portfolio.filter(
        (item) => item.published && (item.kind === 'example' || item.approved),
      ),
      team: record.content.team.filter((item) => item.published),
    },
    revision: record.revision,
    updatedAt: record.updatedAt,
  };
}
