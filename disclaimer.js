// Disclaimer modal: requires user to read and accept before buy buttons are enabled.
(function(){
  const KEY = 'pb_disclaimer_accepted_v1';
  let pendingResolution = null;

  function setCookie(name, value, days){
    const d = new Date(); d.setTime(d.getTime() + (days*24*60*60*1000));
    document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/`;
  }

  function accepted(){
    try { localStorage.setItem(KEY, '1'); } catch(e){}
    try { setCookie(KEY, '1', 365); } catch(e){}
  }

  function isAccepted(){
    try { if (localStorage.getItem(KEY) === '1') return true; } catch(e){}
    try { if (document.cookie.split(';').some(c=>c.trim().startsWith(KEY+'='))) return true; } catch(e){}
    return false;
  }

  function disableBuyButtons(){
    const ids = ['btn-buy','buy-btn'];
    ids.forEach(id=>{ const el = document.getElementById(id); if(el) { el.disabled=true; el.classList.add('disabled-by-disclaimer'); } });
  }
  function enableBuyButtons(){
    const ids = ['btn-buy','buy-btn'];
    ids.forEach(id=>{ const el = document.getElementById(id); if(el) { el.disabled=false; el.classList.remove('disabled-by-disclaimer'); } });
  }

  function buildModal(){
    if (document.getElementById('pb-disclaimer-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'pb-disclaimer-modal';
    modal.innerHTML = `
      <div id="pb-disclaimer-backdrop"></div>
      <div id="pb-disclaimer" role="dialog" aria-modal="true">
        <h3>Presale & DApp Disclaimer</h3>
        <div class="pb-disclaimer-body">
          <div class="pb-disclaimer-scroll" id="pb-disclaimer-scroll" tabindex="0">
            <h4>Disclaimer: Perpetual Bitcoin (PB) Legal Disclaimer</h4>
            <p><strong>Important Notice: Read Before Connecting Your Wallet</strong></p>
            <p>By interacting with the Perpetual Bitcoin (PB) protocol, you acknowledge and agree to the following terms. If you do not accept these terms in full, you should not proceed.</p>
            <ol>
              <li><strong>Not Financial Advice</strong><br>Nothing on this website, or within the PB protocol, constitutes financial, investment, legal, or tax advice. PB is a software protocol, and participation is entirely at your own risk. Consult with qualified professionals before making any financial decisions.</li>
              <li><strong>No Guarantees or Returns Promised</strong><br>PB does not provide interest, yield, dividends, rewards, or any form of return beyond the return of your own previously locked tokens. No guarantees are made regarding price, performance, market demand, or future unlocks. All outcomes depend entirely on market conditions. Past performance does not guarantee future results.</li>
              <li><strong>Immutability and No Administrative Control</strong><br>The PB protocol is completely immutable, with no administrators, owners, or operators. No party has the ability to intervene, modify, or reverse transactions. All interactions are permanent and irreversible, and users assume all risks associated with blockchain transactions, including loss of access, market volatility, and smart contract risks.</li>
              <li><strong>Not a Securities Offering (continued)</strong><br>PB and PBc tokens are not offered as securities or financial instruments. Purchasing PB does not grant ownership, rights, dividends, profit-sharing, or expectations of profit from the efforts of others. PB is a decentralized software protocol, and all participation is self-directed.</li>
              <li><strong>No Refunds or Chargebacks</strong><br>All purchases and blockchain interactions are final and non-refundable. Due to the immutable nature of the protocol, no refunds, reversals, or chargebacks are possible.</li>
              <li><strong>User Assumes All Risks</strong><br>Interacting with PB involves significant risks, including the potential loss of all value. Blockchain networks may experience congestion, failure, or unexpected behavior. Smart contracts may contain vulnerabilities. By using PB, you acknowledge and accept all associated risks.</li>
              <li><strong>No Roadmap, No Future Promises</strong><br>PB has no roadmap, no future promises, and no ongoing development obligations. The protocol is complete and operates autonomously. There will be no updates, changes, or modifications to the protocol.</li>
              <li><strong>Jurisdiction and Eligibility</strong><br>PB may not be available to users in certain jurisdictions. It is your responsibility to ensure that your participation complies with local laws and regulations.</li>
            </ol>
            <p style="margin-top:10px">By accepting below you confirm you have scrolled through and read the full disclaimer above.</p>
          </div>
        </div>
        <label style="display:flex;align-items:center;gap:10px;margin-top:12px;">
          <input id="pb-disclaimer-checkbox" type="checkbox" disabled />
          <span id="pb-disclaimer-checkbox-label">I have read and accept the disclaimer above.</span>
        </label>
        <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;">
          <button id="pb-disclaimer-decline" class="btn">Cancel</button>
          <button id="pb-disclaimer-accept" class="btn btn-primary" disabled>Accept & Continue</button>
        </div>
        <div style="font-size:0.8rem;margin-top:8px;color:#ccc">Acceptance is stored locally for this browser.</div>
      </div>
    `;

    const css = document.createElement('style');
    css.innerHTML = `
      #pb-disclaimer-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:12000}
      #pb-disclaimer{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:12001;background:#111;padding:20px;border-radius:8px;max-width:720px;width:92%;color:#eee;border:1px solid rgba(255,165,0,0.08);}
      #pb-disclaimer h3{margin:0 0 8px 0;color:#FFD27A}
      #pb-disclaimer .pb-disclaimer-body{color:#ddd}
      .pb-disclaimer-scroll{max-height:360px;overflow:auto;padding-right:8px;border:1px solid rgba(255,165,0,0.04);padding:12px;border-radius:6px;background:#0f0f14}
      .pb-disclaimer-scroll h4{margin-top:0;color:#FFD27A}
      .pb-disclaimer-scroll ol{margin-left:1rem}
      .disabled-by-disclaimer{opacity:0.5;pointer-events:none}
    `;
    document.head.appendChild(css);
    document.body.appendChild(modal);

    const chk = document.getElementById('pb-disclaimer-checkbox');
    const acceptBtn = document.getElementById('pb-disclaimer-accept');
    const declineBtn = document.getElementById('pb-disclaimer-decline');
    const scrollEl = document.getElementById('pb-disclaimer-scroll');

    // Enable checkbox only after user scrolls to bottom of the disclaimer
    function checkScrolledToBottom(){
      if(!scrollEl) return;
      const atBottom = (scrollEl.scrollHeight - scrollEl.scrollTop) <= (scrollEl.clientHeight + 2);
      if(atBottom){
        chk.disabled = false;
        document.getElementById('pb-disclaimer-checkbox-label').style.opacity = '1';
      }
    }

    // initialize label opacity when checkbox disabled
    document.getElementById('pb-disclaimer-checkbox-label').style.opacity = '0.6';
    if(scrollEl){
      scrollEl.addEventListener('scroll', checkScrolledToBottom, {passive:true});
      // also check in case content fits without scroll
      setTimeout(checkScrolledToBottom, 50);
    }

    chk.addEventListener('change', ()=>{ acceptBtn.disabled = !chk.checked; });
    acceptBtn.addEventListener('click', ()=>{
      accepted();
      closeModal();
      enableBuyButtons();
      if (pendingResolution) {
        pendingResolution(true);
        pendingResolution = null;
      }
    });
    declineBtn.addEventListener('click', ()=>{
      closeModal();
      if (pendingResolution) {
        pendingResolution(false);
        pendingResolution = null;
      }
    });
  }

  function closeModal(){
    const m = document.getElementById('pb-disclaimer-modal');
    if (m) m.remove();
  }

  function ensureAccepted(){
    if (isAccepted()) return Promise.resolve(true);
    buildModal();
    return new Promise((resolve) => {
      pendingResolution = resolve;
    });
  }

  // Intercept wallet-connect attempts and require disclaimer acceptance before connecting.
  function attachConnectInterceptors(){
    const selector = ['#connect-btn','#nav-connect-btn','.connect-wallet','.btn-connect'].join(',');
    let pending = null;

    function intercept(e){
      // Allow if already accepted
      if (isAccepted() || window.__pb_disclaimer_connect_allowed) return;
      // Only intercept left-clicks / activation
      e.preventDefault();
      e.stopPropagation();
      pending = e.currentTarget || e.target;
      buildModal();

      // After building modal, hook accept to resume connect
      const acceptBtn = document.getElementById('pb-disclaimer-accept');
      if (acceptBtn){
        const resume = ()=>{
          // mark allowed for immediate resume
          window.__pb_disclaimer_connect_allowed = true;
          try { setTimeout(()=>{ if (pending && typeof pending.click === 'function') pending.click(); }, 50); } catch(e){}
          // clear flag after short delay
          setTimeout(()=>{ window.__pb_disclaimer_connect_allowed = false; pending = null; }, 300);
        };
        // attach once
        const onceResume = ()=>{ resume(); acceptBtn.removeEventListener('click', onceResume); };
        acceptBtn.addEventListener('click', onceResume);
      }
    }

    document.querySelectorAll(selector).forEach(el=>{
      el.addEventListener('click', intercept, true);
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    if (isAccepted()) { enableBuyButtons(); }
    attachConnectInterceptors();
  });

  window.PBDisclaimer = {
    isAccepted,
    ensureAccepted,
  };

})();
