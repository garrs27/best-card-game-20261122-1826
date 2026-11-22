// audio.js — tiny WebAudio bleeps, generated in code, no audio files.
// One shared AudioContext, created lazily on the first user gesture so
// browsers allow it. Mute is a single flag; the M key and the HUD button
// flip it, and the button label always shows the current state.

(function () {
  'use strict';

  var ctx = null;
  var muted = false;

  function ensureContext() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // A short oscillator blip: freq slides to freqEnd over `dur` seconds.
  function blip(freq, freqEnd, dur, type, volume) {
    if (muted) return;
    var ac = ensureContext();
    if (!ac) return;
    try {
      var osc = ac.createOscillator();
      var gain = ac.createGain();
      var now = ac.currentTime;
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, now);
      if (freqEnd && freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(freqEnd, now + dur);
      gain.gain.setValueAtTime(volume || 0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch (e) { /* audio is cosmetic; never break the game */ }
  }

  var Sounds = {
    playCard: function () { blip(520, 780, 0.12, 'triangle', 0.14); },
    drawCard: function () { blip(660, 880, 0.08, 'sine', 0.07); },
    hit: function () { blip(220, 90, 0.18, 'sawtooth', 0.12); },
    lifeHit: function () { blip(160, 60, 0.3, 'sawtooth', 0.16); },
    heal: function () { blip(440, 660, 0.2, 'sine', 0.1); },
    endTurn: function () { blip(392, 392, 0.09, 'triangle', 0.1); },
    select: function () { blip(880, 880, 0.05, 'sine', 0.06); },
    win: function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        setTimeout(function () { blip(f, f, 0.22, 'triangle', 0.14); }, i * 130);
      });
    },
    lose: function () {
      [392, 330, 262, 196].forEach(function (f, i) {
        setTimeout(function () { blip(f, f * 0.92, 0.25, 'triangle', 0.12); }, i * 150);
      });
    },
  };

  function isMuted() { return muted; }

  function toggleMute() {
    muted = !muted;
    var btn = document.getElementById('btn-mute');
    if (btn) btn.textContent = muted ? '\uD83D\uDD07 Muted' : '\uD83D\uDD0A Sound on';
    return muted;
  }

  window.EmberAudio = { Sounds: Sounds, isMuted: isMuted, toggleMute: toggleMute };
})();
