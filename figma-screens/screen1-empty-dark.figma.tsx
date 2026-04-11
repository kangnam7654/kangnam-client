/* Screen 1: Main Chat View — Empty State (Dark Mode) */
/* 1440x900 desktop viewport */

<Frame name="Screen 1 — Empty State (Dark)" w={1440} h={900} flex="row" bg="#2b2a27" overflow="hidden">

  {/* ===== SIDEBAR (260px) ===== */}
  <Frame name="Sidebar" w={260} h="fill" flex="col" bg="#1f1e1b" stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeAlign="inside">

    {/* Drag region / traffic lights area */}
    <Frame name="DragRegion" w="fill" h={48} />

    {/* Header — New Chat + Search + Collapse */}
    <Frame name="SidebarHeader" w="fill" flex="row" items="center" gap={8} px={16} pb={12}>
      {/* New Chat button */}
      <Frame name="NewChatBtn" h={40} flex="row" items="center" gap={10} px={12} grow={1}
        rounded={8} stroke="rgba(255,255,255,0.08)" strokeWidth={1}>
        <SVG name="PlusIcon" w={16} h={16} svg='<svg viewBox="0 0 24 24" fill="none" stroke="#9a9893" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' />
        <Text size={14} weight={500} color="#eeeeee" font="Inter">New chat</Text>
      </Frame>
      {/* Search button */}
      <Frame name="SearchBtn" w={36} h={36} flex="row" items="center" justify="center"
        rounded={8} stroke="rgba(255,255,255,0.08)" strokeWidth={1}>
        <SVG name="SearchIcon" w={16} h={16} svg='<svg viewBox="0 0 24 24" fill="none" stroke="#9a9893" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' />
      </Frame>
      {/* Collapse button */}
      <Frame name="CollapseBtn" w={36} h={36} flex="row" items="center" justify="center"
        rounded={8} stroke="rgba(255,255,255,0.08)" strokeWidth={1}>
        <SVG name="SidebarIcon" w={16} h={16} svg='<svg viewBox="0 0 24 24" fill="none" stroke="#9a9893" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>' />
      </Frame>
    </Frame>

    {/* Conversation List — empty */}
    <Frame name="ConversationList" w="fill" grow={1} flex="col" px={8}>
      <Text size={13} color="#9a9893" font="Inter" w="fill" textAlign="center" py={48}>No conversations yet</Text>
    </Frame>

    {/* Bottom — Settings */}
    <Frame name="SidebarBottom" w="fill" flex="col" pt={12} pb={12} px={16}
      stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeAlign="inside">
      <Frame name="SettingsBtn" w="fill" flex="row" items="center" gap={10} px={12} py={10} rounded={8}>
        {/* Avatar circle */}
        <Frame name="Avatar" w={28} h={28} rounded={14} bg="#d97757" flex="row" items="center" justify="center">
          <Text size={11} weight="bold" color="#FFFFFF" font="Inter">U</Text>
        </Frame>
        <Text size={13} weight={500} color="#eeeeee" font="Inter" grow={1}>Settings</Text>
        <SVG name="GearIcon" w={15} h={15} svg='<svg viewBox="0 0 24 24" fill="none" stroke="#9a9893" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>' />
      </Frame>
    </Frame>
  </Frame>

  {/* ===== CHAT AREA ===== */}
  <Frame name="ChatArea" h="fill" grow={1} flex="col" bg="#2b2a27">

    {/* TopBar */}
    <Frame name="TopBar" w="fill" h={48} flex="row" items="center" justify="between" px={16}>
      {/* Left: New button */}
      <Frame name="TopNewBtn" flex="row" items="center" gap={6} px={10} py={6} rounded={8}>
        <SVG name="PlusSmall" w={14} h={14} svg='<svg viewBox="0 0 24 24" fill="none" stroke="#b0aea5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' />
        <Text size={12} color="#b0aea5" font="Inter">New</Text>
      </Frame>

      {/* Center: provider info */}
      <Frame name="TopCenter" flex="row" items="center" gap={8}>
        <Text size={12} weight={500} color="#9a9893" font="Inter" textTransform="uppercase">CLAUDE-CODE</Text>
        <Text size={12} color="#9a9893" font="Inter">/</Text>
        <Text size={12} color="#9a9893" font="Inter">claude-sonnet-4-20250514</Text>
      </Frame>

      {/* Right: Avatar */}
      <Frame name="TopAvatar" w={28} h={28} rounded={14} bg="#d97757" flex="row" items="center" justify="center">
        <Text size={11} weight="bold" color="#FFFFFF" font="Inter">U</Text>
      </Frame>
    </Frame>

    {/* Empty State */}
    <Frame name="EmptyState" w="fill" grow={1} flex="col" items="center" justify="center" gap={8} py={128}>
      {/* K Logo */}
      <Frame name="KLogo" w={40} h={40} rounded={12} bg="#d97757" flex="row" items="center" justify="center">
        <Text size={18} weight="bold" color="#FFFFFF" font="Inter">K</Text>
      </Frame>
      <Text size={18} weight={600} color="#eeeeee" font="Inter" pt={8}>무엇을 도와드릴까요?</Text>
      <Text size={14} color="#9a9893" font="Inter">Claude Code가 준비되었습니다</Text>
    </Frame>

    {/* Composer */}
    <Frame name="ComposerArea" w="fill" flex="col" items="center" px={24} pb={20} pt={12}>
      <Frame name="ComposerContainer" w={768} maxW={768} flex="col">
        <Frame name="ComposerBox" w="fill" flex="row" items="end" gap={12} px={16} py={12}
          rounded={16} stroke="rgba(255,255,255,0.08)" strokeWidth={1} bg="#353432"
          shadow="0px 4px 20px rgba(0,0,0,0.12)">
          <Text size={15} color="#9a9893" font="Inter" grow={1} py={2}>Ask Claude anything...</Text>
          {/* Send button */}
          <Frame name="SendBtn" w={32} h={32} rounded={8} bg="#d97757" flex="row" items="center" justify="center">
            <SVG name="SendIcon" w={14} h={14} svg='<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' />
          </Frame>
        </Frame>
      </Frame>
    </Frame>
  </Frame>
</Frame>
