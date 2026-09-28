// Browser check of ../../black-scholes.html: math against Python reference values, layout
// (every slider beside its plots, one screen), interactions, walkers, screenshots in ./shots.
// Usage: node src/black-scholes/check.cjs   (needs Playwright and Google Chrome)
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/Users/benmeyers/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const PAGE = path.join(__dirname, '..', '..', 'black-scholes.html'), shot = name => path.join(__dirname, 'shots', name);
fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
// Reference values: Python math.erfc, mu 6.74%, sigma 14.8%, 10y, r 4%, K 1.
const REF={d1:1.6741268866858978,above:1.2533302206511332,below:.06188458158759117,pAbove:.8861124203137707,EY:1.3152148022387244,efficientAbove:0.8618520873991842,call:.6593513022736547,efficientCall:.3707832080296659,efficientLeg:.49106887936951826};
const near = (a,b,tol=1e-6,msg='') => assert.ok(Math.abs(a-b)<tol, `${msg} ${a} differs from ${b}`);
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:1440,height:860},deviceScaleFactor:2});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{ if(m.type()==='error'&&!/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route('https://**/*',route=>route.abort());
  await page.goto('file://'+PAGE);
  await page.waitForFunction(()=>Boolean(window.dashboardCharts)); await page.waitForTimeout(400);
  const m=await page.evaluate(()=>window.metrics);
  // Reference values from Python's math.erfc for mu 6.74%, sigma 14.8%, 10y, r 4%, K 1.
  near(m.median,1.7585331077109134,1e-12,'median'); near(m.mean,1.9620699246831084,1e-12,'mean');
  near(m.pBelow,.5925108282814198,2e-7,'pBelow'); near(m.D,.6703200460356393,1e-12,'D'); near(m.EY,REF.EY,1e-12,'EY');
  near(m.d1,REF.d1,1e-12,'d1'); near(m.above,REF.above,3e-7,'above'); near(m.below,REF.below,3e-7,'below');
  near(m.pAbove,REF.pAbove,2e-7,'pAbove'); near(m.above+m.below,m.EY,1e-12,'split sums to E[Y]'); near(m.call,REF.call,5e-7,'call payoff');
  assert.ok(/not its price/.test(await page.locator('#replicate').textContent()),'unpriced call flagged');
  // Off by default: the efficient-market warning says how far off the price is.
  assert.equal(await page.locator('#market-warning').isVisible(),true,'warning visible');
  const warning=await page.locator('#market-warning-text').textContent();
  assert.ok(/31\.5% more today/.test(warning),warning); assert.equal(await page.locator('#total-flag').isVisible(),true,'flag at the total');
  // The controls sit between the real-world plots and the pricing plots.
  const cols=await page.evaluate(()=>['panel-outcome','stock-controls','panel-discount','panel-value'].map(id=>document.getElementById(id).getBoundingClientRect()));
  assert.ok(cols[0].right<=cols[1].left && cols[1].right<=cols[2].left && cols[1].right<=cols[3].left,'sidebar between the columns');
  // Every slider and every plot is fully on screen at once, without scrolling.
  const boxes=await page.evaluate(()=>[...document.querySelectorAll('.instrument input[type=range], .instrument canvas')].map(el=>{const r=el.getBoundingClientRect();return {id:el.id,top:r.top,bottom:r.bottom,w:r.width};}));
  for (const b of boxes) assert.ok(b.top>=0 && b.bottom<=860 && b.w>80, `${b.id} visible at 1440x860 (${b.top}-${b.bottom})`);
  // Plotted areas match the closed form (minus whatever lies beyond the visible axis).
  const numeric=await page.evaluate(()=>{ const c=dashboardCharts.value, t=p=>p.slice(1).reduce((s,q,i)=>s+(q.x-p[i].x)*(q.y+p[i].y)/2,0), top=c.data.datasets[1].data, leg=c.data.datasets[2].data;
    return {below:t(c.data.datasets[0].data),above:t(top),sliver:t(top.map((p,i)=>({x:p.x,y:p.y-leg[i].y}))),sameGrid:top.length===leg.length&&top.every((p,i)=>p.x===leg[i].x),lo:c.options.scales.x.min,hi:c.options.scales.x.max}; });
  assert.ok(numeric.sameGrid,'call fill shares the strike-leg grid'); assert.ok(numeric.sliver<=m.call+1e-6 && numeric.sliver>m.call-.06,'numeric call sliver');
  near(numeric.below,m.below,2e-3,'numeric below'); assert.ok(numeric.above<=m.above+1e-6 && numeric.above>m.above-.06,'numeric above within tail');
  await page.screenshot({path:shot('desktop-1440.png')});
  // Slide sigma: only the plots respond; sticky axes hold for small moves.
  const x0=await page.evaluate(()=>dashboardCharts.price.options.scales.x.max);
  await page.locator('#sigma').evaluate(el=>{el.value='16';el.dispatchEvent(new Event('input',{bubbles:true}));}); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>dashboardCharts.price.options.scales.x.max),x0,'x-axis holds while sliding');
  // Drag the strike directly on plot 04.
  const box=await page.locator('#value-chart').boundingBox(); const area=await page.evaluate(()=>dashboardCharts.value.chartArea);
  await page.mouse.move(box.x+area.left+area.width*.6,box.y+area.top+area.height*.5); await page.mouse.down();
  await page.mouse.move(box.x+area.left+area.width*.3,box.y+area.top+area.height*.5,{steps:6}); await page.mouse.up(); await page.waitForTimeout(300);
  const dragged=await page.evaluate(()=>({K:state.strike,pv:metrics.strikePV,x:dashboardCharts.value.scales.x.getValueForPixel(dashboardCharts.value.chartArea.left+dashboardCharts.value.chartArea.width*.3)}));
  near(dragged.pv,dragged.x,2e-3,'strike follows pointer');
  // The aligned slider thumb sits under the strike line.
  const thumb=await page.evaluate(()=>{const s=document.getElementById('strike'),r=s.getBoundingClientRect(),c=dashboardCharts.value,cr=c.canvas.getBoundingClientRect(),f=(s.value-s.min)/(s.max-s.min);return {thumb:r.left+9+f*(r.width-18),line:cr.left+c.scales.x.getPixelForValue(metrics.strikePV)};});
  near(thumb.thumb,thumb.line,1.5,'thumb aligned with strike line');
  // A drift below the rate: the stock should be worth less today.
  await page.locator('#reset').click(); await page.waitForTimeout(300);
  await page.locator('#mu').evaluate(el=>{el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));}); await page.waitForTimeout(500);
  const lessText=await page.locator('#market-warning-text').textContent(); assert.ok(/less today/.test(lessText),lessText);
  // The one-click fix and the switch: drift tied to r, total becomes today's price.
  await page.locator('#make-efficient').click(); await page.waitForTimeout(500);
  const eff=await page.evaluate(()=>({...metrics,on:state.efficient,checked:document.getElementById('efficient').checked}));
  assert.ok(eff.on&&eff.checked,'switch on'); near(eff.mu,.04,1e-12,'mu set to r'); near(eff.EY,1,1e-12,'total = 1'); near(eff.above,REF.efficientAbove,3e-7,'above = Phi(d1)');
  near(eff.call,REF.efficientCall,5e-7,'Black-Scholes call'); near(eff.strikeLeg,REF.efficientLeg,5e-7,'strike leg');
  assert.ok(/hold Δ = Φ\(d₁\) = 0\.862 shares/.test(await page.locator('#replicate').textContent()),'replication readout');
  assert.equal(await page.locator('#market-warning').isVisible(),false,'warning gone'); assert.equal(await page.locator('#market-ok').isVisible(),true,'ok shown');
  await page.locator('#r').evaluate(el=>{el.value='6';el.dispatchEvent(new Event('input',{bubbles:true}));}); await page.waitForTimeout(500);
  const tied=await page.evaluate(()=>({...metrics})); near(tied.mu,.06,1e-12,'moving r moves mu'); near(tied.EY,1,1e-12,'still 1');
  await page.screenshot({path:shot('desktop-efficient.png')});
  await page.locator('#efficient').evaluate(el=>el.click()); await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>state.efficient),false,'switch off');
  await page.locator('#reset').click(); await page.waitForTimeout(300);
  // Degenerate and extreme settings stay finite.
  for (const [mu,sig,dt,r] of [[-10,0,10,4],[20,60,40,0],[5,15,0,4],[20,.01,.003,20],[-10,60,40,20]]) {
    await page.evaluate(([mu,sig,dt,r])=>{for(const [id,v] of [['mu',mu],['sigma',sig],['r',r]]){const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));} const n=document.getElementById('deltaT-number');n.value=dt;n.dispatchEvent(new Event('input',{bubbles:true}));},[mu,sig,dt,r]);
    await page.waitForTimeout(350);
    const ok=await page.evaluate(()=>Object.values(dashboardCharts).every(c=>c.data.datasets.every(d=>d.data.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))))&&['above','below','EY','pAbove'].every(k=>Number.isFinite(metrics[k])));
    assert.ok(ok,`finite at ${mu},${sig},${dt},${r}`);
    near(await page.evaluate(()=>(metrics.above+metrics.below)/metrics.EY),1,1e-9,'areas add to E[Y]');
  }
  await page.locator('#reset').click(); await page.waitForTimeout(300);
  // 05 · Walkers: 2,000 coin-flip walkers per release; their median and mean match GBM, the no-Itô rule drifts off.
  const walkDone=()=>page.waitForFunction(()=>walkers.batches.length&&walkers.batches.every(b=>b.done),null,{timeout:15000});
  const walkStats=()=>page.evaluate(()=>{ const v=walkers.view, s2=v.sigma*v.sigma, f=v.disc?Math.exp(-v.r*v.T):1, e=walkEmpirical();
    return {n:e.n,median:e.median,mean:e.mean,gbmMedian:Math.exp((v.mu-s2/2)*v.T)*f,gbmMean:Math.exp(v.mu*v.T)*f,naiveMedian:Math.exp(v.mu*v.T)*f,maxFrame:walkers.stats.maxFrame}; });
  await page.locator('#walk-n').evaluate(el=>{el.value='3.30103';el.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.locator('#walk-release').textContent(),'Release 2,000 walkers');
  await page.locator('#walkers').scrollIntoViewIfNeeded(); await page.locator('#walk-release').click(); await walkDone();
  const priceWalk=await walkStats();
  assert.equal(priceWalk.n,2000); near(priceWalk.median/priceWalk.gbmMedian,1,.04,'price-step median ~ e^((mu-s^2/2)T)'); near(priceWalk.mean/priceWalk.gbmMean,1,.06,'price-step mean ~ e^(mu T)');
  await page.locator('#walk-release').click(); await walkDone();
  assert.equal((await walkStats()).n,4000,'pigment and histogram accumulate');
  await page.locator('#walkers').screenshot({path:shot('walkers-price.png')});
  await page.locator('input[name="walk-rule"][value="naive"]').check(); await page.waitForTimeout(100); await walkDone();
  const naiveWalk=await walkStats();
  assert.equal(naiveWalk.n,2000,'rule change respawns');
  assert.ok(Math.abs(naiveWalk.median-naiveWalk.naiveMedian)<Math.abs(naiveWalk.median-naiveWalk.gbmMedian),'no-Ito median drifts off to e^(mu T)');
  await page.locator('#walkers').screenshot({path:shot('walkers-naive.png')});
  await page.locator('input[name="walk-rule"][value="ito"]').check(); await page.waitForTimeout(100); await walkDone();
  const itoWalk=await walkStats(); near(itoWalk.median/itoWalk.gbmMedian,1,.04,'log steps with Ito match GBM');
  await page.locator('#walk-log').check(); await page.waitForTimeout(200);
  assert.equal((await walkStats()).n,2000,'log axis keeps the walkers');
  await page.locator('#walkers').screenshot({path:shot('walkers-log.png')});
  await page.locator('#walk-log').uncheck();
  // Efficient market in today's money: the walkers' mean stays at 1, a martingale.
  await page.locator('#walk-discount').check(); await page.locator('#make-efficient').click(); await page.waitForTimeout(450); await walkDone();
  const mart=await walkStats(); near(mart.mean,1,.06,'discounted mean is 1'); near(mart.gbmMean,1,1e-12,'theory mean is 1');
  await page.locator('#walkers').screenshot({path:shot('walkers-martingale.png')});
  await page.locator('#walk-discount').uncheck(); await page.locator('#walk-clear').click(); await page.locator('#reset').click(); await page.waitForTimeout(300);
  const walkReport={price:priceWalk,naive:naiveWalk,ito:itoWalk,martingaleMean:mart.mean,maxFrameMs:mart.maxFrame};
  for (const [w,h] of [[1180,820],[900,1000],[390,844],[320,700]]) {
    await page.setViewportSize({width:w,height:h}); await page.waitForTimeout(350);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,`no horizontal overflow at ${w}`);
    await page.screenshot({path:shot(`w${w}.png`),fullPage:true});
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result:'PASS',defaults:{EY:m.EY,above:m.above,below:m.below,pAbove:m.pAbove,warning},efficient:{EY:eff.EY,shares:eff.above,borrow:eff.strikeLeg,call:eff.call,below:eff.below},numericVisibleAreas:numeric,walkers:walkReport},null,1));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
