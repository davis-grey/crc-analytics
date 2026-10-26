/** Real rendered application checks. Test-only Playwright, no app dependency.
 * CI supplies CRC_PLAYWRIGHT_MODULE from an isolated temporary install.
 */
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const {chromium}=require(process.env.CRC_PLAYWRIGHT_MODULE || 'playwright');
const output=process.env.CRC_SCREENSHOTS || path.join(require('node:os').tmpdir(),'crc-mvp-mobile');
fs.mkdirSync(output,{recursive:true});
const types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.md':'text/plain'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  const target=file===root?path.join(root,'index.html'):file;
  if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(target,(err,bytes)=>{if(err){res.writeHead(404).end();return;}res.setHeader('content-type',types[path.extname(target)]||'application/octet-stream');res.end(bytes);});
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try {
    for(const width of [320,393,430,1280]) {
      const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(origin,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('#tab-panel-overview .grid')).display==='grid');
      assert.equal(await page.locator('#mvp-leader-points').textContent(),'211.2 Pts');
      const noOverflow=async(label)=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}px ${label}: document overflow`);
      await noOverflow('overview');
      if(width<768) {
        await page.getByRole('button',{name:'Toggle navigation menu'}).click();
        assert.equal(await page.locator('#mobile-nav-menu').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(11, 15, 25)');
        await page.locator('#mobile-nav-menu [data-tab-target="leaderboard"]').click();
        assert.equal(await page.locator('#mobile-nav-menu').isVisible(),false);
      } else await page.locator('nav [data-tab-target="leaderboard"]').click();
      for(const id of ['leaderboard-batting-body','leaderboard-bowling-body']) {
        const table=page.locator('#'+id).locator('..');
        assert.equal(await table.getByRole('columnheader',{name:'Impact',exact:false}).count(),1);
        assert.ok(await table.locator('tbody tr').count()>0);
        await table.getByRole('columnheader',{name:'Impact',exact:false}).click();
        // Impact is a real numeric sort, not formatted-string ordering.
        const values=await table.locator('tbody tr').evaluateAll(rows=>rows.map(r=>Number(r.children[2].textContent.trim())));
        assert.deepEqual(values,[...values].sort((a,b)=>b-a));
        if(width<768)assert.ok(await table.evaluate(e=>e.scrollWidth>e.parentElement.clientWidth),'table should scroll within mobile region');
      }
      await noOverflow('season impact tables');
      await page.screenshot({path:path.join(output,`season-${width}.png`),fullPage:true});
      // Open actual participant profile via its season-table link.
      await page.locator('#leaderboard-mvp-body').getByText('Davison',{exact:true}).click();
      assert.equal(await page.locator('#modal-stat-batting-impact').textContent(),'-2.8');
      assert.equal(await page.locator('#modal-stat-bowling-impact').textContent(),'123.8');
      assert.equal(await page.locator('#modal-stat-potm').textContent(),'3');
      await noOverflow('profile');
      await page.screenshot({path:path.join(output,`profile-${width}.png`)});
      await page.locator('#player-modal-close').click();
      // Render every real fixture at each width using production navigation.
      const ids=await page.evaluate(()=>window.CRC_DATA.matches.map(m=>m.id));
      for(const id of ids) {
        await page.evaluate(id=>{openMatchScorecard(id);switchMatchSubTab('awards');},id);
        await noOverflow(id+' awards');
        assert.equal(await page.locator('#match-panel-awards').getByText('JOINT WINNER',{exact:false}).count(),0);
        const collisions=await page.locator('#match-panel-awards .podium-entry').evaluateAll(rows=>rows.filter(row=>{
          const [a,b]=[...row.children].map(e=>e.getBoundingClientRect());
          return a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;
        }).length);
        assert.equal(collisions,0,`${width}px ${id}: winner/stat overlap`);
        if(id==='csk-s3-m3-corkindians') {
          const cards=page.locator('#match-panel-awards .podium-entry');
          assert.match(await cards.nth(0).textContent(),/Srikanth[\s\S]*WINNER[\s\S]*30\.8/);
          assert.match(await cards.nth(1).textContent(),/Davison[\s\S]*28\.7/);
          assert.match(await cards.nth(2).textContent(),/Savio[\s\S]*27\.7/);
          await page.screenshot({path:path.join(output,`corkindians-awards-${width}.png`),fullPage:true});
        }
        await page.getByRole('button',{name:'Scorecard',exact:true}).click();
        assert.equal(await page.locator('#scorecard-tables-container th').filter({hasText:/^Impact$/}).count(),4);
        await noOverflow(id+' scorecards');
        if(id==='csk-s3-m3-corkindians')await page.screenshot({path:path.join(output,`scorecard-${width}.png`),fullPage:true});
      }
      await page.getByRole('button',{name:'How MVP Points Work'}).click();
      assert.match(await page.locator('#mvp-explainer-modal').textContent(),/Catch \+8 • Run-out \+12 • Stumping \+12/);
      await noOverflow('formula modal');
      assert.deepEqual(errors,[],`${width}px: application errors`);
      console.log(`PASS: ${width}px — all 7 match awards/scorecards, Impact sorting, profiles, formula, no overflow or podium overlaps`);
      await page.close();
    }
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
