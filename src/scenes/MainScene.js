import Phaser from 'phaser';

export default class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
        this.gameState = 'START'; // 'START', 'PLAYING', 'GAMEOVER'
    }

    init() {
        this.score = 0;
        this.combo = 0;
        this.currentWidth = 220;
        this.placedBlocks = [];
        this.movingBlock = null;
        this.movingDirection = 1;
        this.cameraTargetScrollY = 0;
        this.highScore = parseInt(localStorage.getItem('skystack_highscore') || '0', 10);
        this.audioCtx = null;
    }

    create() {
        this.gameWidth = 450;
        this.gameHeight = 800;

        // Create elegant dark gradient background
        this.createBackground();

        // Setup input bindings
        this.input.keyboard.on('keydown-SPACE', () => this.handleAction());
        this.input.on('pointerdown', (pointer) => {
            // Prevent duplicate clicks if the user clicked the restart button in Game Over state
            if (this.gameState === 'GAMEOVER' && this.restartBtn) {
                const bounds = this.restartBtn.getBounds();
                if (bounds.contains(pointer.x, pointer.y)) {
                    return;
                }
            }
            this.handleAction();
        });

        // Initialize UI text overlays
        this.setupUI();

        // Initialize and show start screen
        this.showStartScreen();
    }

    createBackground() {
        const bg = this.add.graphics();
        // Modern minimal dark purple-tinted gradient
        bg.fillGradientStyle(0x15151e, 0x15151e, 0x0b0b0f, 0x0b0b0f, 1);
        bg.fillRect(0, 0, 450, 800);
        bg.setScrollFactor(0);
    }

    setupUI() {
        // Large background score indicator
        this.scoreText = this.add.text(225, 200, '0', {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '150px',
            fontWeight: '900',
            color: 'rgba(255, 255, 255, 0.08)'
        }).setOrigin(0.5).setScrollFactor(0);
        this.scoreText.setVisible(false);

        // Title text for start screen
        this.titleText = this.add.text(225, 300, 'SKYSTACK', {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '48px',
            fontWeight: '900',
            color: '#ffffff',
            letterSpacing: '4px'
        }).setOrigin(0.5).setScrollFactor(0);

        // Subtitle instructions
        this.subtitleText = this.add.text(225, 370, 'TAP OR SPACE TO START', {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '14px',
            fontWeight: 'bold',
            color: 'rgba(255, 255, 255, 0.5)'
        }).setOrigin(0.5).setScrollFactor(0);

        // Gentle pulse animation on instructions
        this.tweens.add({
            targets: this.subtitleText,
            alpha: 0.3,
            duration: 800,
            yoyo: true,
            loop: -1,
            ease: 'Sine.easeInOut'
        });
    }

    showStartScreen() {
        this.gameState = 'START';
        this.titleText.setVisible(true);
        this.subtitleText.setVisible(true);
        this.scoreText.setVisible(false);

        // Reset camera
        this.cameras.main.scrollY = 0;
        this.cameraTargetScrollY = 0;

        // Add visual base block at the bottom
        this.currentWidth = 220;
        const color = this.getRandomPastelColor(0);
        this.addPlacedBlock(225, 680, this.currentWidth, color);
    }

    handleAction() {
        if (this.gameState === 'START') {
            this.startGame();
        } else if (this.gameState === 'PLAYING') {
            this.placeBlock();
        }
    }

    startGame() {
        this.gameState = 'PLAYING';
        this.titleText.setVisible(false);
        this.subtitleText.setVisible(false);
        
        // Show and reset score text
        this.scoreText.setVisible(true);
        this.scoreText.setText('0');

        // Clear existing rectangles
        this.placedBlocks.forEach(b => b.rect.destroy());
        this.placedBlocks = [];

        // Reset block dimension and add base block
        this.currentWidth = 220;
        const color = this.getRandomPastelColor(0);
        this.addPlacedBlock(225, 680, this.currentWidth, color);

        // Spawn first moving block
        this.spawnBlock();
    }

    spawnBlock() {
        if (this.gameState !== 'PLAYING') return;

        const y = 680 - (this.placedBlocks.length * 40);
        const color = this.getRandomPastelColor(this.placedBlocks.length);

        // Alternate start left vs right
        const startFromLeft = this.placedBlocks.length % 2 === 0;
        const startX = startFromLeft ? -this.currentWidth / 2 : 450 + this.currentWidth / 2;
        this.movingDirection = startFromLeft ? 1 : -1;

        this.movingBlock = this.add.rectangle(startX, y, this.currentWidth, 40, color);
    }

    placeBlock() {
        if (!this.movingBlock) return;

        const topBlock = this.placedBlocks[this.placedBlocks.length - 1];
        const block = this.movingBlock;
        this.movingBlock = null; // Decouple reference immediately to prevent double input bugs

        const success = this.sliceBlock(block, topBlock);

        if (success) {
            this.score++;
            this.scoreText.setText(this.score.toString());

            // Handle camera follow (shifts view after score exceeds 5 blocks)
            if (this.placedBlocks.length > 5) {
                this.cameraTargetScrollY = (680 - (this.placedBlocks.length - 5) * 40) - 480;
            }

            // Small delay before spawning next block
            this.time.delayedCall(100, () => {
                this.spawnBlock();
            });
        }
    }

    sliceBlock(movingBlock, topBlock) {
        const diff = movingBlock.x - topBlock.x;

        // 1. Perfect Snap Check (offset <= 3.5px)
        if (Math.abs(diff) <= 3.5) {
            this.handlePerfectPlacement(topBlock, movingBlock);
            return true;
        }

        // 2. Complete Miss Check
        if (Math.abs(diff) >= this.currentWidth) {
            this.handleMissedPlacement(movingBlock);
            return false;
        }

        // 3. Normal Sliced Placement
        const newWidth = this.currentWidth - Math.abs(diff);
        const newX = topBlock.x + (diff / 2);

        // Slice Geometry Calculation
        const sliceWidth = Math.abs(diff);
        let sliceX = 0;
        if (diff > 0) {
            sliceX = newX + (newWidth / 2) + (sliceWidth / 2);
        } else {
            sliceX = newX - (newWidth / 2) - (sliceWidth / 2);
        }

        // Create falling physical debris
        this.createFallingSlice(sliceX, movingBlock.y, sliceWidth, movingBlock.fillColor, diff);

        // Update state parameters
        this.currentWidth = newWidth;
        this.combo = 0;

        // Draw placed block
        this.addPlacedBlock(newX, movingBlock.y, newWidth, movingBlock.fillColor);
        
        // Sound beep
        this.playBeep(false);

        movingBlock.destroy();
        return true;
    }

    handlePerfectPlacement(topBlock, movingBlock) {
        const newX = topBlock.x;
        this.combo++;

        this.playBeep(true);
        this.showFloatingText(`PERFECT! x${this.combo}`, newX, movingBlock.y - 20, '#00ffcc');

        // Size recovery mechanic
        if (this.combo > 0 && this.combo % 3 === 0) {
            const prevWidth = this.currentWidth;
            this.currentWidth = Math.min(220, this.currentWidth + 15);
            if (this.currentWidth > prevWidth) {
                this.showFloatingText('WIDTH RECOVERED!', newX, movingBlock.y - 45, '#ff79c6');
            }
        }

        // Spawn permanent stacked block
        const placed = this.addPlacedBlock(newX, movingBlock.y, this.currentWidth, movingBlock.fillColor);

        // Flash highlight feedback
        const flash = this.add.rectangle(newX, movingBlock.y, this.currentWidth, 40, 0xffffff);
        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 200,
            onComplete: () => flash.destroy()
        });

        movingBlock.destroy();
    }

    handleMissedPlacement(movingBlock) {
        this.playBeep(false); // Play fail sound/beep
        
        // Make the missed block fall away under simulated gravity
        this.tweens.add({
            targets: movingBlock,
            y: movingBlock.y + 600,
            angle: this.movingDirection * 45,
            alpha: 0,
            duration: 900,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                movingBlock.destroy();
                this.triggerGameOver();
            }
        });
    }

    createFallingSlice(x, y, width, color, diff) {
        const slice = this.add.rectangle(x, y, width, 40, color);
        
        this.tweens.add({
            targets: slice,
            y: y + 600,
            x: x + (diff > 0 ? 80 : -80),
            angle: diff > 0 ? 90 : -90,
            alpha: 0,
            duration: 900,
            ease: 'Cubic.easeIn',
            onComplete: () => slice.destroy()
        });
    }

    addPlacedBlock(x, y, width, color) {
        const rect = this.add.rectangle(x, y, width, 40, color);
        this.placedBlocks.push({ x, y, width, color, rect });
        return rect;
    }

    showFloatingText(msg, x, y, color) {
        const txt = this.add.text(x, y, msg, {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '14px',
            fontWeight: 'bold',
            color: color
        }).setOrigin(0.5);

        this.tweens.add({
            targets: txt,
            y: y - 80,
            alpha: 0,
            duration: 800,
            ease: 'Cubic.easeOut',
            onComplete: () => txt.destroy()
        });
    }

    triggerGameOver() {
        this.gameState = 'GAMEOVER';

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('skystack_highscore', this.highScore.toString());
        }

        this.showGameOverModal();
    }

    showGameOverModal() {
        this.gameOverUI = [];

        // Rounded glassmorphic background modal
        const modal = this.add.graphics();
        modal.fillStyle(0x181824, 0.95);
        modal.lineStyle(2, 0xff79c6, 0.2);
        modal.fillRoundedRect(65, 200, 320, 380, 16);
        modal.strokeRoundedRect(65, 200, 320, 380, 16);
        modal.setScrollFactor(0);
        this.gameOverUI.push(modal);

        // Header Title
        const gameOverTitle = this.add.text(225, 250, 'GAME OVER', {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '32px',
            fontWeight: '900',
            color: '#ff5555',
            letterSpacing: '2px'
        }).setOrigin(0.5).setScrollFactor(0);
        this.gameOverUI.push(gameOverTitle);

        // Final score big value
        const scoreVal = this.add.text(225, 330, this.score.toString(), {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '72px',
            fontWeight: '900',
            color: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0);
        this.gameOverUI.push(scoreVal);

        const scoreLabel = this.add.text(225, 385, 'SCORE', {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '12px',
            fontWeight: 'bold',
            color: 'rgba(255, 255, 255, 0.4)'
        }).setOrigin(0.5).setScrollFactor(0);
        this.gameOverUI.push(scoreLabel);

        // Best score info
        const bestScore = this.add.text(225, 430, `BEST: ${this.highScore}`, {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#50fa7b'
        }).setOrigin(0.5).setScrollFactor(0);
        this.gameOverUI.push(bestScore);

        // Restart interactive button
        const restartBtn = this.add.rectangle(225, 510, 200, 50, 0xff79c6)
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: true });

        const restartTxt = this.add.text(225, 510, 'PLAY AGAIN', {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0);

        restartBtn.on('pointerover', () => {
            restartBtn.setScale(1.05);
            restartTxt.setScale(1.05);
        });

        restartBtn.on('pointerout', () => {
            restartBtn.setScale(1);
            restartTxt.setScale(1);
        });

        restartBtn.on('pointerdown', () => {
            // Cleanup game over screen components
            this.gameOverUI.forEach(el => el.destroy());
            restartBtn.destroy();
            restartTxt.destroy();
            this.restartBtn = null;

            this.startGame();
        });

        this.restartBtn = restartBtn;
        this.gameOverUI.push(restartTxt);

        // Fade in animation for GameOver modal
        this.gameOverUI.forEach(el => el.alpha = 0);
        restartBtn.alpha = 0;

        this.tweens.add({
            targets: [...this.gameOverUI, restartBtn],
            alpha: 1,
            duration: 350,
            ease: 'Power2'
        });
    }

    initAudio() {
        if (this.audioCtx) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioCtx = new AudioContext();
            }
        } catch (e) {
            console.warn("AudioContext initialization failed.");
        }
    }

    playBeep(isPerfect) {
        this.initAudio();
        if (!this.audioCtx) return;

        try {
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            if (isPerfect) {
                // High frequency combo chime sound
                osc.frequency.setValueAtTime(700, this.audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(1100, this.audioCtx.currentTime + 0.12);
                gain.gain.setValueAtTime(0.06, this.audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.12);
                osc.start();
                osc.stop(this.audioCtx.currentTime + 0.12);
            } else {
                // Low standard stack beep
                osc.frequency.setValueAtTime(380, this.audioCtx.currentTime);
                gain.gain.setValueAtTime(0.06, this.audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.08);
                osc.start();
                osc.stop(this.audioCtx.currentTime + 0.08);
            }
        } catch (e) {
            // Silently ignore audio bugs
        }
    }

    getRandomPastelColor(index) {
        const hue = (index * 22) % 360;
        const colorObj = Phaser.Display.Color.HSLToColor(hue / 360, 0.75, 0.65);
        return colorObj.color;
    }

    update(time, delta) {
        if (this.gameState === 'PLAYING' && this.movingBlock) {
            const baseSpeed = 330;
            const speedMultiplier = Math.min(1 + (this.score * 0.04), 2.2);
            const speed = baseSpeed * speedMultiplier;

            this.movingBlock.x += speed * this.movingDirection * (delta / 1000);

            const halfWidth = this.currentWidth / 2;
            if (this.movingDirection === 1 && this.movingBlock.x >= 450 + halfWidth) {
                this.movingBlock.x = 450 + halfWidth;
                this.movingDirection = -1;
            } else if (this.movingDirection === -1 && this.movingBlock.x <= -halfWidth) {
                this.movingBlock.x = -halfWidth;
                this.movingDirection = 1;
            }
        }

        // Smooth camera follow tracking the tower's summit
        this.cameras.main.scrollY = Phaser.Math.Linear(
            this.cameras.main.scrollY,
            this.cameraTargetScrollY,
            0.08
        );
    }
}
