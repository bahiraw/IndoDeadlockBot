import { z } from 'zod';

export const MAX_V2_COMPONENTS = 40;
export const MAX_V2_TEXT_CHARS = 4000;

export const ButtonStyleSchema = z.enum([
  'Primary',
  'Secondary',
  'Success',
  'Danger',
  'Link',
]);
export type V2ButtonStyle = z.infer<typeof ButtonStyleSchema>;

export const TextDisplayNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('TextDisplay'),
  content: z.string().min(1, 'TextDisplay requires content').max(4000),
});

export const SeparatorNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('Separator'),
  divider: z.boolean().default(true),
  spacing: z.enum(['Small', 'Large']).default('Small'),
});

export const FileNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('File'),
  url: z
    .string()
    .min(1, 'File URL required (e.g. attachment://example.json)')
    .refine(
      (val) => val.startsWith('attachment://') || /^https?:\/\//.test(val),
      'File URL must start with attachment:// or http(s)://'
    ),
  fileName: z.string().min(1).max(100).optional(),
  fileContent: z.string().max(10000).optional(),
  spoiler: z.boolean().optional(),
});

export const ThumbnailAccessorySchema = z.object({
  type: z.literal('Thumbnail'),
  url: z.string().url('Thumbnail requires a valid URL'),
  description: z.string().max(1024).optional(),
  spoiler: z.boolean().optional(),
});

export const ButtonItemSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('Button'),
    style: ButtonStyleSchema.default('Primary'),
    label: z.string().min(1, 'Button label required').max(80),
    customId: z.string().max(100).optional(),
    url: z.string().url('Button URL must be valid').optional(),
    disabled: z.boolean().optional(),
  })
  .superRefine((btn, ctx) => {
    if (btn.style === 'Link' && !btn.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Link button requires a URL',
      });
    }
    if (btn.style !== 'Link' && !btn.customId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Interactive button requires a customId',
      });
    }
  });

export const SelectOptionSchema = z.object({
  label: z.string().min(1).max(100),
  value: z.string().min(1).max(100),
  description: z.string().max(100).optional(),
  default: z.boolean().optional(),
});

export const StringSelectItemSchema = z.object({
  id: z.string().min(1),
  type: z.literal('StringSelect'),
  customId: z.string().min(1).max(100),
  placeholder: z.string().max(150).optional(),
  minValues: z.number().int().min(0).max(25).default(1),
  maxValues: z.number().int().min(1).max(25).default(1),
  disabled: z.boolean().optional(),
  options: z.array(SelectOptionSchema).min(1).max(25),
});

export const ChannelSelectItemSchema = z.object({
  id: z.string().min(1),
  type: z.literal('ChannelSelect'),
  customId: z.string().min(1).max(100),
  placeholder: z.string().max(150).optional(),
  minValues: z.number().int().min(0).max(25).default(1),
  maxValues: z.number().int().min(1).max(25).default(1),
  disabled: z.boolean().optional(),
});

export const SectionNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('Section'),
  texts: z.array(TextDisplayNodeSchema).min(1).max(3),
  accessory: z.union([ThumbnailAccessorySchema, ButtonItemSchema]),
});

export const MediaGalleryItemSchema = z.object({
  id: z.string().min(1),
  url: z.string().url('Media item requires a valid URL'),
  description: z.string().max(1024).optional(),
  spoiler: z.boolean().optional(),
});

export const MediaGalleryNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('MediaGallery'),
  items: z.array(MediaGalleryItemSchema).min(1).max(10),
});

export const ActionRowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('ActionRow'),
  components: z.union([
    z.array(ButtonItemSchema).min(1).max(5),
    z.array(StringSelectItemSchema).length(1),
    z.array(ChannelSelectItemSchema).length(1),
  ]),
});

export const ContainerChildSchema = z.discriminatedUnion('type', [
  TextDisplayNodeSchema,
  SectionNodeSchema,
  SeparatorNodeSchema,
  MediaGalleryNodeSchema,
  FileNodeSchema,
  ActionRowNodeSchema,
]);

