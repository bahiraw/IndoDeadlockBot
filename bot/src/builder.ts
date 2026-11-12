import { Buffer } from 'node:buffer';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ContainerBuilder,
  FileBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import {
  V2MessageLayoutSchema,
  type ActionRowNode,
  type ButtonItem,
  type ChannelSelectItem,
  type ContainerChild,
  type FileNode,
  type MediaGalleryNode,
  type SectionNode,
  type SeparatorNode,
  type StringSelectItem,
  type TextDisplayNode,
  type V2ButtonStyle,
  type V2Layout,
} from '@v2/shared';

export type V2TopLevelBuilder =
  | ContainerBuilder
  | SectionBuilder
  | TextDisplayBuilder
  | SeparatorBuilder
  | MediaGalleryBuilder
  | FileBuilder
  | ActionRowBuilder<MessageActionRowComponentBuilder>;

const BUTTON_STYLE_MAP: Record<V2ButtonStyle, ButtonStyle> = {
  Primary: ButtonStyle.Primary,
  Secondary: ButtonStyle.Secondary,
  Success: ButtonStyle.Success,
  Danger: ButtonStyle.Danger,
  Link: ButtonStyle.Link,
};

export function buildTextDisplay(node: TextDisplayNode): TextDisplayBuilder {
  return new TextDisplayBuilder().setContent(node.content);
}

export function buildSeparator(node: SeparatorNode): SeparatorBuilder {
  return new SeparatorBuilder()
    .setDivider(node.divider)
    .setSpacing(
      node.spacing === 'Large' ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small
    );
}

export function buildFile(node: FileNode): FileBuilder {
  const fileBuilder = new FileBuilder().setURL(node.url);
  if (node.spoiler) {
    fileBuilder.setSpoiler(true);
  }
  return fileBuilder;
}

export function buildButton(item: ButtonItem): ButtonBuilder {
  const btn = new ButtonBuilder()
    .setStyle(BUTTON_STYLE_MAP[item.style])
    .setLabel(item.label);

  if (item.disabled) {
    btn.setDisabled(true);
  }
  if (item.style === 'Link' && item.url) {
    btn.setURL(item.url);
  } else if (item.customId) {
    btn.setCustomId(item.customId);
  }
  return btn;
}

export function buildStringSelect(item: StringSelectItem): StringSelectMenuBuilder {
  const select = new StringSelectMenuBuilder()
    .setCustomId(item.customId)
    .setMinValues(item.minValues)
    .setMaxValues(item.maxValues)
    .addOptions(
      item.options.map((opt) => {
        const option = new StringSelectMenuOptionBuilder()
          .setLabel(opt.label)
          .setValue(opt.value);
        if (opt.description) option.setDescription(opt.description);
        if (opt.default) option.setDefault(true);
        return option;
      })
    );

  if (item.placeholder) select.setPlaceholder(item.placeholder);
  if (item.disabled) select.setDisabled(true);
  return select;
}

export function buildChannelSelect(item: ChannelSelectItem): ChannelSelectMenuBuilder {
  const select = new ChannelSelectMenuBuilder()
    .setCustomId(item.customId)
    .setMinValues(item.minValues)
    .setMaxValues(item.maxValues)
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement);

  if (item.placeholder) select.setPlaceholder(item.placeholder);
  if (item.disabled) select.setDisabled(true);
  return select;
}

export function buildActionRow(
  node: ActionRowNode
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>();
  const built = node.components.map((comp) => {
    if (comp.type === 'Button') return buildButton(comp);
    if (comp.type === 'ChannelSelect') return buildChannelSelect(comp);
    return buildStringSelect(comp);
  });
  row.addComponents(...built);
  return row;
}

export function buildMediaGallery(node: MediaGalleryNode): MediaGalleryBuilder {
  const gallery = new MediaGalleryBuilder();
  gallery.addItems(
    ...node.items.map((item) => {
      const media = new MediaGalleryItemBuilder().setURL(item.url);
      if (item.description) media.setDescription(item.description);
      if (item.spoiler) media.setSpoiler(true);
      return media;
    })
  );
  return gallery;
}

export function buildSection(node: SectionNode): SectionBuilder {
  const section = new SectionBuilder();
  section.addTextDisplayComponents(...node.texts.map(buildTextDisplay));

  if (node.accessory.type === 'Thumbnail') {
    const thumb = new ThumbnailBuilder().setURL(node.accessory.url);
    if (node.accessory.description) thumb.setDescription(node.accessory.description);
    if (node.accessory.spoiler) thumb.setSpoiler(true);
    section.setThumbnailAccessory(thumb);
  } else {
    section.setButtonAccessory(buildButton(node.accessory));
  }

  return section;
}

