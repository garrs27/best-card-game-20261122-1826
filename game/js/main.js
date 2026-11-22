// main.js — boot Emberline Duel and its demo states.
//
// Normal play starts on the title screen; Play builds a fresh game
// through the same constructor the demo states use. The `?shot=` query
// param seeds a fixed state for screenshots, always through the normal
// game-state constructor (newGame) and then arranged by hand:
//
//   ?shot=title  — title screen
//   ?shot=table  — a real mid-game: creatures on both sides, both hands,
//                  life totals and ember visible (seed 7, turn 6)
//   ?shot=win    — victory screen with stats
//   ?shot=loss   — defeat screen with stats
//
// Demo states are screenshots only; they never affect a real duel.

(function () {
  'use strict';

  var C = window.EmberCards;

  function startDuel() {
    window.EmberGame.newGame();
    window.EmberRender.showScreen('table');
    window.EmberRender.renderAll();
  }

  function showTitle() {
    window.EmberRender.showScreen('title');
    window.EmberRender.showBestLine();
  }

  // A fixed mid-game table, built on the real constructor so every
  // number on screen comes from the same rules as a live duel.
  function demoTable() {
    var s = window.EmberGame.newGame(7);
    s.turn = 6;
    s.stats.turns = 6;
    s.stats.damageDealt = 9;
    s.stats.cardsPlayed = 8;
    s.you.life = 14;
    s.you.maxEmber = 6;
    s.you.ember = 5;
    s.ai.life = 11;
    s.ai.maxEmber = 5;
    s.ai.ember = 4;
    s.you.hand = ['flame-knight', 'tide-healer', 'spark-imp', 'wild-pyre', 'elder-wisp'].map(C.cardById);
    s.ai.hand = [C.cardById('emberling'), C.cardById('spark-imp'), C.cardById('stone-guard'), C.cardById('frost-sprite')];
    s.you.board[0] = C.makeCreature(C.cardById('flame-knight'));
    s.you.board[1] = C.makeCreature(C.cardById('stone-guard'));
    s.you.board[2] = C.makeCreature(C.cardById('cinder-twins'));
    s.ai.board[0] = C.makeCreature(C.cardById('ash-golem'));
    s.ai.board[1] = C.makeCreature(C.cardById('gale-archer'));
    s.ai.board[2] = C.makeCreature(C.cardById('frost-sprite'));
    s.you.board[0].hp = 2; // scarred from last combat
    s.ai.board[1].hp = 1;
    s.log = [
      'Your <b>Flame Knight</b> hits the Emberlord for <span class="dmg">3</span>.',
      'Emberlord\u2019s <b>Ash Golem</b> holds lane 1 at 5 health.',
      'You play <b>Cinder Twins</b> in lane 3.',
      'Emberlord plays <b>Gale Archer</b> in lane 2.',
      'Turn 6: +6 ember, you draw <b>Wild Pyre</b>.',
    ];
    window.EmberRender.showScreen('table');
    window.EmberRender.renderAll();
  }

  function demoEnd(result) {
    var s = window.EmberGame.newGame(11);
    s.turn = 9;
    s.stats.turns = 9;
    s.stats.damageDealt = result === 'win' ? 21 : 8;
    s.stats.cardsPlayed = 11;
    if (result === 'win') {
      s.ai.life = 0;
      s.you.life = 12;
      window.EmberRender.showEndScreen('win', 'The Emberlord\u2019s flame is yours now.');
    } else {
      s.you.life = 0;
      s.ai.life = 7;
      window.EmberRender.showEndScreen('loss', 'Your ember fades. The Emberlord endures.');
    }
  }

  function boot() {
    window.EmberInput.bind();
    var params = new URLSearchParams(window.location.search);
    var shot = params.get('shot');
    if (shot === 'table') { demoTable(); return; }
    if (shot === 'win') { demoEnd('win'); return; }
    if (shot === 'loss') { demoEnd('loss'); return; }
    showTitle();
  }

  document.addEventListener('DOMContentLoaded', boot);

  window.EmberMain = { startDuel: startDuel, showTitle: showTitle };
})();
