// cards.js — the 12 original Emberline Duel cards and the 24-card deck.
//
// Every card is plain data: id, name, cost (ember), attack, health, an
// optional keyword, a glyph drawn from a text symbol (never an image), and
// a one-line flavour. Keywords are told apart by colour AND glyph (see
// style.css .kw-* and .card.k-*). The deck is 12 unique cards x2, shuffled
// with a seedable RNG so demo states are reproducible.

(function () {
  'use strict';

  // Keyword catalogue: glyph + label used on cards and in the how-to list.
  var KEYWORDS = {
    guard: { glyph: '\u26E8', label: 'Guard',  text: 'Shields its lane: no life damage through this lane.' },
    swift: { glyph: '\u26A1', label: 'Swift',  text: 'Strikes first in its lane.' },
    rally: { glyph: '\u21D1', label: 'Rally',  text: 'Adjacent allies get +1 attack while on board.' },
    mend:  { glyph: '\u271A', label: 'Mend',   text: 'Heal your life by 3 when played.' },
    burn:  { glyph: '\u2668', label: 'Burn',   text: 'Deal 1 damage to enemy life when played.' },
    frost: { glyph: '\u2744', label: 'Frost',  text: 'The foe in its lane cannot attack next combat.' },
    draw:  { glyph: '\u29C9', label: 'Draw',   text: 'Draw a card when played.' },
  };

  var CARDS = [
    { id: 'emberling',    name: 'Emberling',    cost: 1, atk: 1, hp: 1, kw: null,    art: '\uD83D\uDD25', flavor: 'A spark that refused to go out.' },
    { id: 'spark-imp',    name: 'Spark Imp',    cost: 2, atk: 2, hp: 1, kw: null,    art: '\uD83D\uDC7A', flavor: 'It giggles before it bites.' },
    { id: 'stone-guard',  name: 'Stone Guard',  cost: 2, atk: 1, hp: 3, kw: 'guard', art: '\uD83D\uDEE1\uFE0F', flavor: 'The lane behind it is safe.' },
    { id: 'gale-archer',  name: 'Gale Archer',  cost: 3, atk: 2, hp: 2, kw: 'swift', art: '\uD83C\uDFF9', flavor: 'Her arrow arrives before the sound.' },
    { id: 'flame-knight', name: 'Flame Knight', cost: 4, atk: 3, hp: 3, kw: null,    art: '\u2694\uFE0F', flavor: 'Oathbound to the emberline.' },
    { id: 'tide-healer',  name: 'Tide Healer',  cost: 3, atk: 1, hp: 2, kw: 'mend',  art: '\uD83D\uDCA7', flavor: 'Cool water over burnt hands.' },
    { id: 'storm-caller', name: 'Storm Caller', cost: 5, atk: 4, hp: 4, kw: null,    art: '\u26C8\uFE0F', flavor: 'The sky answers when she calls.' },
    { id: 'cinder-twins', name: 'Cinder Twins', cost: 3, atk: 2, hp: 2, kw: 'rally', art: '\uD83D\uDC6F', flavor: 'Two sparks, one temper.' },
    { id: 'ash-golem',    name: 'Ash Golem',    cost: 6, atk: 5, hp: 5, kw: null,    art: '\uD83D\uDDFF', flavor: 'It remembers every fire.' },
    { id: 'frost-sprite', name: 'Frost Sprite', cost: 2, atk: 1, hp: 1, kw: 'frost', art: '\u2744\uFE0F', flavor: 'Winter, pocket-sized.' },
    { id: 'wild-pyre',    name: 'Wild Pyre',    cost: 4, atk: 3, hp: 2, kw: 'burn',  art: '\uD83D\uDD25', flavor: 'Light it and step back.' },
    { id: 'elder-wisp',   name: 'Elder Wisp',   cost: 1, atk: 0, hp: 2, kw: 'draw',  art: '\uD83D\uDCAB', flavor: 'Old light, new ideas.' },
  ];

  // Seeded RNG (mulberry32) so demo/screenshot states are reproducible.
  function makeRng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function cardById(id) {
    for (var i = 0; i < CARDS.length; i++) if (CARDS[i].id === id) return CARDS[i];
    return null;
  }

  // A fresh creature on the board: a copy of the card's stats plus live state.
  function makeCreature(card) {
    return {
      id: card.id, name: card.name, cost: card.cost, kw: card.kw,
      art: card.art, flavor: card.flavor,
      atk: card.atk, hp: card.hp, maxHp: card.hp,
      frozen: false, justHit: false,
    };
  }

  // Build a 24-card deck (each unique card twice) and shuffle it.
  function buildDeck(rng) {
    var deck = [];
    CARDS.forEach(function (c) { deck.push(c.id); deck.push(c.id); });
    for (var i = deck.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
    }
    return deck;
  }

  // Rally: a creature's live attack = base + 1 per adjacent allied Rally creature.
  function effectiveAttack(board, lane, creature) {
    if (!creature) return 0;
    var bonus = 0;
    [lane - 1, lane + 1].forEach(function (n) {
      var neighbour = board[n];
      if (neighbour && neighbour.kw === 'rally') bonus += 1;
    });
    return creature.atk + bonus;
  }

  window.EmberCards = {
    CARDS: CARDS, KEYWORDS: KEYWORDS,
    makeRng: makeRng, cardById: cardById,
    makeCreature: makeCreature, buildDeck: buildDeck,
    effectiveAttack: effectiveAttack,
  };
})();
