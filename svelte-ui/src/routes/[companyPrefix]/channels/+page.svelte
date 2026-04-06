<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount, tick } from 'svelte';
  import {
    Hash, Lock, Users, Plus, Send, Search, Pin, Bookmark, Smile,
    MessageSquare, ChevronDown, ChevronRight, Settings, AtSign,
    Reply, MoreHorizontal, Pencil, Trash2, X, Check, ArrowDown,
    ArrowUp, Bot, User, Globe, Megaphone, Paperclip, Code, Image,
    Brain, Activity, Zap,
  } from 'lucide-svelte';
  import { Button, Input, Badge } from '$components/ui/index.js';
  import { cn } from '$utils/index.js';
  import TextGenerateEffect from '$lib/components/aceternity/text-generate-effect.svelte';
  import TypingIndicator from '$lib/components/chat/typing-indicator.svelte';
  import MentionHighlight from '$lib/components/chat/mention-highlight.svelte';
  import RichContentRenderer from '$lib/components/chat/rich-content-renderer.svelte';
  import AgentStatusDot from '$lib/components/chat/agent-status-dot.svelte';
  import ProfileHoverCard from '$lib/components/chat/profile-hover-card.svelte';
  import FloatingActionDock from '$lib/components/chat/floating-action-dock.svelte';
  import AnimatedTooltip from '$lib/components/chat/animated-tooltip.svelte';
  import FlipWords from '$lib/components/chat/flip-words.svelte';
  import StreamingIndicator from '$lib/components/chat/streaming-indicator.svelte';
  import { liveEventsStore, type LiveEvent } from '$stores/live-events.svelte.js';

  onMount(() => breadcrumbStore.set([{ label: 'Chat' }]));

  // ── State ──────────────────────────────────────────────────
  let companyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let prefix = $derived($page.params.companyPrefix);

  // Channel list
  let channelsLoading = $state(true);
  let allChannels = $state<any[]>([]);
  let activeChannelId = $state<string | null>(null);
  let activeChannel = $derived(allChannels.find((c) => c.id === activeChannelId) ?? null);

  // Channel categories
  let publicChannels = $derived(allChannels.filter((c) => c.type !== 'direct' && c.type !== 'private'));
  let directChannels = $derived(allChannels.filter((c) => c.type === 'direct'));
  let privateChannels = $derived(allChannels.filter((c) => c.type === 'private'));

  // Messages
  let messages = $state<any[]>([]);
  let messagesLoading = $state(false);
  let messageInput = $state('');
  let sending = $state(false);

  // Members
  let members = $state<any[]>([]);
  let showMembers = $state(false);

  // Thread
  let threadMessages = $state<any[]>([]);
  let activeThread = $state<any | null>(null);
  let threadInput = $state('');
  let sendingThread = $state(false);

  // Typing indicator
  let typingAgents = $state<{name: string; icon?: string}[]>([]);

  // Search
  let searchQuery = $state('');
  let searchResults = $state<any[]>([]);
  let showSearch = $state(false);

  // Pinned
  let pinnedMessages = $state<any[]>([]);
  let showPinned = $state(false);

  // Create channel
  let showCreateChannel = $state(false);
  let newChannelName = $state('');
  let newChannelDescription = $state('');
  let newChannelType = $state('public');
  let creatingChannel = $state(false);

  // Sidebar collapse — Aceternity pattern: single element, width transition
  let sidebarOpen = $state(false);

  // Section collapse
  let sectionsOpen = $state<Record<string, boolean>>({ channels: true, direct: true, private: true });

  // Editing
  let editingMessageId = $state<string | null>(null);
  let editingBody = $state('');

  // Composer toolbar
  let showEmojiPicker = $state(false);
  let showMentionList = $state(false);
  let showAttachMenu = $state(false);
  let mentionFilter = $state('');
  let composerTextarea: HTMLTextAreaElement | undefined = $state();

  // Vanish input effect
  let vanishActive = $state(false);

  // Agent thoughts panel
  let showAgentThoughts = $state(false);
  interface AgentThought {
    id: string;
    agentId: string;
    agentName: string;
    agentIcon: string | null;
    eventType: string;
    stream: string | null;
    level: string | null;
    message: string;
    timestamp: Date;
    runId: string;
  }
  let agentThoughts = $state<AgentThought[]>([]);
  let thoughtsContainer: HTMLDivElement | undefined = $state();

  // Streaming indicator state (for real-time agent responses)
  let streamingActive = $state(false);
  let streamingAgentName = $state('');
  let streamingAgentIcon = $state<string | null>(null);
  let streamingAction = $state('Thinking');
  let streamingStartedAt = $state<Date | null>(null);
  let streamingTokens = $state(0);

  // Collaborative presence (who's viewing)
  let channelViewers = $derived<{name: string; icon?: string | null; role?: string | null}[]>(
    members.slice(0, 8).map((m: any) => ({ name: m.nickname ?? m.agentName ?? 'User', icon: m.agentIcon ?? null, role: m.agentRole ?? m.role ?? null }))
  );

  // Unread message badges per channel
  let unreadCounts = $state<Record<string, number>>({});

  // Refs
  let messagesContainer: HTMLDivElement | undefined = $state();

  // ── Computed ──────────────────────────────────────────────
  const CHANNEL_ICONS: Record<string, any> = {
    general: Megaphone,
    public: Hash,
    private: Lock,
    team: Users,
    department: Users,
    direct: MessageSquare,
    topic: Hash,
    external: Globe,
  };
  let ActiveChannelIcon = $derived(activeChannel ? (CHANNEL_ICONS[activeChannel.type] ?? Hash) : Hash);

  // ── Data loading ──────────────────────────────────────────
  async function loadChannels() {
    if (!companyId) return;
    channelsLoading = true;
    try {
      const res = await api(`/api/companies/${companyId}/channels`);
      const data = await res.json();
      allChannels = Array.isArray(data) ? data : [];

      // Auto-select first channel or general
      if (!activeChannelId && allChannels.length > 0) {
        const general = allChannels.find((c) => c.type === 'general');
        activeChannelId = general?.id ?? allChannels[0].id;
      }
    } catch (e) {
      console.error('Failed to load channels:', e);
    } finally {
      channelsLoading = false;
    }
  }

  async function loadMessages() {
    if (!activeChannelId) return;
    messagesLoading = true;
    try {
      const res = await api(`/api/channels/${activeChannelId}/messages?limit=100`);
      const data = await res.json();
      // API returns newest first, reverse for display
      messages = Array.isArray(data) ? data.reverse() : [];
      await tick();
      scrollToBottom();
    } catch (e) {
      console.error('Failed to load messages:', e);
    } finally {
      messagesLoading = false;
    }
  }

  async function loadMembers() {
    if (!activeChannelId) return;
    try {
      const res = await api(`/api/channels/${activeChannelId}/members`);
      members = await res.json();
    } catch { members = []; }
  }

  async function loadPinned() {
    if (!activeChannelId) return;
    try {
      const res = await api(`/api/channels/${activeChannelId}/pinned`);
      pinnedMessages = await res.json();
    } catch { pinnedMessages = []; }
  }

  // ── Effects ──────────────────────────────────────────────
  $effect(() => {
    if (companyId) {
      loadChannels();
      loadAgents();
    }
  });

  $effect(() => {
    if (activeChannelId) {
      loadMessages();
      loadMembers();
      messageInput = '';
      activeThread = null;
      threadMessages = [];
      showPinned = false;
      showSearch = false;
      showMembers = false;
    }
  });

  // ── Actions ──────────────────────────────────────────────
  async function sendMessage() {
    if (!messageInput.trim() || !activeChannelId || sending) return;
    sending = true;
    // Trigger vanish animation
    vanishActive = true;
    const bodyToSend = messageInput.trim();
    try {
      // Wait for vanish animation
      await new Promise((r) => setTimeout(r, 350));
      const res = await api(`/api/channels/${activeChannelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: bodyToSend }),
      });
      const msg = await res.json();
      messages = [...messages, msg];
      messageInput = '';
      vanishActive = false;
      // Reset textarea height
      if (composerTextarea) composerTextarea.style.height = 'auto';
      await tick();
      scrollToBottom();

      // Activate streaming indicator — agent will be woken up by the backend
      // The live events listener will handle real run events, but we show
      // immediate feedback that the system is processing
      if (isHumanMessage(msg) && companyAgents.length > 0) {
        // Prefer the @mentioned agent, fallback to first agent
        const mentionMatch = bodyToSend.match(/@(\w[\w\s]*)/);
        let respondingAgent = companyAgents[0];
        if (mentionMatch) {
          const mentionName = mentionMatch[1].trim().toLowerCase();
          const found = companyAgents.find((a) => a.name?.toLowerCase() === mentionName);
          if (found) respondingAgent = found;
        }
        streamingAgentName = respondingAgent.name ?? 'Agent';
        streamingAgentIcon = respondingAgent.icon ?? null;
        streamingAction = 'Thinking';
        streamingStartedAt = new Date();
        streamingTokens = 0;
        streamingActive = true;
        // Token accumulation (real events will override via live events listener)
        const tokenInterval = setInterval(() => {
          if (!streamingActive) { clearInterval(tokenInterval); return; }
          streamingTokens += Math.floor(Math.random() * 40) + 10;
          const actions = ['Thinking', 'Analyzing', 'Composing', 'Writing'];
          streamingAction = actions[Math.floor(streamingTokens / 200) % actions.length];
        }, 500);
        // Auto-stop fallback (live events will stop it earlier if agent responds)
        setTimeout(() => {
          if (streamingActive) {
            streamingActive = false;
          }
          clearInterval(tokenInterval);
        }, 60000);
      }
    } catch (e) {
      console.error('Failed to send:', e);
      vanishActive = false;
    } finally {
      sending = false;
    }
  }

  async function sendThreadReply() {
    if (!threadInput.trim() || !activeChannelId || !activeThread || sendingThread) return;
    sendingThread = true;
    try {
      const res = await api(`/api/channels/${activeChannelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          body: threadInput.trim(),
          parentMessageId: activeThread.id,
          threadId: activeThread.threadId ?? activeThread.id,
        }),
      });
      const msg = await res.json();
      threadMessages = [...threadMessages, msg];
      threadInput = '';
      // Update reply count in main messages
      const idx = messages.findIndex((m) => m.id === activeThread.id);
      if (idx >= 0) {
        messages[idx] = { ...messages[idx], replyCount: (messages[idx].replyCount ?? 0) + 1 };
      }
    } catch (e) {
      console.error('Failed to send thread reply:', e);
    } finally {
      sendingThread = false;
    }
  }

  async function openThread(msg: any) {
    activeThread = msg;
    showPinned = false;
    showSearch = false;
    try {
      const threadId = msg.threadId ?? msg.id;
      const res = await api(`/api/channels/${activeChannelId}/messages?threadId=${threadId}&limit=100`);
      const data = await res.json();
      threadMessages = Array.isArray(data) ? data.reverse() : [];
    } catch { threadMessages = []; }
  }

  async function createChannel() {
    if (!newChannelName.trim() || !companyId || creatingChannel) return;
    creatingChannel = true;
    try {
      const res = await api(`/api/companies/${companyId}/channels`, {
        method: 'POST',
        body: JSON.stringify({
          name: newChannelName.trim(),
          description: newChannelDescription.trim() || undefined,
          type: newChannelType,
          isPrivate: newChannelType === 'private',
        }),
      });
      const ch = await res.json();
      allChannels = [ch, ...allChannels];
      activeChannelId = ch.id;
      showCreateChannel = false;
      newChannelName = '';
      newChannelDescription = '';
      newChannelType = 'public';
    } catch (e) {
      console.error('Failed to create channel:', e);
    } finally {
      creatingChannel = false;
    }
  }

  async function addReaction(messageId: string, emoji: string) {
    try {
      await api(`/api/channel-messages/${messageId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      });
      loadMessages();
    } catch {}
  }

  async function togglePin(msg: any) {
    try {
      if (msg.isPinned) {
        await api(`/api/channel-messages/${msg.id}/pin`, { method: 'DELETE' });
      } else {
        await api(`/api/channel-messages/${msg.id}/pin`, { method: 'POST' });
      }
      loadMessages();
      loadPinned();
    } catch {}
  }

  async function startEdit(msg: any) {
    editingMessageId = msg.id;
    editingBody = msg.body;
  }

  async function saveEdit() {
    if (!editingMessageId || !editingBody.trim()) return;
    try {
      await api(`/api/channel-messages/${editingMessageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ body: editingBody.trim() }),
      });
      editingMessageId = null;
      editingBody = '';
      loadMessages();
    } catch {}
  }

  async function deleteMessage(messageId: string) {
    try {
      await api(`/api/channel-messages/${messageId}`, { method: 'DELETE' });
      messages = messages.filter((m) => m.id !== messageId);
    } catch {}
  }

  async function bookmarkMessage(msg: any) {
    if (!activeChannelId) return;
    try {
      if (msg.isBookmarked) {
        // Find and remove the bookmark
        const res = await api(`/api/channels/${activeChannelId}/bookmarks`);
        const bookmarks = await res.json();
        const bm = Array.isArray(bookmarks) ? bookmarks.find((b: any) => b.messageId === msg.id) : null;
        if (bm) {
          await api(`/api/channel-bookmarks/${bm.id}`, { method: 'DELETE' });
        }
      } else {
        await api(`/api/channels/${activeChannelId}/bookmarks`, {
          method: 'POST',
          body: JSON.stringify({
            title: (msg.body ?? '').slice(0, 80) || 'Saved message',
            messageId: msg.id,
          }),
        });
      }
      loadMessages();
    } catch {}
  }

  function copyMessageText(msg: any) {
    navigator.clipboard.writeText(msg.body ?? '').catch(() => {});
  }

  function copyMessageLink(msg: any) {
    const url = `${window.location.origin}/${prefix}/channels?channel=${activeChannelId}&message=${msg.id}`;
    navigator.clipboard.writeText(url).catch(() => {});
  }

  async function searchMessages() {
    if (!searchQuery.trim() || !companyId) return;
    try {
      const params = new URLSearchParams({ q: searchQuery.trim() });
      if (activeChannelId) params.set('channelId', activeChannelId);
      const res = await api(`/api/companies/${companyId}/channels/search?${params}`);
      searchResults = await res.json();
    } catch { searchResults = []; }
  }

  function scrollToBottom() {
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    // Ensure scroll after derived re-renders complete
    requestAnimationFrame(() => {
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    });
  }

  function selectChannel(channelId: string) {
    activeChannelId = channelId;
    // Clear unread badge
    if (unreadCounts[channelId]) {
      const next = { ...unreadCounts };
      delete next[channelId];
      unreadCounts = next;
    }
  }

  function formatTime(d: string | undefined) {
    if (!d) return '';
    return new Date(d).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(d: string | undefined) {
    if (!d) return '';
    const date = new Date(d);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Group messages by date
  // Build thread map: threadId → sorted replies
  let threadRepliesMap = $derived(() => {
    const map = new Map<string, any[]>();
    for (const msg of messages) {
      if (msg.threadId && msg.threadId !== msg.id) {
        const key = msg.threadId;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(msg);
      }
    }
    return map;
  });

  // Root messages = messages that are NOT thread replies
  let rootMessages = $derived(() => {
    const threadMap = threadRepliesMap();
    const replyIds = new Set<string>();
    for (const replies of threadMap.values()) {
      for (const r of replies) replyIds.add(r.id);
    }
    return messages.filter((m) => !replyIds.has(m.id));
  });

  let groupedMessages = $derived(() => {
    const groups: { date: string; messages: any[] }[] = [];
    let currentDate = '';
    for (const msg of rootMessages()) {
      const date = formatDate(msg.createdAt);
      if (date !== currentDate) {
        currentDate = date;
        groups.push({ date, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    }
    return groups;
  });

  const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '🤔', '👀'];
  const EMOJI_GRID = ['👍', '❤️', '😂', '🎉', '🤔', '👀', '🔥', '✅', '❌', '⚡', '🚀', '💡', '🐛', '🎯', '💪', '👏', '🙏', '😎', '🤖', '💻', '📝', '⭐', '🌟', '💬', '📌', '🔧', '📊', '🎨'];

  // Agent list for mentions
  let companyAgents = $state<any[]>([]);

  async function loadAgents() {
    if (!companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}/agents`);
      const data = await res.json();
      companyAgents = Array.isArray(data) ? data : (data.agents ?? []);
    } catch { companyAgents = []; }
  }

  // Filtered agents for mention autocomplete
  let filteredMentionAgents = $derived(
    mentionFilter
      ? companyAgents.filter((a) => a.name?.toLowerCase().includes(mentionFilter.toLowerCase()))
      : companyAgents,
  );

  function insertAtCursor(text: string) {
    if (!composerTextarea) return;
    const start = composerTextarea.selectionStart;
    const end = composerTextarea.selectionEnd;
    const before = messageInput.slice(0, start);
    const after = messageInput.slice(end);
    messageInput = before + text + after;
    showEmojiPicker = false;
    showMentionList = false;
    showAttachMenu = false;
    // Refocus and position cursor after inserted text
    tick().then(() => {
      if (composerTextarea) {
        composerTextarea.focus();
        const pos = start + text.length;
        composerTextarea.setSelectionRange(pos, pos);
      }
    });
  }

  function insertMention(agentName: string) {
    insertAtCursor(`@${agentName} `);
    mentionFilter = '';
  }

  function insertEmoji(emoji: string) {
    insertAtCursor(emoji);
  }

  // Map Lucide icon names to emoji for display in chat
  const ICON_NAME_TO_EMOJI: Record<string, string> = {
    crown: '👑', terminal: '💻', bot: '🤖', brain: '🧠', cpu: '⚙️',
    zap: '⚡', rocket: '🚀', globe: '🌍', server: '🖥️', database: '🗄️',
    cloud: '☁️', code: '💻', shield: '🛡️', star: '⭐', heart: '❤️',
    fire: '🔥', target: '🎯', pencil: '✏️', book: '📖', lightbulb: '💡',
  };

  function resolveAgentEmoji(icon: string | null | undefined): string | null {
    if (!icon) return null;
    // Already an emoji (non-ASCII)?
    if (/[^\x00-\x7F]/.test(icon)) return icon;
    // Map known icon name to emoji
    return ICON_NAME_TO_EMOJI[icon.toLowerCase()] ?? null;
  }

  function getAgentInitials(name: string): string {
    return name.split(/[\s-]+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  /** True when the message was sent by a human user (not an agent/system).
   *  Agent messages always have senderAgentId; old "System" messages have senderDisplayName but no agentId.
   *  A true human message has no agentId AND no display name (the API sets userId from auth context). */
  function isHumanMessage(msg: any): boolean {
    if (msg.senderAgentId) return false;
    // Has an explicit display name like "System" → not a human chat bubble
    if (msg.senderDisplayName) return false;
    // If no agentId and no display name, it's a human message
    // (senderUserId may be null if auth is not configured)
    return true;
  }

  /** Check if message body has rich content (code blocks, mermaid, charts) */
  function hasRichContent(body: string): boolean {
    // Code blocks, bold, italic, headers, links, tables, lists
    return /```\w*\n[\s\S]*?```/.test(body)
      || /\*\*.+?\*\*/.test(body)
      || /\*[^*\n]+\*/.test(body)
      || /^#{1,6}\s/m.test(body)
      || /\[.+?\]\(.+?\)/.test(body)
      || /^\s*[-*]\s/m.test(body)
      || /^\s*\d+\.\s/m.test(body)
      || /\|.+\|.+\|/.test(body)
      || /`.+?`/.test(body);
  }

  // ── Keyboard shortcuts ──────────────────────────────────
  function handleGlobalKeydown(e: KeyboardEvent) {
    const meta = e.metaKey || e.ctrlKey;
    // Cmd+K — toggle search
    if (meta && e.key === 'k') {
      e.preventDefault();
      showSearch = !showSearch;
      if (showSearch) { showPinned = false; showMembers = false; activeThread = null; }
    }
    // Cmd+Enter — send message (when composerTextarea focused)
    if (meta && e.key === 'Enter' && document.activeElement === composerTextarea) {
      e.preventDefault();
      sendMessage();
    }
    // Esc — close side panels
    if (e.key === 'Escape') {
      if (activeThread || showPinned || showSearch || showMembers || showAgentThoughts) {
        activeThread = null;
        showPinned = false;
        showSearch = false;
        showMembers = false;
        showAgentThoughts = false;
      }
    }
  }

  $effect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleGlobalKeydown);
      return () => window.removeEventListener('keydown', handleGlobalKeydown);
    }
  });

  // ── Live events: auto-refresh messages + streaming indicator ──
  $effect(() => {
    if (!companyId) return;

    const unsubscribe = liveEventsStore.on((event: LiveEvent) => {
      // New message in current channel → auto-refresh
      if (event.type === 'channel_message.created') {
        const p = event.payload as any;
        if (p.channelId === activeChannelId) {
          // Don't refresh if we just sent it (already in the list)
          const alreadyHave = messages.some((m) => m.id === p.messageId);
          if (!alreadyHave) {
            loadMessages();
            // If an agent sent this message, stop streaming indicator
            if (p.senderAgentId && streamingActive) {
              streamingActive = false;
            }
          }
        } else if (p.channelId) {
          // Increment unread badge for non-active channels
          unreadCounts = { ...unreadCounts, [p.channelId]: (unreadCounts[p.channelId] ?? 0) + 1 };
        }
      }

      // Run started → show streaming indicator
      if (event.type === 'run.started' || event.type === 'heartbeat_run.started') {
        const p = event.payload as any;
        if (p.reason === 'channel_message_received' || p.contextSnapshot?.source === 'channel_message') {
          const agent = companyAgents.find((a) => a.id === p.agentId);
          if (agent) {
            streamingAgentName = agent.name ?? 'Agent';
            streamingAgentIcon = agent.icon ?? null;
            streamingAction = 'Thinking';
            streamingStartedAt = new Date();
            streamingTokens = 0;
            streamingActive = true;
          }
        }
      }

      // Run completed → stop streaming
      if (event.type === 'run.completed' || event.type === 'run.failed' || event.type === 'heartbeat_run.completed' || event.type === 'heartbeat_run.failed') {
        const p = event.payload as any;
        if (streamingActive && p.agentId) {
          const agent = companyAgents.find((a) => a.id === p.agentId);
          if (agent && agent.name === streamingAgentName) {
            streamingActive = false;
          }
        }
      }

      // Token update events (if available)
      if (event.type === 'run.token_update' || event.type === 'heartbeat_run.progress') {
        const p = event.payload as any;
        if (streamingActive && p.tokens) {
          streamingTokens = p.tokens;
        }
      }

      // Agent run events → thoughts panel
      if (event.type === 'heartbeat.run.event') {
        const p = event.payload as any;
        if (p.message) {
          const agent = companyAgents.find((a) => a.id === p.agentId);
          const thought: AgentThought = {
            id: `${p.runId}-${p.seq}`,
            agentId: p.agentId,
            agentName: agent?.name ?? 'Agent',
            agentIcon: agent?.icon ?? null,
            eventType: p.eventType ?? 'log',
            stream: p.stream ?? null,
            level: p.level ?? null,
            message: p.message,
            timestamp: new Date(),
            runId: p.runId,
          };
          agentThoughts = [...agentThoughts.slice(-99), thought];
          // Auto-scroll thoughts panel
          if (thoughtsContainer) {
            tick().then(() => {
              if (thoughtsContainer) thoughtsContainer.scrollTop = thoughtsContainer.scrollHeight;
            });
          }
        }
      }

      // Run status changes → thoughts panel
      if (event.type === 'heartbeat.run.status') {
        const p = event.payload as any;
        const agent = companyAgents.find((a) => a.id === p.agentId);
        const statusMessages: Record<string, string> = {
          queued: 'Run queued, waiting to start...',
          running: 'Run started, processing...',
          succeeded: 'Run completed successfully',
          failed: 'Run failed',
          cancelled: 'Run was cancelled',
          timed_out: 'Run timed out',
        };
        const msg = statusMessages[p.status];
        if (msg) {
          const thought: AgentThought = {
            id: `${p.runId}-status-${p.status}`,
            agentId: p.agentId,
            agentName: agent?.name ?? 'Agent',
            agentIcon: agent?.icon ?? null,
            eventType: 'lifecycle',
            stream: 'system',
            level: p.status === 'succeeded' ? 'info' : p.status === 'failed' ? 'error' : 'info',
            message: msg,
            timestamp: new Date(),
            runId: p.runId,
          };
          agentThoughts = [...agentThoughts.slice(-99), thought];
        }
      }

      // Run queued → thoughts panel
      if (event.type === 'heartbeat.run.queued') {
        const p = event.payload as any;
        const agent = companyAgents.find((a) => a.id === p.agentId);
        const thought: AgentThought = {
          id: `${p.runId}-queued`,
          agentId: p.agentId,
          agentName: agent?.name ?? 'Agent',
          agentIcon: agent?.icon ?? null,
          eventType: 'lifecycle',
          stream: 'system',
          level: 'info',
          message: `Waking up (${p.triggerDetail ?? p.invocationSource ?? 'triggered'})...`,
          timestamp: new Date(),
          runId: p.runId,
        };
        agentThoughts = [...agentThoughts.slice(-99), thought];
      }
    });

    return () => unsubscribe();
  });
</script>

<div class="flex h-[calc(100vh-3.5rem)] overflow-hidden">
  <!-- ═══ Channel Sidebar — Aceternity pattern: single element, width transition ═══ -->
  <aside
    class={cn(
      'flex-shrink-0 border-r border-[var(--clawdev-bg-surface-border)] bg-[var(--clawdev-bg-surface)] flex flex-col overflow-hidden transition-all duration-300 ease-in-out',
      sidebarOpen ? 'w-64' : 'w-14',
    )}
    onmouseenter={() => { sidebarOpen = true; }}
    onmouseleave={() => { sidebarOpen = false; }}
  >
    <!-- Header -->
    <div class="flex items-center gap-2 p-3 border-b border-[var(--clawdev-bg-surface-border)] h-[49px]">
      {#if sidebarOpen}
        <h2 class="font-heading text-sm font-semibold truncate flex-1 whitespace-nowrap">
          {companyStore.company?.name ?? 'Chat'}
        </h2>
        <button
          onclick={() => (showCreateChannel = !showCreateChannel)}
          class="p-1 rounded hover:bg-[var(--clawdev-bg-surface-border)] transition-colors flex-shrink-0"
          title="Create channel"
        >
          <Plus class="h-4 w-4 opacity-60" />
        </button>
      {:else}
        <div class="flex items-center justify-center w-full">
          <MessageSquare class="h-5 w-5 opacity-60" />
        </div>
      {/if}
    </div>

    {#if showCreateChannel && sidebarOpen}
      <div class="p-3 border-b border-[var(--clawdev-bg-surface-border)] space-y-2">
        <Input bind:value={newChannelName} placeholder="channel-name" class="h-8 text-sm" />
        <Input bind:value={newChannelDescription} placeholder="Description (optional)" class="h-8 text-sm" />
        <select bind:value={newChannelType} class="w-full h-8 text-sm rounded border border-[var(--clawdev-bg-surface-border)] bg-[var(--clawdev-card-bg)] px-2">
          <option value="public">Public</option>
          <option value="private">Private</option>
          <option value="team">Team</option>
        </select>
        <div class="flex gap-2">
          <Button onclick={createChannel} disabled={creatingChannel} class="h-7 text-xs flex-1">Create</Button>
          <Button onclick={() => (showCreateChannel = false)} variant="ghost" class="h-7 text-xs">Cancel</Button>
        </div>
      </div>
    {/if}

    <!-- Channel list -->
    <nav class="flex-1 overflow-y-auto overflow-x-hidden py-1">
      {#if sidebarOpen}
        <!-- Expanded: full channel names with sections -->
        <div class="px-2 py-1">
          <button class="flex items-center gap-1 w-full text-xs font-semibold opacity-60 hover:opacity-100 uppercase tracking-wider py-1" onclick={() => (sectionsOpen.channels = !sectionsOpen.channels)}>
            {#if sectionsOpen.channels}<ChevronDown class="h-3 w-3" />{:else}<ChevronRight class="h-3 w-3" />{/if}
            Channels
          </button>
          {#if sectionsOpen.channels}
            {#each publicChannels as ch}
              {@const ChannelIcon = CHANNEL_ICONS[ch.type] ?? Hash}
              <button class={cn('flex items-center gap-2 w-full px-2 py-1 rounded text-sm transition-colors whitespace-nowrap', ch.id === activeChannelId ? 'bg-[var(--clawdev-primary)] text-white channel-glow-active' : 'hover:bg-[var(--clawdev-bg-surface-border)] opacity-80 hover:opacity-100')} onclick={() => selectChannel(ch.id)}>
                <ChannelIcon class="h-3.5 w-3.5 flex-shrink-0" />
                <span class="truncate">{ch.name}</span>
                {#if (unreadCounts[ch.id] ?? 0) > 0}
                  <Badge variant="destructive" class="ml-auto text-[10px] h-4 px-1">{unreadCounts[ch.id]}</Badge>
                {/if}
              </button>
            {/each}
          {/if}
        </div>
        {#if privateChannels.length > 0}
          <div class="px-2 py-1">
            <button class="flex items-center gap-1 w-full text-xs font-semibold opacity-60 hover:opacity-100 uppercase tracking-wider py-1" onclick={() => (sectionsOpen.private = !sectionsOpen.private)}>
              {#if sectionsOpen.private}<ChevronDown class="h-3 w-3" />{:else}<ChevronRight class="h-3 w-3" />{/if}
              Private
            </button>
            {#if sectionsOpen.private}
              {#each privateChannels as ch}
                <button class={cn('flex items-center gap-2 w-full px-2 py-1 rounded text-sm transition-colors whitespace-nowrap', ch.id === activeChannelId ? 'bg-[var(--clawdev-primary)] text-white' : 'hover:bg-[var(--clawdev-bg-surface-border)] opacity-80 hover:opacity-100')} onclick={() => selectChannel(ch.id)}>
                  <Lock class="h-3.5 w-3.5 flex-shrink-0" />
                  <span class="truncate">{ch.name}</span>
                </button>
              {/each}
            {/if}
          </div>
        {/if}
        <div class="px-2 py-1">
          <button class="flex items-center gap-1 w-full text-xs font-semibold opacity-60 hover:opacity-100 uppercase tracking-wider py-1" onclick={() => (sectionsOpen.direct = !sectionsOpen.direct)}>
            {#if sectionsOpen.direct}<ChevronDown class="h-3 w-3" />{:else}<ChevronRight class="h-3 w-3" />{/if}
            Direct Messages
          </button>
          {#if sectionsOpen.direct}
            {#each directChannels as ch}
              <button class={cn('flex items-center gap-2 w-full px-2 py-1 rounded text-sm transition-colors whitespace-nowrap', ch.id === activeChannelId ? 'bg-[var(--clawdev-primary)] text-white' : 'hover:bg-[var(--clawdev-bg-surface-border)] opacity-80 hover:opacity-100')} onclick={() => selectChannel(ch.id)}>
                <Bot class="h-3.5 w-3.5 flex-shrink-0" />
                <span class="truncate">{ch.name}</span>
              </button>
            {/each}
          {/if}
        </div>
      {:else}
        <!-- Collapsed: icon-only -->
        <div class="flex flex-col items-center gap-0.5 px-1 py-1">
          {#each allChannels as ch}
            {@const ChannelIcon = CHANNEL_ICONS[ch.type] ?? Hash}
            <button
              class={cn(
                'relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
                ch.id === activeChannelId
                  ? 'bg-[var(--clawdev-primary)] text-white'
                  : 'hover:bg-[var(--clawdev-bg-surface-border)] opacity-60 hover:opacity-100',
              )}
              onclick={() => selectChannel(ch.id)}
              title={ch.name}
            >
              <ChannelIcon class="h-4 w-4" />
              {#if unreadCounts[ch.id]}
                <span class="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1 leading-none">
                  {unreadCounts[ch.id] > 99 ? '99+' : unreadCounts[ch.id]}
                </span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </nav>
  </aside>

  <!-- ═══ Main Chat Area ═══ -->
  <main class="flex-1 flex flex-col min-w-0">
    {#if !activeChannel}
      <div class="flex-1 flex items-center justify-center opacity-40">
        <div class="text-center">
          <MessageSquare class="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p class="font-heading text-lg">Select a channel to start chatting</p>
        </div>
      </div>
    {:else}
      <!-- Channel header -->
      <header class="flex items-center justify-between px-4 py-2 border-b border-[var(--clawdev-bg-surface-border)] bg-[var(--clawdev-card-bg)]">
        <div class="flex items-center gap-2 min-w-0">
          <ActiveChannelIcon class="h-4 w-4 opacity-60 flex-shrink-0" />
          <h3 class="font-heading font-semibold text-sm truncate">{activeChannel.name}</h3>
          {#if activeChannel.topic}
            <span class="text-xs opacity-50 truncate hidden md:inline">| {activeChannel.topic}</span>
          {/if}
          <Badge variant="outline" class="text-[10px] hidden sm:inline-flex">
            {members.length} members
          </Badge>

          <!-- Collaborative Presence Indicators -->
          {#if channelViewers.length > 0}
            <div class="flex items-center -space-x-1.5 ml-2">
              {#each channelViewers.slice(0, 5) as viewer, i (viewer.name + i)}
                <AnimatedTooltip text="{viewer.name}{viewer.role ? ` · ${viewer.role}` : ''}" position="bottom" delay={100}>
                  {#snippet children()}
                    <div
                      class="relative w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-[var(--clawdev-card-bg)] cursor-pointer hover:scale-110 hover:z-10 transition-transform"
                      style="background: linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2)); z-index: {5 - i};"
                    >
                      {#if resolveAgentEmoji(viewer.icon)}
                        <span class="text-xs">{resolveAgentEmoji(viewer.icon)}</span>
                      {:else}
                        <span class="opacity-70">{getAgentInitials(viewer.name)}</span>
                      {/if}
                    </div>
                  {/snippet}
                </AnimatedTooltip>
              {/each}
              {#if channelViewers.length > 5}
                <div
                  class="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-semibold border-2 border-[var(--clawdev-card-bg)] bg-[var(--clawdev-bg-surface)]"
                  style="z-index: 0;"
                >
                  +{channelViewers.length - 5}
                </div>
              {/if}
            </div>
          {/if}
        </div>
        <div class="flex items-center gap-1">
          <button
            onclick={() => { showPinned = !showPinned; if (showPinned) loadPinned(); showSearch = false; showMembers = false; activeThread = null; showAgentThoughts = false; }}
            class={cn('p-1.5 rounded transition-colors', showPinned ? 'bg-[var(--clawdev-primary)] text-white' : 'hover:bg-[var(--clawdev-bg-surface-border)]')}
            title="Pinned messages"
          >
            <Pin class="h-4 w-4" />
          </button>
          <button
            onclick={() => { showSearch = !showSearch; showPinned = false; showMembers = false; activeThread = null; showAgentThoughts = false; }}
            class={cn('p-1.5 rounded transition-colors flex items-center gap-1', showSearch ? 'bg-[var(--clawdev-primary)] text-white' : 'hover:bg-[var(--clawdev-bg-surface-border)]')}
            title="Search"
            data-shortcut="Cmd+K"
          >
            <Search class="h-4 w-4" />
            <span class="kbd-hint hidden lg:inline-flex">{navigator?.platform?.includes('Mac') ? '\u2318' : 'Ctrl+'}K</span>
          </button>
          <button
            onclick={() => { showMembers = !showMembers; showPinned = false; showSearch = false; activeThread = null; showAgentThoughts = false; }}
            class={cn('p-1.5 rounded transition-colors', showMembers ? 'bg-[var(--clawdev-primary)] text-white' : 'hover:bg-[var(--clawdev-bg-surface-border)]')}
            title="Members"
          >
            <Users class="h-4 w-4" />
          </button>
          <div class="w-px h-4 bg-[var(--clawdev-bg-surface-border)] mx-0.5"></div>
          <button
            onclick={() => { showAgentThoughts = !showAgentThoughts; if (showAgentThoughts) { showPinned = false; showSearch = false; showMembers = false; activeThread = null; } }}
            class={cn(
              'p-1.5 rounded transition-colors relative',
              showAgentThoughts ? 'bg-orange-500 text-white' : 'hover:bg-[var(--clawdev-bg-surface-border)]'
            )}
            title="Agent Thoughts"
          >
            <Brain class="h-4 w-4" />
            {#if agentThoughts.length > 0 && !showAgentThoughts}
              <span class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            {/if}
          </button>
        </div>
      </header>

      <!-- Messages area -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Message list -->
        <div class="flex-1 flex flex-col min-w-0">
          <div
            bind:this={messagesContainer}
            class="flex-1 overflow-y-auto px-4 py-2"
          >
            {#if messagesLoading}
              <div class="flex items-center justify-center h-full opacity-40">
                <p class="text-sm">Loading messages...</p>
              </div>
            {:else if messages.length === 0}
              <div class="flex items-center justify-center h-full opacity-40">
                <div class="text-center" style="perspective: 600px;">
                  <Hash class="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p class="font-heading">Welcome to #{activeChannel.name}</p>
                  <p class="text-xs mt-1">{activeChannel.description || 'This is the start of the conversation.'}</p>
                  <div class="mt-4 text-sm font-medium" style="perspective: 600px;">
                    <FlipWords />
                  </div>
                </div>
              </div>
            {:else}
              {#each groupedMessages() as group}
                <!-- Date divider -->
                <div class="flex items-center gap-3 my-3">
                  <div class="flex-1 h-px bg-[var(--clawdev-bg-surface-border)]"></div>
                  <span class="text-[11px] font-semibold opacity-50 px-2">{group.date}</span>
                  <div class="flex-1 h-px bg-[var(--clawdev-bg-surface-border)]"></div>
                </div>

                {#each group.messages as msg (msg.id)}
                  {#if isHumanMessage(msg)}
                    <!-- ══ Human message — right-aligned, same layout pattern ══ -->
                    <div class="group flex flex-row-reverse gap-3 py-1.5 px-2 rounded-lg hover:bg-emerald-500/[0.04] transition-colors relative">
                      <!-- Avatar -->
                      <div class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5 text-sm font-bold" style="background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(59,130,246,0.15))">
                        <User class="h-4 w-4 opacity-70" />
                      </div>

                      <!-- Content — text-right for alignment -->
                      <div class="flex-1 min-w-0 text-right">
                        <div class="flex items-baseline gap-2 justify-end">
                          {#if msg.isPinned}
                            <Pin class="h-3 w-3 text-yellow-500" />
                          {/if}
                          {#if msg.editedAt}
                            <span class="text-[10px] opacity-30">(edited)</span>
                          {/if}
                          <AnimatedTooltip text={msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ''}>
                            {#snippet children()}
                              <span class="text-[11px] opacity-40 cursor-default">{formatTime(msg.createdAt)}</span>
                            {/snippet}
                          </AnimatedTooltip>
                          <span class="font-semibold text-sm text-emerald-600 dark:text-emerald-400">
                            You
                          </span>
                        </div>

                        {#if editingMessageId === msg.id}
                          <div class="flex gap-2 mt-1 justify-end">
                            <Input
                              bind:value={editingBody}
                              class="h-8 text-sm flex-1"
                              onkeydown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { editingMessageId = null; } }}
                            />
                            <button onclick={saveEdit} class="p-1 text-green-500 hover:bg-green-500/10 rounded"><Check class="h-4 w-4" /></button>
                            <button onclick={() => (editingMessageId = null)} class="p-1 text-red-500 hover:bg-red-500/10 rounded"><X class="h-4 w-4" /></button>
                          </div>
                        {:else if hasRichContent(msg.body)}
                          <RichContentRenderer body={msg.body} searchQuery={showSearch ? searchQuery : ''} />
                        {:else}
                          <MentionHighlight body={msg.body} searchQuery={showSearch ? searchQuery : ''} />
                        {/if}

                        <!-- Reactions -->
                        {#if msg.reactionsSummary}
                          {@const reactions = typeof msg.reactionsSummary === 'string' ? JSON.parse(msg.reactionsSummary) : msg.reactionsSummary}
                          {#if Array.isArray(reactions) && reactions.length > 0}
                            <div class="flex flex-wrap gap-1 mt-1 justify-end">
                              {#each reactions as r}
                                <AnimatedTooltip text={r.users?.join(', ') ?? `${r.count} reacted`}>
                                  {#snippet children()}
                                    <button
                                      onclick={() => addReaction(msg.id, r.emoji)}
                                      class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-[var(--clawdev-bg-surface)] border border-[var(--clawdev-bg-surface-border)] hover:border-[var(--clawdev-primary)] transition-colors"
                                    >
                                      <span>{r.emoji}</span>
                                      <span class="opacity-60">{r.count}</span>
                                    </button>
                                  {/snippet}
                                </AnimatedTooltip>
                              {/each}
                            </div>
                          {/if}
                        {/if}

                        {#if (threadRepliesMap().get(msg.threadId ?? msg.id)?.length ?? 0) > 0 && !msg.threadId}
                          <button
                            onclick={() => openThread(msg)}
                            class="inline-flex items-center gap-1.5 mt-1 text-xs text-[var(--clawdev-primary)] hover:underline"
                          >
                            <MessageSquare class="h-3 w-3" />
                            View full thread
                          </button>
                        {/if}
                      </div>

                      <!-- Floating Action Dock (hover) -->
                      <div class="absolute left-2 top-1 hidden group-hover:block">
                        <FloatingActionDock
                          visible={true}
                          onReply={() => openThread(msg)}
                          onReact={(emoji) => addReaction(msg.id, emoji)}
                          onPin={() => togglePin(msg)}
                          onBookmark={() => bookmarkMessage(msg)}
                          onEdit={() => startEdit(msg)}
                          onDelete={() => deleteMessage(msg.id)}
                          onCopyText={() => copyMessageText(msg)}
                          onCopyLink={() => copyMessageLink(msg)}
                          isPinned={msg.isPinned}
                          isBookmarked={!!msg.isBookmarked}
                          isOwnMessage={!msg.senderAgentId}
                        />
                      </div>
                    </div>
                    <!-- ═══ X-style inline thread replies (human parent) ═══ -->
                    {#if threadRepliesMap().has(msg.threadId ?? msg.id) && !msg.threadId}
                      {@const replies = threadRepliesMap().get(msg.threadId ?? msg.id) ?? []}
                      <div class="ml-6 border-l-2 border-[var(--clawdev-primary)]/30 pl-3 mb-1">
                        {#each replies as reply (reply.id)}
                          <div class="group/reply flex gap-2 py-1 px-1 rounded hover:bg-[var(--clawdev-bg-surface)] transition-colors relative">
                            <div class="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold" style:background={reply.senderAgentId ? 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))' : 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(59,130,246,0.15))'}>
                              {#if resolveAgentEmoji(reply.senderAgentIcon)}
                                <span class="text-sm">{resolveAgentEmoji(reply.senderAgentIcon)}</span>
                              {:else if reply.senderAgentName}
                                <span class="opacity-70 text-[9px]">{getAgentInitials(reply.senderAgentName)}</span>
                              {:else}
                                <User class="h-3 w-3 opacity-70" />
                              {/if}
                            </div>
                            <div class="flex-1 min-w-0">
                              <div class="flex items-baseline gap-1.5">
                                <span class="font-semibold text-xs">{reply.senderDisplayName ?? reply.senderAgentName ?? 'You'}</span>
                                {#if reply.senderAgentRole}
                                  <span class="text-[9px] opacity-35">{reply.senderAgentRole}</span>
                                {/if}
                                <span class="text-[10px] opacity-35">{formatTime(reply.createdAt)}</span>
                              </div>
                              {#if hasRichContent(reply.body)}
                                <RichContentRenderer body={reply.body} searchQuery={showSearch ? searchQuery : ''} />
                              {:else}
                                <MentionHighlight body={reply.body} searchQuery={showSearch ? searchQuery : ''} />
                              {/if}
                            </div>
                            <div class="absolute right-1 top-0.5 hidden group-hover/reply:block">
                              <button onclick={() => openThread(msg)} class="p-0.5 rounded hover:bg-[var(--clawdev-bg-surface-border)] opacity-50 hover:opacity-80" title="Open thread">
                                <Reply class="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        {/each}
                        {#if replies.length >= 3}
                          <button
                            onclick={() => openThread(msg)}
                            class="text-[10px] text-[var(--clawdev-primary)] hover:underline py-0.5 px-1"
                          >
                            View full thread ({msg.replyCount ?? replies.length})
                          </button>
                        {/if}
                      </div>
                    {/if}
                  {:else}
                    <!-- ══ Agent/System message — left-aligned (Slack style) ══ -->
                    <div class="group flex gap-3 py-1.5 px-2 rounded-lg hover:bg-[var(--clawdev-bg-surface)] transition-colors relative">
                      <!-- Avatar with Profile Hover Card -->
                      <ProfileHoverCard
                        name={msg.senderDisplayName ?? msg.senderAgentName ?? 'Unknown'}
                        role={msg.senderAgentRole ?? ''}
                        icon={msg.senderAgentIcon ?? null}
                        status={msg.senderAgentId ? 'online' : 'offline'}
                        onMention={() => insertMention(msg.senderAgentName ?? msg.senderDisplayName ?? '')}
                      >
                        {#snippet children()}
                          <div class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5 text-sm font-bold cursor-pointer" style:background={msg.senderAgentId ? 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))' : 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(234,88,12,0.15))'}>
                            {#if resolveAgentEmoji(msg.senderAgentIcon)}
                              <span class="text-lg">{resolveAgentEmoji(msg.senderAgentIcon)}</span>
                            {:else if msg.senderAgentName}
                              <span class="opacity-70 text-xs">{getAgentInitials(msg.senderAgentName)}</span>
                            {:else if msg.senderDisplayName}
                              <span class="opacity-70 text-xs">{getAgentInitials(msg.senderDisplayName)}</span>
                            {:else}
                              <Globe class="h-4 w-4 opacity-70" />
                            {/if}
                          </div>
                        {/snippet}
                      </ProfileHoverCard>

                      <!-- Content -->
                      <div class="flex-1 min-w-0">
                        <div class="flex items-baseline gap-2">
                          <span class="font-semibold text-sm">
                            {msg.senderDisplayName ?? msg.senderAgentName ?? 'Unknown'}
                          </span>
                          {#if msg.senderAgentRole}
                            <span class="text-[10px] opacity-40">{msg.senderAgentRole}</span>
                          {/if}
                          <AnimatedTooltip text={msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ''}>
                            {#snippet children()}
                              <span class="text-[11px] opacity-40 cursor-default">{formatTime(msg.createdAt)}</span>
                            {/snippet}
                          </AnimatedTooltip>
                          {#if msg.editedAt}
                            <span class="text-[10px] opacity-30">(edited)</span>
                          {/if}
                          {#if msg.isPinned}
                            <Pin class="h-3 w-3 text-yellow-500" />
                          {/if}
                        </div>

                        {#if editingMessageId === msg.id}
                          <div class="flex gap-2 mt-1">
                            <Input
                              bind:value={editingBody}
                              class="h-8 text-sm flex-1"
                              onkeydown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { editingMessageId = null; } }}
                            />
                            <button onclick={saveEdit} class="p-1 text-green-500 hover:bg-green-500/10 rounded"><Check class="h-4 w-4" /></button>
                            <button onclick={() => (editingMessageId = null)} class="p-1 text-red-500 hover:bg-red-500/10 rounded"><X class="h-4 w-4" /></button>
                          </div>
                        {:else if hasRichContent(msg.body)}
                          <RichContentRenderer body={msg.body} searchQuery={showSearch ? searchQuery : ''} />
                        {:else}
                          <MentionHighlight body={msg.body} searchQuery={showSearch ? searchQuery : ''} />
                        {/if}

                        <!-- Reactions -->
                        {#if msg.reactionsSummary}
                          {@const reactions = typeof msg.reactionsSummary === 'string' ? JSON.parse(msg.reactionsSummary) : msg.reactionsSummary}
                          {#if Array.isArray(reactions) && reactions.length > 0}
                            <div class="flex flex-wrap gap-1 mt-1">
                              {#each reactions as r}
                                <AnimatedTooltip text={r.users?.join(', ') ?? `${r.count} reacted`}>
                                  {#snippet children()}
                                    <button
                                      onclick={() => addReaction(msg.id, r.emoji)}
                                      class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-[var(--clawdev-bg-surface)] border border-[var(--clawdev-bg-surface-border)] hover:border-[var(--clawdev-primary)] transition-colors"
                                    >
                                      <span>{r.emoji}</span>
                                      <span class="opacity-60">{r.count}</span>
                                    </button>
                                  {/snippet}
                                </AnimatedTooltip>
                              {/each}
                            </div>
                          {/if}
                        {/if}

                        <!-- Thread indicator -->
                        {#if (threadRepliesMap().get(msg.threadId ?? msg.id)?.length ?? 0) > 0 && !msg.threadId}
                          <button
                            onclick={() => openThread(msg)}
                            class="flex items-center gap-1.5 mt-1 text-xs text-[var(--clawdev-primary)] hover:underline"
                          >
                            <MessageSquare class="h-3 w-3" />
                            View full thread
                          </button>
                        {/if}
                      </div>

                      <!-- Floating Action Dock (hover) -->
                      <div class="absolute right-2 top-1 hidden group-hover:block">
                        <FloatingActionDock
                          visible={true}
                          onReply={() => openThread(msg)}
                          onReact={(emoji) => addReaction(msg.id, emoji)}
                          onPin={() => togglePin(msg)}
                          onBookmark={() => bookmarkMessage(msg)}
                          onEdit={() => startEdit(msg)}
                          onDelete={() => deleteMessage(msg.id)}
                          onCopyText={() => copyMessageText(msg)}
                          onCopyLink={() => copyMessageLink(msg)}
                          isPinned={msg.isPinned}
                          isBookmarked={!!msg.isBookmarked}
                          isOwnMessage={!msg.senderAgentId}
                        />
                      </div>
                    </div>
                    <!-- ═══ X-style inline thread replies (agent parent) ═══ -->
                    {#if threadRepliesMap().has(msg.threadId ?? msg.id) && !msg.threadId}
                      {@const replies = threadRepliesMap().get(msg.threadId ?? msg.id) ?? []}
                      <div class="ml-12 border-l-2 border-[var(--clawdev-primary)]/30 pl-3 mb-1">
                        {#each replies as reply (reply.id)}
                          <div class="group/reply flex gap-2 py-1 px-1 rounded hover:bg-[var(--clawdev-bg-surface)] transition-colors relative">
                            <div class="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold" style:background={reply.senderAgentId ? 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))' : 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(59,130,246,0.15))'}>
                              {#if resolveAgentEmoji(reply.senderAgentIcon)}
                                <span class="text-sm">{resolveAgentEmoji(reply.senderAgentIcon)}</span>
                              {:else if reply.senderAgentName}
                                <span class="opacity-70 text-[9px]">{getAgentInitials(reply.senderAgentName)}</span>
                              {:else}
                                <User class="h-3 w-3 opacity-70" />
                              {/if}
                            </div>
                            <div class="flex-1 min-w-0">
                              <div class="flex items-baseline gap-1.5">
                                <span class="font-semibold text-xs">{reply.senderDisplayName ?? reply.senderAgentName ?? 'You'}</span>
                                {#if reply.senderAgentRole}
                                  <span class="text-[9px] opacity-35">{reply.senderAgentRole}</span>
                                {/if}
                                <span class="text-[10px] opacity-35">{formatTime(reply.createdAt)}</span>
                              </div>
                              {#if hasRichContent(reply.body)}
                                <RichContentRenderer body={reply.body} searchQuery={showSearch ? searchQuery : ''} />
                              {:else}
                                <MentionHighlight body={reply.body} searchQuery={showSearch ? searchQuery : ''} />
                              {/if}
                            </div>
                            <div class="absolute right-1 top-0.5 hidden group-hover/reply:block">
                              <button onclick={() => openThread(msg)} class="p-0.5 rounded hover:bg-[var(--clawdev-bg-surface-border)] opacity-50 hover:opacity-80" title="Open thread">
                                <Reply class="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        {/each}
                        {#if replies.length >= 3}
                          <button
                            onclick={() => openThread(msg)}
                            class="text-[10px] text-[var(--clawdev-primary)] hover:underline py-0.5 px-1"
                          >
                            View full thread ({msg.replyCount ?? replies.length})
                          </button>
                        {/if}
                      </div>
                    {/if}
                  {/if}
                {/each}
              {/each}
            {/if}
          </div>

          <TypingIndicator agents={typingAgents} />

          <!-- Streaming indicator — Claude Code style -->
          <StreamingIndicator
            active={streamingActive}
            agentName={streamingAgentName}
            agentIcon={streamingAgentIcon}
            action={streamingAction}
            startedAt={streamingStartedAt}
            tokens={streamingTokens}
            onStop={() => { streamingActive = false; }}
          />

          <!-- Message composer — Claude Code web style -->
          <div class="px-4 py-3 relative">
            <!-- Mention autocomplete popup -->
            {#if showMentionList}
              <div class="absolute bottom-full left-4 right-4 mb-1 rounded-xl border border-[var(--clawdev-bg-surface-border)] bg-[var(--clawdev-card-bg)] shadow-xl z-20 max-h-48 overflow-y-auto">
                <div class="p-2">
                  <input
                    type="text"
                    bind:value={mentionFilter}
                    placeholder="Search agents..."
                    class="w-full h-7 px-2 text-xs rounded-lg border border-[var(--clawdev-bg-surface-border)] bg-[var(--clawdev-bg-surface)] focus:outline-none mb-1"
                  />
                  {#each filteredMentionAgents as agent (agent.id)}
                    <button
                      onclick={() => insertMention(agent.name)}
                      class="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-[var(--clawdev-bg-surface)] transition-colors text-left"
                    >
                      <div class="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold" style="background: linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))">
                        {#if resolveAgentEmoji(agent.icon)}
                          <span>{resolveAgentEmoji(agent.icon)}</span>
                        {:else}
                          <span class="opacity-70 text-[10px]">{getAgentInitials(agent.name)}</span>
                        {/if}
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-xs font-medium truncate">{agent.name}</p>
                        <p class="text-[10px] opacity-40 truncate">{agent.role ?? ''}</p>
                      </div>
                    </button>
                  {/each}
                  {#if filteredMentionAgents.length === 0}
                    <p class="text-xs text-center opacity-40 py-2">No agents found</p>
                  {/if}
                </div>
              </div>
            {/if}

            <!-- Emoji picker popup -->
            {#if showEmojiPicker}
              <div class="absolute bottom-full left-4 mb-1 rounded-xl border border-[var(--clawdev-bg-surface-border)] bg-[var(--clawdev-card-bg)] shadow-xl z-20 p-3">
                <div class="grid grid-cols-7 gap-1">
                  {#each EMOJI_GRID as emoji}
                    <button
                      onclick={() => insertEmoji(emoji)}
                      class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--clawdev-bg-surface)] transition-colors text-base hover:scale-110"
                    >{emoji}</button>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Attach menu popup -->
            {#if showAttachMenu}
              <div class="absolute bottom-full left-4 mb-1 py-1 min-w-[160px] rounded-xl border border-[var(--clawdev-bg-surface-border)] bg-[var(--clawdev-card-bg)] shadow-xl z-20">
                <button
                  onclick={() => { showAttachMenu = false; }}
                  class="flex items-center gap-2.5 w-full px-3 py-2 text-xs hover:bg-[var(--clawdev-bg-surface)] transition-colors text-left"
                >
                  <Code class="h-4 w-4 opacity-60" />
                  Code snippet
                </button>
                <button
                  onclick={() => { showAttachMenu = false; }}
                  class="flex items-center gap-2.5 w-full px-3 py-2 text-xs hover:bg-[var(--clawdev-bg-surface)] transition-colors text-left"
                >
                  <Image class="h-4 w-4 opacity-60" />
                  Upload image
                </button>
                <button
                  onclick={() => { showAttachMenu = false; }}
                  class="flex items-center gap-2.5 w-full px-3 py-2 text-xs hover:bg-[var(--clawdev-bg-surface)] transition-colors text-left"
                >
                  <Paperclip class="h-4 w-4 opacity-60" />
                  Attach file
                </button>
              </div>
            {/if}

            <div class="relative rounded-2xl border border-[var(--clawdev-bg-surface-border)] bg-[var(--clawdev-card-bg)] transition-all focus-within:border-[color-mix(in_srgb,var(--clawdev-bg-surface-border)_60%,var(--clawdev-primary)_40%)]">
              <!-- Textarea with vanish effect -->
              <textarea
                bind:this={composerTextarea}
                bind:value={messageInput}
                placeholder="Message #{activeChannel.name}..."
                class="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm focus:outline-none min-h-[44px] max-h-[200px] placeholder:opacity-35 {vanishActive ? 'vanish-send' : ''}"
                rows="1"
                onkeydown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                  if (e.key === 'Escape') {
                    showEmojiPicker = false;
                    showMentionList = false;
                    showAttachMenu = false;
                  }
                }}
                oninput={(e) => {
                  const target = e.currentTarget;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 200) + 'px';
                }}
                onfocus={() => { showEmojiPicker = false; showMentionList = false; }}
              ></textarea>

              <!-- Bottom toolbar row -->
              <div class="flex items-center justify-between px-3 pb-2.5">
                <!-- Left actions -->
                <div class="flex items-center gap-1">
                  <button
                    onclick={() => { showAttachMenu = !showAttachMenu; showEmojiPicker = false; showMentionList = false; }}
                    class={cn(
                      'flex items-center justify-center h-7 w-7 rounded-lg border border-[var(--clawdev-bg-surface-border)] transition-colors',
                      showAttachMenu ? 'bg-[var(--clawdev-bg-surface)]' : 'hover:bg-[var(--clawdev-bg-surface)]',
                    )}
                    title="Attach"
                  >
                    <Plus class="h-3.5 w-3.5 opacity-60" />
                  </button>
                  <button
                    onclick={() => { showMentionList = !showMentionList; showEmojiPicker = false; showAttachMenu = false; mentionFilter = ''; }}
                    class={cn(
                      'flex items-center gap-1.5 h-7 px-2.5 rounded-lg transition-colors text-[11px] font-medium',
                      showMentionList ? 'bg-[var(--clawdev-bg-surface)] opacity-100' : 'hover:bg-[var(--clawdev-bg-surface)] opacity-70 hover:opacity-100',
                    )}
                    title="Mention agent"
                  >
                    <AtSign class="h-3.5 w-3.5" />
                    <span class="hidden sm:inline">Mention</span>
                  </button>
                  <button
                    onclick={() => { showEmojiPicker = !showEmojiPicker; showMentionList = false; showAttachMenu = false; }}
                    class={cn(
                      'flex items-center gap-1.5 h-7 px-2.5 rounded-lg transition-colors text-[11px] font-medium',
                      showEmojiPicker ? 'bg-[var(--clawdev-bg-surface)] opacity-100' : 'hover:bg-[var(--clawdev-bg-surface)] opacity-70 hover:opacity-100',
                    )}
                    title="Emoji"
                  >
                    <Smile class="h-3.5 w-3.5" />
                  </button>
                </div>

                <!-- Right: channel indicator + send button -->
                <div class="flex items-center gap-2">
                  <span class="text-[11px] opacity-30 hidden sm:inline">#{activeChannel.name}</span>
                  <span class="kbd-hint hidden lg:inline-flex">{navigator?.platform?.includes('Mac') ? '\u2318' : 'Ctrl+'}Enter</span>
                  <button
                    onclick={sendMessage}
                    disabled={!messageInput.trim() || sending}
                    class={cn(
                      'flex items-center justify-center h-7 w-7 rounded-full transition-all',
                      messageInput.trim()
                        ? 'bg-[var(--clawdev-text,#1a1a1a)] dark:bg-white text-white dark:text-black hover:opacity-80 active:scale-95'
                        : 'bg-[var(--clawdev-bg-surface-border)] opacity-40 cursor-not-allowed',
                    )}
                    title="Send (Enter)"
                    data-shortcut="Cmd+Enter"
                  >
                    <ArrowUp class="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ Side Panel (Thread / Pinned / Search / Members / Agent Thoughts) ═══ -->
        {#if activeThread || showPinned || showSearch || showMembers || showAgentThoughts}
          <aside class={cn(
            'flex-shrink-0 border-l border-[var(--clawdev-bg-surface-border)] bg-[var(--clawdev-card-bg)] flex flex-col overflow-hidden',
            showAgentThoughts ? 'w-96' : 'w-80',
          )}>
            <!-- Panel header -->
            <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--clawdev-bg-surface-border)]">
              <h4 class="font-heading text-sm font-semibold flex items-center gap-1.5">
                {#if showAgentThoughts}
                  <Brain class="h-4 w-4 text-orange-500" />
                  <span>Agent Thoughts</span>
                  {#if agentThoughts.length > 0}
                    <span class="text-[10px] font-normal opacity-40">({agentThoughts.length})</span>
                  {/if}
                {:else if activeThread}Thread{:else if showPinned}Pinned Messages{:else if showSearch}Search{:else}Members{/if}
              </h4>
              <div class="flex items-center gap-1">
                {#if showAgentThoughts && agentThoughts.length > 0}
                  <button
                    onclick={() => { agentThoughts = []; }}
                    class="text-[10px] px-1.5 py-0.5 rounded hover:bg-[var(--clawdev-bg-surface-border)] opacity-50 hover:opacity-80 transition-opacity"
                  >
                    Clear
                  </button>
                {/if}
                <span class="kbd-hint">Esc</span>
                <button
                  onclick={() => { activeThread = null; showPinned = false; showSearch = false; showMembers = false; showAgentThoughts = false; }}
                  class="p-1 rounded hover:bg-[var(--clawdev-bg-surface-border)]"
                  data-shortcut="Esc"
                >
                  <X class="h-4 w-4" />
                </button>
              </div>
            </div>

            <div class="flex-1 overflow-y-auto">
              <!-- Thread panel -->
              {#if activeThread}
                <!-- Original message -->
                <div class="px-3 py-2 border-b border-[var(--clawdev-bg-surface-border)]">
                  <div class="flex items-baseline gap-2 mb-1">
                    <span class="font-semibold text-sm">{activeThread.senderDisplayName ?? activeThread.senderAgentName}</span>
                    <span class="text-[11px] opacity-40">{formatTime(activeThread.createdAt)}</span>
                  </div>
                  <p class="text-sm whitespace-pre-wrap">{activeThread.body}</p>
                </div>

                <div class="px-3 py-1">
                  <span class="text-xs opacity-40">{activeThread.replyCount ?? 0} replies</span>
                </div>

                <!-- Thread messages -->
                {#each threadMessages as msg (msg.id)}
                  {#if msg.id !== activeThread.id}
                    <div class="flex gap-2 px-3 py-1.5">
                      <div class="w-6 h-6 rounded bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                        <Bot class="h-3 w-3 opacity-70" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-baseline gap-2">
                          <span class="font-semibold text-xs">{msg.senderDisplayName ?? msg.senderAgentName ?? 'Unknown'}</span>
                          <span class="text-[10px] opacity-40">{formatTime(msg.createdAt)}</span>
                        </div>
                        <p class="text-xs whitespace-pre-wrap">{msg.body}</p>
                      </div>
                    </div>
                  {/if}
                {/each}

                <!-- Thread composer — Claude Code style compact -->
                <div class="px-3 py-2 mt-auto border-t border-[var(--clawdev-bg-surface-border)]">
                  <div class="relative rounded-xl border border-[var(--clawdev-bg-surface-border)] bg-[var(--clawdev-card-bg)] focus-within:border-[color-mix(in_srgb,var(--clawdev-bg-surface-border)_60%,var(--clawdev-primary)_40%)]">
                    <textarea
                      bind:value={threadInput}
                      placeholder="Reply..."
                      class="w-full resize-none bg-transparent px-3 pt-2 pb-1 text-xs focus:outline-none min-h-[32px] max-h-[80px] placeholder:opacity-35"
                      rows="1"
                      onkeydown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendThreadReply();
                        }
                      }}
                    ></textarea>
                    <div class="flex items-center justify-between px-2 pb-1.5">
                      <button
                        class="flex items-center justify-center h-5 w-5 rounded border border-[var(--clawdev-bg-surface-border)] hover:bg-[var(--clawdev-bg-surface)] transition-colors"
                        title="Attach"
                      >
                        <Plus class="h-3 w-3 opacity-50" />
                      </button>
                      <button
                        onclick={sendThreadReply}
                        disabled={!threadInput.trim() || sendingThread}
                        class={cn(
                          'flex items-center justify-center h-5 w-5 rounded-full transition-all',
                          threadInput.trim()
                            ? 'bg-[var(--clawdev-text,#1a1a1a)] dark:bg-white text-white dark:text-black'
                            : 'bg-[var(--clawdev-bg-surface-border)] opacity-30 cursor-not-allowed',
                        )}
                      >
                        <ArrowUp class="h-3 w-3" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </div>

              <!-- Pinned panel -->
              {:else if showPinned}
                {#if pinnedMessages.length === 0}
                  <div class="p-4 text-center opacity-40 text-sm">No pinned messages</div>
                {:else}
                  {#each pinnedMessages as msg (msg.id)}
                    <div class="px-3 py-2 border-b border-[var(--clawdev-bg-surface-border)] hover:bg-[var(--clawdev-bg-surface)] cursor-pointer">
                      <div class="flex items-baseline gap-2 mb-1">
                        <span class="font-semibold text-xs">{msg.senderDisplayName ?? msg.senderAgentName}</span>
                        <span class="text-[10px] opacity-40">{formatTime(msg.createdAt)}</span>
                      </div>
                      <p class="text-xs line-clamp-3">{msg.body}</p>
                    </div>
                  {/each}
                {/if}

              <!-- Search panel -->
              {:else if showSearch}
                <div class="p-3">
                  <div class="flex gap-2">
                    <Input
                      bind:value={searchQuery}
                      placeholder="Search messages..."
                      class="h-8 text-sm"
                      onkeydown={(e) => { if (e.key === 'Enter') searchMessages(); }}
                    />
                    <Button onclick={searchMessages} class="h-8 px-3 text-xs">
                      <Search class="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {#each searchResults as msg (msg.id)}
                  <div class="px-3 py-2 border-b border-[var(--clawdev-bg-surface-border)] hover:bg-[var(--clawdev-bg-surface)] cursor-pointer">
                    <div class="flex items-baseline gap-2 mb-1">
                      <span class="font-semibold text-xs">{msg.senderDisplayName ?? msg.senderAgentName}</span>
                      <span class="text-[10px] opacity-40">{formatTime(msg.createdAt)}</span>
                    </div>
                    <p class="text-xs line-clamp-3">{msg.body}</p>
                  </div>
                {/each}

              <!-- Members panel -->
              {:else if showMembers}
                {#each members as member (member.id)}
                  <div class="flex items-center gap-2 px-3 py-2 hover:bg-[var(--clawdev-bg-surface)]">
                    <div class="relative w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                      <Bot class="h-3.5 w-3.5 opacity-70" />
                      <AgentStatusDot status="online" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium truncate">{member.nickname ?? member.agentName ?? 'User'}</p>
                      <p class="text-[10px] opacity-40">{member.agentRole ?? member.role}</p>
                    </div>
                    <Badge variant="outline" class="text-[9px]">{member.role}</Badge>
                  </div>
                {/each}

              <!-- Agent Thoughts panel -->
              {:else if showAgentThoughts}
                {#if agentThoughts.length === 0}
                  <div class="flex flex-col items-center justify-center h-full p-6 text-center opacity-40">
                    <Brain class="h-8 w-8 mb-2 opacity-30" />
                    <p class="text-sm font-medium">No agent activity yet</p>
                    <p class="text-xs mt-1">Agent thoughts will appear here in real-time when they process messages</p>
                  </div>
                {:else}
                  <div bind:this={thoughtsContainer} class="flex-1 overflow-y-auto">
                    {#each agentThoughts as thought (thought.id)}
                      {@const isError = thought.level === 'error'}
                      {@const isLifecycle = thought.eventType === 'lifecycle'}
                      {@const isStdout = thought.stream === 'stdout'}
                      {@const isStderr = thought.stream === 'stderr'}
                      <div class={cn(
                        'px-3 py-2 border-b border-[var(--clawdev-bg-surface-border)]/50 transition-colors',
                        isError ? 'bg-red-500/5' : isLifecycle ? 'bg-blue-500/5' : 'hover:bg-[var(--clawdev-bg-surface)]/50',
                      )}>
                        <!-- Agent header -->
                        <div class="flex items-center gap-1.5 mb-1">
                          <div class={cn(
                            'w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[10px]',
                            isLifecycle
                              ? 'bg-blue-500/15 text-blue-500'
                              : isError
                                ? 'bg-red-500/15 text-red-500'
                                : 'bg-orange-500/15 text-orange-500',
                          )}>
                            {#if resolveAgentEmoji(thought.agentIcon)}
                              <span>{resolveAgentEmoji(thought.agentIcon)}</span>
                            {:else if isLifecycle}
                              <Zap class="h-3 w-3" />
                            {:else}
                              <Brain class="h-3 w-3" />
                            {/if}
                          </div>
                          <span class="text-[11px] font-semibold truncate">{thought.agentName}</span>
                          <span class="text-[9px] opacity-30 tabular-nums flex-shrink-0">
                            {thought.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                          </span>
                          {#if isLifecycle}
                            <Badge variant="outline" class="text-[8px] px-1 py-0 h-3.5 border-blue-500/20 text-blue-500">lifecycle</Badge>
                          {:else if isStderr}
                            <Badge variant="outline" class="text-[8px] px-1 py-0 h-3.5 border-red-500/20 text-red-500">stderr</Badge>
                          {:else if isStdout}
                            <Badge variant="outline" class="text-[8px] px-1 py-0 h-3.5 border-green-500/20 text-green-500">stdout</Badge>
                          {/if}
                        </div>
                        <!-- Thought content -->
                        <div class={cn(
                          'text-xs leading-relaxed ml-6.5 whitespace-pre-wrap break-words font-mono',
                          isError ? 'text-red-400' : isLifecycle ? 'text-blue-400' : 'opacity-80',
                        )}>
                          {thought.message}
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
              {/if}
            </div>
          </aside>
        {/if}
      </div>
    {/if}
  </main>
</div>
