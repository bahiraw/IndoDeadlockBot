import './polyfill.js';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type Interaction,
  type MessageActionRowComponentBuilder,
  type ModalActionRowComponentBuilder,
} from 'discord.js';
import type { TemplateRecord, V2Layout } from '@v2/shared';
import {
  buildZarScapeShowcasePayload,
  createV2EditPayload,
  createV2SendPayload,
} from './builder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env.example') });

const dbPath = path.resolve(repoRoot, process.env.SQLITE_PATH || './data/v2builder.db');

function fetchTemplateFromSqlite(id: string): TemplateRecord | null {
  const db = new Database(dbPath, { readonly: true, fileMustExist: false });
  try {
    const row = db
      .prepare('SELECT * FROM templates WHERE id = ?')
      .get(id) as
      | {
          id: string;
          name: string;
          description: string;
          layout_json: string;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      layout: JSON.parse(row.layout_json) as V2Layout,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } finally {
    db.close();
  }
}

const commands = [
  new SlashCommandBuilder()
    .setName('v2-showcase')
    .setDescription(
      'Send the full ZarScape/discord.js-v2-components interactive showcase message'
    ),
  new SlashCommandBuilder()
    .setName('v2-send')
    .setDescription('Fetch a saved Components V2 template from SQLite and dispatch to a channel')
    .addStringOption((opt) =>
      opt.setName('id').setDescription('Template ID from the dashboard').setRequired(true)
    )
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Target text channel or thread')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.PublicThread,
          ChannelType.PrivateThread,
          ChannelType.AnnouncementThread
        )
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('v2-edit')
    .setDescription('Migrate or update an existing bot message into Components V2')
    .addStringOption((opt) =>
      opt.setName('id').setDescription('Template ID from the dashboard').setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('message_id')
        .setDescription('Message ID in the current channel')
        .setRequired(true)
    ),
].map((cmd) => cmd.toJSON());

export const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

async function registerSlashCommands(token: string, clientId: string) {
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  console.log('[Bot] Registered /v2-showcase, /v2-send, and /v2-edit slash commands.');
}

