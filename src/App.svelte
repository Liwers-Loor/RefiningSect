<script lang="ts">
  import { onMount } from 'svelte';
  import { advance } from './game/advance';
  import { availableLocations, dispatch, type GameCommand } from './game/actions';
  import { quantityAt } from './game/inventory';
  import { arrayGoldQi, localAura, paperEarthToGold } from './game/resources';
  import { loadGame, saveGame, type SaveStorage } from './game/save';
  import { createInitialState, type LocationId, type MaterialId } from './game/state';
  import { PAGE_VERSION } from './game/version';

  const placeNames: Record<LocationId, string> = { courtyard: '筑器峰宅院', marsh: '泥沼', forest: '丛林', spring: '灵泉' };
  const materialNames: Record<MaterialId, string> = { earth: '泥土', wood: '木头', water: '水' };
  const itemNames: Record<string, string> = {
    bag: '下品行囊', bucket: '下品木桶', shovel: '下品铲子', saw: '下品锯子', ironBucket: '下品铁桶',
    duct: '下品精碳导管', paperArray: '纸质炼器阵', table: '桌子', cushion: '蒲团', bed: '床', cabinet: '柜子'
  };

  let game = createInitialState();
  let saveProblem: { reason: string; raw?: string } | null = null;
  let message = '';
  let lastMs = 0;
  let storage: SaveStorage;
  let showInventory = true;
  let showJournal = true;
  let activeTab: 'story' | 'locations' | 'actions' | 'tasks' = 'story';
  let paperSelected = false;
  let showFacilities = false;
  let earthInput = 100;

  $: bucket = game.items.find((item) => item.kind === 'bucket' && item.id === game.heldItemId);
  $: bagEarth = quantityAt(game, 'bag', 'earth');
  $: earthOnArray = quantityAt(game, 'paperArray', 'earth');
  $: goldOnArray = arrayGoldQi(game);

  function elapsedLabel(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    return `${Math.floor(seconds / 3600)}时 ${Math.floor((seconds % 3600) / 60)}分 ${seconds % 60}秒`;
  }

  function persist(): void {
    try {
      saveGame(storage, game, Date.now());
    } catch (error) {
      saveProblem = { reason: error instanceof Error ? error.message : '存档写入失败' };
    }
  }

  function perform(command: GameCommand): void {
    if (saveProblem) return;
    try {
      const now = Date.now();
      game = advance(game, Math.max(0, now - lastMs));
      lastMs = now;
      game = dispatch(game, command);
      message = '';
      persist();
      if (command.type === 'deployPaper' || command.type === 'storeWood' || command.type === 'enchantSaw') activeTab = 'locations';
      if (command.type === 'collectWater') activeTab = 'actions';
      if (command.type === 'restart') { activeTab = 'story'; paperSelected = false; showFacilities = false; }
    } catch (error) {
      message = error instanceof Error ? error.message : '操作失败';
      persist();
    }
  }

  function tick(): void {
    if (saveProblem) return;
    const now = Date.now();
    try {
      const wasPaper = game.activeAction?.kind === 'paper';
      game = advance(game, Math.max(0, now - lastMs));
      if (wasPaper && game.activeAction === null) activeTab = 'story';
      lastMs = now;
      saveGame(storage, game, now);
    } catch (error) {
      saveProblem = { reason: error instanceof Error ? error.message : '模拟或存档失败' };
    }
  }

  function resetGame(): void {
    if (confirm('确定重新开始？当前周目的进度会被替换，初始三种材料各有1,000份。')) perform({ type: 'restart' });
  }

  function replaceInvalidSave(): void {
    if (!confirm('确定替换这份无法读取的存档？请先复制下方原始内容留作备份。')) return;
    const raw = saveProblem?.raw;
    try {
      const next = createInitialState();
      saveGame(storage, next, Date.now());
      game = next;
      lastMs = Date.now();
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
      if (loaded.status === 'invalid') saveProblem = { reason: loaded.reason, raw: loaded.raw };
      else { game = loaded.state; saveGame(storage, game, lastMs); }
    } catch (error) {
      saveProblem = { reason: error instanceof Error ? error.message : '本地存储不可用' };
    }
    const timer = window.setInterval(tick, 1000);
    window.addEventListener('pagehide', tick);
    return () => { window.clearInterval(timer); window.removeEventListener('pagehide', tick); };
  });
</script>

<svelte:head>
  <meta name="description" content="炼器宗：以五行轮转与生产建设为核心的网页放置游戏。" />
</svelte:head>

