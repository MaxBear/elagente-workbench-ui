import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const output = path.resolve(process.env.LAYOUT_OUTPUT || './layout-evidence');
await mkdir(output, {recursive:true});
const browser = await chromium.launch({headless:true});
const records = [];
const errors = [];
async function screenshot(page, name) { await page.screenshot({path:path.join(output, `${name}.png`)}); }
async function bounded(page, name) {
  const geometry = await page.evaluate(() => ({width:innerWidth, height:innerHeight, scrollWidth:document.documentElement.scrollWidth, scrollHeight:document.documentElement.scrollHeight, bodyWidth:document.body.scrollWidth}));
  assert.ok(geometry.scrollWidth <= geometry.width && geometry.bodyWidth <= geometry.width, `${name}: horizontal overflow ${JSON.stringify(geometry)}`);
  assert.ok(geometry.scrollHeight <= geometry.height, `${name}: page scroll traps pane scroll`);
  records.push({name, ...geometry});
}
async function visibleControl(page, selector, bottom) {
  const rect = await page.locator(selector).boundingBox();
  assert.ok(rect && rect.x >= 0 && rect.y >= 0 && rect.x+rect.width <= (await page.evaluate(() => innerWidth)) && rect.y+rect.height <= bottom+1, `Control outside usable viewport: ${selector} ${JSON.stringify(rect)}`);
}
try {
  for (const viewport of [{width:1440,height:900}, {width:390,height:844}, {width:900,height:700}]) {
    for (const theme of ['light','dark']) {
      const context = await browser.newContext({viewport});
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      const label = `${viewport.width}-${theme}`;
      await page.goto(`${process.env.LAYOUT_URL || 'http://127.0.0.1:5183'}/?theme=${theme}`);
      await page.locator('.thread-graph-composer-input [contenteditable]').waitFor();
      await page.locator('.thread-graph-composer-input [contenteditable]').fill('Inspect this workspace');
      // Explorer starts closed; the desktop checks open it from the top bar.
      if (viewport.width === 1440) {
        await page.getByRole('button', {name:'Toggle Explorer',exact:true}).click();
        await page.locator('span[title="inspection-result-0.txt"]').waitFor();
      }
      await bounded(page, label);
      // Document width cannot detect content clipped inside a bounded pane.
      const usageFields = await page.locator('.thread-turn-usage > span').evaluateAll(nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect();
        const pane = node.closest('.thread-graph-scroll-container').getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(node);
        return {text:node.textContent, width:rect.width, height:rect.height, left:pane.left, right:pane.right, lines:Array.from(range.getClientRects(), line => ({left:line.left, right:line.right}))};
      }));
      // The running turn's footer shows its usage row (model, effort, speed; TurnUsageInline).
      assert.ok(usageFields.length >= 2, 'Usage fixture must expose the running turn usage row');
      for (const field of usageFields) {
        assert.ok(field.width > 0 && field.height > 0, `Hidden usage field: ${field.text}`);
        for (const line of field.lines) assert.ok(line.left >= field.left - 1 && line.right <= field.right + 1, `Clipped usage text: ${field.text}`);
      }
      await visibleControl(page, '.thread-graph-composer-send-button', viewport.height);
      await visibleControl(page, '.thread-graph-composer-stop-button', viewport.height);
      await screenshot(page, `${label}-chat`);
      if (viewport.width === 1440) {
        const handle = page.getByRole('separator', {name:'Resize Explorer',exact:true});
        await handle.focus();
        // The separator resizes with the arrow keys only (Home/End were dropped in c29aca5): step to each limit.
        const minimum = Number(await handle.getAttribute('aria-valuemin'));
        const stepTo = async key => { for (let step = 0; step < 60; step++) await page.keyboard.press(key); };
        await stepTo('ArrowRight');
        assert.equal(Number(await handle.getAttribute('aria-valuenow')), minimum);
        await page.keyboard.press('ArrowLeft');
        assert.equal(Number(await handle.getAttribute('aria-valuenow')), minimum + 24);
        // Width persists across a reload; the Explorer itself opens closed again.
        await page.reload();
        await page.getByRole('button', {name:'Toggle Explorer',exact:true}).click();
        await handle.waitFor();
        assert.equal(Number(await handle.getAttribute('aria-valuenow')), minimum + 24);
        await handle.focus();
        await stepTo('ArrowLeft');
        assert.equal(await handle.getAttribute('aria-valuenow'), await handle.getAttribute('aria-valuemax'));
        await bounded(page, `${label}-resized`);
        // Pointer resizing also persists, without allowing a narrow chat pane.
        const rect = await handle.boundingBox();
        await page.mouse.move(rect.x+rect.width/2, rect.y+100);
        await page.mouse.down(); await page.mouse.move(rect.x+80,rect.y+100); await page.mouse.up();
        const width = Number(await handle.getAttribute('aria-valuenow'));
        assert.ok(width >=minimum && width<=Number(await handle.getAttribute('aria-valuemax')));
        // A narrower window clamps the drawn Explorer (chat keeps 320px) without overwriting the saved width.
        // The separator's aria values refresh on the next resize, so the checks use the drawn geometry.
        const drawn = () => page.evaluate(() => ({explorer:Math.round(document.querySelector('aside.matter-explorer').getBoundingClientRect().width), chat:document.querySelector('.matter-chat').getBoundingClientRect().width}));
        await page.setViewportSize({width:1100,height:900});
        await page.waitForFunction(() => document.querySelector('.matter-chat').getBoundingClientRect().width >= 320);
        assert.ok((await drawn()).explorer < width);
        await bounded(page, `${label}-narrow-desktop`);
        await page.setViewportSize(viewport);
        await page.waitForFunction(expected => Math.round(document.querySelector('aside.matter-explorer').getBoundingClientRect().width) === expected, width);
        await screenshot(page, `${label}-workspace-resized`);
        // Closing the desktop Explorer unmounts it (c29aca5); reopening shows the tree again.
        await page.getByRole('button', {name:'Toggle Explorer',exact:true}).click();
        assert.equal(await page.locator('aside.matter-explorer').count(), 0);
        await page.getByRole('button', {name:'Toggle Explorer',exact:true}).click();
        await page.locator('span[title="inspection-result-0.txt"]').waitFor();
      } else {
        // Files open from the phone dock or the top bar ("Toggle Explorer" in both).
        await page.getByRole('button', {name:'Toggle Explorer',exact:true}).click();
        await page.locator('span[title="inspection-result-0.txt"]').waitFor();
        const treeScroll = page.locator('.thread-graph-workspace-tree-scroll');
        await treeScroll.hover();
        await page.mouse.wheel(0, 2200);
        await page.waitForFunction(() => document.querySelector('.thread-graph-workspace-tree-scroll').scrollTop > 500);
        await treeScroll.evaluate(node => {node.scrollTop=0;});
        await page.locator('span[title="inspection-result-0.txt"]').click();
        await page.getByText('Persistent inspection fixture', {exact:false}).waitFor();
        await bounded(page, `${label}-workspace`);
        await screenshot(page, `${label}-workspace`);
        // Back to chat and to files again: the phone dock's Chat button, the top bar's toggle at 900px.
        if (viewport.width === 390) await page.locator('.matter-phone-dock').getByRole('button', {name:'Chat',exact:true}).click();
        else await page.getByRole('button', {name:'Toggle Explorer',exact:true}).click();
        await page.locator('.thread-graph-composer-input [contenteditable]').waitFor();
        // The Explorer remounts (c29aca5), so the reopened view shows the tree, not the last preview.
        await page.getByRole('button', {name:'Toggle Explorer',exact:true}).click();
        await page.locator('span[title="inspection-result-0.txt"]').waitFor();
        await page.getByRole('button', {name:'Close Explorer',exact:true}).click();
        await page.locator('aside.matter-explorer').waitFor({state:'detached'});
      }
      if (viewport.width === 390) {
        // The phone dock's More sheet opens the drawer; once that sheet has closed, focus returns to More.
        const more=page.getByRole('button', {name:'More actions',exact:true});
        const openDrawer=async () => { await more.click(); await page.getByRole('button', {name:'Workspace and shortcuts',exact:true}).click(); };
        await openDrawer();
        await page.getByRole('dialog', {name:'Thread navigation'}).waitFor();
        await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Close sidebar');
        await page.keyboard.press('Shift+Tab');
        assert.ok(await page.locator('.matter-sidebar').evaluate(node => node.contains(document.activeElement)));
        await screenshot(page, `${label}-navigation`);
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),'More actions');
        assert.equal(await page.locator('.matter-sidebar').getAttribute('inert'),'');
        await openDrawer();
        await page.getByRole('button', {name:'Agent Beta',exact:true}).click();
        assert.equal(await page.getByRole('dialog', {name:'Thread navigation'}).count(),0);
        assert.equal(await more.getAttribute('aria-expanded'),'false');
        assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),'More actions');
        // A deterministic visualViewport resize exercises the keyboard-inset path.
        await page.locator('.thread-graph-composer-input [contenteditable]').focus();
        await page.evaluate(() => { Object.defineProperty(window.visualViewport,'height',{configurable:true,value:500}); window.visualViewport.dispatchEvent(new Event('resize')); });
        // The composer lifts by the keyboard inset less the phone dock it covers (844 - 500 - 56).
        await page.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector('.thread-graph-composer-host')).bottom) >= 288);
        await visibleControl(page,'.thread-graph-composer-send-button',500);
        await visibleControl(page,'.thread-graph-composer-stop-button',500);
        await screenshot(page, `${label}-keyboard-inset`);
        await page.reload();
        await page.setViewportSize({width:390,height:500});
        await page.locator('.thread-graph-composer-input [contenteditable]').fill('Keyboard resize fixture');
        await visibleControl(page,'.thread-graph-composer-send-button',500);
        await visibleControl(page,'.thread-graph-composer-stop-button',500);
        await bounded(page,`${label}-keyboard-resized`);
        await screenshot(page, `${label}-keyboard-resized`);
        await page.setViewportSize(viewport);
      }
      // Unavailable and connected shells share theme tokens and agent selection.
      const themeTokens=await page.locator('.matter-workbench').evaluate(node=>({fg:getComputedStyle(node).getPropertyValue('--theme-fg'), bg:getComputedStyle(node).getPropertyValue('--theme-bg')}));
      await page.goto(`${process.env.LAYOUT_URL || 'http://127.0.0.1:5183'}/?theme=${theme}&unavailable=1`);
      await page.locator('.fixture-unavailable').waitFor();
      const unavailableTokens=await page.locator('.matter-workbench').evaluate(node=>({fg:getComputedStyle(node).getPropertyValue('--theme-fg'), bg:getComputedStyle(node).getPropertyValue('--theme-bg')}));
      assert.deepEqual(unavailableTokens,themeTokens);
      if(viewport.width===390) { await page.getByRole('button',{name:'More actions',exact:true}).click(); await page.getByRole('button',{name:'Workspace and shortcuts',exact:true}).click(); }
      await page.getByRole('button',{name:'Agent Beta',exact:true}).click();
      assert.equal(await page.locator('.matter-sidebar button').filter({hasText:'Agent Beta'}).getAttribute('aria-pressed'),'true');
      await bounded(page,`${label}-unavailable`);
      await screenshot(page, `${label}-unavailable`);
      await context.close();
    }
  }
  assert.deepEqual(errors,[]);
  await writeFile(path.join(output,'results.json'),JSON.stringify({passed:true,records,errors,keyboard:'Chromium viewport + synthetic visualViewport; physical mobile IME remains W11 acceptance'},null,2));
  console.log(`Passed ${records.length} layout geometry checks; screenshots in ${output}`);
} finally { await browser.close(); }
