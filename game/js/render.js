// render.js — turns game state into DOM: HUD, lanes, hand, log, screens.
//
// Rendering is a full re-draw of the table from state on every change
// (the game is small; a fresh draw keeps the code honest). Card elements
// are rebuilt each time, which is also what gives the dealt hand its
// slide-in animation and lets damage floaters sit on the right lane.

(function () {
  'use strict';

  var C = window.EmberCards;

  function $(id) { return document.getElementById(id); }

  function showScreen(name) {
    ['screen-title', 'screen-table', 'screen-end'].forEach(function (id) {
      $(id).classList.toggle('hidden', id !== 'screen-' + name);
    });
  }

  function keywordChip(card) {
    if (!card.kw) return '';
    var kw = C.KEYWORDS[card.kw];
    return '<span class="kw ' + card.kw + '">' + kw.glyph + ' ' + kw.label + '</span>';
  }

  // One card element. `context` is 'hand' or 'board'; hand cards carry
  // their index for click selection, board cards show live health.
  function cardElement(card, context, index) {
    var el = document.createElement('div');
    var kwClass = card.kw ? 'k-' + card.kw : 'k-none';
    el.className = 'card ' + kwClass;
    if (card.frozen) el.classList.add('frozen');
    if (card.justHit) el.classList.add('just-hit');
    if (context === 'hand') el.dataset.handIndex = index;
    var atk = card.atk;
    var hp = card.hp;
    el.innerHTML =
      '<div class="cost" title="Ember cost">' + card.cost + '</div>' +
      '<div class="art" aria-hidden="true">' + card.art + '</div>' +
      '<div class="name">' + card.name + '</div>' +
      '<div class="kw-line">' + keywordChip(card) + '</div>' +
      '<div class="flavor">' + card.flavor + '</div>' +
      '<div class="atk" title="Attack">' + atk + '</div>' +
      '<div class="hp" title="Health">' + hp + '</div>';
    return el;
  }

  function renderHud() {
    var s = window.EmberGame.getState();
    if (!s) return;
    $('ai-life').textContent = Math.max(0, s.ai.life);
    $('you-life').textContent = Math.max(0, s.you.life);
    $('ai-life').classList.toggle('low', s.ai.life <= 5);
    $('you-life').classList.toggle('low', s.you.life <= 5);
    $('ai-deck').textContent = s.ai.deck.length;
    $('you-deck').textContent = s.you.deck.length;
    $('ai-ember').textContent = s.ai.ember;
    $('you-ember').textContent = s.you.ember;
    $('you-ember-max').textContent = s.you.maxEmber;

    // Life bars + ember pips: the same numbers as shapes, readable at a
    // glance in a screenshot — bar width is life out of the 20 both
    // duelists start with, one pip per ember crystal (lit = spendable).
    var MAX_LIFE = 20;
    $('ai-life-fill').style.width = Math.min(100, Math.max(0, s.ai.life) / MAX_LIFE * 100) + '%';
    $('you-life-fill').style.width = Math.min(100, Math.max(0, s.you.life) / MAX_LIFE * 100) + '%';
    $('ai-life-bar').classList.toggle('low', s.ai.life <= 5);
    $('you-life-bar').classList.toggle('low', s.you.life <= 5);
    [['ai-ember-pips', s.ai], ['you-ember-pips', s.you]].forEach(function (pair) {
      var host = $(pair[0]);
      var side = pair[1];
      host.innerHTML = '';
      for (var i = 0; i < side.maxEmber; i++) {
        var pip = document.createElement('span');
        pip.className = 'pip' + (i < side.ember ? ' on' : '');
        host.appendChild(pip);
      }
    });
    $('turn-num').textContent = s.turn;
    var phaseText = {
      player: 'Your turn — play a card, then End Turn',
      ai: 'Emberlord is thinking…',
      combat: '⚔ Combat resolves lane by lane…',
      over: 'The duel is decided.',
    };
    $('phase-line').textContent = phaseText[s.phase] || '';
    $('btn-end-turn').disabled = s.phase !== 'player';

    // Enemy hand as face-down card backs with a count.
    var backs = $('ai-hand');
    backs.innerHTML = '';
    s.ai.hand.forEach(function () {
      var b = document.createElement('div');
      b.className = 'mini-card';
      backs.appendChild(b);
    });
    var count = document.createElement('span');
    count.textContent = '×' + s.ai.hand.length;
    count.style.cssText = 'color:#b8a58c;font-size:13px;align-self:center;margin-left:4px;';
    backs.appendChild(count);
  }

  function renderBoard() {
    var s = window.EmberGame.getState();
    if (!s) return;
    for (var lane = 0; lane < 3; lane++) {
      var aiSlot = document.querySelector('.slot.ai-slot[data-lane="' + lane + '"]');
      var youSlot = document.querySelector('.slot.you-slot[data-lane="' + lane + '"]');
      [aiSlot, youSlot].forEach(function (slot) { slot.innerHTML = ''; slot.classList.remove('empty'); });
      var a = s.ai.board[lane];
      var y = s.you.board[lane];
      if (a) aiSlot.appendChild(cardElement(a, 'board'));
      else aiSlot.classList.add('empty');
      if (y) youSlot.appendChild(cardElement(y, 'board'));
      else youSlot.classList.add('empty');

      // A lane is a legal target while a hand card is selected.
      var laneEl = document.querySelector('.lane[data-lane="' + lane + '"]');
      var targetable = s.phase === 'player' && s.selected != null && !s.you.board[lane];
      laneEl.classList.toggle('targetable', !!targetable);
    }
  }

  function renderHand() {
    var s = window.EmberGame.getState();
    if (!s) return;
    var hand = $('hand');
    hand.innerHTML = '';
    if (!s.you.hand.length) {
      var empty = document.createElement('div');
      empty.className = 'empty-hand';
      empty.textContent = 'Your hand is empty — draw next turn.';
      hand.appendChild(empty);
      return;
    }
    s.you.hand.forEach(function (card, i) {
      var el = cardElement(card, 'hand', i);
      if (s.you.ember < card.cost) el.classList.add('unaffordable');
      if (s.selected === i) el.classList.add('selected');
      hand.appendChild(el);
    });
  }

  function renderLog() {
    var s = window.EmberGame.getState();
    var list = $('combat-log');
    if (!s || !list) return;
    list.innerHTML = '';
    s.log.slice(0, 8).forEach(function (line) {
      var li = document.createElement('li');
      li.innerHTML = line;
      list.appendChild(li);
    });
  }

  function renderAll() {
    renderHud();
    renderBoard();
    renderHand();
    renderLog();
  }

  // A floating damage/heal number over a lane's slot.
  function floatText(lane, side, text, kind) {
    var slot = document.querySelector('.slot.' + side + '-slot[data-lane="' + lane + '"]');
    var host = $('floaters');
    if (!slot || !host) return;
    var boardRect = $('board').getBoundingClientRect();
    var rect = slot.getBoundingClientRect();
    var span = document.createElement('span');
    span.className = 'floater' + (kind ? ' ' + kind : '');
    span.textContent = text;
    span.style.left = (rect.left - boardRect.left + rect.width / 2 - 14) + 'px';
    span.style.top = (rect.top - boardRect.top + 10) + 'px';
    host.appendChild(span);
    setTimeout(function () { span.remove(); }, 1050);
  }

  // End screen: win gets confetti, loss gets a quieter close.
  function showEndScreen(result, sub) {
    var s = window.EmberGame.getState();
    showScreen('end');
    var screen = $('screen-end');
    screen.classList.toggle('win', result === 'win');
    screen.classList.toggle('lose', result === 'loss');
    $('end-title').textContent = result === 'win' ? 'VICTORY' : 'DEFEAT';
    $('end-sub').textContent = sub || '';
    $('stat-turns').textContent = s ? s.turn : 0;
    $('stat-damage').textContent = s ? s.stats.damageDealt : 0;
    $('stat-played').textContent = s ? s.stats.cardsPlayed : 0;

    var confetti = $('confetti');
    confetti.innerHTML = '';
    if (result === 'win') {
      var colours = ['#ffb347', '#ff6b35', '#ffd27a', '#7bc96f', '#5aa9e6', '#e0523a'];
      for (var i = 0; i < 60; i++) {
        var piece = document.createElement('i');
        piece.style.left = (Math.random() * 100) + '%';
        piece.style.background = colours[i % colours.length];
        piece.style.animationDuration = (2.2 + Math.random() * 2.5) + 's';
        piece.style.animationDelay = (Math.random() * 1.2) + 's';
        piece.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
        confetti.appendChild(piece);
      }
    }
    // Remember the best result on the title screen.
    try {
      if (result === 'win') {
        localStorage.setItem('emberline-best', 'Won in ' + s.turn + ' turns');
      }
    } catch (e) { /* private mode: best line simply stays hidden */ }
  }

  function showBestLine() {
    var line = $('best-line');
    try {
      var best = localStorage.getItem('emberline-best');
      if (best) {
        line.textContent = '🏆 Best duel: ' + best;
        line.classList.remove('hidden');
      }
    } catch (e) { /* ignore */ }
  }

  window.EmberRender = {
    showScreen: showScreen, renderAll: renderAll, renderLog: renderLog,
    floatText: floatText, showEndScreen: showEndScreen, showBestLine: showBestLine,
  };
})();
