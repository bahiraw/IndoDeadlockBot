import '@v2/bot/polyfill';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ChannelType, MessageFlags } from 'discord.js';
import { TemplatePayloadSchema, V2MessageLayoutSchema } from '@v2/shared';
import { compileV2Components } from '@v2/bot/builder';
import {
  createTemplate,
  deleteTemplate,
  getTemplateById,
  listTemplates,
  updateTemplate,
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env.example') });

const PORT = Number(process.env.PORT || 3001);
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173';
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || '';
const CLIENT_ID = process.env.CLIENT_ID || '';
const CLIENT_SECRET = process.env.CLIENT_SECRET || '';
const REDIRECT_URI =
  process.env.REDIRECT_URI || `http://localhost:${PORT}/api/auth/callback`;
const SESSION_SECRET = process.env.SESSION_SECRET || 'v2_dispatcher_dev_secret';

interface DiscordSession {
  userId: string;
  username: string;
  avatar: string | null;
  accessToken: string;
  expiresAt: number;
}

const sessions = new Map<string, DiscordSession>();

function signSessionId(id: string): string {
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(id)
    .digest('hex');
  return `${id}.${sig}`;
}

function verifySessionCookie(raw: string | undefined): DiscordSession | null {
  if (!raw) return null;
  const [id, sig] = raw.split('.');
  if (!id || !sig) return null;
  const expected = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(id)
    .digest('hex');
  if (sig !== expected) return null;
  const session = sessions.get(id);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(id);
    return null;
  }
  return session;
}

const hasRealBotToken =
  Boolean(DISCORD_TOKEN) && DISCORD_TOKEN !== 'your_bot_token_here';

const app = express();
app.use(cors({ origin: WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// --- Discord OAuth2 Routes ---

app.get('/api/auth/login', (_req: Request, res: Response) => {
  if (!CLIENT_ID || CLIENT_ID === 'your_discord_client_id') {
    res.status(400).json({
      error: 'CLIENT_ID is not configured in .env yet.',
    });
    return;
  }
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});

app.get('/api/auth/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.status(400).json({ error: 'Missing OAuth2 code' });
    return;
  }

  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!tokenRes.ok) {
    res.status(401).json({ error: 'OAuth2 token exchange failed' });
    return;
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    expires_in: number;
  };
  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userRes.ok) {
    res.status(401).json({ error: 'Failed to fetch Discord user profile' });
    return;
  }

  const user = (await userRes.json()) as {
    id: string;
    username: string;
    avatar: string | null;
  };
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, {
    userId: user.id,
    username: user.username,
    avatar: user.avatar,
    accessToken: tokenData.access_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000,
  });

  res.cookie('v2_session', signSessionId(sessionId), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: tokenData.expires_in * 1000,
  });
  res.redirect(WEB_ORIGIN);
});

app.get('/api/auth/session', (req: Request, res: Response) => {
  const session = verifySessionCookie(req.cookies?.v2_session);
  if (!session) {
    res.json({
      authenticated: false,
      botConfigured: hasRealBotToken,
      user: null,
    });
    return;
  }
  res.json({
    authenticated: true,
    botConfigured: hasRealBotToken,
    user: {
      id: session.userId,
      username: session.username,
      avatar: session.avatar,
    },
  });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const raw = req.cookies?.v2_session as string | undefined;
  if (raw) sessions.delete(raw.split('.')[0]);
  res.clearCookie('v2_session');
  res.json({ ok: true });
});

// --- Guilds & Channels Discovery ---

app.get('/api/guilds', async (req: Request, res: Response) => {
  const session = verifySessionCookie(req.cookies?.v2_session);

  if (!hasRealBotToken) {
    // Provide mock guilds in local preview mode when bot token is not yet configured
    res.json([
      { id: 'guild_indo_deadlock', name: 'Indo Deadlock Official (Preview)', icon: null },
      { id: 'guild_scrim_hub', name: 'SEA Competitive Scrims (Preview)', icon: null },
    ]);
    return;
  }

  const botGuildRes = await fetch('https://discord.com/api/v10/users/@me/guilds', {
    headers: { Authorization: `Bot ${DISCORD_TOKEN}` },
  });

  if (!botGuildRes.ok) {
    res.status(botGuildRes.status).json({ error: 'Failed to fetch bot guilds' });
    return;
  }

  const botGuilds = (await botGuildRes.json()) as Array<{
    id: string;
    name: string;
    icon: string | null;
  }>;

  if (session) {
    const userGuildRes = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (userGuildRes.ok) {
      const userGuilds = (await userGuildRes.json()) as Array<{ id: string }>;
      const userGuildIds = new Set(userGuilds.map((g) => g.id));
      res.json(botGuilds.filter((g) => userGuildIds.has(g.id)));
      return;
    }
  }

  res.json(botGuilds);
});

