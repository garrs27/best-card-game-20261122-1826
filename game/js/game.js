// game.js — Emberline Duel rules: state machine, turns, combat, keywords.
//
// One game object owns everything: both sides' life, ember, deck, hand and
// 3-lane boards, the turn counter, the combat log and the running stats.
// Rendering lives in render.js; the AI's choices live in ai.js; this file
// only decides what happens and when. All timings are plain setTimeout so
// the AI's moves stay visible (~700 ms apart).

(function () {
  'use strict';

  var C = window.EmberCards;
  var START_LIFE = 20;
  var MAX_HAND = 7;
  var MAX_EMBER = 10;
  var LANES = 3;

  var state = null;

  function freshSide(rng) {
    return {
      life: START_LIFE,
      ember: 1, maxEmber: 1,
      deck: C.buildDeck(rng),
      hand: [],
      board: [null, null, null],
    };
  }

  // Build a brand-new game through the normal constructor. `seed` makes the
  // shuffle reproducible (demo states use a fixed seed).
  function newGame(seed) {
    var rng = C.makeRng(seed == null ? (Date.now() % 2147483647) : seed);
    state = {
      seed: seed == null ? 0 : seed,
      screen: 'table',
      phase: 'player',          // 'player' | 'ai' | 'combat' | 'over'
      turn: 1,
      you: freshSide(rng),
      ai: freshSide(rng),
      selected: null,
      log: [],
      stats: { damageDealt: 0, cardsPlayed: 0, turns: 0 },
      rng: rng,
    };
    // Opening hands: 3 cards each. Guarantee the player can act on turn 1:
    // if the opening hand holds no 1-ember card, swap one in from the deck
    // (the swapped card goes back into the deck at the same spot).
    for (var i = 0; i < 3; i++) { drawCard(state.you); drawCard(state.ai); }
    if (!state.you.hand.some(function (c) { return c.cost <= 1; })) {
      var oneCost = -1;
      for (var d = 0; d < state.you.deck.length; d++) {
        if (C.cardById(state.you.deck[d]).cost <= 1) { oneCost = d; break; }
      }
      if (oneCost >= 0) {
        var swapOut = state.you.hand[0].id;
        state.you.hand[0] = C.cardById(state.you.deck[oneCost]);
        state.you.deck[oneCost] = swapOut;
      }
    }
    logLine('The duel begins. You hold the first spark.');
    return state;
  }

  function getState() { return state; }
  function setState(s) { state = s; }

  function logLine(html) {
    if (!state) return;
    state.log.unshift(html);
    if (state.log.length > 40) state.log.length = 40;
    if (window.EmberRender) window.EmberRender.renderLog();
  }

  function drawCard(side) {
    if (side.deck.length === 0) return null;
    if (side.hand.length >= MAX_HAND) {
      side.deck.shift(); // hand full: the drawn card burns
      return null;
    }
    var id = side.deck.shift();
    var card = C.cardById(id);
    side.hand.push(card);
    return card;
  }

  // --- playing a card -------------------------------------------------
  function canPlay(handIndex, lane) {
    if (!state || state.phase !== 'player') return false;
    var card = state.you.hand[handIndex];
    if (!card) return false;
    if (state.you.ember < card.cost) return false;
    if (lane < 0 || lane >= LANES) return false;
    if (state.you.board[lane]) return false; // one creature per lane per side
    return true;
  }

  function playCard(handIndex, lane) {
    if (!canPlay(handIndex, lane)) return false;
    var card = state.you.hand[handIndex];
    state.you.ember -= card.cost;
    state.you.hand.splice(handIndex, 1);
    var creature = C.makeCreature(card);
    state.you.board[lane] = creature;
    state.stats.cardsPlayed++;
    window.EmberAudio.Sounds.playCard();
    logLine('You play <b>' + card.name + '</b> in lane ' + (lane + 1) + '.');
    applyPlayEffect('you', creature, lane);
    state.selected = null;
    window.EmberRender.renderAll();
    return true;
  }

  // on-play keywords: Mend, Burn, Draw, Frost.
  function applyPlayEffect(sideName, creature, lane) {
    var me = state[sideName];
    var foe = state[sideName === 'you' ? 'ai' : 'you'];
    var who = sideName === 'you' ? 'You' : 'Emberlord';
    if (creature.kw === 'mend') {
      me.life = Math.min(START_LIFE, me.life + 3);
      window.EmberAudio.Sounds.heal();
      logLine(who + ' mend <span class="heal">+3 life</span>.');
      window.EmberRender.floatText(lane, sideName, '+3', 'heal');
    } else if (creature.kw === 'burn') {
      foe.life -= 1;
      if (sideName === 'you') state.stats.damageDealt += 1;
      window.EmberAudio.Sounds.lifeHit();
      logLine(who + ' burn the foe for <span class="dmg">1</span>.');
      window.EmberRender.floatText(lane, sideName === 'you' ? 'ai' : 'you', '-1', '');
    } else if (creature.kw === 'draw') {
      var drawn = drawCard(me);
      logLine(who + (drawn ? ' draw <b>' + drawn.name + '</b>.' : ' try to draw, but the hand is full.'));
    } else if (creature.kw === 'frost') {
      var target = foe.board[lane];
      if (target) {
        target.frozen = true;
        logLine(who + ' freeze <b>' + target.name + '</b> in lane ' + (lane + 1) + '.');
      }
    }
    checkEnd();
  }

  // --- turn flow ------------------------------------------------------
  function endTurn() {
    if (!state || state.phase !== 'player') return;
    state.phase = 'ai';
    state.selected = null;
    window.EmberAudio.Sounds.endTurn();
    logLine('— Your turn ends. Emberlord stirs… —');
    window.EmberRender.renderAll();
    setTimeout(aiTakeTurn, 650);
  }

  function aiTakeTurn() {
    if (!state || state.phase !== 'ai') return;
    // AI draws and its ember grows like the player's.
    state.ai.maxEmber = Math.min(MAX_EMBER, state.ai.maxEmber + 1);
    state.ai.ember = state.ai.maxEmber;
    var drawn = drawCard(state.ai);
    if (drawn) logLine('Emberlord draws a card.');

    // Play moves one at a time so each is visible on the board.
    var step = function () {
      if (!state || state.phase !== 'ai') return;
      var move = window.EmberAI.chooseAiMove(state);
      if (!move) { setTimeout(resolveCombat, 700); return; }
      aiPlayCard(move.cardId, move.lane);
      setTimeout(step, 700);
    };
    step();
  }

  function aiPlayCard(cardId, lane) {
    var idx = -1;
    for (var i = 0; i < state.ai.hand.length; i++) {
      if (state.ai.hand[i].id === cardId) { idx = i; break; }
    }
    if (idx < 0) return false;
    var card = state.ai.hand[idx];
    if (state.ai.ember < card.cost || state.ai.board[lane]) return false;
    state.ai.ember -= card.cost;
    state.ai.hand.splice(idx, 1);
    var creature = C.makeCreature(card);
    state.ai.board[lane] = creature;
    window.EmberAudio.Sounds.playCard();
    logLine('Emberlord plays <b>' + card.name + '</b> in lane ' + (lane + 1) + '.');
    applyPlayEffect('ai', creature, lane);
    window.EmberRender.renderAll();
    return true;
  }

  // --- combat ---------------------------------------------------------
  // Lane by lane: Swift strikes first; otherwise both creatures trade
  // damage at once. A survivor whose foe is gone (or was never there)
  // hits the enemy life — unless a Guard stands in that lane.
  function resolveCombat() {
    if (!state) return;
    state.phase = 'combat';
    logLine('— Combat! —');
    window.EmberRender.renderAll();
    var lane = 0;
    var stepLane = function () {
      if (!state) return;
      if (lane >= LANES) { finishCombat(); return; }
      fightLane(lane);
      window.EmberRender.renderAll();
      lane++;
      setTimeout(stepLane, 750);
    };
    stepLane();
  }

  function creatureCanHit(creature) {
    return creature && !creature.frozen;
  }

  function fightLane(lane) {
    var y = state.you.board[lane];
    var a = state.ai.board[lane];
    if (!y && !a) return;

    var yAtk = C.effectiveAttack(state.you.board, lane, y);
    var aAtk = C.effectiveAttack(state.ai.board, lane, a);
    // A Guard that falls in this lane still shields its owner's life for
    // this combat — its last stand absorbs the blow. That is what makes
    // Guard worth playing: without it the keyword could never trigger,
    // since one creature per lane means an empty lane has no Guard in it.
    var yGuardFell = false;
    var aGuardFell = false;

    if (y && a) {
      var ySwift = y.kw === 'swift';
      var aSwift = a.kw === 'swift';
      if (ySwift && !aSwift && creatureCanHit(y)) {
        a.hp -= yAtk; a.justHit = true;
        logLine('Your <b>' + y.name + '</b> strikes first (<span class="dmg">' + yAtk + '</span>).');
        window.EmberAudio.Sounds.hit();
        if (a.hp <= 0) { if (a.kw === 'guard') aGuardFell = true; state.ai.board[lane] = null; logLine('Emberlord\u2019s <b>' + a.name + '</b> falls.'); }
      } else if (aSwift && !ySwift && creatureCanHit(a)) {
        y.hp -= aAtk; y.justHit = true;
        logLine('Emberlord\u2019s <b>' + a.name + '</b> strikes first (<span class="dmg">' + aAtk + '</span>).');
        window.EmberAudio.Sounds.hit();
        if (y.hp <= 0) { if (y.kw === 'guard') yGuardFell = true; state.you.board[lane] = null; logLine('Your <b>' + y.name + '</b> falls.'); }
      } else {
        // Simultaneous trade; a frozen creature deals nothing.
        if (creatureCanHit(y)) { a.hp -= yAtk; a.justHit = true; }
        if (creatureCanHit(a)) { y.hp -= aAtk; y.justHit = true; }
        if (yAtk || aAtk) window.EmberAudio.Sounds.hit();
        if (a.hp <= 0 && state.ai.board[lane]) { if (a.kw === 'guard') aGuardFell = true; state.ai.board[lane] = null; logLine('Emberlord\u2019s <b>' + a.name + '</b> falls.'); }
        if (y.hp <= 0 && state.you.board[lane]) { if (y.kw === 'guard') yGuardFell = true; state.you.board[lane] = null; logLine('Your <b>' + y.name + '</b> falls.'); }
        if (y.frozen) { logLine('Your <b>' + y.name + '</b> is frozen and cannot strike.'); y.frozen = false; }
        if (a && a.frozen) { logLine('Emberlord\u2019s <b>' + a.name + '</b> is frozen and cannot strike.'); a.frozen = false; }
      }
    }

    // Survivors push damage to life (Guard blocks its own lane).
    var yAlive = state.you.board[lane];
    var aAlive = state.ai.board[lane];
    if (yAlive && !aAlive) {
      var dmg = C.effectiveAttack(state.you.board, lane, yAlive);
      if (aGuardFell) {
        logLine('The fallen Guard holds lane ' + (lane + 1) + ' — no life damage.');
      } else if (dmg > 0) {
        state.ai.life -= dmg;
        state.stats.damageDealt += dmg;
        window.EmberAudio.Sounds.lifeHit();
        logLine('Your <b>' + yAlive.name + '</b> hits the Emberlord for <span class="dmg">' + dmg + '</span>.');
        window.EmberRender.floatText(lane, 'ai', '-' + dmg, '');
      }
    }
    if (aAlive && !yAlive) {
      var dmg2 = C.effectiveAttack(state.ai.board, lane, aAlive);
      if (yGuardFell) {
        logLine('Your fallen Guard holds lane ' + (lane + 1) + ' — no life damage.');
      } else if (dmg2 > 0) {
        state.you.life -= dmg2;
        window.EmberAudio.Sounds.lifeHit();
        logLine('Emberlord\u2019s <b>' + aAlive.name + '</b> hits you for <span class="dmg">' + dmg2 + '</span>.');
        window.EmberRender.floatText(lane, 'you', '-' + dmg2, '');
      }
    }
    if (state.you.board[lane]) state.you.board[lane].justHit = false;
    if (state.ai.board[lane]) state.ai.board[lane].justHit = false;
  }

  function finishCombat() {
    if (!state) return;
    if (checkEnd()) return;
    // Your next turn: ember grows, draw one.
    state.turn++;
    state.stats.turns = state.turn;
    state.you.maxEmber = Math.min(MAX_EMBER, state.you.maxEmber + 1);
    state.you.ember = state.you.maxEmber;
    var drawn = drawCard(state.you);
    state.phase = 'player';
    logLine('Turn ' + state.turn + ': +' + state.you.maxEmber + ' ember' + (drawn ? ', you draw <b>' + drawn.name + '</b>.' : '.'));
    window.EmberRender.renderAll();
  }

  // --- game end -------------------------------------------------------
  function checkEnd() {
    if (!state || state.phase === 'over') return false;
    if (state.ai.life <= 0 && state.you.life <= 0) {
      endGame('loss', 'Both sparks gutter out — a draw counts as a defeat here.');
      return true;
    }
    if (state.ai.life <= 0) {
      endGame('win', 'The Emberlord\u2019s flame is yours now.');
      return true;
    }
    if (state.you.life <= 0) {
      endGame('loss', 'Your ember fades. The Emberlord endures.');
      return true;
    }
    return false;
  }

  function endGame(result, sub) {
    state.phase = 'over';
    state.screen = result === 'win' ? 'win' : 'loss';
    state.endSub = sub;
    if (result === 'win') window.EmberAudio.Sounds.win();
    else window.EmberAudio.Sounds.lose();
    window.EmberRender.renderAll();
    window.EmberRender.showEndScreen(result, sub);
  }

  window.EmberGame = {
    newGame: newGame, getState: getState, setState: setState,
    playCard: playCard, canPlay: canPlay, endTurn: endTurn,
    logLine: logLine, drawCard: drawCard,
    START_LIFE: START_LIFE, MAX_HAND: MAX_HAND, MAX_EMBER: MAX_EMBER,
  };
})();
