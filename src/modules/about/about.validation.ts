import { AboutSectionSchemas, GenericContentSchema } from './about.schemas.js';
import { ABOUT_SECTION_TYPES, ABOUT_SECTION_REQUIREMENTS } from './about.constants.js';

export interface PublishValidationError {
  sectionKey: string;
  field: string;
  code: string;
  message: string;
}

export interface PublishValidationResult {
  valid: boolean;
  errors: PublishValidationError[];
}

export class AboutPublishValidator {
  /**
   * Validates the entire About page draft before publishing.
   */
  public async validateDraft(
    sections: any[],
    seo: any
  ): Promise<PublishValidationResult> {
    const errors: PublishValidationError[] = [];

    // 1. Validate required sections presence
    for (const [sectionType, reqs] of Object.entries(ABOUT_SECTION_REQUIREMENTS)) {
      if (reqs.required) {
        const hasSection = sections.some(
          (s) => s.sectionType === sectionType && s.enabled
        );
        if (!hasSection) {
          errors.push({
            sectionKey: sectionType.toLowerCase(),
            field: 'general',
            code: 'MISSING_REQUIRED_SECTION',
            message: `The ${sectionType} section is required to publish.`,
          });
        }
      }
    }

    // 2. Validate individual section content schemas
    for (const section of sections) {
      if (!section.enabled) continue;

      const schema = AboutSectionSchemas[section.sectionType as keyof typeof AboutSectionSchemas] || GenericContentSchema;
      const result = schema.safeParse(section.content);

      if (!result.success) {
        result.error.errors.forEach((zodError) => {
          errors.push({
            sectionKey: section.sectionKey || section.sectionType.toLowerCase(),
            field: zodError.path.join('.') || 'content',
            code: 'INVALID_FIELD',
            message: zodError.message,
          });
        });
      }
    }

    // 3. Validate SEO
    if (!seo || !seo.title || !seo.description) {
      errors.push({
        sectionKey: 'seo',
        field: 'seo',
        code: 'SEO_REQUIRED',
        message: 'SEO title and description are required.',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
