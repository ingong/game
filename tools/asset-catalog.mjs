import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DEEP, SKY } from '../src/palette.mjs'

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]))
const bytes = value => value >= 1024*1024 ? `${(value/1024/1024).toFixed(2)} MiB` : `${(value/1024).toFixed(2)} KiB`
const labels = { runtime:'실행용', concept:'콘셉트', reference:'참고 자료' }
const strings = value => Array.isArray(value) ? value.filter(item => typeof item === 'string') : []
const localUrl = path => typeof path === 'string' && /^(assets|src)\//.test(path) &&
  path.split('/').every(part => part && part !== '.' && part !== '..')
  ? '../../'+path.split('/').map(encodeURIComponent).join('/') : null
const link = (url, label) => url ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>` : escape(label)

export function renderCatalog(report) {
  const atlas = report.assets.find(asset => asset.role === 'runtime' && asset.exportName === 'RUNNER' &&
    asset.frames?.width === 32 && asset.frames?.height === 56 && strings(asset.frames?.names).length === 5 &&
    asset.image?.width === 160 && asset.image?.height === 56)
  const cards = report.assets.map(asset => {
    const url = localUrl(asset.path)
    const external = /^https?:\/\//.test(asset.source?.url ?? '') ? asset.source.url : null
    const image = asset.image
    const preview = image && url ? `<a class="image" href="${escape(url)}" target="_blank" rel="noopener noreferrer"><img src="${escape(url)}" alt="${escape(asset.title)}" loading="lazy" width="${image.width}" height="${image.height}"></a>`
      : `<div class="placeholder">${escape({procedural:'Canvas / 코드',archive:'ZIP / 원본 묶음',document:'문서 / 출처 기록'}[asset.kind] ?? asset.kind)}</div>`
    return `<article class="card" data-role="${escape(asset.role)}" data-search="${escape([asset.id,asset.title,asset.path,asset.source?.author,asset.license?.id].join(' ').toLowerCase())}">
      ${preview}<div class="details"><div class="card-top"><span class="badge ${escape(asset.role)}">${escape(labels[asset.role])}</span><span>${Number.isFinite(asset.bytes) ? bytes(asset.bytes) : '파일 없음'}${asset.kind === 'procedural' ? ' · 소스 크기' : ''}</span></div>
      <h3>${escape(asset.title)}</h3><p class="path">${link(url,asset.path)}</p>
      <dl><dt>규격</dt><dd>${image ? `${image.width} × ${image.height} · ${image.bitDepth}-bit · ${image.paletteColors ? image.paletteColors+' colors' : 'truecolor'}` : escape(asset.kind)}</dd>
      <dt>출처</dt><dd>${link(external,asset.source?.author)}</dd><dt>이용 조건</dt><dd>${escape(asset.license?.id)}</dd></dl>
      <details><summary>출처 기록과 점검 정보</summary><p>${escape(asset.source?.evidence)}</p><p>${escape(asset.license?.note)}</p>
      ${image ? `<p>완전 투명 ${image.transparentPixels.toLocaleString('en-US')} px · 반투명 ${image.partialAlphaPixels.toLocaleString('en-US')} px · 불투명 ${image.opaquePixels.toLocaleString('en-US')} px</p>` : ''}
      ${strings(asset.derivedFrom).length ? `<p>원본 ID: ${escape(strings(asset.derivedFrom).join(', '))}</p>` : ''}
      ${strings(asset.review).map(note => `<p class="note">${escape(note)}</p>`).join('')}
      <p class="hash">SHA-256 ${escape(asset.sha256 ?? 'unavailable')}</p></details></div></article>`
  }).join('\n')
  const previewData = atlas ? JSON.stringify({ url:localUrl(atlas.path), ...atlas.frames }).replaceAll('<','\\u003c') : 'null'
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Crimson Furnace · 에셋 라이브러리</title>
  <style>
    :root{color-scheme:light;--ink:#202126;--muted:#686a70;--line:#dddcd8;--paper:#f6f5f1;--accent:#ae312f}
    *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.65 system-ui,sans-serif}main{max-width:1420px;margin:auto;padding:38px 32px 64px}
    a{color:inherit;text-underline-offset:3px}a:hover{color:var(--accent)}header{border-bottom:1px solid var(--line);padding-bottom:24px}.eyebrow{color:var(--accent);font-size:12px;letter-spacing:.14em;font-weight:750}h1{font-size:34px;letter-spacing:-.04em;margin:7px 0}h2{font-size:18px;margin:0 0 12px}h3{font-size:16px;line-height:1.35;margin:12px 0 8px}p{margin:7px 0}header p,.muted{color:var(--muted)}
    .stats{display:flex;gap:28px;flex-wrap:wrap;margin-top:20px}.stat strong{display:block;font-size:24px;line-height:1.2}.stat span{font-size:12px;color:var(--muted)}
    .review{margin:24px 0;border:1px solid #e5cbae;background:#fff6e9;border-radius:8px;padding:18px 22px}.review summary{cursor:pointer;font-weight:650}.review li{margin:8px 0;overflow-wrap:anywhere}.review .error{color:#ad1f25}
    .studio{background:#fff;border:1px solid var(--line);border-radius:8px;padding:24px;display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:24px 0}.stage{min-height:236px;display:flex;justify-content:center;align-items:center;border-radius:5px;border:1px solid var(--line)}.checker,.image{background-color:#f1efeb;background-image:conic-gradient(#dddcd8 25%,transparent 0 50%,#dddcd8 0 75%,transparent 0);background-size:16px 16px}
    canvas{width:128px;height:224px;image-rendering:pixelated}label{display:block;font-size:12px;font-weight:650;margin:10px 0 5px}input,select,button{font:inherit;border:1px solid #bdbdb8;border-radius:5px;background:#fff;padding:9px 12px;color:var(--ink)}button{cursor:pointer}button:hover{border-color:var(--ink)}button.active{background:var(--ink);border-color:var(--ink);color:#fff}input:focus,select:focus,button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.controls{display:flex;gap:12px;flex-wrap:wrap;align-items:end}.frame-label{font:12px ui-monospace,monospace;margin:12px 0;color:var(--muted)}
    .toolbar{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:28px 0 16px}.toolbar input{min-width:200px;flex:1}.filters{display:flex;gap:6px}.count{color:var(--muted);font-size:12px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.card{background:#fff;border:1px solid var(--line);border-radius:8px;overflow:hidden}.image,.placeholder{display:flex;height:210px;align-items:center;justify-content:center;border-bottom:1px solid var(--line)}.image img{width:100%;height:100%;object-fit:contain;image-rendering:pixelated;padding:12px}.placeholder{background:#e8e9eb;color:#676b75;font:14px ui-monospace,monospace}.details{padding:18px}.card-top{display:flex;gap:8px;align-items:center;justify-content:space-between;color:var(--muted);font-size:11px}.badge{border:1px solid #c9c9c5;border-radius:4px;padding:2px 7px}.runtime{color:#207346;border-color:#bdd9c9;background:#eff9f3}.concept{color:#8a4a24;border-color:#e6c5a5;background:#fff7ed}.reference{color:#4d5e81;border-color:#c5d0e6;background:#f1f5fd}.path{font:11px/1.6 ui-monospace,monospace;overflow-wrap:anywhere;color:var(--muted);min-height:35px}dl{display:grid;grid-template-columns:66px 1fr;gap:7px;margin:15px 0;font-size:12px}dt{color:var(--muted)}dd{margin:0;overflow-wrap:anywhere}details{font-size:12px;border-top:1px solid var(--line);padding-top:12px}summary{cursor:pointer}.hash{font-family:ui-monospace,monospace;overflow-wrap:anywhere;color:var(--muted)}.note{color:#925522}.empty{padding:40px;text-align:center}.hidden,[hidden]{display:none!important}footer{border-top:1px solid var(--line);padding-top:20px;margin-top:30px;color:var(--muted);font-size:12px}code{font-size:12px}
    @media(max-width:1050px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){main{padding:24px 16px}.grid,.studio{grid-template-columns:1fr}.filters{flex-wrap:wrap}h1{font-size:28px}.studio{padding:18px}}
  </style></head><body><main><header><div class="eyebrow">CRIMSON FURNACE / DEVELOPMENT</div><h1>에셋 라이브러리</h1><p>실행용 이미지, 콘셉트, 참고 자료와 코드로 그리는 에셋의 출처·규격·상태를 확인합니다.</p>
    <div class="stats"><div class="stat"><strong>${report.assets.length}</strong><span>등록 에셋</span></div><div class="stat"><strong>${bytes(report.totals.runtime ?? 0)}</strong><span>실행용 PNG 원본 · ZIP 기여량과 다름</span></div><div class="stat"><strong>${bytes((report.totals.concept ?? 0)+(report.totals.reference ?? 0))}</strong><span>콘셉트·참고 파일</span></div><div class="stat"><strong>${report.errors.length}</strong><span>검증 오류</span></div></div></header>
    <section class="review"><details open><summary>점검 메모 ${report.warnings.length}개${report.errors.length ? ` · 오류 ${report.errors.length}개` : ''}</summary><ul>${report.errors.map(error => `<li class="error">${escape(error)}</li>`).join('')}${report.warnings.map(warning => `<li>${escape(warning)}</li>`).join('')}</ul><p>자동 검증은 파일·규격·출처 기록의 누락을 확인합니다. 이용 조건의 최신성이나 창작 이력을 증명하지는 않습니다.</p></details></section>
    ${atlas ? `<section class="studio"><div><h2>러너 프레임 미리보기</h2><p class="muted">${atlas.frames.width} × ${atlas.frames.height} px / ${atlas.frames.names.length} frames. 서로 다른 배경에서 가장자리와 실루엣을 비교합니다.</p><div class="controls"><div><label for="pose">동작</label><select id="pose"><option value="run">달리기 · 1 → 0 → 2 → 0</option><option value="0">접지</option><option value="1">왼쪽 보폭</option><option value="2">오른쪽 보폭 · 좌우 반전</option><option value="3">점프 / 이단 점프 공통</option><option value="4">착지 / 충돌 공통</option></select></div><div><label for="background">배경</label><select id="background"><option value="checker">체커보드</option><option value="#fff">흰색</option><option value="${DEEP}">어두운색</option><option value="${SKY}">게임 배경</option></select></div><button id="pause" type="button" aria-pressed="false">일시정지</button></div><p id="frame-label" class="frame-label"></p><p class="muted">4배 확대 미리보기입니다. 실제 게임의 원근·회전·스케일 효과는 포함하지 않습니다.</p></div><div class="stage checker" id="stage"><canvas id="runner" width="128" height="224" aria-label="러너 프레임 미리보기"></canvas></div></section>` : ''}
    <div class="toolbar"><input id="search" type="search" aria-label="에셋 검색" placeholder="이름, 경로, 제작자, 이용 조건 검색"><div class="filters" role="group" aria-label="에셋 분류">${[['all','전체'],...Object.entries(labels)].map(([role,label]) => `<button data-filter="${role}" type="button" aria-pressed="${role === 'all'}" class="${role === 'all' ? 'active' : ''}">${label}</button>`).join('')}</div><span class="count" id="count" aria-live="polite"></span></div>
    <section class="grid" aria-label="에셋 목록">${cards}</section><p class="empty" id="empty" hidden>일치하는 에셋이 없습니다.</p>
    <footer><p>목록의 기준: <code>assets/manifest.json</code> · 다시 생성: <code>npm run assets:catalog</code> · 원본 이미지 링크는 로컬 파일을 엽니다.</p><p>이 페이지와 출처 기록은 개발용이며 제출 ZIP에 포함되지 않습니다. 생성 시점의 파일 상태이며, 변경 후 다시 생성해야 합니다.</p></footer>
  </main><script>
    const cards = [...document.querySelectorAll('.card')]; let role = 'all';
    const update = () => { const query = document.querySelector('#search').value.toLowerCase().trim(); let count = 0; for (const card of cards) { card.hidden = !((role === 'all' || card.dataset.role === role) && card.dataset.search.includes(query)); if (!card.hidden) count++; } document.querySelector('#count').textContent = count + ' / ' + cards.length; document.querySelector('#empty').hidden = count !== 0; };
    document.querySelector('#search').addEventListener('input',update);
    document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click',() => { role = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(item => { item.classList.toggle('active',item === button); item.setAttribute('aria-pressed',String(item === button)); }); update(); })); update();
    const atlas = ${previewData};
    if (atlas) {
      const canvas = document.querySelector('#runner'), ctx = canvas.getContext('2d'), sheet = new Image();
      canvas.width = atlas.width*4; canvas.height = atlas.height*4;
      const pose = document.querySelector('#pose'), label = document.querySelector('#frame-label');
      let paused = matchMedia('(prefers-reduced-motion: reduce)').matches, time = 0, previous = null;
      const pause = document.querySelector('#pause');
      const syncPause = () => { pause.textContent = paused ? '재생' : '일시정지'; pause.setAttribute('aria-pressed',String(paused)); }; syncPause();
      pause.addEventListener('click',() => { paused = !paused; syncPause(); });
      document.querySelector('#background').addEventListener('change',event => { const stage = document.querySelector('#stage'); stage.classList.toggle('checker',event.target.value === 'checker'); stage.style.backgroundColor = event.target.value === 'checker' ? '' : event.target.value; });
      const draw = now => { if (previous !== null && !paused) time += Math.min(now-previous,100); previous = now; const frame = pose.value === 'run' ? [1,0,2,0][Math.floor(time/150)%4] : Number(pose.value); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.imageSmoothingEnabled = false; ctx.save(); if (frame === 2) { ctx.translate(canvas.width,0); ctx.scale(-1,1); } ctx.drawImage(sheet,frame*atlas.width,0,atlas.width,atlas.height,0,0,canvas.width,canvas.height); ctx.restore(); label.textContent = 'Frame ' + frame + ' / ' + atlas.names[frame]; requestAnimationFrame(draw); };
      sheet.onload = () => requestAnimationFrame(draw); sheet.onerror = () => { label.textContent = '이미지를 읽을 수 없습니다. npm run assets:serve로 열어 주세요.'; }; sheet.src = atlas.url;
    }
  </script></body></html>`
}

export function writeCatalog(root, report) {
  const folder = resolve(root,'reports/assets')
  mkdirSync(folder,{ recursive:true })
  writeFileSync(resolve(folder,'index.html'),renderCatalog(report))
  writeFileSync(resolve(folder,'audit.json'),JSON.stringify(report,null,2)+'\n')
}