async function handleChatInputCommand(interaction: ChatInputCommandInteraction) {
  if (interaction.commandName === 'v2-showcase') {
    await interaction.reply(buildZarScapeShowcasePayload());
    return;
  }

  if (interaction.commandName === 'v2-send') {
    const templateId = interaction.options.getString('id', true);
    const channelOpt = interaction.options.getChannel('channel', true);
    const template = fetchTemplateFromSqlite(templateId);

    if (!template) {
      await interaction.reply({
        components: [
          new TextDisplayBuilder().setContent(
            `Template \`${templateId}\` was not found in SQLite.`
          ),
        ],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      return;
    }

    const targetChannel = await client.channels.fetch(channelOpt.id);
    if (!targetChannel || !targetChannel.isTextBased() || !('send' in targetChannel)) {
      await interaction.reply({
        components: [
          new TextDisplayBuilder().setContent('Selected channel is not text-sendable.'),
        ],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      return;
    }

    const dispatched = await targetChannel.send(createV2SendPayload(template.layout));

    await interaction.reply({
      components: [
        new TextDisplayBuilder().setContent(
          `Dispatched **${template.name}** (\`${template.id}\`) to <#${channelOpt.id}> — Message ID: \`${dispatched.id}\`.`
        ),
      ],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.commandName === 'v2-edit') {
    const templateId = interaction.options.getString('id', true);
    const messageId = interaction.options.getString('message_id', true);
    const template = fetchTemplateFromSqlite(templateId);

    if (!template || !interaction.channel || !interaction.channel.isTextBased()) {
      await interaction.reply({
        components: [
          new TextDisplayBuilder().setContent('Template or target channel could not be resolved.'),
        ],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      return;
    }

    const message = await interaction.channel.messages.fetch(messageId);
    await message.edit(createV2EditPayload(template.layout));

    await interaction.reply({
      components: [
        new TextDisplayBuilder().setContent(
          `Updated message \`${messageId}\` to Components V2 template **${template.name}**.`
        ),
      ],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  }
}

async function handleInteraction(interaction: Interaction) {
  if (interaction.isChatInputCommand()) {
    await handleChatInputCommand(interaction);
    return;
  }

  if (interaction.isButton()) {
    const { customId } = interaction;

    if (customId.startsWith('channel_access:')) {
      const channelId = customId.split(':')[1]?.trim();
      if (!interaction.guild || !channelId) {
        await interaction.reply({
          components: [
            new TextDisplayBuilder().setContent('Channel access is only available inside a server.'),
          ],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
        return;
      }

      const targetChannel = await interaction.guild.channels.fetch(channelId);
      if (targetChannel && 'permissionOverwrites' in targetChannel) {
        await targetChannel.permissionOverwrites.edit(interaction.user.id, {
          [PermissionFlagsBits.ViewChannel.toString()]: true,
          [PermissionFlagsBits.SendMessages.toString()]: true,
          [PermissionFlagsBits.ReadMessageHistory.toString()]: true,
        });
      }

      const jumpUrl = `https://discord.com/channels/${interaction.guild.id}/${channelId}`;
      await interaction.reply({
        components: [
          new TextDisplayBuilder().setContent(
            `Access granted to <#${channelId}>! Click below to enter the channel:`
          ),
          new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Link)
              .setLabel('Go to Channel')
              .setURL(jumpUrl)
          ),
        ],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      return;
    }

    if (customId.startsWith('role_toggle:')) {
      const [, roleId, redirectChannelId] = customId.split(':');
      if (!interaction.guild || !roleId) {
        await interaction.reply({
          components: [
            new TextDisplayBuilder().setContent('Role toggle is only available inside a guild.'),
          ],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
        return;
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);
      const hasRole = member.roles.cache.has(roleId);
      if (hasRole) {
        await member.roles.remove(roleId);
      } else {
        await member.roles.add(roleId);
      }

      const replyComponents = [
        new TextDisplayBuilder().setContent(
          `${hasRole ? 'Removed' : 'Granted'} role <@&${roleId}>.${
            !hasRole && redirectChannelId ? ` Head over to <#${redirectChannelId}>!` : ''
          }`
        ),
      ];

      if (!hasRole && redirectChannelId) {
        const jumpUrl = `https://discord.com/channels/${interaction.guild.id}/${redirectChannelId}`;
        replyComponents.push(
          new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Link)
              .setLabel('Open Hidden Channel')
              .setURL(jumpUrl)
          ) as unknown as TextDisplayBuilder
        );
      }

      await interaction.reply({
        components: replyComponents,
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      return;
    }

    if (customId.startsWith('modal:')) {
      const topic = customId.split(':')[1] || 'general';
      const modal = new ModalBuilder()
        .setCustomId(`v2_modal:${topic}`)
        .setTitle('Submit Feedback');

      const input = new TextInputBuilder()
        .setCustomId('details')
        .setLabel('Details')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input)
      );
      await interaction.showModal(modal);
      return;
    }

    await interaction.reply({
      components: [
        new TextDisplayBuilder().setContent(
          `Acknowledged interaction for button \`${customId}\`.`
        ),
      ],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.isStringSelectMenu()) {
    const chosen = interaction.values.join(', ');
    await interaction.reply({
      components: [
        new TextDisplayBuilder().setContent(
          `Recorded selection on \`${interaction.customId}\`: **${chosen}**`
        ),
      ],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.isChannelSelectMenu()) {
    const channels = interaction.values.map((id) => `<#${id}>`).join(', ');
    await interaction.reply({
      components: [
        new TextDisplayBuilder().setContent(
          `Selected channel(s) on \`${interaction.customId}\`: ${channels}`
        ),
      ],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('v2_modal:')) {
    const details = interaction.fields.getTextInputValue('details');
    await interaction.reply({
      components: [
        new TextDisplayBuilder().setContent(`Submission received:\n> ${details}`),
      ],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[Bot] Connected as ${readyClient.user.tag}`);
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  if (token && clientId && token !== 'your_bot_token_here') {
    await registerSlashCommands(token, clientId);
  }
});

client.on(Events.InteractionCreate, (interaction) => {
  handleInteraction(interaction).catch((err) => {
    console.error('[Bot] Interaction handler error:', err);
  });
});

const token = process.env.DISCORD_TOKEN;
if (token && token !== 'your_bot_token_here') {
  client.login(token).catch((err) => {
    console.error('[Bot] Failed to login:', err);
  });
} else {
  console.warn(
    '[Bot] DISCORD_TOKEN is not configured yet. Update .env to connect the live Discord gateway.'
  );
}
