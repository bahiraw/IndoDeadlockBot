import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bot,
  CheckCircle2,
  ChevronDown,
  Code2,
  ExternalLink,
  FileCode2,
  FolderKanban,
  GripVertical,
  Hash,
  Image as ImageIcon,
  Layers,
  LayoutPanelTop,
  Minus,
  MousePointerClick,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Type,
} from 'lucide-react';
import {
  calculateV2Metrics,
  DEFAULT_STARTER_LAYOUT,
  MAX_V2_COMPONENTS,
  MAX_V2_TEXT_CHARS,
  V2MessageLayoutSchema,
  type ActionRowNode,
  type ButtonItem,
  type ChannelSelectItem,
  type ContainerChild,
  type ContainerNode,
  type FileNode,
  type MediaGalleryNode,
  type SectionNode,
  type SeparatorNode,
  type StringSelectItem,
  type TemplateRecord,
  type TextDisplayNode,
  type TopLevelNode,
  type V2ButtonStyle,
  type V2Layout,
} from '@v2/shared';

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultChild(type: ContainerChild['type']): ContainerChild {
  switch (type) {
    case 'TextDisplay':
      return {
        id: uid('txt'),
        type: 'TextDisplay',
        content: '### New Text Display\nWrite clean Discord markdown here.',
      };
    case 'Separator':
      return {
        id: uid('sep'),
        type: 'Separator',
        divider: true,
        spacing: 'Small',
      };
    case 'File':
      return {
        id: uid('file'),
        type: 'File',
        url: 'attachment://example.json',
        fileName: 'example.json',
        fileContent: '{\n  "componentsV2": true\n}',
        spoiler: false,
      };
    case 'Section':
      return {
        id: uid('sec'),
        type: 'Section',
        texts: [
          {
            id: uid('txt'),
            type: 'TextDisplay',
            content:
              '**Section Header**\nPair up to 3 text blocks with a Thumbnail or Button accessory.',
          },
        ],
        accessory: {
          type: 'Thumbnail',
          url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80',
          description: 'Section Thumbnail',
        },
      };
    case 'MediaGallery':
      return {
        id: uid('gal'),
        type: 'MediaGallery',
        items: [
          {
            id: uid('img'),
            url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80',
            description: 'Gallery Image',
          },
        ],
      };
    case 'ActionRow':
      return {
        id: uid('row'),
        type: 'ActionRow',
        components: [
          {
            id: uid('btn'),
            type: 'Button',
            style: 'Primary',
            label: 'Confirm Action',
            customId: `action:${uid('btn')}`,
          },
        ],
      };
  }
}

function createDefaultTopLevel(type: TopLevelNode['type']): TopLevelNode {
  if (type === 'Container') {
    return {
      id: uid('cont'),
      type: 'Container',
      accentColor: '#5865F2',
      spoiler: false,
      children: [
        createDefaultChild('Section'),
        createDefaultChild('Separator'),
        createDefaultChild('File'),
        createDefaultChild('ActionRow'),
      ],
    };
  }
  return createDefaultChild(type);
}

interface GuildItem {
  id: string;
  name: string;
}

interface ChannelItem {
  id: string;
  name: string;
  type: number;
}

function renderDiscordMarkdown(raw: string): React.ReactNode {
  const lines = raw.split('\n');
  return lines.map((line, idx) => {
    const key = `${idx}-${line.slice(0, 12)}`;
    if (line.startsWith('### ')) {
      return (
        <h3 key={key} className="text-[15px] font-bold text-white leading-snug mt-1 mb-0.5">
          {formatInline(line.slice(4))}
        </h3>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <h2 key={key} className="text-[18px] font-bold text-white leading-snug mt-1 mb-1">
          {formatInline(line.slice(3))}
        </h2>
      );
    }
    if (line.startsWith('# ')) {
      return (
        <h1 key={key} className="text-[21px] font-extrabold text-white leading-tight mt-1 mb-1">
          {formatInline(line.slice(2))}
        </h1>
      );
    }
    if (line.startsWith('- ')) {
      return (
        <div
          key={key}
          className="flex items-start gap-2 text-[14px] text-[#dbdee1] leading-relaxed pl-1"
        >
          <span className="text-[#949ba4] select-none">•</span>
          <span>{formatInline(line.slice(2))}</span>
        </div>
      );
    }
    if (line.trim() === '') {
      return <div key={key} className="h-2" />;
    }
    return (
      <p key={key} className="text-[14px] text-[#dbdee1] leading-relaxed">
        {formatInline(line)}
      </p>
    );
  });
}

