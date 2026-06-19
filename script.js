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
    dotacion:     null,  // label visible (ej. "Entre 10 y 25 trabajadores")
    tramoId:      null,  // id interno (tramo_1 .. tramo_4)
    respuestas:   {},    // { p1: 'Sí'|'No', p2: ..., p3: ..., p4: ..., p5: ..., p6: ... }
    puntaje:      0,     // puntaje acumulado de respuestas "No"
    nivelRiesgo:  null,  // BAJA | MEDIA | ALTA | CRÍTICA
    nombre:       null,
    empresa:      null,
    email:        null,
    telefono:     null,
  };

  /* Pasos del flujo del chatbot */
  const STEPS = {
    GREETING:  'greeting',
    DOTACION:  'dotacion',
    P1:        'p1',
    P2:        'p2',
    P3:        'p3',
    P4:        'p4',
    P5:        'p5',
    P6:        'p6',
    FORM:      'form',
    DONE:      'done',
  };
  let currentStep = STEPS.GREETING;

  /* ─── PREGUNTAS DE LA MATRIZ (Ley Karin / CEAL-SM / RIHS / CPHS) ───
   * Cada pregunta define:
   *   - id: clave usada en leadData.respuestas y en el payload
   *   - texto: texto exacto a mostrar
   *   - puntajeNo: puntos sumados si la respuesta es "No"
   *   - opciones: [{label, value}] — value 'si' resta puntaje (0), 'no' suma puntajeNo
   *   - aplica(tramoId): función que determina si la pregunta se gatilla para el tramo actual
   */
  const PREGUNTAS = [
    {
      id: 'p1',
      texto: '¿Cuentas con el Protocolo de Prevención del Acoso Sexual, Laboral y Violencia en el Trabajo (Ley Karin) redactado, difundido e incorporado en el RIHS?',
      puntajeNo: 35,
      opciones: [{ label: 'Sí', value: 'si' }, { label: 'No', value: 'no' }],
      aplica: () => true, // BLOQUE A — todas las empresas
    },
    {
      id: 'p2',
      texto: '¿Has evaluado los riesgos psicosociales en los últimos 2 años utilizando el nuevo cuestionario CEAL-SM (SUSESO)?',
      puntajeNo: 25,
      opciones: [{ label: 'Sí', value: 'si' }, { label: 'No', value: 'no' }],
      aplica: () => true, // BLOQUE A — todas las empresas
    },
    {
      id: 'p3',
      texto: '¿Tienes tu Reglamento Interno de Higiene y Seguridad (RIHS) actualizado y registrado en la Dirección del Trabajo (DT)?',
      puntajeNo: 20,
      opciones: [{ label: 'Sí', value: 'si' }, { label: 'No', value: 'no' }],
      aplica: (tramoId) => ['tramo_2', 'tramo_3', 'tramo_4'].includes(tramoId), // BLOQUE B
    },
    {
      id: 'p4',
      texto: '¿Cuentan formalmente con un Delegado de Personal elegido por los trabajadores para representarlos ante temas de seguridad?',
      puntajeNo: 15,
      opciones: [{ label: 'Sí', value: 'si' }, { label: 'No', value: 'no' }],
      aplica: (tramoId) => ['tramo_2', 'tramo_3', 'tramo_4'].includes(tramoId), // BLOQUE B
    },
    {
      id: 'p5',
      texto: '¿Tienen constituido y funcionando activamente el Comité Paritario de Higiene y Seguridad (CPHS) bajo el DS 54?',
      puntajeNo: 25,
      opciones: [{ label: 'Sí', value: 'si' }, { label: 'No', value: 'no' }],
      aplica: (tramoId) => tramoId === 'tramo_4', // BLOQUE C
    },
    {
      id: 'p6',
      texto: 'Si tienes más de 100 trabajadores, ¿cuentas con un Departamento de Prevención de Riesgos dirigido por un experto?',
      puntajeNo: 15,
      opciones: [{ label: 'Sí', value: 'si' }, { label: 'No / No aplica', value: 'no' }],
      aplica: (tramoId) => tramoId === 'tramo_4', // BLOQUE C
    },
  ];

  /* Tramos de tamaño de empresa */
  const TRAMOS = [
    { id: 'tramo_1', label: 'Menos de 10 trabajadores' },
    { id: 'tramo_2', label: 'Entre 10 y 25 trabajadores' },
    { id: 'tramo_3', label: 'Entre 26 y 49 trabajadores' },
    { id: 'tramo_4', label: '50 o más trabajadores' },
  ];


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
      '¿Cuántos trabajadores contratados tiene actualmente tu empresa?'
    );
    askDotacionOptions();
  }

  /* PASO 1: Pregunta Filtro Inicial — Tamaño de Empresa */
  async function askDotacion() {
    await botReply('¿Cuántos trabajadores contratados tiene actualmente tu empresa?');
    askDotacionOptions();
  }

  function askDotacionOptions() {
    currentStep = STEPS.DOTACION;
    showOptions(
      TRAMOS.map((t) => ({ label: t.label, value: t.id })),
      (value, label) => {
        leadData.tramoId  = value;
        leadData.dotacion = label;
        appendMessage(label, 'user');
        askPregunta(0); // inicia secuencia de preguntas desde P1
      }
    );
  }

  /* ─── SECUENCIA DE PREGUNTAS (BLOQUES A / B / C) ─────────────
   * Recorre PREGUNTAS en orden; salta las que no aplican según
   * el tramo de empresa seleccionado (lógica de bloques B y C).
   */
  async function askPregunta(index) {
    if (index >= PREGUNTAS.length) {
      finalizarMatriz();
      return;
    }

    const pregunta = PREGUNTAS[index];

    /* Si la pregunta no aplica al tramo actual, saltar a la siguiente */
    if (!pregunta.aplica(leadData.tramoId)) {
      askPregunta(index + 1);
      return;
    }

    currentStep = STEPS[pregunta.id.toUpperCase()] || currentStep;

    await botReply(pregunta.texto);

    showOptions(
      pregunta.opciones,
      (value, label) => {
        appendMessage(label, 'user');

        /* Guardar respuesta y sumar puntaje si corresponde */
        leadData.respuestas[pregunta.id] = label;
        if (value === 'no') {
          leadData.puntaje += pregunta.puntajeNo;
        }

        askPregunta(index + 1);
      }
    );
  }

  /* ─── CÁLCULO DE LA MATRIZ DE RIESGO SENSIBILIZADA ───────────
   * 1) Forzado por criticidad comercial/legal: tramo_3 o tramo_4
   *    con puntaje >= 40 => CRÍTICA, sin importar la escala estándar.
   * 2) En el resto de los casos, se aplica la escala estándar por
   *    rangos numéricos.
   */
  function calcularNivelRiesgo(puntaje, tramoId) {
    const esEmpresaGrande = tramoId === 'tramo_3' || tramoId === 'tramo_4';

    if (esEmpresaGrande && puntaje >= 40) {
      return 'CRÍTICA';
    }

    if (puntaje >= 70) return 'CRÍTICA';
    if (puntaje >= 40) return 'ALTA';   // solo empresas <26 trabajadores llegan aquí sin forzarse a CRÍTICA
    if (puntaje >= 15) return 'MEDIA';
    return 'BAJA';
  }

  /* Finaliza la secuencia de preguntas, calcula el nivel de riesgo
   * y transiciona al formulario de contacto */
  async function finalizarMatriz() {
    leadData.nivelRiesgo = calcularNivelRiesgo(leadData.puntaje, leadData.tramoId);
    await transitionToForm(leadData.nivelRiesgo);
  }

  /* Transición al formulario según Nivel de Riesgo calculado */
  async function transitionToForm(nivelRiesgo) {
    currentStep = STEPS.FORM;

    let contextMsg = '';
    if (nivelRiesgo === 'CRÍTICA') {
      contextMsg = 'Tu perfil presenta un <strong>Nivel de Riesgo Crítico</strong>. Una sanción puede bloquearte en SICEP antes de que presentes tu próxima propuesta. NEXOR puede evitarlo.';
    } else if (nivelRiesgo === 'ALTA') {
      contextMsg = 'Tu perfil presenta un <strong>Nivel de Riesgo Alto</strong>. Estás en el momento crítico para actuar: acompañar bien este proceso puede convertirse en una ventaja competitiva frente a tu mandante.';
    } else if (nivelRiesgo === 'MEDIA') {
      contextMsg = 'Tu perfil presenta un <strong>Nivel de Riesgo Medio</strong>. Hay brechas puntuales que, bien gestionadas, fortalecen tu posición frente a tu mandante.';
    } else {
      contextMsg = 'Tu perfil presenta un <strong>Nivel de Riesgo Bajo</strong>. Buen punto de partida: NEXOR puede ayudarte a convertir ese cumplimiento en inteligencia operacional visible para tu mandante.';
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
   * • Tamaño Empresa:  [Tramo seleccionado]
   * • Puntaje Riesgo:  [Puntaje numérico acumulado]
   * • Nivel de Riesgo: [BAJA / MEDIA / ALTA / CRÍTICA]
   * • Respuestas P1-P6:[Detalle de cada respuesta]
   * --------------------------------------------------
   */
  async function sendLeadNotification(data) {
    if (USE_WEBHOOK) {
      /* ── OPCIÓN A: Webhook (Make / Zapier) ── */
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source:        'NEXOR .ai Chat',
          nombre:        data.nombre,
          empresa:       data.empresa,
          email:         data.email,
          telefono:      data.telefono,
          dotacion:      data.dotacion,
          tramo_id:      data.tramoId,
          puntaje_total: data.puntaje,
          nivel_riesgo:  data.nivelRiesgo,
          respuesta_p1:  data.respuestas.p1 || null,
          respuesta_p2:  data.respuestas.p2 || null,
          respuesta_p3:  data.respuestas.p3 || null,
          respuesta_p4:  data.respuestas.p4 || null,
          respuesta_p5:  data.respuestas.p5 || null,
          respuesta_p6:  data.respuestas.p6 || null,
          timestamp:     new Date().toISOString(),
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
        nombre:        data.nombre,
        empresa:       data.empresa,
        email:         data.email,
        telefono:      data.telefono,
        dotacion:      data.dotacion,
        tramo_id:      data.tramoId,
        puntaje_total: data.puntaje,
        nivel_riesgo:  data.nivelRiesgo,
        respuesta_p1:  data.respuestas.p1 || null,
        respuesta_p2:  data.respuestas.p2 || null,
        respuesta_p3:  data.respuestas.p3 || null,
        respuesta_p4:  data.respuestas.p4 || null,
        respuesta_p5:  data.respuestas.p5 || null,
        respuesta_p6:  data.respuestas.p6 || null,
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