function attachContainerChild(container: ContainerBuilder, child: ContainerChild): void {
  switch (child.type) {
    case 'TextDisplay':
      container.addTextDisplayComponents(buildTextDisplay(child));
      break;
    case 'Section':
      container.addSectionComponents(buildSection(child));
      break;
    case 'Separator':
      container.addSeparatorComponents(buildSeparator(child));
      break;
    case 'MediaGallery':
      container.addMediaGalleryComponents(buildMediaGallery(child));
      break;
    case 'File':
      container.addFileComponents(buildFile(child));
      break;
    case 'ActionRow':
      container.addActionRowComponents(buildActionRow(child));
      break;
  }
}

/**
 * Extracts AttachmentBuilder instances for any FileNode using attachment://<filename>
 * following ZarScape/discord.js-v2-components conventions.
 */
export function extractAttachments(rawLayout: V2Layout): AttachmentBuilder[] {
  const attachments: AttachmentBuilder[] = [];
  const seen = new Set<string>();

  function collectFromFile(node: FileNode) {
    if (!node.url.startsWith('attachment://')) return;
    const inferredName = node.fileName || node.url.replace('attachment://', '');
    if (!inferredName || seen.has(inferredName)) return;
    seen.add(inferredName);

    const body =
      node.fileContent ??
      JSON.stringify({ generatedBy: 'discord.js-v2-components', file: inferredName }, null, 2);
    attachments.push(new AttachmentBuilder(Buffer.from(body, 'utf-8'), { name: inferredName }));
  }

  for (const node of rawLayout.components) {
    if (node.type === 'File') {
      collectFromFile(node);
    } else if (node.type === 'Container') {
      for (const child of node.children) {
        if (child.type === 'File') collectFromFile(child);
      }
    }
  }

  return attachments;
}

function deduplicateLayoutCustomIds(layout: V2Layout): V2Layout {
  const seen = new Map<string, number>();

  function uniqueId(raw: string | undefined): string | undefined {
    if (!raw) return raw;
    const count = seen.get(raw) ?? 0;
    seen.set(raw, count + 1);
    return count === 0 ? raw : `${raw}_${count + 1}`;
  }

  function fixChild(child: ContainerChild): ContainerChild {
    if (child.type === 'Section' && child.accessory.type === 'Button') {
      return {
        ...child,
        accessory: {
          ...child.accessory,
          customId: uniqueId(child.accessory.customId),
        },
      };
    }
    if (child.type === 'ActionRow') {
      const first = child.components[0];
      if (!first) return child;
      if (first.type === 'StringSelect') {
        return {
          ...child,
          components: [{ ...first, customId: uniqueId(first.customId) || first.customId }],
        };
      }
      if (first.type === 'ChannelSelect') {
        return {
          ...child,
          components: [{ ...first, customId: uniqueId(first.customId) || first.customId }],
        };
      }
      const buttons = (child.components as ButtonItem[]).map((b) => ({
        ...b,
        customId: uniqueId(b.customId),
      }));
      return {
        ...child,
        components: buttons as [ButtonItem, ...ButtonItem[]],
      };
    }
    return child;
  }

  return {
    components: layout.components.map((node) => {
      if (node.type === 'Container') {
        return {
          ...node,
          children: node.children.map(fixChild),
        };
      }
      return fixChild(node);
    }),
  };
}

/**
 * Pure compiler mapping a validated V2Layout JSON structure into Discord.js V2 Builder instances.
 * Implements the full ZarScape/discord.js-v2-components builder suite and auto-deduplicates custom_ids.
 */
export function compileV2Components(rawLayout: V2Layout): V2TopLevelBuilder[] {
  const validated = V2MessageLayoutSchema.parse(rawLayout);
  const layout = deduplicateLayoutCustomIds(validated);

  return layout.components.map((node) => {
    switch (node.type) {
      case 'Container': {
        const container = new ContainerBuilder();
        if (node.accentColor) {
          container.setAccentColor(parseInt(node.accentColor.slice(1), 16));
        }
        if (node.spoiler) {
          container.setSpoiler(true);
        }
        for (const child of node.children) {
          attachContainerChild(container, child);
        }
        return container;
      }
      case 'Section':
        return buildSection(node);
      case 'TextDisplay':
        return buildTextDisplay(node);
      case 'Separator':
        return buildSeparator(node);
      case 'MediaGallery':
        return buildMediaGallery(node);
      case 'File':
        return buildFile(node);
      case 'ActionRow':
        return buildActionRow(node);
    }
  });
}