function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded bg-[#1e1f22] text-[#eb459e] font-mono text-[12.5px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

const DISCORD_BTN_CLASSES: Record<V2ButtonStyle, string> = {
  Primary: 'bg-[#5865F2] hover:bg-[#4752C4] text-white',
  Secondary: 'bg-[#4e5058] hover:bg-[#6d6f78] text-white',
  Success: 'bg-[#248046] hover:bg-[#1a6334] text-white',
  Danger: 'bg-[#da373c] hover:bg-[#a1282c] text-white',
  Link: 'bg-[#4e5058] hover:bg-[#6d6f78] text-white',
};

export default function App() {
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('Deadlock Indo Inhouse Hub');
  const [templateDesc, setTemplateDesc] = useState(
    'Production V2 announcement & role dispatcher card'
  );
  const [layout, setLayout] = useState<V2Layout>(DEFAULT_STARTER_LAYOUT);

  const [guilds, setGuilds] = useState<GuildItem[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState<string>('');
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [customTargetId, setCustomTargetId] = useState<string>('');
  const [editMessageId, setEditMessageId] = useState<string>('');

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    kind: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);

  const metrics = useMemo(() => calculateV2Metrics(layout), [layout]);
  const validation = useMemo(() => V2MessageLayoutSchema.safeParse(layout), [layout]);

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedGuildId) return;
    fetch(`/api/guilds/${selectedGuildId}/channels`)
      .then((r) => r.json())
      .then((data: ChannelItem[]) => {
        if (Array.isArray(data)) {
          setChannels(data);
          if (data.length > 0) setSelectedChannelId(data[0].id);
        }
      })
      .catch(() => setChannels([]));
  }, [selectedGuildId]);

  async function loadInitialData() {
    try {
      const [tplRes, gRes] = await Promise.all([
        fetch('/api/templates'),
        fetch('/api/guilds'),
      ]);
      if (tplRes.ok) {
        const list = (await tplRes.json()) as TemplateRecord[];
        setTemplates(list);
        if (list.length > 0) {
          selectTemplateRecord(list[0]);
        }
      }
      if (gRes.ok) {
        const gList = (await gRes.json()) as GuildItem[];
        if (Array.isArray(gList) && gList.length > 0) {
          setGuilds(gList);
          setSelectedGuildId(gList[0].id);
        }
      }
    } catch {
      // Offline fallback uses DEFAULT_STARTER_LAYOUT
    }
  }

  function selectTemplateRecord(t: TemplateRecord) {
    setActiveTemplateId(t.id);
    setTemplateName(t.name);
    setTemplateDesc(t.description);
    setLayout(t.layout);
  }

  function handleNewTemplate() {
    setActiveTemplateId(null);
    setTemplateName('Untitled V2 Template');
    setTemplateDesc('Custom Components V2 layout');
    setLayout({
      components: [createDefaultTopLevel('Container')],
    });
    setStatusBanner({ kind: 'ok', text: 'Initialized a clean Components V2 draft.' });
  }

  async function handleSaveTemplate() {
    if (!validation.success) {
      setStatusBanner({
        kind: 'err',
        text: validation.error.issues[0]?.message || 'Validation failed',
      });
      return;
    }

    setIsSaving(true);
    setStatusBanner(null);
    try {
      const isUpdating = Boolean(activeTemplateId);
      const url = isUpdating ? `/api/templates/${activeTemplateId}` : '/api/templates';
      const method = isUpdating ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          description: templateDesc,
          layout,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(JSON.stringify(errData.error || 'Failed to save template'));
      }

      const saved = (await res.json()) as TemplateRecord;
      setActiveTemplateId(saved.id);
      const refreshed = await fetch('/api/templates').then((r) => r.json());
      setTemplates(refreshed);
      setStatusBanner({
        kind: 'ok',
        text: `Saved template "${saved.name}" (ID: ${saved.id}) to SQLite.`,
      });
    } catch (err) {
      setStatusBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Save error',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteTemplate(id: string) {
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const next = templates.filter((t) => t.id !== id);
        setTemplates(next);
        if (next.length > 0) {
          selectTemplateRecord(next[0]);
        } else {
          handleNewTemplate();
        }
        setStatusBanner({ kind: 'ok', text: `Deleted template ${id}.` });
      }
    } catch {
      setStatusBanner({ kind: 'err', text: 'Failed to delete template.' });
    }
  }

  async function handleDispatch() {
    const rawTarget = customTargetId.trim() || selectedChannelId;
    const resolvedChannelId = rawTarget.includes('discord.com/channels/')
      ? rawTarget.split('/').filter(Boolean).pop() || ''
      : rawTarget;

    if (!resolvedChannelId) {
      setStatusBanner({
        kind: 'err',
        text: 'Please select a channel/thread or paste a Thread ID/URL first.',
      });
      return;
    }
    if (!validation.success) {
      setStatusBanner({
        kind: 'err',
        text: validation.error.issues[0]?.message || 'Fix schema errors before sending.',
      });
      return;
    }

    setIsDispatching(true);
    setStatusBanner(null);
    try {
      const targetId = activeTemplateId || 'draft';
      const res = await fetch(`/api/templates/${targetId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: resolvedChannelId,
          messageId: editMessageId.trim() || undefined,
          layoutOverride: layout,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string' ? data.error : JSON.stringify(data.error)
        );
      }

      setStatusBanner({
        kind: 'ok',
        text: data.simulated
          ? `V2 Compiler verified! Flag IsComponentsV2 (${data.flags}) ready for #${resolvedChannelId}.`
          : `Dispatched live Components V2 message (${data.messageId}) to target (${resolvedChannelId})!`,
      });
    } catch (err) {
      setStatusBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Failed to dispatch message',
      });
    } finally {
      setIsDispatching(false);
    }
  }

  function updateTopLevel(index: number, nextNode: TopLevelNode) {
    setLayout((prev) => {
      const copy = [...prev.components];
      copy[index] = nextNode;
      return { components: copy };
    });
  }

  function removeTopLevel(index: number) {
    setLayout((prev) => ({
      components: prev.components.filter((_, i) => i !== index),
    }));
  }

  function moveTopLevel(from: number, to: number) {
    setLayout((prev) => {
      if (to < 0 || to >= prev.components.length) return prev;
      const copy = [...prev.components];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return { components: copy };
    });
  }

  function addTopLevel(type: TopLevelNode['type']) {
    setLayout((prev) => ({
      components: [...prev.components, createDefaultTopLevel(type)],
    }));
  }

  const compPercent = Math.min(100, (metrics.componentCount / MAX_V2_COMPONENTS) * 100);
  const charPercent = Math.min(100, (metrics.textCharCount / MAX_V2_TEXT_CHARS) * 100);

  return (
    <div className="min-h-screen flex flex-col bg-[#111214] text-zinc-100">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-[#18191c]/95 backdrop-blur px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#5865F2] flex items-center justify-center shadow-lg shadow-[#5865F2]/25">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base tracking-tight text-white">
                Discord Components V2 Dispatcher
              </h1>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#5865F2]/20 text-[#949cf7] border border-[#5865F2]/30">
                MessageFlags.IsComponentsV2
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              ZarScape/discord.js-v2-components • 40-component & 4,000-character compiler guard
            </p>
          </div>
        </div>

        {/* Real-time API Limit Meters */}
        <div className="flex items-center gap-6">
          <div className="w-44">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-zinc-400 font-medium">Total Components</span>
              <span
                className={`font-mono font-bold ${
                  !metrics.withinComponentLimit
                    ? 'text-red-400'
                    : metrics.componentCount > 32
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {metrics.componentCount}/{MAX_V2_COMPONENTS}
              </span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${
                  !metrics.withinComponentLimit
                    ? 'bg-red-500'
                    : metrics.componentCount > 32
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${compPercent}%` }}
              />
            </div>
          </div>

          <div className="w-48">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-zinc-400 font-medium">TextDisplay Chars</span>
              <span
                className={`font-mono font-bold ${
                  !metrics.withinCharLimit
                    ? 'text-red-400'
                    : metrics.textCharCount > 3400
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {metrics.textCharCount}/{MAX_V2_TEXT_CHARS}
              </span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${
                  !metrics.withinCharLimit
                    ? 'bg-red-500'
                    : metrics.textCharCount > 3400
                    ? 'bg-amber-500'
                    : 'bg-[#5865F2]'
                }`}
                style={{ width: `${charPercent}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowJsonModal((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 border border-zinc-700 cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5" />
            {showJsonModal ? 'Hide V2 JSON' : 'Inspect JSON'}
          </button>
        </div>
      </header>

      {/* Status Alert Banner */}
      {statusBanner && (
        <div
          className={`px-6 py-2.5 text-xs font-medium flex items-center justify-between border-b ${
            statusBanner.kind === 'ok'
              ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-200'
              : 'bg-red-950/60 border-red-800/60 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusBanner.kind === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{statusBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-zinc-400 hover:text-white cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main 3-Column Studio */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0">
        {/* Left Sidebar: Saved Templates & Bot Dispatch */}
        <aside className="lg:col-span-3 border-r border-zinc-800/80 bg-[#16171a] p-4 flex flex-col gap-5 overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-[#5865F2]" />
                Saved SQLite Templates
              </span>
              <button
                type="button"
                onClick={handleNewTemplate}
                className="text-xs px-2 py-1 rounded bg-[#5865F2]/15 hover:bg-[#5865F2]/25 text-[#949cf7] font-medium flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> New
              </button>
            </div>

            <div className="space-y-1.5">
              {templates.map((t) => {
                const isSelected = t.id === activeTemplateId;
                return (
                  <div
                    key={t.id}
                    onClick={() => selectTemplateRecord(t)}
                    className={`group p-2.5 rounded-lg border transition cursor-pointer flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-[#5865F2]/15 border-[#5865F2]/50 text-white'
                        : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{t.name}</div>
                      <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                        ID: {t.id}
                      </div>
                    </div>
                    {templates.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteTemplate(t.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 p-1 cursor-pointer"
                        title="Delete template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Template Metadata & Save */}
          <div className="border-t border-zinc-800 pt-4 space-y-3">
            <label className="block">
              <span className="text-xs text-zinc-400 font-medium">Template Name</span>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:border-[#5865F2]"
              />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-400 font-medium">Description</span>
              <input
                type="text"
                value={templateDesc}
                onChange={(e) => setTemplateDesc(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 focus:outline-none focus:border-[#5865F2]"
              />
            </label>

            <button
              type="button"
              disabled={isSaving || !metrics.isValidLimits}
              onClick={handleSaveTemplate}
              className="w-full py-2 px-3 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving
                ? 'Saving...'
                : activeTemplateId
                ? `Update Template (${activeTemplateId})`
                : 'Save New Template'}
            </button>
          </div>

          {/* Channel Target & One-Click Bot Dispatch */}
          <div className="border-t border-zinc-800 pt-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-[#5865F2]" />
              Bot Channel Dispatcher
            </div>

            <label className="block">
              <span className="text-xs text-zinc-400">Discord Server (Guild)</span>
              <select
                value={selectedGuildId}
                onChange={(e) => setSelectedGuildId(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-xs text-white"
              >
                {guilds.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-zinc-400">Target Channel or Active Thread</span>
              <div className="relative mt-1">
                <select
                  value={selectedChannelId}
                  onChange={(e) => setSelectedChannelId(e.target.value)}
                  className="w-full pl-7 pr-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-xs text-white"
                >
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Hash className="w-3.5 h-3.5 text-zinc-400 absolute left-2 top-2 pointer-events-none" />
              </div>
            </label>

            <label className="block">
              <span className="text-xs text-zinc-400">
                Or Paste Thread Link / Thread ID{' '}
                <span className="text-zinc-500">(overrides dropdown)</span>
              </span>
              <input
                type="text"
                placeholder="https://discord.com/channels/... or Thread ID"
                value={customTargetId}
                onChange={(e) => setCustomTargetId(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 placeholder:text-zinc-600"
              />
            </label>

            <label className="block">
              <span className="text-xs text-zinc-400">
                Edit Existing Message ID <span className="text-zinc-500">(optional)</span>
              </span>
              <input
                type="text"
                placeholder="Leave blank to send a new message"
                value={editMessageId}
                onChange={(e) => setEditMessageId(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 placeholder:text-zinc-600"
              />
            </label>

            <button
              type="button"
              disabled={isDispatching || !metrics.isValidLimits}
              onClick={handleDispatch}
              className="w-full py-2.5 px-3 rounded-md bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#5865F2]/25 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              {isDispatching
                ? 'Dispatching V2 Payload...'
                : editMessageId.trim()
                ? 'Edit Message into V2'
                : 'Send via Bot'}
            </button>

            <div className="p-2.5 rounded bg-zinc-900/90 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
              <div className="font-semibold text-zinc-300 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Slash Commands Ready
              </div>
              <div className="font-mono text-[10.5px] text-zinc-300 bg-black/40 px-2 py-1 rounded">
                /v2-showcase
              </div>
              <div className="font-mono text-[10.5px] text-zinc-300 bg-black/40 px-2 py-1 rounded">
                /v2-send id:{activeTemplateId || 'deadlock-v2'} channel:#inhouse-queue
              </div>
            </div>
          </div>
        </aside>

        {/* Center Column: Drag & Reorder Block Stacker */}
        <main className="lg:col-span-5 border-r border-zinc-800/80 bg-[#121316] p-5 overflow-y-auto space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#5865F2]" />
                Components V2 Block Stacker
              </h2>
              <p className="text-xs text-zinc-400">
                Drag blocks or use arrows to reorder top-level and nested container elements.
              </p>
            </div>
          </div>

          {/* Add Top-Level Block Palette */}
          <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/90">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              + Append Top-Level V2 Component
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { type: 'Container', icon: LayoutPanelTop, label: 'Container' },
                  { type: 'Section', icon: Sparkles, label: 'Section + Accessory' },
                  { type: 'TextDisplay', icon: Type, label: 'TextDisplay' },
                  { type: 'Separator', icon: Minus, label: 'Separator' },
                  { type: 'MediaGallery', icon: ImageIcon, label: 'MediaGallery' },
                  { type: 'File', icon: FileCode2, label: 'FileBuilder' },
                  { type: 'ActionRow', icon: MousePointerClick, label: 'ActionRow' },
                ] as const
              ).map(({ type, icon: Icon, label }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => addTopLevel(type)}
                  className="px-2.5 py-1.5 rounded-md bg-zinc-800 hover:bg-[#5865F2] text-zinc-200 hover:text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Validation Warning Box */}
          {!validation.success && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/70 text-xs text-red-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-red-300">
                <AlertTriangle className="w-4 h-4" />
                Zod V2 Contract Violations:
              </div>
              <ul className="list-disc list-inside space-y-0.5">
                {validation.error.issues.map((iss, idx) => (
                  <li key={idx}>
                    {iss.path.length > 0 ? `${iss.path.join('.')}: ` : ''}
                    {iss.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Stacked Top-Level Nodes */}
          <div className="space-y-3">
            {layout.components.map((node, index) => (
              <div
                key={node.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null && dragIndex !== index) {
                    moveTopLevel(dragIndex, index);
                  }
                  setDragIndex(null);
                }}
                className="rounded-xl bg-[#18191d] border border-zinc-800 hover:border-zinc-700 transition p-3.5 space-y-3"
              >
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800/80">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-zinc-500 cursor-grab" />
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide bg-[#5865F2]/20 text-[#949cf7]">
                      {node.type}
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono">{node.id}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveTopLevel(index, index - 1)}
                      disabled={index === 0}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-400 disabled:opacity-30 cursor-pointer"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTopLevel(index, index + 1)}
                      disabled={index === layout.components.length - 1}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-400 disabled:opacity-30 cursor-pointer"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTopLevel(index)}
                      disabled={layout.components.length <= 1}
                      className="p-1 rounded hover:bg-red-950/60 text-zinc-400 hover:text-red-400 disabled:opacity-30 cursor-pointer"
                      title="Remove block"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {node.type === 'Container' ? (
                  <ContainerEditor
                    node={node}
                    onChange={(updated) => updateTopLevel(index, updated)}
                  />
                ) : (
                  <ChildNodeEditor
                    node={node}
                    onChange={(updated) => updateTopLevel(index, updated)}
                  />
                )}
              </div>
            ))}
          </div>
        </main>

        {/* Right Column: High-Fidelity Discord Dark-Mode Live Preview */}
        <section className="lg:col-span-4 bg-[#313338] p-5 overflow-y-auto flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#3f4147]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#dbdee1]">
                Discord Client V2 Live Preview
              </h2>
            </div>
            <span className="text-[11px] font-mono text-[#949ba4]">
              flags: 32768 (1 &lt;&lt; 15)
            </span>
          </div>

          {showJsonModal && (
            <pre className="mb-4 p-3 rounded-lg bg-[#1e1f22] text-[11px] text-emerald-300 font-mono overflow-x-auto max-h-64 border border-zinc-700">
              {JSON.stringify(
                {
                  flags: 32768,
                  components: layout.components,
                },
                null,
                2
              )}
            </pre>
          )}

          {/* Simulated Discord Message Row */}
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center shrink-0 text-white font-bold shadow">
              V2
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[15px] text-white hover:underline cursor-pointer">
                  IndoDeadlock Dispatcher
                </span>
                <span className="px-1.5 py-0.2 rounded bg-[#5865F2] text-white text-[10px] font-bold uppercase tracking-wide">
                  APP
                </span>
                <span className="text-[11px] text-[#949ba4] ml-1">Today at 20:00</span>
              </div>

              <div className="space-y-2.5 max-w-[520px]">
                {layout.components.map((node) => (
                  <DiscordNodePreview key={node.id} node={node} />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ============================================================================
 * Container & Child Block Editors
 * ========================================================================== */

function ContainerEditor({
  node,
  onChange,
}: {
  node: ContainerNode;
  onChange: (next: ContainerNode) => void;
}) {
  function updateChild(idx: number, nextChild: ContainerChild) {
    const children = [...node.children];
    children[idx] = nextChild;
    onChange({ ...node, children });
  }

  function removeChild(idx: number) {
    if (node.children.length <= 1) return;
    onChange({
      ...node,
      children: node.children.filter((_, i) => i !== idx),
    });
  }

  function moveChild(from: number, to: number) {
    if (to < 0 || to >= node.children.length) return;
    const copy = [...node.children];
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
    onChange({ ...node, children: copy });
  }

  function appendChild(type: ContainerChild['type']) {
    onChange({
      ...node,
      children: [...node.children, createDefaultChild(type)],
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 bg-zinc-900/90 p-2.5 rounded-lg border border-zinc-800">
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <span>Accent Color:</span>
          <input
            type="color"
            value={node.accentColor || '#5865F2'}
            onChange={(e) => onChange({ ...node, accentColor: e.target.value })}
            className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
          />
          <input
            type="text"
            value={node.accentColor || ''}
            placeholder="#5865F2"
            onChange={(e) =>
              onChange({
                ...node,
                accentColor: e.target.value ? e.target.value : null,
              })
            }
            className="w-24 px-2 py-1 rounded bg-zinc-950 border border-zinc-700 font-mono text-xs text-white"
          />
        </label>

        <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={Boolean(node.spoiler)}
            onChange={(e) => onChange({ ...node, spoiler: e.target.checked })}
          />
          Spoiler Container
        </label>
      </div>

      <div className="pl-3 border-l-2 border-[#5865F2]/60 space-y-2.5">
        {node.children.map((child, idx) => (
          <div
            key={child.id}
            className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/90 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5865F2]" />
                {child.type}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveChild(idx, idx - 1)}
                  disabled={idx === 0}
                  className="p-0.5 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => moveChild(idx, idx + 1)}
                  disabled={idx === node.children.length - 1}
                  className="p-0.5 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => removeChild(idx)}
                  disabled={node.children.length <= 1}
                  className="p-0.5 text-zinc-400 hover:text-red-400 disabled:opacity-30 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            <ChildNodeEditor
              node={child}
              onChange={(updated) => updateChild(idx, updated)}
            />
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] text-zinc-400 mr-1">+ Child:</span>
          {(
            ['Section', 'TextDisplay', 'Separator', 'MediaGallery', 'File', 'ActionRow'] as const
          ).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => appendChild(t)}
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-200 cursor-pointer"
            >
              + {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChildNodeEditor({
  node,
  onChange,
}: {
  node: ContainerChild;
  onChange: (next: ContainerChild) => void;
}) {
  switch (node.type) {
    case 'TextDisplay':
      return <TextDisplayEditor node={node} onChange={onChange} />;
    case 'Separator':
      return <SeparatorEditor node={node} onChange={onChange} />;
    case 'File':
      return <FileNodeEditor node={node} onChange={onChange} />;
    case 'Section':
      return <SectionEditor node={node} onChange={onChange} />;
    case 'MediaGallery':
      return <MediaGalleryEditor node={node} onChange={onChange} />;
    case 'ActionRow':
      return <ActionRowEditor node={node} onChange={onChange} />;
  }
}

function TextDisplayEditor({
  node,
  onChange,
}: {
  node: TextDisplayNode;
  onChange: (next: TextDisplayNode) => void;
}) {
  return (
    <div>
      <textarea
        rows={3}
        value={node.content}
        onChange={(e) => onChange({ ...node, content: e.target.value })}
        className="w-full p-2 rounded bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 font-sans focus:outline-none focus:border-[#5865F2]"
        placeholder="Enter Markdown text..."
      />
      <div className="text-right text-[10px] text-zinc-500 font-mono">
        {node.content.length} chars
      </div>
    </div>
  );
}

function SeparatorEditor({
  node,
  onChange,
}: {
  node: SeparatorNode;
  onChange: (next: SeparatorNode) => void;
}) {
  return (
    <div className="flex items-center gap-4 text-xs">
      <label className="flex items-center gap-1.5 text-zinc-300 cursor-pointer">
        <input
          type="checkbox"
          checked={node.divider}
          onChange={(e) => onChange({ ...node, divider: e.target.checked })}
        />
        Show Divider Line
      </label>

      <label className="flex items-center gap-1.5 text-zinc-300">
        <span>Spacing:</span>
        <select
          value={node.spacing}
          onChange={(e) =>
            onChange({ ...node, spacing: e.target.value as 'Small' | 'Large' })
          }
          className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-xs"
        >
          <option value="Small">Small</option>
          <option value="Large">Large</option>
        </select>
      </label>
    </div>
  );
}

function FileNodeEditor({
  node,
  onChange,
}: {
  node: FileNode;
  onChange: (next: FileNode) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        <input
          type="text"
          value={node.url}
          onChange={(e) => onChange({ ...node, url: e.target.value })}
          placeholder="attachment://filename.json"
          className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-200"
        />
        <input
          type="text"
          value={node.fileName || ''}
          onChange={(e) =>
            onChange({
              ...node,
              fileName: e.target.value,
              url: e.target.value ? `attachment://${e.target.value}` : node.url,
            })
          }
          placeholder="Attachment file name (e.g. rules.json)"
          className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-xs text-zinc-200"
        />
      </div>
      <textarea
        rows={2}
        value={node.fileContent || ''}
        onChange={(e) => onChange({ ...node, fileContent: e.target.value })}
        placeholder="Attached file content (sent via AttachmentBuilder alongside FileBuilder)..."
        className="w-full p-2 rounded bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300"
      />
    </div>
  );
}

function SectionEditor({
  node,
  onChange,
}: {
  node: SectionNode;
  onChange: (next: SectionNode) => void;
}) {
  const isThumb = node.accessory.type === 'Thumbnail';

  function switchAccessoryType(kind: 'Thumbnail' | 'Button') {
    if (kind === 'Thumbnail') {
      onChange({
        ...node,
        accessory: {
          type: 'Thumbnail',
          url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300&auto=format&fit=crop&q=80',
          description: 'Thumbnail',
        },
      });
    } else {
      onChange({
        ...node,
        accessory: {
          id: uid('btn'),
          type: 'Button',
          style: 'Primary',
          label: 'Quick Action',
          customId: `section:${uid('act')}`,
        },
      });
    }
  }

  return (
    <div className="space-y-2.5">
      {node.texts.map((t, idx) => (
        <div key={t.id} className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span>Section Text #{idx + 1}</span>
            {node.texts.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...node,
                    texts: node.texts.filter((_, i) => i !== idx),
                  })
                }
                className="text-red-400 hover:underline cursor-pointer"
              >
                Remove
              </button>
            )}
          </div>
          <textarea
            rows={2}
            value={t.content}
            onChange={(e) => {
              const texts = [...node.texts];
              texts[idx] = { ...t, content: e.target.value };
              onChange({ ...node, texts });
            }}
            className="w-full p-2 rounded bg-zinc-950 border border-zinc-800 text-xs text-zinc-100"
          />
        </div>
      ))}

      {node.texts.length < 3 && (
        <button
          type="button"
          onClick={() =>
            onChange({
              ...node,
              texts: [
                ...node.texts,
                { id: uid('txt'), type: 'TextDisplay', content: 'Additional section line' },
              ],
            })
          }
          className="text-[11px] text-[#949cf7] hover:underline cursor-pointer"
        >
          + Add TextDisplay to Section ({node.texts.length}/3)
        </button>
      )}

      <div className="p-2 rounded bg-zinc-950/90 border border-zinc-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-zinc-400">
            Required Section Accessory
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => switchAccessoryType('Thumbnail')}
              className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${
                isThumb ? 'bg-[#5865F2] text-white' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              Thumbnail
            </button>
            <button
              type="button"
              onClick={() => switchAccessoryType('Button')}
              className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${
                !isThumb ? 'bg-[#5865F2] text-white' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              Button
            </button>
          </div>
        </div>

        {node.accessory.type === 'Thumbnail' ? (
          <input
            type="text"
            value={node.accessory.url}
            onChange={(e) =>
              onChange({
                ...node,
                accessory: { ...node.accessory, type: 'Thumbnail', url: e.target.value },
              })
            }
            placeholder="https://... thumbnail image URL"
            className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-200"
          />
        ) : (
          <ButtonItemEditor
            item={node.accessory}
            onChange={(updated) => onChange({ ...node, accessory: updated })}
          />
        )}
      </div>
    </div>
  );
}

function MediaGalleryEditor({
  node,
  onChange,
}: {
  node: MediaGalleryNode;
  onChange: (next: MediaGalleryNode) => void;
}) {
  return (
    <div className="space-y-2">
      {node.items.map((item, idx) => (
        <div key={item.id} className="flex items-center gap-2">
          <input
            type="text"
            value={item.url}
            onChange={(e) => {
              const items = [...node.items];
              items[idx] = { ...item, url: e.target.value };
              onChange({ ...node, items });
            }}
            placeholder="https://... image URL"
            className="flex-1 px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-xs text-zinc-200"
          />
          {node.items.length > 1 && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...node,
                  items: node.items.filter((_, i) => i !== idx),
                })
              }
              className="text-zinc-500 hover:text-red-400 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
      {node.items.length < 10 && (
        <button
          type="button"
          onClick={() =>
            onChange({
              ...node,
              items: [
                ...node.items,
                {
                  id: uid('img'),
                  url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop&q=80',
                },
              ],
            })
          }
          className="text-[11px] text-[#949cf7] hover:underline cursor-pointer"
        >
          + Add Gallery Image ({node.items.length}/10)
        </button>
      )}
    </div>
  );
}

function ButtonItemEditor({
  item,
  onChange,
}: {
  item: ButtonItem;
  onChange: (next: ButtonItem) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
      <select
        value={item.style}
        onChange={(e) => {
          const style = e.target.value as V2ButtonStyle;
          if (style === 'Link') {
            onChange({
              ...item,
              style,
              url: item.url || 'https://discord.com',
              customId: undefined,
            });
          } else {
            onChange({
              ...item,
              style,
              customId: item.customId || `action:${item.id}`,
              url: undefined,
            });
          }
        }}
        className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs text-white"
      >
        <option value="Primary">Primary (Blurple)</option>
        <option value="Secondary">Secondary (Grey)</option>
        <option value="Success">Success (Green)</option>
        <option value="Danger">Danger (Red)</option>
        <option value="Link">Link (URL)</option>
      </select>

      <input
        type="text"
        value={item.label}
        onChange={(e) => onChange({ ...item, label: e.target.value })}
        placeholder="Button Label"
        className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs text-white"
      />

      {item.style === 'Link' ? (
        <input
          type="text"
          value={item.url || ''}
          onChange={(e) => onChange({ ...item, url: e.target.value })}
          placeholder="https://..."
          className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-200"
        />
      ) : (
        <input
          type="text"
          value={item.customId || ''}
          onChange={(e) => onChange({ ...item, customId: e.target.value })}
          placeholder="custom_id (e.g. role_toggle:123)"
          className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-200"
        />
      )}
    </div>
  );
}

function ActionRowEditor({
  node,
  onChange,
}: {
  node: ActionRowNode;
  onChange: (next: ActionRowNode) => void;
}) {
  const first = node.components[0];
  const currentMode =
    first?.type === 'StringSelect'
      ? 'select'
      : first?.type === 'ChannelSelect'
      ? 'channel'
      : 'buttons';

  function setMode(mode: 'buttons' | 'select' | 'channel') {
    if (mode === 'buttons') {
      onChange({
        ...node,
        components: [
          {
            id: uid('btn'),
            type: 'Button',
            style: 'Primary',
            label: 'Click Me',
            customId: `btn:${uid('click')}`,
          },
        ],
      });
    } else if (mode === 'select') {
      onChange({
        ...node,
        components: [
          {
            id: uid('sel'),
            type: 'StringSelect',
            customId: `select:${uid('menu')}`,
            placeholder: 'Choose an option...',
            minValues: 1,
            maxValues: 1,
            options: [
              { label: 'Option Alpha', value: 'alpha', description: 'First choice', default: true },
              { label: 'Option Beta', value: 'beta', description: 'Second choice' },
            ],
          },
        ],
      });
    } else {
      onChange({
        ...node,
        components: [
          {
            id: uid('chsel'),
            type: 'ChannelSelect',
            customId: `channel_select:${uid('target')}`,
            placeholder: 'Pick a server channel...',
            minValues: 1,
            maxValues: 1,
          },
        ],
      });
    }
  }

  const modeSwitcher = (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-zinc-400">ActionRow Mode:</span>
      <div className="flex gap-1">
        {(
          [
            { id: 'buttons', label: 'Buttons' },
            { id: 'select', label: 'StringSelect' },
            { id: 'channel', label: 'ChannelSelect' },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${
              currentMode === m.id
                ? 'bg-[#5865F2] text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (currentMode === 'channel') {
    const chSel = first as ChannelSelectItem;
    return (
      <div className="space-y-2">
        {modeSwitcher}
        <div className="grid grid-cols-2 gap-1.5">
          <input
            type="text"
            value={chSel.customId}
            onChange={(e) =>
              onChange({ ...node, components: [{ ...chSel, customId: e.target.value }] })
            }
            placeholder="custom_id"
            className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-xs font-mono"
          />
          <input
            type="text"
            value={chSel.placeholder || ''}
            onChange={(e) =>
              onChange({ ...node, components: [{ ...chSel, placeholder: e.target.value }] })
            }
            placeholder="ChannelSelect placeholder..."
            className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-xs"
          />
        </div>
      </div>
    );
  }

  if (currentMode === 'select') {
    const sel = first as StringSelectItem;
    return (
      <div className="space-y-2">
        {modeSwitcher}

        <div className="grid grid-cols-2 gap-1.5">
          <input
            type="text"
            value={sel.customId}
            onChange={(e) =>
              onChange({ ...node, components: [{ ...sel, customId: e.target.value }] })
            }
            placeholder="custom_id"
            className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-xs font-mono"
          />
          <input
            type="text"
            value={sel.placeholder || ''}
            onChange={(e) =>
              onChange({ ...node, components: [{ ...sel, placeholder: e.target.value }] })
            }
            placeholder="Placeholder text..."
            className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-xs"
          />
        </div>

        <div className="space-y-1">
          {sel.options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <input
                type="text"
                value={opt.label}
                onChange={(e) => {
                  const options = [...sel.options];
                  options[idx] = { ...opt, label: e.target.value };
                  onChange({ ...node, components: [{ ...sel, options }] });
                }}
                placeholder="Label"
                className="flex-1 px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-xs"
              />
              <input
                type="text"
                value={opt.value}
                onChange={(e) => {
                  const options = [...sel.options];
                  options[idx] = { ...opt, value: e.target.value };
                  onChange({ ...node, components: [{ ...sel, options }] });
                }}
                placeholder="value"
                className="w-28 px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-xs font-mono"
              />
              {sel.options.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const options = sel.options.filter((_, i) => i !== idx);
                    onChange({ ...node, components: [{ ...sel, options }] });
                  }}
                  className="text-zinc-500 hover:text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          {sel.options.length < 25 && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...node,
                  components: [
                    {
                      ...sel,
                      options: [
                        ...sel.options,
                        {
                          label: `Option ${sel.options.length + 1}`,
                          value: `opt_${sel.options.length + 1}`,
                        },
                      ],
                    },
                  ],
                })
              }
              className="text-[11px] text-[#949cf7] hover:underline cursor-pointer"
            >
              + Add Select Option
            </button>
          )}
        </div>
      </div>
    );
  }

  const buttons = node.components as ButtonItem[];
  return (
    <div className="space-y-2">
      {modeSwitcher}

      {buttons.map((btn, idx) => (
        <div key={btn.id} className="flex items-center gap-1.5">
          <div className="flex-1">
            <ButtonItemEditor
              item={btn}
              onChange={(updated) => {
                const next = [...buttons];
                next[idx] = updated;
                onChange({ ...node, components: next });
              }}
            />
          </div>
          {buttons.length > 1 && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...node,
                  components: buttons.filter((_, i) => i !== idx) as [
                    ButtonItem,
                    ...ButtonItem[],
                  ],
                })
              }
              className="text-zinc-500 hover:text-red-400 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}

      {buttons.length < 5 && (
        <button
          type="button"
          onClick={() =>
            onChange({
              ...node,
              components: [
                ...buttons,
                {
                  id: uid('btn'),
                  type: 'Button',
                  style: 'Secondary',
                  label: 'Button',
                  customId: `btn:${uid('act')}`,
                },
              ],
            })
          }
          className="text-[11px] text-[#949cf7] hover:underline cursor-pointer"
        >
          + Add Button to Row ({buttons.length}/5)
        </button>
      )}
    </div>
  );
}

/* ============================================================================
 * High-Fidelity Discord Dark-Mode V2 Renderer
 * ========================================================================== */

function DiscordNodePreview({ node }: { node: TopLevelNode }) {
  if (node.type === 'Container') {
    return (
      <div
        className="rounded-[8px] bg-[#2b2d31] border border-[#1e1f22] overflow-hidden flex shadow-sm"
        style={
          node.accentColor
            ? { borderLeftWidth: '4px', borderLeftColor: node.accentColor }
            : undefined
        }
      >
        <div className="p-4 flex-1 space-y-3 min-w-0">
          {node.children.map((child) => (
            <DiscordChildPreview key={child.id} node={child} />
          ))}
        </div>
      </div>
    );
  }
  return <DiscordChildPreview node={node} />;
}

function DiscordChildPreview({ node }: { node: ContainerChild }) {
  switch (node.type) {
    case 'TextDisplay':
      return <div className="space-y-1">{renderDiscordMarkdown(node.content)}</div>;

    case 'Separator':
      return (
        <div className={node.spacing === 'Large' ? 'py-2.5' : 'py-1'}>
          {node.divider && <div className="h-[1px] bg-[#3f4147] w-full" />}
        </div>
      );

    case 'File': {
      const displayFile = node.fileName || node.url.replace('attachment://', '');
      return (
        <div className="p-3 rounded-md bg-[#1e1f22] border border-[#111214] flex items-center gap-3">
          <FileCode2 className="w-7 h-7 text-[#5865F2] shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-[#00a8fc] hover:underline truncate cursor-pointer">
              {displayFile}
            </div>
            <div className="text-[11px] text-[#949ba4] font-mono">
              {node.url} • FileBuilder
            </div>
          </div>
        </div>
      );
    }

    case 'Section':
      return (
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-1.5">
            {node.texts.map((t) => (
              <div key={t.id}>{renderDiscordMarkdown(t.content)}</div>
            ))}
          </div>
          <div className="shrink-0">
            {node.accessory.type === 'Thumbnail' ? (
              <img
                src={node.accessory.url}
                alt={node.accessory.description || 'Thumbnail'}
                className="w-20 h-20 rounded-lg object-cover bg-[#1e1f22] border border-[#3f4147]"
              />
            ) : (
              <DiscordButtonPreview button={node.accessory} />
            )}
          </div>
        </div>
      );

    case 'MediaGallery':
      return (
        <div
          className={`grid gap-1.5 rounded-lg overflow-hidden ${
            node.items.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
          }`}
        >
          {node.items.map((item) => (
            <img
              key={item.id}
              src={item.url}
              alt={item.description || 'Gallery media'}
              className="w-full h-36 object-cover rounded bg-[#1e1f22]"
            />
          ))}
        </div>
      );

    case 'ActionRow': {
      const first = node.components[0];
      if (first?.type === 'StringSelect') {
        const sel = first as StringSelectItem;
        return (
          <div className="w-full px-3 py-2 rounded-[4px] bg-[#1e1f22] border border-[#111214] flex items-center justify-between text-xs text-[#949ba4] cursor-pointer hover:border-[#5865F2]">
            <span>{sel.placeholder || sel.options[0]?.label || 'Make a selection'}</span>
            <ChevronDown className="w-4 h-4 text-[#b5bac1]" />
          </div>
        );
      }

      if (first?.type === 'ChannelSelect') {
        const chSel = first as ChannelSelectItem;
        return (
          <div className="w-full px-3 py-2 rounded-[4px] bg-[#1e1f22] border border-[#111214] flex items-center justify-between text-xs text-[#949ba4] cursor-pointer hover:border-[#5865F2]">
            <span className="flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-[#949ba4]" />
              {chSel.placeholder || 'Select a channel...'}
            </span>
            <ChevronDown className="w-4 h-4 text-[#b5bac1]" />
          </div>
        );
      }

      const buttons = node.components as ButtonItem[];
      return (
        <div className="flex flex-wrap gap-2 pt-0.5">
          {buttons.map((btn) => (
            <DiscordButtonPreview key={btn.id} button={btn} />
          ))}
        </div>
      );
    }
  }
}

function DiscordButtonPreview({ button }: { button: ButtonItem }) {
  return (
    <button
      type="button"
      className={`px-4 py-1.5 rounded-[3px] text-[13px] font-medium transition inline-flex items-center gap-1.5 cursor-pointer ${
        DISCORD_BTN_CLASSES[button.style]
      }`}
    >
      <span>{button.label}</span>
      {button.style === 'Link' && <ExternalLink className="w-3.5 h-3.5 opacity-80" />}
    </button>
  );
}