app.get('/api/guilds/:id/channels', async (req: Request, res: Response) => {
  const guildId = String(req.params.id);

  if (!hasRealBotToken || guildId.startsWith('guild_')) {
    res.json([
      { id: 'ch_announcements', name: 'announcements', type: ChannelType.GuildAnnouncement },
      { id: 'ch_inhouse_queue', name: 'inhouse-queue', type: ChannelType.GuildText },
      { id: 'ch_patch_notes', name: 'patch-notes-v2', type: ChannelType.GuildText },
      { id: 'ch_role_select', name: 'role-assignment', type: ChannelType.GuildText },
    ]);
    return;
  }

  const [chRes, thRes] = await Promise.all([
    fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${DISCORD_TOKEN}` },
    }),
    fetch(`https://discord.com/api/v10/guilds/${guildId}/threads/active`, {
      headers: { Authorization: `Bot ${DISCORD_TOKEN}` },
    }),
  ]);

  if (!chRes.ok) {
    res.status(chRes.status).json({ error: 'Failed to fetch guild channels' });
    return;
  }

  const channels = (await chRes.json()) as Array<{
    id: string;
    name: string;
    type: number;
  }>;

  const sendable = channels.filter(
    (c) => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement
  );

  if (thRes.ok) {
    const threadData = (await thRes.json()) as {
      threads?: Array<{ id: string; name: string; type: number }>;
    };
    for (const thread of threadData.threads ?? []) {
      sendable.push({
        id: thread.id,
        name: `🧵 ${thread.name}`,
        type: thread.type,
      });
    }
  }

  res.json(sendable);
});

// --- Templates CRUD ---

app.get('/api/templates', (_req: Request, res: Response) => {
  res.json(listTemplates());
});

app.post('/api/templates', (req: Request, res: Response) => {
  const parsed = TemplatePayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const id = crypto.randomUUID().slice(0, 8);
  const created = createTemplate(
    id,
    parsed.data.name,
    parsed.data.description,
    parsed.data.layout
  );
  res.status(201).json(created);
});

app.put('/api/templates/:id', (req: Request, res: Response) => {
  const parsed = TemplatePayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const updated = updateTemplate(
    String(req.params.id),
    parsed.data.name,
    parsed.data.description,
    parsed.data.layout
  );
  if (!updated) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  res.json(updated);
});

app.delete('/api/templates/:id', (req: Request, res: Response) => {
  const ok = deleteTemplate(String(req.params.id));
  if (!ok) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  res.status(204).send();
});

// --- Direct Bot Dispatch Endpoint ---

app.post('/api/templates/:id/dispatch', async (req: Request, res: Response) => {
  const templateId = String(req.params.id);
  const { channelId, messageId, layoutOverride } = req.body as {
    channelId?: string;
    messageId?: string;
    layoutOverride?: unknown;
  };

  if (!channelId) {
    res.status(400).json({ error: 'channelId is required' });
    return;
  }

  let targetLayout = getTemplateById(templateId)?.layout;
  if (layoutOverride) {
    const validated = V2MessageLayoutSchema.safeParse(layoutOverride);
    if (!validated.success) {
      res.status(400).json({ error: validated.error.flatten() });
      return;
    }
    targetLayout = validated.data;
  }

  if (!targetLayout) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  const compiledBuilders = compileV2Components(targetLayout);
  const serializedComponents = compiledBuilders.map((b) => b.toJSON());

  // Enforce strict Discord Components V2 payload contract
  const wirePayload = messageId
    ? {
        content: null,
        embeds: [],
        components: serializedComponents,
        flags: MessageFlags.IsComponentsV2,
      }
    : {
        components: serializedComponents,
        flags: MessageFlags.IsComponentsV2,
      };

  if (!hasRealBotToken || channelId.startsWith('ch_')) {
    res.json({
      simulated: true,
      channelId,
      flags: MessageFlags.IsComponentsV2,
      payload: wirePayload,
      message:
        'Compiled V2 payload verified (simulation mode — set DISCORD_TOKEN in .env for live Discord gateway dispatch).',
    });
    return;
  }

  const endpoint = messageId
    ? `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`
    : `https://discord.com/api/v10/channels/${channelId}/messages`;

  const discordRes = await fetch(endpoint, {
    method: messageId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bot ${DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(wirePayload),
  });

  const data = await discordRes.json();
  if (!discordRes.ok) {
    res.status(discordRes.status).json({ error: data });
    return;
  }

  res.json({
    simulated: false,
    messageId: (data as { id: string }).id,
    channelId,
    flags: MessageFlags.IsComponentsV2,
  });
});

app.listen(PORT, () => {
  console.log(`[Server] Discord Components V2 API listening on http://localhost:${PORT}`);
});
