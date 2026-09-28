/* ==========================================================================
   PIXEL CACTUS CLASH - COMPLETE PLAYABLE RETRO ARCADE GAME
   Pure HTML5 Canvas, Vanilla JS, Web Audio Synthesizer, Local Storage Save
   ========================================================================== */

(function () {
  'use strict';

  // --- AUDIO SYNTHESIZER (No external sound files required) ---
  const AudioEngine = {
    ctx: null,
    muted: false,
    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
    },
    playTone(freq, type, duration, endFreq = null, vol = 0.15) {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (endFreq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFreq), this.ctx.currentTime + duration);
      }
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    },
    warning() {
      this.playTone(320, 'square', 0.12, 160, 0.2);
    },
    fall() {
      this.playTone(600, 'sawtooth', 0.7, 80, 0.15);
    },
    plop() {
      this.playTone(140, 'triangle', 0.25, 30, 0.4);
      setTimeout(() => this.playTone(60, 'square', 0.35, 20, 0.35), 40);
    },
    spikeShot() {
      this.playTone(720, 'square', 0.08, 220, 0.12);
    },
    swing() {
      this.playTone(280, 'sine', 0.1, 90, 0.1);
    },
    chopHit() {
      this.playTone(180, 'square', 0.08, 60, 0.25);
    },
    dash() {
      this.playTone(380, 'triangle', 0.18, 900, 0.18);
    },
    collect() {
      this.playTone(523, 'square', 0.08, null, 0.12);
      setTimeout(() => this.playTone(784, 'square', 0.12, null, 0.15), 60);
    },
    playerHurt() {
      this.playTone(120, 'sawtooth', 0.25, 30, 0.35);
    },
    buy() {
      this.playTone(440, 'triangle', 0.08, null, 0.2);
      setTimeout(() => this.playTone(659, 'triangle', 0.08, null, 0.2), 70);
      setTimeout(() => this.playTone(880, 'triangle', 0.15, null, 0.25), 140);
    },
    cactusExplode() {
      this.playTone(160, 'sawtooth', 0.5, 30, 0.4);
      this.playTone(90, 'square', 0.4, 20, 0.3);
    }
  };

  // --- PERSISTENT DATA & SAVE SYSTEM ---
  const SAVE_KEY = 'PIXEL_CACTUS_CLASH_SAVE_DATA_v1';
  let SaveData = {
    money: 0,
    cactusParts: 0,
    round: 1,
    upgrades: {
      axeSpeed: 0,
      axeStrength: 0,
      harvestYield: 0,
      moveSpeed: 0,
      dashLength: 0,
      dashCooldown: 0,
      partValue: 0,
      harvestBonus: 0,
      shockwaveDash: 0,
      tempShield: 0,
      spikeImmunity: 0,
      quickChop: 0,
      magnetPickup: 0
    },
    settings: {
      scanlines: true,
      sound: true
    }
  };

  function loadGameData() {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        SaveData.money = parsed.money || 0;
        SaveData.cactusParts = parsed.cactusParts || 0;
        SaveData.round = parsed.round || 1;
        SaveData.upgrades = Object.assign(SaveData.upgrades, parsed.upgrades || {});
        SaveData.settings = Object.assign(SaveData.settings, parsed.settings || {});
      }
    } catch (e) {
      console.warn('Could not read localStorage:', e);
    }
  }

  function saveGameData() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(SaveData));
    } catch (e) {
      console.warn('Could not write localStorage:', e);
    }
  }

  loadGameData();

  // --- UPGRADE METADATA ---
  const UPGRADE_SPECS = {
    axeSpeed: { name: 'Faster Axe', desc: 'Reduces chop delay', max: 5, basePrice: 25, mult: 1.8, icon: '🪓' },
    axeStrength: { name: 'Stronger Axe', desc: 'Increases chop damage', max: 5, basePrice: 35, mult: 1.9, icon: '💪' },
    harvestYield: { name: 'Better Harvest', desc: 'More parts per cactus', max: 5, basePrice: 40, mult: 2.0, icon: '🌱' },
    moveSpeed: { name: 'Faster Move', desc: 'Boosts walking speed', max: 5, basePrice: 30, mult: 1.7, icon: '👟' },
    dashLength: { name: 'Longer Dash', desc: 'Increases dash travel', max: 4, basePrice: 45, mult: 2.1, icon: '💨' },
    dashCooldown: { name: 'Quick Dash CD', desc: 'Dash recharges faster', max: 5, basePrice: 50, mult: 1.9, icon: '⚡' },
    partValue: { name: 'Part Value', desc: 'Earn more gold per part', max: 5, basePrice: 60, mult: 2.2, icon: '🪙' },
    shockwaveDash: { name: 'Shockwave Dash', desc: 'Dash destroys spikes!', max: 1, basePrice: 200, mult: 1, icon: '💥' },
    tempShield: { name: 'Arcade Shield', desc: 'Blocks 1 spike per round', max: 1, basePrice: 150, mult: 1, icon: '🛡️' },
    magnetPickup: { name: 'Part Magnet', desc: 'Attracts distant cactus parts', max: 3, basePrice: 75, mult: 2.0, icon: '🧲' },
    quickChop: { name: 'Double Chop', desc: 'Chance of an instant hit', max: 3, basePrice: 120, mult: 2.2, icon: '⚔️' }
  };

  function getUpgradeCost(key) {
    const spec = UPGRADE_SPECS[key];
    const lvl = SaveData.upgrades[key] || 0;
    if (lvl >= spec.max) return null;
    return Math.floor(spec.basePrice * Math.pow(spec.mult, lvl));
  }

  // --- CANVAS & DISPLAY SETUP ---
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const crtOverlay = document.getElementById('crt-overlay');
  if (!SaveData.settings.scanlines) crtOverlay.classList.add('disabled');

  const WIDTH = 800;
  const HEIGHT = 600;

  // Screen Shake
  let shakeTime = 0;
  let shakeIntensity = 0;
  function triggerShake(intensity, duration) {
    shakeIntensity = intensity;
    shakeTime = duration;
  }

  // --- GAME STATES ---
  const STATES = {
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    MARKET: 'MARKET',
    UPGRADES: 'UPGRADES',
    SETTINGS: 'SETTINGS',
    GAMEOVER: 'GAMEOVER'
  };
  let currentState = STATES.MENU;

  // --- INPUT HANDLING ---
  const keys = {};
  const mouse = { x: 0, y: 0, down: false };

  window.addEventListener('keydown', (e) => {
    AudioEngine.init();
    keys[e.key.toLowerCase()] = true;
    keys[e.code] = true;

    if (e.code === 'Space') e.preventDefault();

    if (currentState === STATES.PLAYING) {
      if (e.code === 'Space') Player.triggerDash();
      if (e.key === 'j' || e.key === 'k' || e.key === 'z' || e.key === 'x') Player.triggerAttack();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
    keys[e.code] = false;
  });

  function getCanvasRelativeCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  canvas.addEventListener('mousemove', (e) => {
    const coords = getCanvasRelativeCoords(e);
    mouse.x = coords.x;
    mouse.y = coords.y;
  });

  canvas.addEventListener('mousedown', (e) => {
    AudioEngine.init();
    mouse.down = true;
    handleCanvasClick(mouse.x, mouse.y);
  });

  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });

  // Mobile virtual joystick & buttons
  const joystickBase = document.getElementById('joystick-base');
  const joystickStick = document.getElementById('joystick-stick');
  const btnDash = document.getElementById('btn-dash');
  const btnAttack = document.getElementById('btn-attack');

  let touchMoveX = 0;
  let touchMoveY = 0;
  let joystickTouchId = null;

  joystickBase.addEventListener('touchstart', (e) => {
    AudioEngine.init();
    e.preventDefault();
    const touch = e.changedTouches[0];
    joystickTouchId = touch.identifier;
    updateJoystick(touch);
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (joystickTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId) {
        updateJoystick(e.changedTouches[i]);
        break;
      }
    }
  }, { passive: false });

  const endJoystick = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId) {
        joystickTouchId = null;
        touchMoveX = 0;
        touchMoveY = 0;
        joystickStick.style.transform = 'translate(-50%, -50%)';
        break;
      }
    }
  };
  window.addEventListener('touchend', endJoystick);
  window.addEventListener('touchcancel', endJoystick);

  function updateJoystick(touch) {
    const rect = joystickBase.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const dist = Math.hypot(dx, dy);
    const maxRadius = rect.width / 2;
    const angle = Math.atan2(dy, dx);
    const clampedDist = Math.min(dist, maxRadius);

    touchMoveX = (Math.cos(angle) * (clampedDist / maxRadius));
    touchMoveY = (Math.sin(angle) * (clampedDist / maxRadius));

    const stickX = Math.cos(angle) * clampedDist;
    const stickY = Math.sin(angle) * clampedDist;
    joystickStick.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;
  }

  btnDash.addEventListener('touchstart', (e) => {
    e.preventDefault();
    AudioEngine.init();
    if (currentState === STATES.PLAYING) Player.triggerDash();
  });

  btnAttack.addEventListener('touchstart', (e) => {
    e.preventDefault();
    AudioEngine.init();
    if (currentState === STATES.PLAYING) Player.triggerAttack();
  });

  // --- ENTITIES & SYSTEMS ---

  // Particle System
  let particles = [];
  function spawnDust(x, y, count = 8, color = '#d6b27e') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2.5 + 1;
      particles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.6,
        size: Math.floor(Math.random() * 4) + 3,
        life: 1,
        decay: Math.random() * 0.04 + 0.03,
        color: color
      });
    }
  }

  function spawnCactusChunks(x, y, count = 12) {
    const colors = ['#2e8b57', '#1b4d3e', '#70d68b', '#ffd700'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1.5;
      particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: Math.floor(Math.random() * 5) + 4,
        life: 1,
        decay: 0.025,
        color: colors[Math.floor(Math.random() * colors.length)],
        isChunk: true
      });
    }
  }

  // Floating Damage / Pickup Texts
  let floatingTexts = [];
  function addFloatingText(x, y, text, color = '#ffff55', size = 16) {
    floatingTexts.push({
      x, y, text, color, size, life: 1, vy: -1.2
    });
  }

  // Cactus Parts Drop
  let droppedParts = [];
  function spawnDrops(x, y, amount) {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 45 + 15;
      droppedParts.push({
        x: x,
        y: y,
        targetX: Math.max(40, Math.min(WIDTH - 40, x + Math.cos(angle) * dist)),
        targetY: Math.max(40, Math.min(HEIGHT - 40, y + Math.sin(angle) * dist)),
        progress: 0,
        bobOffset: Math.random() * Math.PI * 2,
        collected: false
      });
    }
  }

  // Spikes (Projectiles)
  let spikes = [];
  function spawnSpike(x, y, vx, vy, speed) {
    spikes.push({
      x, y,
      vx: vx * speed,
      vy: vy * speed,
      size: 10,
      trail: []
    });
  }

  // Player Object
  const Player = {
    x: WIDTH / 2,
    y: HEIGHT * 0.72,
    baseSpeed: 3.4,
    width: 24,
    height: 32,
    facing: 'down',
    walking: false,
    walkFrame: 0,
    walkTimer: 0,
    health: 3,
    maxHealth: 3,
    shield: 0,
    invincibleTimer: 0,

    // Dash
    dashing: false,
    dashTimer: 0,
    dashCooldownTimer: 0,
    dashVx: 0,
    dashVy: 0,
    dashTrail: [],

    // Axe swing
    isAttacking: false,
    attackTimer: 0,
    attackCooldown: 0,

    reset() {
      this.x = WIDTH / 2;
      this.y = HEIGHT * 0.75;
      this.health = this.maxHealth;
      this.shield = SaveData.upgrades.tempShield ? 1 : 0;
      this.dashing = false;
      this.dashTimer = 0;
      this.dashCooldownTimer = 0;
      this.isAttacking = false;
      this.invincibleTimer = 0;
    },

    getSpeed() {
      return this.baseSpeed + (SaveData.upgrades.moveSpeed * 0.45);
    },

    getAxeDelay() {
      return Math.max(0.18, 0.45 - (SaveData.upgrades.axeSpeed * 0.055));
    },

    getAxeDamage() {
      return 15 + (SaveData.upgrades.axeStrength * 8);
    },

    getDashDuration() {
      return 0.16 + (SaveData.upgrades.dashLength * 0.03);
    },

    getDashCooldown() {
      return Math.max(0.65, 1.6 - (SaveData.upgrades.dashCooldown * 0.18));
    },

    triggerDash() {
      if (this.dashCooldownTimer > 0 || this.dashing) return;
      AudioEngine.dash();
      this.dashing = true;
      this.dashTimer = this.getDashDuration();
      this.dashCooldownTimer = this.getDashCooldown();

      // Determine dash direction
      let dx = 0;
      let dy = 0;
      if (keys['w'] || keys['arrowup']) dy -= 1;
      if (keys['s'] || keys['arrowdown']) dy += 1;
      if (keys['a'] || keys['arrowleft']) dx -= 1;
      if (keys['d'] || keys['arrowright']) dx += 1;

      if (touchMoveX !== 0 || touchMoveY !== 0) {
        dx = touchMoveX;
        dy = touchMoveY;
      }

      if (dx === 0 && dy === 0) {
        if (this.facing === 'up') dy = -1;
        else if (this.facing === 'down') dy = 1;
        else if (this.facing === 'left') dx = -1;
        else if (this.facing === 'right') dx = 1;
      }

      const len = Math.hypot(dx, dy) || 1;
      const speed = 10.5;
      this.dashVx = (dx / len) * speed;
      this.dashVy = (dy / len) * speed;

      spawnDust(this.x, this.y + 12, 10, '#ffffff');

      // Shockwave upgrade destroys nearby spikes immediately upon dash
      if (SaveData.upgrades.shockwaveDash) {
        spikes = spikes.filter(spk => {
          const d = Math.hypot(spk.x - this.x, spk.y - this.y);
          if (d < 95) {
            spawnDust(spk.x, spk.y, 6, '#ffd700');
            return false;
          }
          return true;
        });
      }
    },

    triggerAttack() {
      if (this.attackCooldown > 0 || this.dashing) return;
      AudioEngine.swing();
      this.isAttacking = true;
      this.attackTimer = 0.18;
      this.attackCooldown = this.getAxeDelay();

      // Check hit on Cactus
      if (Cactus.state === 'READY' && Cactus.yHeight === 0) {
        const hitRange = 68;
        const dist = Math.hypot(this.x - Cactus.x, this.y - Cactus.y);
        if (dist <= hitRange) {
          let dmg = this.getAxeDamage();
          // Quick chop chance for double damage
          if (SaveData.upgrades.quickChop && Math.random() < SaveData.upgrades.quickChop * 0.25) {
            dmg *= 2;
            addFloatingText(Cactus.x, Cactus.y - 45, 'CRIT!', '#ff3366', 20);
          }
          Cactus.hit(dmg);
        }
      }
    },

    takeDamage(amount = 1) {
      if (this.invincibleTimer > 0 || this.dashing) return;

      if (this.shield > 0) {
        this.shield--;
        AudioEngine.playTone(600, 'square', 0.2, 1200, 0.2);
        addFloatingText(this.x, this.y - 30, 'SHIELD BROKE!', '#00e1ff', 16);
        this.invincibleTimer = 0.7;
        return;
      }

      this.health -= amount;
      this.invincibleTimer = 1.0 + (SaveData.upgrades.spikeImmunity ? 0.6 : 0);
      AudioEngine.playerHurt();
      triggerShake(7, 0.35);
      spawnDust(this.x, this.y, 10, '#ff3344');
      addFloatingText(this.x, this.y - 30, '-1 HP', '#ff2222', 20);

      if (this.health <= 0) {
        currentState = STATES.GAMEOVER;
        saveGameData();
      }
    },

    update(dt) {
      // Cooldown timers
      if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;
      if (this.attackCooldown > 0) this.attackCooldown -= dt;
      if (this.attackTimer > 0) {
        this.attackTimer -= dt;
        if (this.attackTimer <= 0) this.isAttacking = false;
      }
      if (this.invincibleTimer > 0) this.invincibleTimer -= dt;

      // Dash execution
      if (this.dashing) {
        this.dashTimer -= dt;
        this.x += this.dashVx;
        this.y += this.dashVy;

        // Trail
        if (Math.random() < 0.6) {
          this.dashTrail.push({ x: this.x, y: this.y, life: 0.25, facing: this.facing });
        }

        if (this.dashTimer <= 0) {
          this.dashing = false;
        }
      } else {
        // Normal movement
        let moveX = 0;
        let moveY = 0;
        if (keys['w'] || keys['arrowup']) moveY -= 1;
        if (keys['s'] || keys['arrowdown']) moveY += 1;
        if (keys['a'] || keys['arrowleft']) moveX -= 1;
        if (keys['d'] || keys['arrowright']) moveX += 1;

        if (touchMoveX !== 0 || touchMoveY !== 0) {
          moveX = touchMoveX;
          moveY = touchMoveY;
        }

        if (moveX !== 0 || moveY !== 0) {
          this.walking = true;
          const mag = Math.hypot(moveX, moveY) || 1;
          const spd = this.getSpeed();
          this.x += (moveX / mag) * spd;
          this.y += (moveY / mag) * spd;

          // Orientation
          if (Math.abs(moveX) > Math.abs(moveY)) {
            this.facing = moveX > 0 ? 'right' : 'left';
          } else {
            this.facing = moveY > 0 ? 'down' : 'up';
          }

          // Walk animation timer
          this.walkTimer += dt;
          if (this.walkTimer > 0.13) {
            this.walkTimer = 0;
            this.walkFrame = (this.walkFrame + 1) % 4;
            if (this.walkFrame % 2 === 0) spawnDust(this.x, this.y + 14, 2);
          }
        } else {
          this.walking = false;
          this.walkFrame = 0;
        }
      }

      // Arena bounds clamp
      const pad = 36;
      this.x = Math.max(pad, Math.min(WIDTH - pad, this.x));
      this.y = Math.max(pad + 40, Math.min(HEIGHT - pad, this.y));

      // Update Dash Trails
      for (let i = this.dashTrail.length - 1; i >= 0; i--) {
        this.dashTrail[i].life -= dt;
        if (this.dashTrail[i].life <= 0) this.dashTrail.splice(i, 1);
      }
    },

    draw(ctx) {
      // Dash Trails
      this.dashTrail.forEach(t => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, t.life / 0.25) * 0.45;
        drawPixelPlayer(ctx, t.x, t.y, t.facing, 0, false, false, '#4fa0ff');
        ctx.restore();
      });

      // Invincibility flicker
      if (this.invincibleTimer > 0 && Math.floor(Date.now() / 60) % 2 === 0) {
        return;
      }

      // Player Shadow
      ctx.fillStyle = 'rgba(10, 10, 20, 0.45)';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 14, 13, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shield Aura
      if (this.shield > 0) {
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 20 + Math.sin(Date.now() * 0.008) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Sprite
      drawPixelPlayer(ctx, this.x, this.y, this.facing, this.walkFrame, this.isAttacking, this.dashing);
    }
  };

  // --- PIXEL DRAWING UTILITIES ---

  function drawPixelPlayer(ctx, x, y, facing, frame, attacking, dashing, tint = null) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));

    const pCol = tint || '#ffc83b';      // Hat / hair
    const sCol = tint || '#2874a6';      // Shirt / overalls
    const skin = tint || '#ffccaa';      // Skin
    const bCol = tint || '#4a235a';      // Boots

    // Head / Face
    ctx.fillStyle = pCol;
    ctx.fillRect(-8, -16, 16, 8); // Hat
    ctx.fillStyle = skin;
    ctx.fillRect(-7, -8, 14, 8);  // Face

    // Eyes
    ctx.fillStyle = '#111';
    if (facing === 'down') {
      ctx.fillRect(-4, -6, 2, 2);
      ctx.fillRect(2, -6, 2, 2);
    } else if (facing === 'up') {
      // Back of head (all hair)
      ctx.fillStyle = pCol;
      ctx.fillRect(-7, -8, 14, 8);
    } else if (facing === 'left') {
      ctx.fillRect(-5, -6, 2, 2);
    } else if (facing === 'right') {
      ctx.fillRect(3, -6, 2, 2);
    }

    // Body / Overalls
    ctx.fillStyle = sCol;
    ctx.fillRect(-6, 0, 12, 10);

    // Legs / Boots with walk bob
    const legOffset = (frame === 1 ? -3 : frame === 3 ? 3 : 0);
    ctx.fillStyle = bCol;
    ctx.fillRect(-6, 10 + legOffset, 5, 5);
    ctx.fillRect(1, 10 - legOffset, 5, 5);

    // Visible Axe / Swinging
    ctx.fillStyle = '#8b5a2b'; // Wood handle
    const steel = '#d0d7de';
    const sharp = '#ffffff';

    if (attacking) {
      ctx.save();
      const swingAngle = Math.sin((0.18 - Player.attackTimer) / 0.18 * Math.PI) * 1.5;
      let axeX = (facing === 'left' ? -14 : 14);
      let axeY = 2;
      ctx.translate(axeX, axeY);
      ctx.rotate(facing === 'left' ? -swingAngle : swingAngle);

      // Handle
      ctx.fillRect(-2, -18, 4, 22);
      // Blade
      ctx.fillStyle = steel;
      ctx.fillRect(-8, -20, 14, 7);
      ctx.fillStyle = sharp;
      ctx.fillRect(-8, -20, 3, 7);
      ctx.restore();
    } else {
      // Stowed axe on side
      const side = (facing === 'left' ? -1 : 1);
      ctx.fillRect(side * 8, -4, 3, 14);
      ctx.fillStyle = steel;
      ctx.fillRect(side * 8 - 2, -7, 7, 5);
    }

    ctx.restore();
  }

  // --- CACTUS BOSS & EVENT SYSTEM ---
  const Cactus = {
    x: WIDTH / 2,
    y: HEIGHT * 0.38,
    maxHp: 100,
    hp: 100,
    width: 64,
    height: 84,
    scale: 1,
    yHeight: 0,       // Distance from ground for falling animation
    fallSpeed: 0,
    state: 'INACTIVE', // WARNING, FALLING, IMPACT, READY, DESTROYED
    timer: 0,
    warningDuration: 3.2,
    plopTimer: 0,
    shakeTimer: 0,

    initRound(round) {
      this.maxHp = Math.round(90 + (round * 45) + Math.pow(round, 1.4) * 8);
      this.hp = this.maxHp;
      this.state = 'WARNING';
      this.timer = this.warningDuration;
      this.yHeight = 450;
      this.fallSpeed = 0;
      this.scale = 2.4;
      this.x = WIDTH / 2;
      this.y = HEIGHT * 0.38;
      spikes = [];
      droppedParts = [];
    },

    hit(dmg) {
      if (this.state !== 'READY') return;
      this.hp -= dmg;
      this.shakeTimer = 0.18;
      AudioEngine.chopHit();
      spawnCactusChunks(this.x, this.y, 8);
      addFloatingText(this.x + (Math.random() - 0.5) * 40, this.y - 30, `-${dmg}`, '#fffa40', 18);
      triggerShake(4, 0.15);

      if (this.hp <= 0) {
        this.hp = 0;
        this.destroy();
      }
    },

    destroy() {
      this.state = 'DESTROYED';
      AudioEngine.cactusExplode();
      triggerShake(12, 0.6);
      spawnCactusChunks(this.x, this.y, 35);
      spawnDust(this.x, this.y, 25, '#70d68b');

      // Drop Parts
      const baseDrops = 5 + Math.floor(SaveData.round * 2.2);
      const bonusDrops = SaveData.upgrades.harvestYield * 2;
      const totalDrops = baseDrops + bonusDrops;
      spawnDrops(this.x, this.y, totalDrops);

      addFloatingText(this.x, this.y - 60, 'HARVEST COMPLETE!', '#33ff66', 22);

      // Advance round in save
      SaveData.round++;
      saveGameData();
    },

    fireSpikes(count, speed) {
      AudioEngine.spikeShot();
      triggerShake(6, 0.25);
      const angleStep = (Math.PI * 2) / count;
      const baseAngle = Math.random() * Math.PI;

      for (let i = 0; i < count; i++) {
        const ang = baseAngle + i * angleStep;
        const vx = Math.cos(ang);
        const vy = Math.sin(ang);
        spawnSpike(this.x, this.y + 10, vx, vy, speed);
      }
    },

    update(dt) {
      if (this.shakeTimer > 0) this.shakeTimer -= dt;

      if (this.state === 'WARNING') {
        this.timer -= dt;
        if (Math.floor(this.timer * 4) % 2 === 0) {
          if (this.timer < 1.2 && Math.random() < 0.15) AudioEngine.warning();
        }

        if (this.timer <= 0) {
          this.state = 'FALLING';
          this.fallSpeed = 8;
          AudioEngine.fall();
        }
      } else if (this.state === 'FALLING') {
        this.fallSpeed += 32 * dt;
        this.yHeight -= this.fallSpeed;
        this.scale = 1 + (this.yHeight / 450) * 1.6;

        if (this.yHeight <= 0) {
          this.yHeight = 0;
          this.scale = 1;
          this.state = 'IMPACT';
          this.plopTimer = 1.0;
          AudioEngine.plop();
          triggerShake(16, 0.5);
          spawnDust(this.x, this.y + 24, 30, '#e5be82');
          spawnCactusChunks(this.x, this.y + 10, 15);

          // Shoot outward Spikes!
          const spikeCount = 8 + Math.min(18, SaveData.round * 2);
          const spikeSpeed = 3.6 + Math.min(3.2, SaveData.round * 0.25);
          this.fireSpikes(spikeCount, spikeSpeed);
        }
      } else if (this.state === 'IMPACT') {
        this.plopTimer -= dt;
        if (this.plopTimer <= 0) {
          this.state = 'READY';
        }
      }
    },

    draw(ctx) {
      if (this.state === 'INACTIVE') return;

      // Draw Ground Shadow
      const shadowScale = Math.max(0.3, 1 - (this.yHeight / 450) * 0.7);
      ctx.fillStyle = 'rgba(10, 10, 15, 0.55)';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 24, 38 * shadowScale, 18 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // WARNING RETICLE ON GROUND
      if (this.state === 'WARNING') {
        const pulse = Math.sin(Date.now() * 0.015);
        ctx.save();
        ctx.strokeStyle = (Math.floor(Date.now() / 120) % 2 === 0) ? '#ff2244' : '#ffaa00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 48 + pulse * 6, 0, Math.PI * 2);
        ctx.stroke();

        // Crosshairs
        ctx.beginPath();
        ctx.moveTo(this.x - 60, this.y); ctx.lineTo(this.x + 60, this.y);
        ctx.moveTo(this.x, this.y - 60); ctx.lineTo(this.x, this.y + 60);
        ctx.stroke();

        // Warning Text
        ctx.fillStyle = '#ff2244';
        ctx.font = 'bold 18px Courier New';
        ctx.textAlign = 'center';
        let warnText = "INCOMING CACTUS";
        if (this.timer > 2.0) warnText = "WARNING!";
        else if (this.timer < 0.9) warnText = "GET READY!";
        ctx.fillText(warnText, this.x, this.y - 75);
        ctx.restore();
      }

      // DRAW CACTUS SPRITE
      if (this.state !== 'DESTROYED') {
        ctx.save();
        let drawX = this.x;
        let drawY = this.y - this.yHeight;

        if (this.shakeTimer > 0) {
          drawX += (Math.random() - 0.5) * 8;
          drawY += (Math.random() - 0.5) * 8;
        }

        ctx.translate(Math.round(drawX), Math.round(drawY));
        ctx.scale(this.scale, this.scale);
        drawPixelCactus(ctx);
        ctx.restore();

        // PLOP! Comic Impact Graphic
        if (this.state === 'IMPACT' && this.plopTimer > 0.3) {
          ctx.save();
          ctx.translate(this.x, this.y - 60);
          ctx.fillStyle = '#ffd700';
          ctx.strokeStyle = '#d63031';
          ctx.lineWidth = 5;
          ctx.font = '900 36px Courier New, sans-serif';
          ctx.textAlign = 'center';
          ctx.strokeText("PLOP!", 0, 0);
          ctx.fillText("PLOP!", 0, 0);
          ctx.restore();
        }

        // Cactus Health Bar (When in Combat)
        if (this.state === 'READY') {
          const barW = 100;
          const barH = 10;
          const barX = this.x - barW / 2;
          const barY = this.y - 75;

          ctx.fillStyle = '#0a0a14';
          ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);

          const hpPct = Math.max(0, this.hp / this.maxHp);
          ctx.fillStyle = hpPct > 0.4 ? '#2ed573' : '#ff4757';
          ctx.fillRect(barX, barY, Math.round(barW * hpPct), barH);

          // Health text
          ctx.fillStyle = '#ffffff';
          ctx.font = '10px Courier New';
          ctx.textAlign = 'center';
          ctx.fillText(`${Math.round(this.hp)} / ${this.maxHp}`, this.x, barY - 4);
        }
      }
    }
  };

  function drawPixelCactus(ctx) {
    const mainCol = '#2d8a4e';
    const darkCol = '#1b5e34';
    const lightCol = '#4cd175';
    const spineCol = '#f1f2f6';
    const flowerCol = '#ff4757';

    // Main Trunk
    ctx.fillStyle = mainCol;
    ctx.fillRect(-18, -48, 36, 70);
    // Dark shading on left
    ctx.fillStyle = darkCol;
    ctx.fillRect(-18, -48, 8, 70);
    // Highlight ridge
    ctx.fillStyle = lightCol;
    ctx.fillRect(6, -46, 5, 68);

    // Left Arm
    ctx.fillStyle = mainCol;
    ctx.fillRect(-38, -26, 22, 14);
    ctx.fillRect(-38, -44, 14, 24);
    ctx.fillStyle = darkCol;
    ctx.fillRect(-38, -44, 4, 24);

    // Right Arm
    ctx.fillStyle = mainCol;
    ctx.fillRect(16, -16, 22, 14);
    ctx.fillRect(24, -36, 14, 26);
    ctx.fillStyle = lightCol;
    ctx.fillRect(32, -36, 4, 24);

    // Spines / Needles
    ctx.fillStyle = spineCol;
    const spinesCoords = [
      [-22, -38], [-22, -18], [-22, 4],
      [18, -40], [18, -20], [18, 6],
      [-42, -34], [40, -26], [0, -52]
    ];
    spinesCoords.forEach(([sx, sy]) => {
      ctx.fillRect(sx, sy, 4, 2);
    });

    // Top Pink Cactus Blossom
    ctx.fillStyle = flowerCol;
    ctx.fillRect(-8, -56, 16, 8);
    ctx.fillStyle = '#ffa502';
    ctx.fillRect(-4, -53, 8, 4);
  }

  // --- UPDATE & RENDER LOOP ---
  let lastTime = performance.now();

  function gameLoop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    update(dt);
    render();

    requestAnimationFrame(gameLoop);
  }

  function update(dt) {
    // Screen Shake decay
    if (shakeTime > 0) {
      shakeTime -= dt;
    }

    if (currentState === STATES.PLAYING) {
      Player.update(dt);
      Cactus.update(dt);

      // Magnet upgrade: pull dropped cactus parts
      const magnetStrength = SaveData.upgrades.magnetPickup;
      const magnetRadius = 80 + magnetStrength * 50;

      // Update Dropped Parts
      for (let i = droppedParts.length - 1; i >= 0; i--) {
        const drop = droppedParts[i];
        if (drop.progress < 1) {
          drop.progress += dt * 3.5;
          drop.x += (drop.targetX - drop.x) * 0.15;
          drop.y += (drop.targetY - drop.y) * 0.15;
        }

        // Magnet attraction
        if (magnetStrength > 0) {
          const mDist = Math.hypot(Player.x - drop.x, Player.y - drop.y);
          if (mDist < magnetRadius) {
            drop.x += (Player.x - drop.x) * 0.08 * magnetStrength;
            drop.y += (Player.y - drop.y) * 0.08 * magnetStrength;
          }
        }

        // Player collection collision
        const dist = Math.hypot(Player.x - drop.x, Player.y - drop.y);
        if (dist < 26) {
          AudioEngine.collect();
          SaveData.cactusParts++;
          saveGameData();
          addFloatingText(drop.x, drop.y - 10, '+1 PART', '#55ff77', 14);
          spawnDust(drop.x, drop.y, 6, '#4cd175');
          droppedParts.splice(i, 1);
        }
      }

      // Update Spikes
      for (let i = spikes.length - 1; i >= 0; i--) {
        const spk = spikes[i];
        spk.x += spk.vx;
        spk.y += spk.vy;

        // Trail
        if (Math.random() < 0.4) {
          spk.trail.push({ x: spk.x, y: spk.y, life: 0.18 });
        }
        for (let t = spk.trail.length - 1; t >= 0; t--) {
          spk.trail[t].life -= dt;
          if (spk.trail[t].life <= 0) spk.trail.splice(t, 1);
        }

        // Check collision with Player
        const pDist = Math.hypot(Player.x - spk.x, Player.y - spk.y);
        if (pDist < 18) {
          Player.takeDamage(1);
          spikes.splice(i, 1);
          continue;
        }

        // Boundary removal
        if (spk.x < -30 || spk.x > WIDTH + 30 || spk.y < -30 || spk.y > HEIGHT + 30) {
          spikes.splice(i, 1);
        }
      }
    }

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Update Floating Texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y += ft.vy;
      ft.life -= dt * 1.3;
      if (ft.life <= 0) floatingTexts.splice(i, 1);
    }
  }

  function render() {
    ctx.save();

    // Apply Screen Shake
    if (shakeTime > 0) {
      const ox = (Math.random() - 0.5) * shakeIntensity * 2;
      const oy = (Math.random() - 0.5) * shakeIntensity * 2;
      ctx.translate(ox, oy);
    }

    // Clear Screen with retro dark backdrop
    ctx.fillStyle = '#0f0e17';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    if (currentState === STATES.MENU) {
      drawMenuScreen();
    } else if (currentState === STATES.PLAYING) {
      drawArena();
      drawGameEntities();
      drawHUD();
    } else if (currentState === STATES.MARKET) {
      drawMarketScreen();
    } else if (currentState === STATES.UPGRADES) {
      drawUpgradesScreen();
    } else if (currentState === STATES.SETTINGS) {
      drawSettingsScreen();
    } else if (currentState === STATES.GAMEOVER) {
      drawGameOverScreen();
    }

    ctx.restore();
  }

  // --- DRAW ARENA & ENTITIES ---
  function drawArena() {
    // Dirt arena with pixel checker pattern
    ctx.fillStyle = '#221929';
    ctx.fillRect(20, 20, WIDTH - 40, HEIGHT - 40);

    ctx.fillStyle = '#2a1f33';
    const tileSize = 32;
    for (let x = 20; x < WIDTH - 20; x += tileSize) {
      for (let y = 20; y < HEIGHT - 20; y += tileSize) {
        if ((Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0) {
          ctx.fillRect(x, y, tileSize, tileSize);
        }
      }
    }

    // Arena border stones
    ctx.strokeStyle = '#433454';
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, WIDTH - 40, HEIGHT - 40);

    ctx.strokeStyle = '#ff9f43';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, WIDTH - 32, HEIGHT - 32);
  }

  function drawGameEntities() {
    // Dropped parts
    droppedParts.forEach(drop => {
      const bob = Math.sin(Date.now() * 0.006 + drop.bobOffset) * 4;
      ctx.fillStyle = '#2ed573';
      ctx.fillRect(drop.x - 6, drop.y - 6 + bob, 12, 12);
      ctx.fillStyle = '#ffa502';
      ctx.fillRect(drop.x - 2, drop.y - 2 + bob, 4, 4);
    });

    // Spikes
    spikes.forEach(spk => {
      // Trails
      spk.trail.forEach(t => {
        ctx.fillStyle = 'rgba(255, 165, 2, 0.4)';
        ctx.fillRect(t.x - 3, t.y - 3, 6, 6);
      });

      // Sharp Diamond Spike
      ctx.save();
      ctx.translate(spk.x, spk.y);
      const angle = Math.atan2(spk.vy, spk.vx);
      ctx.rotate(angle);
      ctx.fillStyle = '#ffd32a';
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-6, -4);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-6, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // Cactus
    Cactus.draw(ctx);

    // Player
    Player.draw(ctx);

    // Particles
    particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });

    // Floating text
    floatingTexts.forEach(ft => {
      ctx.fillStyle = ft.color;
      ctx.font = `bold ${ft.size}px Courier New`;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
    });

    // Round clear prompt
    if (Cactus.state === 'DESTROYED' && droppedParts.length === 0) {
      drawPixelButton(WIDTH / 2 - 110, HEIGHT - 90, 220, 48, 'NEXT ROUND [SPACE]', '#2ed573', '#1e824c');
    }
  }

  // --- HUD ---
  function drawHUD() {
    // Top Bar Background
    ctx.fillStyle = 'rgba(15, 12, 25, 0.85)';
    ctx.fillRect(0, 0, WIDTH, 54);
    ctx.strokeStyle = '#3e3455';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 52, WIDTH, 2);

    ctx.font = 'bold 15px Courier New';
    ctx.textAlign = 'left';

    // Health Hearts
    let hearts = '';
    for (let i = 0; i < Player.maxHealth; i++) {
      hearts += (i < Player.health ? '❤️' : '🖤');
    }
    ctx.fillStyle = '#ff4757';
    ctx.fillText(hearts, 24, 33);

    // Money & Cactus Parts
    ctx.fillStyle = '#ffd32a';
    ctx.fillText(`💰 $${SaveData.money}`, 145, 33);

    ctx.fillStyle = '#2ed573';
    ctx.fillText(`🌵 Parts: ${SaveData.cactusParts}`, 280, 33);

    ctx.fillStyle = '#a55eea';
    ctx.fillText(`🏆 Round ${SaveData.round}`, 450, 33);

    // Dash Cooldown Meter
    const cdPct = Math.max(0, Player.dashCooldownTimer / Player.getDashCooldown());
    const meterX = 590;
    const meterY = 20;
    const meterW = 85;
    const meterH = 16;
    ctx.fillStyle = '#1e272e';
    ctx.fillRect(meterX, meterY, meterW, meterH);
    ctx.fillStyle = cdPct === 0 ? '#00d2d3' : '#576574';
    ctx.fillRect(meterX, meterY, Math.round(meterW * (1 - cdPct)), meterH);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(meterX, meterY, meterW, meterH);
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Courier New';
    ctx.fillText('DASH', meterX + 26, meterY + 12);

    // Market Shortcut button
    drawPixelButton(700, 12, 85, 32, 'SHOP', '#f39c12', '#b9770e', 12);
  }

  // --- UI BUTTON HELPER ---
  const activeButtons = [];
  function drawPixelButton(x, y, w, h, text, bg = '#3498db', shadow = '#21618c', fontSize = 16, tag = '') {
    // Drop shadow
    ctx.fillStyle = shadow;
    ctx.fillRect(x, y + 4, w, h);
    // Button body
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);

    // Pixel highlight & border
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(x, y + h - 3, w, 3);

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSize}px Courier New`;
    ctx.textAlign = 'center';
    ctx.fillText(text, x + w / 2, y + h / 2 + 5);

    activeButtons.push({ x, y, w, h, tag: tag || text });
  }

  // --- SCREENS ---

  function drawMenuScreen() {
    activeButtons.length = 0;

    // Animated Parallax Background
    const time = Date.now() * 0.001;
    ctx.fillStyle = '#18122B';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Pixel stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {
      const sx = (i * 97) % WIDTH;
      const sy = (i * 53 + (time * 12)) % (HEIGHT * 0.6);
      ctx.fillRect(sx, sy, 2, 2);
    }

    // Title
    ctx.fillStyle = '#2ed573';
    ctx.strokeStyle = '#051b11';
    ctx.lineWidth = 8;
    ctx.font = '900 48px Courier New';
    ctx.textAlign = 'center';
    ctx.strokeText('PIXEL CACTUS CLASH', WIDTH / 2, 140);
    ctx.fillText('PIXEL CACTUS CLASH', WIDTH / 2, 140);

    ctx.fillStyle = '#ff9f43';
    ctx.font = 'bold 16px Courier New';
    ctx.fillText('RETRO ARCADE CHOPPER', WIDTH / 2, 175);

    // Money Display
    ctx.fillStyle = '#ffd32a';
    ctx.font = 'bold 18px Courier New';
    ctx.fillText(`💰 BANK: $${SaveData.money}   |   🌵 PARTS: ${SaveData.cactusParts}`, WIDTH / 2, 220);

    // Menu Buttons
    const btnW = 240;
    const btnH = 50;
    const startY = 260;
    drawPixelButton(WIDTH / 2 - btnW / 2, startY, btnW, btnH, 'PLAY', '#2ed573', '#1e824c', 20, 'PLAY');
    drawPixelButton(WIDTH / 2 - btnW / 2, startY + 68, btnW, btnH, 'UPGRADES', '#3742fa', '#1e2499', 18, 'UPGRADES');
    drawPixelButton(WIDTH / 2 - btnW / 2, startY + 136, btnW, btnH, 'MARKET', '#ffa502', '#b37402', 18, 'MARKET');
    drawPixelButton(WIDTH / 2 - btnW / 2, startY + 204, btnW, btnH, 'SETTINGS', '#747d8c', '#474d56', 16, 'SETTINGS');
  }

  function drawMarketScreen() {
    activeButtons.length = 0;
    drawPanel('CACTUS MARKET');

    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(`You currently hold: ${SaveData.cactusParts} Cactus Parts`, WIDTH / 2, 180);

    const baseVal = 10;
    const partValue = baseVal + (SaveData.upgrades.partValue * 4);
    ctx.fillStyle = '#2ed573';
    ctx.fillText(`Market Rate: $${partValue} gold per part`, WIDTH / 2, 215);

    // Sell 1 Button
    drawPixelButton(WIDTH / 2 - 190, 260, 180, 52, `SELL 1 (+$${partValue})`, '#2ed573', '#1e824c', 14, 'SELL_1');
    // Sell All Button
    const totalVal = SaveData.cactusParts * partValue;
    drawPixelButton(WIDTH / 2 + 10, 260, 180, 52, `SELL ALL (+$${totalVal})`, '#ffa502', '#b37402', 14, 'SELL_ALL');

    ctx.fillStyle = '#ffd32a';
    ctx.font = 'bold 20px Courier New';
    ctx.fillText(`Current Gold: $${SaveData.money}`, WIDTH / 2, 360);

    drawPixelButton(WIDTH / 2 - 100, 440, 200, 48, 'BACK TO MENU', '#57606f', '#2f3542', 16, 'MENU');
  }

  function drawUpgradesScreen() {
    activeButtons.length = 0;
    drawPanel('ARCADE WORKSHOP & UPGRADES');

    ctx.fillStyle = '#ffd32a';
    ctx.font = 'bold 16px Courier New';
    ctx.textAlign = 'right';
    ctx.fillText(`GOLD: $${SaveData.money}`, WIDTH - 70, 115);

    // List of upgrades
    const keysList = Object.keys(UPGRADE_SPECS);
    let startY = 140;
    keysList.slice(0, 6).forEach((key, idx) => {
      const spec = UPGRADE_SPECS[key];
      const lvl = SaveData.upgrades[key] || 0;
      const cost = getUpgradeCost(key);
      const rowY = startY + (idx * 52);

      // Icon & Name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px Courier New';
      ctx.textAlign = 'left';
      ctx.fillText(`${spec.icon} ${spec.name} (Lv. ${lvl}/${spec.max})`, 70, rowY + 22);

      ctx.fillStyle = '#a4b0be';
      ctx.font = '12px Courier New';
      ctx.fillText(spec.desc, 70, rowY + 38);

      // Upgrade Button
      if (lvl >= spec.max) {
        drawPixelButton(WIDTH - 190, rowY + 8, 120, 34, 'MAXED', '#57606f', '#2f3542', 12, 'MAX');
      } else {
        const canAfford = SaveData.money >= cost;
        drawPixelButton(
          WIDTH - 190, rowY + 8, 120, 34,
          `$${cost} BUY`,
          canAfford ? '#2ed573' : '#747d8c',
          canAfford ? '#1e824c' : '#474d56',
          13,
          `UPG_${key}`
        );
      }
    });

    drawPixelButton(WIDTH / 2 - 100, 490, 200, 44, 'BACK TO MENU', '#57606f', '#2f3542', 16, 'MENU');
  }

  function drawSettingsScreen() {
    activeButtons.length = 0;
    drawPanel('ARCADE SETTINGS');

    const soundText = AudioEngine.muted ? 'SOUND: OFF' : 'SOUND: ON';
    drawPixelButton(WIDTH / 2 - 130, 200, 260, 50, soundText, '#3742fa', '#1e2499', 16, 'TOGGLE_SOUND');

    const crtText = SaveData.settings.scanlines ? 'CRT SCANLINES: ON' : 'CRT SCANLINES: OFF';
    drawPixelButton(WIDTH / 2 - 130, 275, 260, 50, crtText, '#2ed573', '#1e824c', 16, 'TOGGLE_CRT');

    drawPixelButton(WIDTH / 2 - 100, 420, 200, 48, 'BACK TO MENU', '#57606f', '#2f3542', 16, 'MENU');
  }

  function drawGameOverScreen() {
    activeButtons.length = 0;

    ctx.fillStyle = 'rgba(10, 5, 15, 0.9)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = '#ff4757';
    ctx.font = '900 48px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', WIDTH / 2, 170);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Courier New';
    ctx.fillText(`Round Reached: ${SaveData.round}`, WIDTH / 2, 235);
    ctx.fillText(`Total Parts Collected: ${SaveData.cactusParts}`, WIDTH / 2, 270);
    ctx.fillText(`Current Gold: $${SaveData.money}`, WIDTH / 2, 305);

    drawPixelButton(WIDTH / 2 - 180, 370, 160, 50, 'RESTART', '#2ed573', '#1e824c', 18, 'PLAY');
    drawPixelButton(WIDTH / 2 + 20, 370, 160, 50, 'HOME', '#57606f', '#2f3542', 18, 'MENU');
  }

  function drawPanel(title) {
    ctx.fillStyle = '#1e162a';
    ctx.fillRect(40, 40, WIDTH - 80, HEIGHT - 80);
    ctx.strokeStyle = '#513d69';
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 40, WIDTH - 80, HEIGHT - 80);

    ctx.fillStyle = '#ffd32a';
    ctx.font = '900 26px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(title, WIDTH / 2, 95);
  }

  // --- BUTTON CLICKS & ROUTING ---
  function handleCanvasClick(cx, cy) {
    for (let btn of activeButtons) {
      if (cx >= btn.x && cx <= btn.x + btn.w && cy >= btn.y && cy <= btn.y + btn.h) {
        AudioEngine.init();
        AudioEngine.playTone(450, 'square', 0.08, null, 0.1);

        if (btn.tag === 'PLAY') {
          Player.reset();
          Cactus.initRound(SaveData.round);
          currentState = STATES.PLAYING;
        } else if (btn.tag === 'MENU') {
          currentState = STATES.MENU;
        } else if (btn.tag === 'UPGRADES') {
          currentState = STATES.UPGRADES;
        } else if (btn.tag === 'MARKET' || btn.tag === 'SHOP') {
          currentState = STATES.MARKET;
        } else if (btn.tag === 'SETTINGS') {
          currentState = STATES.SETTINGS;
        } else if (btn.tag === 'SELL_1') {
          if (SaveData.cactusParts > 0) {
            SaveData.cactusParts--;
            const val = 10 + (SaveData.upgrades.partValue * 4);
            SaveData.money += val;
            AudioEngine.collect();
            saveGameData();
          }
        } else if (btn.tag === 'SELL_ALL') {
          if (SaveData.cactusParts > 0) {
            const val = 10 + (SaveData.upgrades.partValue * 4);
            SaveData.money += SaveData.cactusParts * val;
            SaveData.cactusParts = 0;
            AudioEngine.buy();
            saveGameData();
          }
        } else if (btn.tag.startsWith('UPG_')) {
          const key = btn.tag.replace('UPG_', '');
          const cost = getUpgradeCost(key);
          if (cost !== null && SaveData.money >= cost) {
            SaveData.money -= cost;
            SaveData.upgrades[key] = (SaveData.upgrades[key] || 0) + 1;
            AudioEngine.buy();
            saveGameData();
          }
        } else if (btn.tag === 'TOGGLE_SOUND') {
          AudioEngine.muted = !AudioEngine.muted;
          SaveData.settings.sound = !AudioEngine.muted;
          saveGameData();
        } else if (btn.tag === 'TOGGLE_CRT') {
          SaveData.settings.scanlines = !SaveData.settings.scanlines;
          crtOverlay.classList.toggle('disabled', !SaveData.settings.scanlines);
          saveGameData();
        } else if (btn.tag.includes('NEXT ROUND')) {
          Cactus.initRound(SaveData.round);
        }
        return;
      }
    }

    // In-game attack on click
    if (currentState === STATES.PLAYING) {
      Player.triggerAttack();
    }
  }

  // Kickoff game loop
  requestAnimationFrame(gameLoop);

})();