export const ContainerNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('Container'),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Accent color must be a 6-digit hex code')
    .nullable()
    .optional(),
  spoiler: z.boolean().optional(),
  children: z.array(ContainerChildSchema).min(1, 'Container must have at least 1 child'),
});

export const TopLevelNodeSchema = z.discriminatedUnion('type', [
  ContainerNodeSchema,
  SectionNodeSchema,
  TextDisplayNodeSchema,
  SeparatorNodeSchema,
  MediaGalleryNodeSchema,
  FileNodeSchema,
  ActionRowNodeSchema,
]);

export const V2LayoutSchema = z.object({
  components: z.array(TopLevelNodeSchema).min(1, 'At least one component is required'),
});

export type TextDisplayNode = z.infer<typeof TextDisplayNodeSchema>;
export type SeparatorNode = z.infer<typeof SeparatorNodeSchema>;
export type FileNode = z.infer<typeof FileNodeSchema>;
export type ThumbnailAccessory = z.infer<typeof ThumbnailAccessorySchema>;
export type ButtonItem = z.infer<typeof ButtonItemSchema>;
export type SelectOption = z.infer<typeof SelectOptionSchema>;
export type StringSelectItem = z.infer<typeof StringSelectItemSchema>;
export type ChannelSelectItem = z.infer<typeof ChannelSelectItemSchema>;
export type SectionNode = z.infer<typeof SectionNodeSchema>;
export type MediaGalleryItem = z.infer<typeof MediaGalleryItemSchema>;
export type MediaGalleryNode = z.infer<typeof MediaGalleryNodeSchema>;
export type ActionRowNode = z.infer<typeof ActionRowNodeSchema>;
export type ContainerChild = z.infer<typeof ContainerChildSchema>;
export type ContainerNode = z.infer<typeof ContainerNodeSchema>;
export type TopLevelNode = z.infer<typeof TopLevelNodeSchema>;
export type V2Layout = z.infer<typeof V2LayoutSchema>;

export interface V2Metrics {
  componentCount: number;
  textCharCount: number;
  withinComponentLimit: boolean;
  withinCharLimit: boolean;
  isValidLimits: boolean;
}

export function countChildNode(node: ContainerChild): { components: number; chars: number } {
  switch (node.type) {
    case 'TextDisplay':
      return { components: 1, chars: node.content.length };
    case 'Separator':
      return { components: 1, chars: 0 };
    case 'MediaGallery':
      return { components: 1, chars: 0 };
    case 'File':
      return { components: 1, chars: 0 };
    case 'Section': {
      const textChars = node.texts.reduce((sum, t) => sum + t.content.length, 0);
      return { components: 1 + node.texts.length + 1, chars: textChars };
    }
    case 'ActionRow':
      return { components: 1 + node.components.length, chars: 0 };
  }
}

export function calculateV2Metrics(layout: V2Layout): V2Metrics {
  let componentCount = 0;
  let textCharCount = 0;

  for (const node of layout.components) {
    if (node.type === 'Container') {
      componentCount += 1;
      for (const child of node.children) {
        const res = countChildNode(child);
        componentCount += res.components;
        textCharCount += res.chars;
      }
    } else {
      const res = countChildNode(node);
      componentCount += res.components;
      textCharCount += res.chars;
    }
  }

  const withinComponentLimit = componentCount <= MAX_V2_COMPONENTS;
  const withinCharLimit = textCharCount <= MAX_V2_TEXT_CHARS;

  return {
    componentCount,
    textCharCount,
    withinComponentLimit,
    withinCharLimit,
    isValidLimits: withinComponentLimit && withinCharLimit,
  };
}

export const V2MessageLayoutSchema = V2LayoutSchema.superRefine((layout, ctx) => {
  const metrics = calculateV2Metrics(layout);
  if (!metrics.withinComponentLimit) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Total component count (${metrics.componentCount}) exceeds Discord limit of ${MAX_V2_COMPONENTS}`,
    });
  }
  if (!metrics.withinCharLimit) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Combined TextDisplay characters (${metrics.textCharCount}) exceeds Discord limit of ${MAX_V2_TEXT_CHARS}`,
    });
  }
});

