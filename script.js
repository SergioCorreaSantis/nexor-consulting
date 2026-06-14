/* ═══════════════════════════════════════════════════════════════
   NEXOR Consulting — script.js
   Navbar · Mobile Drawer · Chat Widget (refactored) · Scroll FX
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─── CONFIGURACIÓN ─────────────────────────────────────────── */
  /*
   * EMAILJS: Regístrate en https://www.emailjs.com, crea un servicio
   * y una plantilla, luego reemplaza los valores de abajo.
   * Alternativamente, usa WEBHOOK_URL con Make / Zapier.
   *
   * Para EmailJS la plantilla debe incluir las variables:
   *   {{nombre}}, {{empresa}}, {{email}}, {{telefono}},
   *   {{dotacion}}, {{ceal_sm}}
   */
  const EMAILJS_PUBLIC_KEY  = 'INSERTAR_TU_PUBLIC_KEY_EMAILJS';  // e.g. 'user_XXXX'
  const EMAILJS_SERVICE_ID  = 'INSERTAR_TU_SERVICE_ID_EMAILJS';  // e.g. 'service_XXXX'
  const EMAILJS_TEMPLATE_ID = 'INSERTAR_TU_TEMPLATE_ID_EMAILJS'; // e.g. 'template_XXXX'

  /* Si prefieres un webhook (Make / Zapier), pega la URL aquí y
   * cambia USE_WEBHOOK a true. El objeto de datos se enviará como JSON. */
  const USE_WEBHOOK  = true;
  const WEBHOOK_URL  = 'https://hook.us2.make.com/zu6scdx565iapn24mg5gnumcforoogbl'; // e.g. 'https://hook.eu1.make.com/...'


  /* ─── DOM REFS ──────────────────────────────────────────────── */
  const navHeader       = document.getElementById('nav-header');
  const navHamburger    = document.getElementById('nav-hamburger');
  const navDrawer       = document.getElementById('nav-drawer');
  const navDrawerClose  = document.getElementById('nav-drawer-close');
  const navOverlay      = document.getElementById('nav-drawer-overlay');
  const navLinks        = document.querySelectorAll('.nav-drawer-link');
  const navDesktopLinks = document.querySelectorAll('.nav-link');

  const chatFab         = document.getElementById('chat-fab');
  const chatWindow      = document.getElementById('chat-window');
  const chatMessages    = document.getElementById('chat-messages');
  const chatInput       = document.getElementById('chat-input');
  const chatSend        = document.getElementById('chat-send');
  const chatOptionsArea = document.getElementById('chat-options-area');
  const chatLeadForm    = document.getElementById('chat-lead-form');
  const leadSubmit      = document.getElementById('lead-submit');
  const chatFabOpen     = chatFab.querySelector('.chat-fab-open');
  const chatFabClose    = chatFab.querySelector('.chat-fab-close');


  /* ─── STATE ─────────────────────────────────────────────────── */
  let drawerOpen   = false;
  let chatOpen     = false;
  let chatStarted  = false; // si el usuario ya interactuó

  /* Estado de calificación del lead */
  const leadData = {
    dotacion: null,
    cealSM:   null,
    nombre:   null,
    empresa:  null,
    email:    null,
    telefono: null,
  };

  /* Pasos del flujo del chatbot */
  const STEPS = {
    GREETING:  'greeting',
    DOTACION:  'dotacion',
    CEAL_SM:   'ceal_sm',
    FORM:      'form',
    DONE:      'done',
  };
  let currentStep = STEPS.GREETING;


  /* ─── NAVBAR SCROLL ─────────────────────────────────────────── */
  function handleScroll() {
    navHeader.classList.toggle('scrolled', window.scrollY > 60);
  }
  window.addEventListener('scroll', handleScroll, { passive: true });


  /* ─── ACTIVE NAV LINK (Intersection Observer) ───────────────── */
  const sections = document.querySelectorAll('section[id]');
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const target = `#${entry.target.id}`;
        navDesktopLinks.forEach((link) => {
          link.classList.toggle('active', link.getAttribute('href') === target);
        });
      }
    });
  }, {
    root: null,
    rootMargin: `-${parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h') || '68')}px 0px -50% 0px`,
    threshold: 0,
  });
  sections.forEach((s) => sectionObserver.observe(s));


  /* ─── DRAWER OPEN / CLOSE ───────────────────────────────────── */
  function openDrawer() {
    drawerOpen = true;
    navDrawer.classList.add('open');
    navDrawer.setAttribute('aria-hidden', 'false');
    navHamburger.classList.add('open');
    navHamburger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    navDrawerClose.focus();
  }

  function closeDrawer() {
    drawerOpen = false;
    navDrawer.classList.remove('open');
    navDrawer.setAttribute('aria-hidden', 'true');
    navHamburger.classList.remove('open');
    navHamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    navHamburger.focus();
  }

  navHamburger.addEventListener('click', () => drawerOpen ? closeDrawer() : openDrawer());
  navDrawerClose.addEventListener('click', closeDrawer);
  navOverlay.addEventListener('click', closeDrawer);
  navLinks.forEach((link) => link.addEventListener('click', closeDrawer));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (drawerOpen) closeDrawer();
      if (chatOpen)   closeChat();
    }
  });


  /* ─── CHAT OPEN / CLOSE ─────────────────────────────────────── */
  function openChat() {
    chatOpen = true;
    chatWindow.classList.add('open');
    chatWindow.setAttribute('aria-hidden', 'false');
    chatFab.setAttribute('aria-expanded', 'true');
    chatFabOpen.style.display  = 'none';
    chatFabClose.style.display = 'block';

    /* Inicia el flujo la primera vez */
    if (!chatStarted) {
      chatStarted = true;
      setTimeout(startGreeting, 300);
    } else {
      setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
        chatInput.focus();
      }, 60);
    }
  }

  function closeChat() {
    chatOpen = false;
    chatWindow.classList.remove('open');
    chatWindow.setAttribute('aria-hidden', 'true');
    chatFab.setAttribute('aria-expanded', 'false');
    chatFabOpen.style.display  = 'block';
    chatFabClose.style.display = 'none';
    chatFab.focus();
  }

  chatFab.addEventListener('click', () => chatOpen ? closeChat() : openChat());


  /* ─── MESSAGE HELPERS ───────────────────────────────────────── */
  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function appendMessage(html, type) {
    const msg = document.createElement('div');
    msg.className = `chat-msg chat-msg-${type}`;
    const p = document.createElement('p');
    p.innerHTML = html;
    msg.appendChild(p);
    chatMessages.appendChild(msg);
    scrollToBottom();
    return msg;
  }

  function appendTyping() {
    const msg = document.createElement('div');
    msg.className = 'chat-msg chat-msg-bot';
    msg.id = 'chat-typing';
    msg.innerHTML = `<p style="color:var(--text-muted);letter-spacing:0.1em;font-size:1.1rem;">···</p>`;
    chatMessages.appendChild(msg);
    scrollToBottom();
    return msg;
  }

  function removeTyping() {
    const t = document.getElementById('chat-typing');
    if (t) t.remove();
  }

  /**
   * Muestra botones de opción en el área de opciones del chat.
   * @param {Array<{label:string, value:string}>} options
   * @param {function} onSelect - callback(value, label)
   */
  function showOptions(options, onSelect) {
    chatOptionsArea.innerHTML = '';
    chatOptionsArea.style.display = 'flex';

    options.forEach(({ label, value }) => {
      const btn = document.createElement('button');
      btn.className  = 'chat-option-btn';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        hideOptions();
        onSelect(value, label);
      });
      chatOptionsArea.appendChild(btn);
    });

    // Scroll para que los botones queden visibles
    setTimeout(() => chatOptionsArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
  }

  function hideOptions() {
    chatOptionsArea.style.display = 'none';
    chatOptionsArea.innerHTML     = '';
  }

  function botReply(html, delay = 900) {
    return new Promise((resolve) => {
      const typing = appendTyping();
      setTimeout(() => {
        removeTyping();
        appendMessage(html, 'bot');
        resolve();
      }, delay + Math.random() * 400);
    });
  }


  /* ─── FLUJO DEL CHATBOT ─────────────────────────────────────── */

  /* PASO 0: Saludo inicial */
  async function startGreeting() {
    currentStep = STEPS.GREETING;
    await botReply(
      'Bienvenido a <strong>NEXOR Consulting</strong>. Soy tu asistente de inteligencia operacional.<br><br>' +
      '¿Tu empresa opera bajo contratos con mandante y quieres protegerlos ante el nuevo marco normativo laboral?',
      600
    );
    showOptions(
      [
        { label: 'Sí, quiero proteger mis contratos', value: 'yes' },
        { label: 'Quiero conocer más antes', value: 'more' },
      ],
      (value) => {
        if (value === 'yes') {
          appendMessage('Sí, quiero proteger mis contratos.', 'user');
          askDotacion();
        } else {
          appendMessage('Quiero conocer más antes.', 'user');
          replyMore();
        }
      }
    );
  }

  /* Rama "quiero saber más" */
  async function replyMore() {
    await botReply(
      'NEXOR transforma exigencias normativas como <strong>CEAL-SM</strong>, <strong>Ley Karin</strong> y <strong>DS44</strong> en un panel de control de alertas tempranas. ' +
      'Tu mandante monitorea el cumplimiento: nosotros nos aseguramos de que vea una operación blindada, no una carpeta archivada.<br><br>' +
      '¿Cuántos trabajadores tiene tu empresa?'
    );
    askDotacionOptions();
  }

  /* PASO 1: Dotación */
  async function askDotacion() {
    await botReply('Para orientarte con precisión, ¿cuántos trabajadores tiene actualmente tu empresa?');
    askDotacionOptions();
  }

  function askDotacionOptions() {
    currentStep = STEPS.DOTACION;
    showOptions(
      [
        { label: 'Menos de 10 trabajadores',     value: '<10'    },
        { label: 'Entre 10 y 30 trabajadores',   value: '10-30'  },
        { label: 'Entre 30 y 50 trabajadores',   value: '30-50'  },
        { label: 'Más de 50 trabajadores',       value: '>50'    },
      ],
      (value, label) => {
        leadData.dotacion = label;
        appendMessage(label, 'user');
        askCealSM();
      }
    );
  }

  /* PASO 2: Estado CEAL-SM */
  async function askCealSM() {
    currentStep = STEPS.CEAL_SM;
    await botReply(
      '¿La empresa cuenta actualmente con la evaluación <strong>CEAL-SM</strong> (Cuestionario de Evaluación de Ambientes Laborales — Salud Mental) implementada?'
    );
    showOptions(
      [
        { label: 'Sí, completamente al día.',           value: 'completo'       },
        { label: 'En proceso de implementación.',       value: 'en_proceso'     },
        { label: 'No / Desconozco la normativa.',       value: 'no_desconoce'   },
      ],
      (value, label) => {
        leadData.cealSM = label;
        appendMessage(label, 'user');
        transitionToForm(value);
      }
    );
  }

  /* Transición al formulario según estado CEAL-SM */
  async function transitionToForm(cealValue) {
    currentStep = STEPS.FORM;

    let contextMsg = '';
    if (cealValue === 'completo') {
      contextMsg = 'Excelente punto de partida. NEXOR convierte esa medición en inteligencia operacional que tu mandante puede ver en tiempo real, no en un informe archivado.';
    } else if (cealValue === 'en_proceso') {
      contextMsg = 'Estás en el momento crítico. Acompañar bien este proceso puede convertirse en una ventaja competitiva frente a tu mandante y en licitaciones futuras.';
    } else {
      contextMsg = 'La normativa SUSESO es de cumplimiento obligatorio. Una sanción puede bloquearte en SICEP antes de que presentes tu próxima propuesta. NEXOR puede evitarlo.';
    }

    await botReply(contextMsg);
    await botReply(
      'He registrado tu perfil de riesgo. Para conectarte con un Socio Director, necesito los siguientes datos:',
      600
    );

    /* Deshabilitar input de texto y mostrar formulario */
    chatInput.disabled = true;
    chatSend.disabled  = true;
    chatLeadForm.style.display = 'block';
    setTimeout(() => chatLeadForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    setTimeout(() => document.getElementById('lead-nombre').focus(), 200);
  }


  /* ─── ENVÍO DEL FORMULARIO DE LEAD ─────────────────────────── */
  leadSubmit.addEventListener('click', async () => {
    const nombre   = document.getElementById('lead-nombre').value.trim();
    const empresa  = document.getElementById('lead-empresa').value.trim();
    const email    = document.getElementById('lead-email').value.trim();
    const telefono = document.getElementById('lead-telefono').value.trim();

    /* Validación mínima */
    if (!nombre || !email) {
      if (!nombre)  highlightField('lead-nombre');
      if (!email)   highlightField('lead-email');
      return;
    }

    /* Guardar en el objeto de estado */
    leadData.nombre   = nombre;
    leadData.empresa  = empresa;
    leadData.email    = email;
    leadData.telefono = telefono;

    /* Deshabilitar el botón para evitar doble envío */
    leadSubmit.disabled     = true;
    leadSubmit.textContent  = 'Enviando…';

    try {
      await sendLeadNotification(leadData);
    } catch (err) {
      console.error('Error al enviar lead:', err);
      /* No interrumpir la UX al usuario incluso si falla el envío */
    }

    /* Ocultar formulario y mostrar confirmación */
    chatLeadForm.style.display = 'none';
    currentStep = STEPS.DONE;

    appendMessage(
      '✓ Datos registrados con éxito. Un Socio Director de NEXOR se pondrá en contacto contigo a la brevedad. <strong>Gracias por tu confianza.</strong>',
      'bot'
    );

    /* Rehabilitar input de texto por si el usuario quiere seguir */
    chatInput.disabled = false;
    chatSend.disabled  = false;
    chatInput.focus();
  });

  function highlightField(id) {
    const el = document.getElementById(id);
    el.style.borderColor = 'var(--copper)';
    el.focus();
    el.addEventListener('input', () => { el.style.borderColor = ''; }, { once: true });
  }


  /* ─── NOTIFICACIÓN DE LEAD ───────────────────────────────────── */
  /**
   * Envía los datos del lead vía EmailJS o un webhook (Make / Zapier).
   * Reemplaza las constantes de configuración al inicio del archivo.
   *
   * Formato de correo esperado:
   * --------------------------------------------------
   * NUEVO LEAD CALIFICADO - NEXOR .ai
   * --------------------------------------------------
   * • Nombre:          [Nombre]
   * • Empresa:         [Empresa]
   * • Correo:          [Correo Corporativo]
   * • Teléfono:        [Fono]
   * • Tamaño Empresa:  [Opción Seleccionada]
   * • Estado CEAL-SM:  [Opción Seleccionada]
   * --------------------------------------------------
   */
  async function sendLeadNotification(data) {
    if (USE_WEBHOOK) {
      /* ── OPCIÓN A: Webhook (Make / Zapier) ── */
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source:    'NEXOR .ai Chat',
          nombre:    data.nombre,
          empresa:   data.empresa,
          email:     data.email,
          telefono:  data.telefono,
          dotacion:  data.dotacion,
          ceal_sm:   data.cealSM,
          timestamp: new Date().toISOString(),
        }),
      });
      if (!response.ok) throw new Error(`Webhook error: ${response.status}`);

    } else {
      /* ── OPCIÓN B: EmailJS ── */
      /* Carga el SDK de EmailJS de forma dinámica si aún no está presente */
      if (!window.emailjs) {
        await loadScript('https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js');
        window.emailjs.init(EMAILJS_PUBLIC_KEY);
      }

      await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        nombre:   data.nombre,
        empresa:  data.empresa,
        email:    data.email,
        telefono: data.telefono,
        dotacion: data.dotacion,
        ceal_sm:  data.cealSM,
      });
    }
  }

  /* Helper para cargar scripts externos de forma dinámica */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s  = document.createElement('script');
      s.src    = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }


  /* ─── INPUT DE TEXTO LIBRE (después del flujo o fuera de él) ── */
  /*
   * El input de texto sigue disponible para que el usuario pueda
   * escribir preguntas adicionales una vez terminado el flujo.
   * También permite iniciar el flujo si el usuario empieza escribiendo.
   */
  function processUserMessage(text) {
    if (!text.trim()) return;

    appendMessage(text, 'user');
    chatInput.value = '';

    if (currentStep === STEPS.DONE) {
      /* Respuesta libre post-conversión */
      botReply('Gracias por tu mensaje. Un Socio Director revisará tu consulta junto con tu ficha de contacto. ¿Hay algo más en lo que pueda orientarte?', 800);
      return;
    }

    /* Si el usuario escribe antes de que empiece el flujo, iniciarlo */
    if (currentStep === STEPS.GREETING && !chatStarted) {
      chatStarted = true;
      startGreeting();
      return;
    }

    /* Respuesta genérica durante el flujo */
    botReply(
      'Entiendo tu consulta. NEXOR transforma el cumplimiento normativo en inteligencia operacional que protege tus contratos activos. ' +
      'Continúa seleccionando las opciones para que un Socio Director pueda preparar un diagnóstico personalizado.',
      800
    );
  }

  chatSend.addEventListener('click', () => processUserMessage(chatInput.value));
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      processUserMessage(chatInput.value);
    }
  });


  /* ─── SCROLL ANIMATIONS ─────────────────────────────────────── */
  /* Nota: .team-card eliminado junto con la sección de equipo */
  const animEls = document.querySelectorAll(
    '.risk-card, .service-card, .section-headline, .section-label, .section-lead, ' +
    '.diff-table-wrap, .diff-cards-mobile, .hero-indicators, .cta-headline, .cta-sub'
  );

  animEls.forEach((el) => el.classList.add('anim-fade-up'));

  const animObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const idx = Array.from(entry.target.parentElement?.children || []).indexOf(entry.target);
          entry.target.style.transitionDelay = `${Math.min(idx * 80, 300)}ms`;
          entry.target.classList.add('visible');
          animObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
  );

  animEls.forEach((el) => animObserver.observe(el));


  /* ─── SMOOTH SCROLL OFFSET (fixed nav) ─────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const navH = navHeader.offsetHeight;
      const top  = target.getBoundingClientRect().top + window.scrollY - navH - 12;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });


  /* ─── INIT ──────────────────────────────────────────────────── */
  handleScroll();

})();
