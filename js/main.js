'use strict';
(() => {
  const q = (s, r=document) => r.querySelector(s);
  const form = q('#quote-form');
  document.querySelectorAll('a[href^="tel:"]').forEach(a => {
    a.addEventListener('click', () => {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({event:'phone_click', cta_location:a.dataset.ctaLocation || 'unknown'});
    });
  });

  if (document.body.dataset.page === 'thank-you') {
    try {
      if (sessionStorage.getItem('rapidpest_lead_ok') !== '1') location.replace('./index.html');
      else sessionStorage.removeItem('rapidpest_lead_ok');
    } catch (_) {}
    return;
  }
  if (!form) return;

  const status = q('#form-status');
  const submit = q('#quote-submit');
  const fields = {
    name: q('#f-name'), phone:q('#f-phone'), email:q('#f-email'),
    zip:q('#f-zip'), service:q('#f-service'), message:q('#f-message')
  };

  function error(name, msg) {
    const el = fields[name], wrap = el && el.closest('.field');
    if (!wrap) return;
    wrap.classList.toggle('has-error', !!msg);
    const text = wrap.querySelector('.field__error-text');
    if (text) text.textContent = msg || '';
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  function validate() {
    let ok = true;
    Object.keys(fields).forEach(k => error(k,''));
    if (!fields.name.value.trim()) { error('name','Please enter your name.'); ok=false; }
    const digits = fields.phone.value.replace(/\D/g,'');
    if (digits.length < 10) { error('phone','Please enter a valid phone number.'); ok=false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.value.trim())) { error('email','Please enter a valid email.'); ok=false; }
    if (!/^\d{5}(-\d{4})?$/.test(fields.zip.value.trim())) { error('zip','Enter a valid U.S. ZIP code.'); ok=false; }
    if (!fields.service.value) { error('service','Please choose a service.'); ok=false; }
    return ok;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.className = 'form-status'; status.textContent = '';
    if (!validate()) {
      const first = q('.field.has-error input, .field.has-error select');
      if (first) first.focus();
      return;
    }
    submit.disabled = true;
    q('.btn__label', submit).textContent = 'Sending…';
    const payload = {
      name: fields.name.value.trim(),
      full_name: fields.name.value.trim(),
      phone: fields.phone.value.trim(),
      email: fields.email.value.trim(),
      zip: fields.zip.value.trim(),
      service: fields.service.value,
      message: fields.message.value.trim()
    };
    try {
      const endpoint = (window.RAPID_PEST_CONFIG && window.RAPID_PEST_CONFIG.leadEndpoint) || '/api/lead';
      const res = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.error || 'We could not send your request.');
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({event:'form_submission',form_name:'quote_request_form',service_selected:payload.service,form_location:'hero'});
      try { sessionStorage.setItem('rapidpest_lead_ok','1'); } catch (_) {}
      location.href = '/thank-you.html';
    } catch (err) {
      status.className = 'form-status is-error';
      status.textContent = (err && err.message) || 'Something went wrong. Please call +1-844-937-2204.';
      submit.disabled = false;
      q('.btn__label', submit).textContent = 'Request My Quote';
    }
  });
})();