export const TemplatePayloadSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100),
  description: z.string().max(300).optional().default(''),
  layout: V2MessageLayoutSchema,
});

export interface TemplateRecord {
  id: string;
  name: string;
  description: string;
  layout: V2Layout;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_STARTER_LAYOUT: V2Layout = {
  components: [
    {
      id: 'cont-hero',
      type: 'Container',
      accentColor: '#5865F2',
      spoiler: false,
      children: [
        {
          id: 'sec-header',
          type: 'Section',
          texts: [
            {
              id: 'txt-title',
              type: 'TextDisplay',
              content:
                '## Deadlock Indo Inhouse — Patch v2.4 Live\nQueue opens tonight at **20:00 WIB**. Read the updated lane assignment rules and verify your Steam ID before joining a lobby.',
            },
          ],
          accessory: {
            type: 'Thumbnail',
            url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300&auto=format&fit=crop&q=80',
            description: 'Tournament Banner',
          },
        },
        {
          id: 'sep-1',
          type: 'Separator',
          divider: true,
          spacing: 'Small',
        },
        {
          id: 'txt-highlights',
          type: 'TextDisplay',
          content:
            '### Key Updates\n- **Components V2 Native**: Zero legacy embeds, full interactive containers.\n- **Balanced Matchmaking**: MMR draft captain mode enabled for Tier 1 lobbies.\n- **Attached Match Config**: Download the lobby JSON ruleset via `FileBuilder` below.',
        },
        {
          id: 'gal-preview',
          type: 'MediaGallery',
          items: [
            {
              id: 'img-1',
              url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop&q=80',
              description: 'Arena Map Overview',
            },
            {
              id: 'img-2',
              url: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&auto=format&fit=crop&q=80',
              description: 'Draft Lobby Screen',
            },
          ],
        },
        {
          id: 'file-config',
          type: 'File',
          url: 'attachment://lobby-rules.json',
          fileName: 'lobby-rules.json',
          fileContent: '{\n  "region": "SEA-Jakarta",\n  "mode": "CaptainsDraft",\n  "tickrate": 64\n}',
          spoiler: false,
        },
        {
          id: 'row-actions',
          type: 'ActionRow',
          components: [
            {
              id: 'btn-checkin',
              type: 'Button',
              style: 'Primary',
              label: 'Check-In Now',
              customId: 'checkin:lobby_main',
            },
            {
              id: 'btn-role',
              type: 'Button',
              style: 'Success',
              label: 'Toggle Inhouse Ping',
              customId: 'role_toggle:123456789012345678',
            },
            {
              id: 'btn-feedback',
              type: 'Button',
              style: 'Secondary',
              label: 'Report Issue',
              customId: 'modal:feedback',
            },
            {
              id: 'btn-rules',
              type: 'Button',
              style: 'Link',
              label: 'Rulebook',
              url: 'https://github.com/ZarScape/discord.js-v2-components',
            },
          ],
        },
      ],
    },
    {
      id: 'row-region',
      type: 'ActionRow',
      components: [
        {
          id: 'sel-region',
          type: 'StringSelect',
          customId: 'select:preferred_role',
          placeholder: 'Select your primary Deadlock lane preference...',
          minValues: 1,
          maxValues: 1,
          options: [
            {
              label: 'Solo Lane (Yellow / Green)',
              value: 'solo_lane',
              description: '1v1 high-pressure laning phase',
              default: true,
            },
            {
              label: 'Duo Lane (Blue / Purple)',
              value: 'duo_lane',
              description: '2v2 coordinated soul secure & guardian push',
            },
            {
              label: 'Flex / Fill Captain',
              value: 'flex_captain',
              description: 'Willing to draft and fill any missing lane',
            },
          ],
        },
      ],
    },
    {
      id: 'row-channel',
      type: 'ActionRow',
      components: [
        {
          id: 'sel-channel',
          type: 'ChannelSelect',
          customId: 'channel_select:lobby_voice',
          placeholder: 'Select a target lobby channel (ChannelSelectMenuBuilder)...',
          minValues: 1,
          maxValues: 1,
        },
      ],
    },
  ],
};
