<script lang="ts">
  import { onMount } from 'svelte';
  import { advance } from './game/advance';
  import { loadGame, saveGame, type SaveStorage } from './game/save';
  import { createInitialState } from './game/state';
  import { PAGE_VERSION } from './game/version';

  let game = createInitialState();
  let saveProblem: { reason: string; raw?: string } | null = null;
  let lastMs = 0;
  let storage: SaveStorage;
  let showInventory = true;
  let showJournal = true;
  let activeTab: 'story' | 'locations' | 'actions' | 'tasks' = 'story';

  function elapsedLabel(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}时 ${minutes}分 ${seconds % 60}秒`;
  }

  function tick(): void {
    if (saveProblem) return;
    const now = Date.now();
    game = advance(game, Math.max(0, now - lastMs));
    lastMs = now;
    try {
      saveGame(storage, game, now);
    } catch (error) {
      saveProblem = { reason: error instanceof Error ? error.message : '存档写入失败' };
    }
  }

  function startNew(): void {
    if (!confirm('确定清空这份无法读取的存档并重新开始？请先复制下方原始内容留作备份。')) return;
    const raw = saveProblem?.raw;
    try {
      const nextGame = createInitialState();
      const now = Date.now();
      saveGame(storage, nextGame, now);
      game = nextGame;
      lastMs = now;
      saveProblem = null;
    } catch (error) {
      saveProblem = { reason: error instanceof Error ? error.message : '无法重建存档', raw };
    }
  }

  onMount(() => {
    try {
      storage = window.localStorage;
      lastMs = Date.now();
      const loaded = loadGame(storage, lastMs);
      if (loaded.status === 'invalid') {
        saveProblem = { reason: loaded.reason, raw: loaded.raw };
      } else {
        game = loaded.state;
        saveGame(storage, game, lastMs);
      }
    } catch (error) {
      saveProblem = { reason: error instanceof Error ? error.message : '本地存储不可用' };
    }
    const timer = window.setInterval(tick, 1000);
    window.addEventListener('pagehide', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', tick);
    };
  });
</script>

<svelte:head>
  <meta name="description" content="炼器宗：以五行轮转与生产建设为核心的网页放置游戏。" />
</svelte:head>

<div class="shell">
  <header class="topbar">
    <div class="topbar-controls">
      <button type="button" aria-controls="inventory-panel" aria-expanded={showInventory} onclick={() => showInventory = !showInventory}>
        {showInventory ? '收起行囊' : '展开行囊'}
      </button>
    </div>
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">◇</span>
      <div>
        <p class="eyebrow">REFINING SECT</p>
        <h1>炼器宗</h1>
      </div>
    </div>
    <div class="topbar-status">
      <span>筑器峰 · 宅院</span>
      <span>历时 {elapsedLabel(game.elapsedMs)}</span>
      <span class="version">{PAGE_VERSION}</span>
      <button type="button" aria-controls="journal-panel" aria-expanded={showJournal} onclick={() => showJournal = !showJournal}>
        {showJournal ? '收起侧栏' : '展开侧栏'}
      </button>
    </div>
  </header>

  {#if saveProblem}
    <section class="save-alert" role="alert" aria-labelledby="save-alert-title">
      <h2 id="save-alert-title">存档需要处理</h2>
      <p>{saveProblem.reason}。游戏已停止写入，原始数据仍保留在浏览器中。</p>
      {#if saveProblem.raw}
        <label for="raw-save">原始存档（可复制备份）</label>
        <textarea id="raw-save" readonly value={saveProblem.raw}></textarea>
        <button type="button" onclick={startNew}>清空这份存档并重新开始</button>
      {/if}
    </section>
  {:else}
    <main class:inventory-hidden={!showInventory} class:journal-hidden={!showJournal} class="columns">
      <aside id="inventory-panel" class="panel inventory" aria-labelledby="inventory-title" hidden={!showInventory}>
        <div class="panel-heading">
          <p class="eyebrow">POSSESSIONS</p>
          <h2 id="inventory-title">行囊与物品</h2>
        </div>
        <div class="empty-slot" aria-label="行囊内容为空">
          <span aria-hidden="true">◇</span>
          <p>行囊尚未展开</p>
        </div>
      </aside>

      <section class="panel scene" aria-labelledby="scene-title">
        <div class="panel-heading">
          <p class="eyebrow">COURTYARD · 001</p>
          <h2 id="scene-title">筑器峰宅院</h2>
        </div>
        <div class="courtyard" aria-hidden="true">
          <div class="courtyard-roof"></div>
          <div class="courtyard-ground"><span>阵位</span></div>
        </div>
        <p class="scene-caption">院中空地寂静，尚待第一道阵纹落下。</p>
      </section>

      <aside id="journal-panel" class="panel journal" aria-label="剧情、地点、动作与任务" hidden={!showJournal}>
        <div class="journal-tabs" role="tablist" aria-label="侧栏栏目">
          <button type="button" role="tab" id="tab-story" aria-controls="journal-content" aria-selected={activeTab === 'story'} onclick={() => activeTab = 'story'}>剧情</button>
          <button type="button" role="tab" id="tab-locations" aria-controls="journal-content" aria-selected={activeTab === 'locations'} onclick={() => activeTab = 'locations'}>地点</button>
          <button type="button" role="tab" id="tab-actions" aria-controls="journal-content" aria-selected={activeTab === 'actions'} onclick={() => activeTab = 'actions'}>动作</button>
          <button type="button" role="tab" id="tab-tasks" aria-controls="journal-content" aria-selected={activeTab === 'tasks'} onclick={() => activeTab = 'tasks'}>任务</button>
        </div>
        <div id="journal-content" class="journal-content" role="tabpanel" aria-labelledby={`tab-${activeTab}`} tabindex="0">
        {#if activeTab === 'story'}
        <section class="journal-section" aria-labelledby="story-title">
          <p class="eyebrow">STORY</p>
          <h2 id="story-title">剧情</h2>
          <p>你已获准进入内门。眼前这处宅院，将成为炼器之路的起点。</p>
        </section>
        {:else if activeTab === 'locations'}
        <section class="journal-section" aria-labelledby="locations-title">
          <p class="eyebrow">PLACES</p>
          <h2 id="locations-title">地点</h2>
          <p>筑器峰宅院</p>
        </section>
        {:else if activeTab === 'actions'}
        <section class="journal-section" aria-labelledby="actions-title">
          <p class="eyebrow">ACTIONS</p>
          <h2 id="actions-title">动作</h2>
          <p class="muted">尚无可执行的动作</p>
        </section>
        {:else}
        <section class="journal-section" aria-labelledby="tasks-title">
          <p class="eyebrow">TASKS</p>
          <h2 id="tasks-title">任务</h2>
          <p class="muted">尚无进行中的任务</p>
        </section>
        {/if}
        </div>
      </aside>
    </main>
  {/if}
</div>
