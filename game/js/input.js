// input.js — mouse and keyboard for Emberline Duel.
//
// Mouse: click a hand card to select it, then click a lane to play it
// there; click End Turn (or press Enter) to pass. Keyboard: 1–7 select a
// hand card, Enter/Space ends the turn, Esc returns to the title, M
// toggles sound. All buttons also work by click, so nothing is
// keyboard-only.

(function () {
  'use strict';

  function currentState() { return window.EmberGame.getState(); }

  function selectHandCard(index) {
    var s = currentState();
    if (!s || s.phase !== 'player') return;
    var card = s.you.hand[index];
    if (!card) return;
    if (s.you.ember < card.cost) {
      window.EmberGame.logLine('Not enough ember for <b>' + card.name + '</b> (' + card.cost + ' needed).');
      window.EmberRender.renderLog();
      return;
    }
    s.selected = (s.selected === index) ? null : index;
    window.EmberAudio.Sounds.select();
    window.EmberRender.renderAll();
  }

  function clickLane(lane) {
    var s = currentState();
    if (!s || s.phase !== 'player') return;
    if (s.selected == null) return;
    var ok = window.EmberGame.playCard(s.selected, lane);
    if (!ok) window.EmberGame.logLine('That lane is taken — pick an empty one.');
  }

  function bind() {
    // Hand cards (event delegation: the hand is re-rendered often).
    document.getElementById('hand').addEventListener('click', function (ev) {
      var cardEl = ev.target.closest('.card');
      if (!cardEl) return;
      selectHandCard(parseInt(cardEl.dataset.handIndex, 10));
    });

    // Lanes.
    document.querySelectorAll('.lane').forEach(function (laneEl) {
      laneEl.addEventListener('click', function () {
        clickLane(parseInt(laneEl.dataset.lane, 10));
      });
    });

    document.getElementById('btn-end-turn').addEventListener('click', function () {
      window.EmberGame.endTurn();
    });
    document.getElementById('btn-mute').addEventListener('click', function () {
      window.EmberAudio.toggleMute();
    });

    // Title / end-screen buttons.
    document.getElementById('btn-play').addEventListener('click', function () {
      window.EmberMain.startDuel();
    });
    document.getElementById('btn-howto').addEventListener('click', function () {
      document.getElementById('howto').classList.toggle('hidden');
    });
    document.getElementById('btn-again').addEventListener('click', function () {
      window.EmberMain.startDuel();
    });
    document.getElementById('btn-title').addEventListener('click', function () {
      window.EmberMain.showTitle();
    });

    // Keyboard.
    document.addEventListener('keydown', function (ev) {
      var s = currentState();
      if (ev.key >= '1' && ev.key <= '7') {
        selectHandCard(parseInt(ev.key, 10) - 1);
        return;
      }
      if (ev.key === 'Enter' || ev.key === ' ') {
        if (s && s.screen === 'table' && s.phase === 'player') {
          ev.preventDefault();
          window.EmberGame.endTurn();
        }
        return;
      }
      if (ev.key === 'Escape') {
        window.EmberMain.showTitle();
        return;
      }
      if (ev.key === 'm' || ev.key === 'M') {
        window.EmberAudio.toggleMute();
      }
    });
  }

  window.EmberInput = { bind: bind, selectHandCard: selectHandCard, clickLane: clickLane };
})();