<div class="shell">
  <header class="topbar">
    <div class="topbar-controls"><button type="button" aria-controls="inventory-panel" aria-expanded={showInventory} onclick={() => showInventory = !showInventory}>{showInventory ? '收起行囊' : '展开行囊'}</button></div>
    <div class="brand"><span class="brand-mark" aria-hidden="true">◇</span><div><p class="eyebrow">REFINING SECT</p><h1>炼器宗</h1></div></div>
    <div class="topbar-status"><span>{placeNames[game.locationId]}</span><span>历时 {elapsedLabel(game.elapsedMs)}</span><span class="version">{PAGE_VERSION}</span><button type="button" aria-controls="journal-panel" aria-expanded={showJournal} onclick={() => showJournal = !showJournal}>{showJournal ? '收起侧栏' : '展开侧栏'}</button></div>
  </header>

  {#if saveProblem}
    <section class="save-alert" role="alert" aria-labelledby="save-alert-title">
      <h2 id="save-alert-title">存档需要处理</h2>
      <p>{saveProblem.reason}。游戏已停止写入，原始数据仍保留在浏览器中。</p>
      {#if saveProblem.raw}
        <label for="raw-save">原始存档（可复制备份）</label>
        <textarea id="raw-save" readonly value={saveProblem.raw}></textarea>
        <button type="button" onclick={replaceInvalidSave}>替换这份存档并重新开始</button>
      {/if}
    </section>
  {:else}
    <main class:inventory-hidden={!showInventory} class:journal-hidden={!showJournal} class="columns">
      <aside id="inventory-panel" class="panel inventory" aria-labelledby="inventory-title" hidden={!showInventory}>
        <div class="panel-heading"><p class="eyebrow">POSSESSIONS</p><h2 id="inventory-title">行囊与物品</h2></div>
        <p class="energy">主角灵气 <strong>{game.playerEnergy} / 100</strong></p>
        <h3>携带</h3>
        <ul class="stock-list">
          {#each game.items.filter((item) => item.ownerId === 'player') as item (item.id)}
            <li>
              <span>{itemNames[item.kind]}{item.id === game.heldItemId ? ' · 手持' : ''}</span>
              {#if item.kind === 'bucket' || item.kind === 'saw'}<button type="button" onclick={() => perform({ type: 'hold', itemId: item.id })}>拿起</button>{/if}
              {#if item.kind === 'paperArray' && !game.paperDeployed}<button class:tutorial-focus={!paperSelected && !game.restartMode} type="button" onclick={() => paperSelected = true}>选中</button>{/if}
            </li>
          {/each}
        </ul>
        <h3>行囊材料</h3>
        <ul class="stock-list">
          {#each ['earth', 'wood', 'water'] as kind}
            <li><span>{materialNames[kind as MaterialId]}</span><strong>{quantityAt(game, 'bag', kind as MaterialId)} / 100</strong></li>
          {/each}
        </ul>
        {#if bucket}
          <p class="small-note">手持木桶：泥土 {quantityAt(game, bucket.id as `bucket:${number}`, 'earth')}，水 {quantityAt(game, bucket.id as `bucket:${number}`, 'water')} / 10</p>
          <button type="button" onclick={() => perform({ type: 'emptyBucket' })}>将桶中物资倒入行囊</button>
        {/if}
        {#if game.locationId === 'courtyard'}
          <h3>宅院仓储</h3>
          <p>土堆 {quantityAt(game, 'earthStore', 'earth')} · 柴房 {quantityAt(game, 'woodStore', 'wood')} · 水窖 {quantityAt(game, 'waterStore', 'water')}</p>
        {/if}
      </aside>

      <section class="panel scene" aria-labelledby="scene-title">
        <div class="panel-heading"><p class="eyebrow">{game.locationId.toUpperCase()}</p><h2 id="scene-title">{placeNames[game.locationId]}</h2></div>
        <div class:marsh={game.locationId === 'marsh'} class:forest={game.locationId === 'forest'} class:spring={game.locationId === 'spring'} class="courtyard">
          {#if game.locationId === 'courtyard'}
            <div class="courtyard-roof"></div>
            {#if showFacilities && !game.paperDeployed}<button class="table-action" class:tutorial-focus={paperSelected && !game.restartMode} type="button" onclick={() => { if (paperSelected) perform({ type: 'deployPaper' }); else message = '先在行囊中选中纸质炼器阵'; }}>桌子 · 铺开纸质阵图</button>{/if}
            <div class="courtyard-ground"><span>{game.paperDeployed ? '纸阵' : '阵位'}</span></div>
          {:else if game.locationId === 'marsh'}
            <button class="site-action" type="button" onclick={() => perform({ type: 'collectEarth' })}>泥潭 · 装土</button>
          {:else if game.locationId === 'forest'}
            <button class="site-action" type="button" onclick={() => perform({ type: 'chopWood' })}>椰树林 · 砍伐</button>
          {:else}
            <button class="site-action" type="button" onclick={() => perform({ type: 'collectWater' })}>泉眼 · 取水</button>
          {/if}
        </div>
        {#if game.locationId === 'courtyard'}
          <p class="scene-caption">{game.paperDeployed ? `土阵眼 ${earthOnArray} 份泥土 · 金阵眼 ${goldOnArray} 点金气 · 本地游离土气 ${localAura(game, 'earth')}` : '院中空地寂静，尚待第一道阵纹落下。'}</p>
          {#if !game.paperDeployed}<button class="facility-button" class:tutorial-focus={paperSelected && !showFacilities && !game.restartMode} type="button" onclick={() => showFacilities = !showFacilities}>设施{showFacilities ? ' · 收起' : ' · 展开'}</button>{/if}
        {:else}<p class="scene-caption">{game.locationId === 'marsh' ? '泥土需要先装进木桶，再倒入行囊。' : game.locationId === 'forest' ? `锯子赋能强度 +${game.sawBoostPercent}%；每次点击只结算一次。` : '木桶每次可装十份水。'}</p>{/if}
        {#if game.activeAction}<p class="progress" role="status">{game.activeAction.kind === 'paper' ? '纸阵催动中' : '手工制桶中'} · 剩余 {Math.ceil(game.activeAction.remainingMs / 1000)} 秒</p>{/if}
        {#if message}<p class="feedback" role="alert">{message}</p>{/if}
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
            <section class="journal-section"><p class="eyebrow">STORY</p><h2>剧情</h2>
              {#if game.tutorialPaused}<p>纸阵炼出了金气，也泄出大量土气。模拟时间已暂停。趁金气尚未消散，请在“动作”中将它赋给锯子。</p>
              {:else if !game.paperDeployed}<p>外门大比前十，让你获准进入内门。宗门赐下一处宅院和一张纸质阵图。先在行囊中选中阵图，展开“设施”，再点击桌子。</p>
              {:else if !game.milestones.firstTransform}<p>阵图已经铺好。打开“地点”前往泥沼，拿起木桶装土；回院后将泥土放上土阵眼。</p>
              {:else if !game.milestones.woodStored}<p>金气已能让锯子更快砍树。前往丛林取得木头，再带回宅院柴房。</p>
              {:else if !game.milestones.waterCollected}<p>柴房已有木头，灵泉已经显现。携木桶取水；拓印地面炼器阵仍需泥土、木头和水各两千份。</p>
              {:else}<p>第一口水已取到。你可以将水存入水窖，再用木头按图纸手工制作第二只木桶。</p>{/if}
            </section>
          {:else if activeTab === 'locations'}
            <section class="journal-section"><p class="eyebrow">PLACES</p><h2>地点</h2>
              <div class="action-list">{#each availableLocations(game) as location}<button type="button" aria-current={game.locationId === location ? 'location' : undefined} onclick={() => perform({ type: 'travel', locationId: location })}>{placeNames[location]}</button>{/each}</div>
            </section>
          {:else if activeTab === 'actions'}
            <section class="journal-section"><p class="eyebrow">ACTIONS</p><h2>动作</h2><div class="action-list">
              {#if game.locationId === 'courtyard' && game.paperDeployed}
                <label for="earth-input">投放泥土数量（预计金气 {paperEarthToGold(Math.max(1, Math.floor(Number(earthInput) || 1))).goldQi} 点）</label>
                <input id="earth-input" type="number" min="1" max={bagEarth} bind:value={earthInput} />
                <button type="button" onclick={() => perform({ type: 'placeEarth', quantity: earthInput })}>从行囊投入土阵眼</button>
                <button type="button" onclick={() => perform({ type: 'startPaper' })}>催动纸阵 · 10秒耗灵气50</button>
                {#if goldOnArray > 0}<button type="button" onclick={() => perform({ type: 'enchantSaw' })}>将金气赋予锯子</button>{/if}
                <button type="button" onclick={() => perform({ type: 'storeWood' })}>将行囊木头存入柴房</button>
                <button type="button" onclick={() => perform({ type: 'withdrawWood' })}>从柴房取木头5份</button>
                <button type="button" onclick={() => perform({ type: 'storeWater' })}>将行囊水存入水窖</button>
              {/if}
              <button type="button" onclick={() => perform({ type: 'startCraftBucket' })}>手工制作木桶 · 木头5份 / 400秒</button>
              {#if game.activeAction?.kind === 'craftBucket'}<button type="button" onclick={() => perform({ type: 'cancelCraftBucket' })}>中断手作（投入不返还）</button>{/if}
              <button type="button" onclick={resetGame}>重置游戏</button>
            </div></section>
          {:else}
            <section class="journal-section"><p class="eyebrow">TASKS</p><h2>任务</h2>
              {#if !game.paperDeployed}<p>展开纸质炼器阵，迈出炼器的第一步。</p>
          {:else if !game.milestones.woodStored}<p>去内门藏经阁求教：纸阵泄漏的土气如何回收？</p><p>继续走出宅院，认识泥土、金气与木头的生产链。</p>
              {:else}<p>积攒基础资源，准备拓印初级固定炼器阵：</p><p>泥土 {quantityAt(game, 'earthStore', 'earth')} / 2,000<br />木头 {quantityAt(game, 'woodStore', 'wood')} / 2,000<br />水 {quantityAt(game, 'waterStore', 'water')} / 2,000</p>{/if}
              {#if game.milestones.bucketCrafted}<p>已按图纸制成第二只木桶。</p>{/if}
            </section>
          {/if}
        </div>
      </aside>
    </main>
  {/if}
</div>
