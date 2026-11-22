// ai.js — the Emberlord's brain: one readable move at a time.
//
// The AI is deliberately legible: you can see what it values and play
// around it. Each call returns a single move { cardId, lane } or null
// when it is done for the turn. The game calls it repeatedly until it
// returns null, so every move is re-planned on the fresh board.
//
// Priorities, in order:
//   1. If low on life (<= 8) and a Guard is affordable, guard the lane
//      facing the biggest enemy attack.
//   2. Frost the biggest enemy creature it can reach.
//   3. Mend when hurt, Burn whenever it is cheap damage.
//   4. Otherwise play its biggest affordable attacker into the lane
//      where it wins the trade, or an empty lane to push life damage.

(function () {
  'use strict';

  var C = window.EmberCards;

  function affordablePlays(state) {
    var plays = [];
    state.ai.hand.forEach(function (card) {
      if (card.cost > state.ai.ember) return;
      for (var lane = 0; lane < 3; lane++) {
        if (!state.ai.board[lane]) plays.push({ card: card, lane: lane });
      }
    });
    return plays;
  }

  function enemyAttackInLane(state, lane) {
    var c = state.you.board[lane];
    return c ? C.effectiveAttack(state.you.board, lane, c) : 0;
  }

  function chooseAiMove(state) {
    var plays = affordablePlays(state);
    if (!plays.length) return null;

    var me = state.ai;

    // 1. Desperate defence: Guard the most dangerous lane when low.
    if (me.life <= 8) {
      var guards = plays.filter(function (p) { return p.card.kw === 'guard'; });
      if (guards.length) {
        var worst = 0;
        for (var l = 1; l < 3; l++) {
          if (enemyAttackInLane(state, l) > enemyAttackInLane(state, worst)) worst = l;
        }
        var g = guards.filter(function (p) { return p.lane === worst; })[0] || guards[0];
        return { cardId: g.card.id, lane: g.lane };
      }
    }

    // 2. Frost the biggest enemy creature on the board.
    var frosts = plays.filter(function (p) { return p.card.kw === 'frost'; });
    if (frosts.length) {
      var bestFrost = null, bestAtk = 0;
      frosts.forEach(function (p) {
        var atk = enemyAttackInLane(state, p.lane);
        if (atk > bestAtk) { bestAtk = atk; bestFrost = p; }
      });
      if (bestFrost) return { cardId: bestFrost.card.id, lane: bestFrost.lane };
    }

    // 3. Heal when hurt, burn for free reach.
    var mends = plays.filter(function (p) { return p.card.kw === 'mend'; });
    if (mends.length && me.life <= 14) return { cardId: mends[0].card.id, lane: mends[0].lane };
    var burns = plays.filter(function (p) { return p.card.kw === 'burn'; });
    if (burns.length) return { cardId: burns[0].card.id, lane: burns[0].lane };

    // 4. Biggest attacker into the best lane: prefer a lane it wins
    // (its attack >= the foe's health), else an empty lane to hit life,
    // else the lane with the weakest foe.
    var attackers = plays.slice().sort(function (a, b) { return b.card.atk - a.card.atk; });
    var best = null, bestScore = -1;
    attackers.forEach(function (p) {
      var foe = state.you.board[p.lane];
      var score = 0;
      if (!foe) score = 10 + p.card.atk;                    // empty lane: life damage
      else if (p.card.atk >= foe.hp) score = 8 + p.card.atk; // wins the trade
      else score = p.card.atk - foe.atk;                     // loses, but chips
      if (p.card.kw === 'rally') score += 1;
      if (score > bestScore) { bestScore = score; best = p; }
    });
    if (!best) return null;
    return { cardId: best.card.id, lane: best.lane };
  }

  window.EmberAI = { chooseAiMove: chooseAiMove };
})();