/**
 * Builds a strict Discord Components V2 send payload (zero legacy fields).
 */
export function createV2SendPayload(layout: V2Layout) {
  const files = extractAttachments(layout);
  return {
    components: compileV2Components(layout),
    ...(files.length > 0 ? { files } : {}),
    flags: MessageFlags.IsComponentsV2 as const,
  };
}

/**
 * Builds a strict Discord Components V2 edit payload, explicitly clearing legacy content & embeds.
 */
export function createV2EditPayload(layout: V2Layout) {
  const files = extractAttachments(layout);
  return {
    content: null,
    embeds: [],
    components: compileV2Components(layout),
    ...(files.length > 0 ? { files } : {}),
    flags: MessageFlags.IsComponentsV2 as const,
  };
}

/**
 * Reference implementation of ZarScape/discord.js-v2-components showcase message:
 * Combines TextDisplayBuilder, SectionBuilder (with ThumbnailBuilder & ButtonBuilder),
 * MediaGalleryBuilder, SeparatorBuilder, FileBuilder + AttachmentBuilder,
 * ActionRowBuilder (Buttons, StringSelectMenuBuilder, ChannelSelectMenuBuilder),
 * and ContainerBuilder with MessageFlags.IsComponentsV2.
 */
export function buildZarScapeShowcasePayload() {
  const attachment = new AttachmentBuilder(
    Buffer.from(
      JSON.stringify(
        {
          repository: 'https://github.com/ZarScape/discord.js-v2-components',
          componentsV2: true,
          timestamp: new Date().toISOString(),
        },
        null,
        2
      ),
      'utf-8'
    ),
    { name: 'v2-config.json' }
  );

  const container = new ContainerBuilder()
    .setAccentColor(0x5865f2)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '# Discord.js Components V2 Showcase\nBuilt with `ContainerBuilder`, `SectionBuilder`, `TextDisplayBuilder`, `MediaGalleryBuilder`, `SeparatorBuilder`, `FileBuilder`, and `ActionRowBuilder`.'
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            '### Section + Thumbnail Accessory\nSections pair up to 3 `TextDisplayBuilder` blocks alongside a `ThumbnailBuilder` or `ButtonBuilder` accessory.'
          )
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder()
            .setURL('https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300&auto=format&fit=crop&q=80')
            .setDescription('Components V2 Thumbnail')
        ),
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            '### Section + Button Accessory\nInteractive buttons can also be mounted directly as a section accessory.'
          )
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId('showcase:section_ping')
            .setLabel('Section Action')
            .setStyle(ButtonStyle.Primary)
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large)
    )
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setURL('https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop&q=80')
          .setDescription('Showcase Gallery Item 1'),
        new MediaGalleryItemBuilder()
          .setURL('https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&auto=format&fit=crop&q=80')
          .setDescription('Showcase Gallery Item 2')
      )
    )
    .addFileComponents(new FileBuilder().setURL('attachment://v2-config.json'))
    .addActionRowComponents(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('showcase:primary')
          .setLabel('Primary Button')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('showcase:success')
          .setLabel('Success Button')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('modal:feedback')
          .setLabel('Open Modal')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setLabel('ZarScape Repo')
          .setStyle(ButtonStyle.Link)
          .setURL('https://github.com/ZarScape/discord.js-v2-components')
      ),
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('showcase:string_select')
          .setPlaceholder('Select a Components V2 builder to inspect...')
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel('ContainerBuilder')
              .setValue('ContainerBuilder')
              .setDescription('Groups V2 components with an optional accent color bar'),
            new StringSelectMenuOptionBuilder()
              .setLabel('SectionBuilder')
              .setValue('SectionBuilder')
              .setDescription('Displays text alongside a thumbnail or button accessory'),
            new StringSelectMenuOptionBuilder()
              .setLabel('FileBuilder')
              .setValue('FileBuilder')
              .setDescription('Embeds attachment:// files directly inside V2 containers')
          )
      ),
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('showcase:channel_select')
          .setPlaceholder('Pick a channel (ChannelSelectMenuBuilder)...')
          .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      )
    );

  return {
    components: [container],
    files: [attachment],
    flags: MessageFlags.IsComponentsV2 as const,
  };
}
