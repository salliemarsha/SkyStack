import Phaser from 'phaser';

const BLOCK_HEIGHT = 50;
const DROP_HEIGHT = 220; // Vertical distance the block drops
const BASE_Y = 680;      // Baseline height of the first block
const VIEWPORT_TARGET_Y = 520; // Target screen coordinate for the top block

export default class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
        this.gameState = 'START'; // 'START', 'PLAYING', 'DROPPING', 'GAMEOVER'
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
        
        // Stars coordinates for cozy background
        this.stars = [];
        for (let i = 0; i < 25; i++) {
            this.stars.push({
                x: Math.random() * 450,
                y: Math.random() * 550,
                size: Math.random() * 1.5 + 0.5,
                alphaOffset: Math.random() * Math.PI * 2,
                speed: 0.001 + Math.random() * 0.002
            });
        }
    }

    create() {
        this.gameWidth = 450;
        this.gameHeight = 800;

        // Static background graphics for gradients & stars
        this.bgGraphics = this.add.graphics().setScrollFactor(0);

        // Draw static backdrop silhouettes
        this.drawSkylineBackdrop();

        // Setup input bindings
        this.input.keyboard.on('keydown-SPACE', () => this.handleAction());
        this.input.on('pointerdown', (pointer) => {
            // Check if game over overlay restart button was clicked
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

        // Show start screen
        this.showStartScreen();
    }

    blendColors(color1, color2, ratio) {
        const r1 = (color1 >> 16) & 0xff;
        const g1 = (color1 >> 8) & 0xff;
        const b1 = color1 & 0xff;
        
        const r2 = (color2 >> 16) & 0xff;
        const g2 = (color2 >> 8) & 0xff;
        const b2 = color2 & 0xff;
        
        const r = Math.round(r1 + (r2 - r1) * ratio);
        const g = Math.round(g1 + (g2 - g1) * ratio);
        const b = Math.round(b1 + (b2 - b1) * ratio);
        
        return (r << 16) + (g << 8) + b;
    }

    updateBackground(time) {
        const heightRatio = Math.min(this.score / 35, 1);
        const timeOffset = Math.sin(time / 4500) * 0.04;
        const finalRatio = Phaser.Math.Clamp(heightRatio + timeOffset, 0, 1);
        
        // Twilight violet gradient shifting to space dark blue
        const topColor = this.blendColors(0x151124, 0x05050a, finalRatio);
        const bottomColor = this.blendColors(0x2f1b34, 0x0e0e18, finalRatio);

        this.bgGraphics.clear();
        this.bgGraphics.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1);
        this.bgGraphics.fillRect(0, 0, this.gameWidth, this.gameHeight);

        // Twinkling stars
        this.stars.forEach(star => {
            const starAlpha = 0.2 + 0.8 * ((Math.sin(time * star.speed + star.alphaOffset) + 1) / 2);
            this.bgGraphics.fillStyle(0xffffff, starAlpha);
            this.bgGraphics.fillRect(star.x, star.y, star.size, star.size);
        });
    }

    drawSkylineBackdrop() {
        const g = this.add.graphics().setScrollFactor(0);
        
        // Back silhouettes
        g.fillStyle(0x1b1928, 0.45);
        g.fillRect(15, 680, 75, 120);
        g.fillRect(80, 640, 65, 160);
        g.fillRect(135, 690, 60, 110);
        g.fillRect(235, 650, 85, 150);
        g.fillRect(310, 630, 80, 170);
        g.fillRect(380, 680, 55, 120);
        
        // Middle silhouettes
        g.fillStyle(0x12101b, 0.75);
        g.fillRect(-10, 720, 85, 80);
        g.fillRect(65, 695, 80, 105);
        g.fillRect(170, 725, 85, 75);
        g.fillRect(245, 705, 75, 95);
        g.fillRect(315, 715, 145, 85);
    }

    // Procedural water towers or chimneys
    drawRoofAccessory(graphics, width, color, seedVal) {
        const seed = seedVal * 153.25;
        const rand = (offset = 0) => {
            const x = Math.sin(seed + offset) * 10000;
            return x - Math.floor(x);
        };
        
        const yTop = -BLOCK_HEIGHT / 2;
        
        // Force thin antenna if width is narrow
        let accessoryType = Math.floor(rand(1) * 3);
        if (width < 45) {
            accessoryType = 0;
        }
        
        if (accessoryType === 0) {
            // Antenna
            graphics.fillStyle(0xcccccc, 1);
            graphics.fillRect(-1.5, yTop - 22, 3, 22);
            graphics.fillStyle(0xff5555, 1);
            graphics.fillCircle(0, yTop - 24, 2.5);
        } else if (accessoryType === 1) {
            // Air Vents
            graphics.fillStyle(0x888888, 1);
            graphics.fillRect(-10, yTop - 10, 7, 10);
            graphics.fillRect(3, yTop - 10, 7, 10);
            
            graphics.fillStyle(0x222222, 1);
            graphics.fillRect(-9, yTop - 10, 5, 1.5);
            graphics.fillRect(4, yTop - 10, 5, 1.5);
        } else {
            // Mini Water Tower
            graphics.fillStyle(0x90a4ae, 1);
            graphics.fillRect(-8, yTop - 15, 16, 12);
            
            graphics.fillStyle(0x37474f, 1);
            graphics.fillRect(-10, yTop - 18, 20, 3);
            
            graphics.fillStyle(0x546e7a, 1);
            graphics.fillRect(-6, yTop - 3, 1.5, 3);
            graphics.fillRect(4, yTop - 3, 1.5, 3);
        }
    }

    // Procedural modular skyscraper floor drawer
    drawBuildingSection(graphics, width, height, color, seed, isTop = false, isBase = false) {
        graphics.clear();

        // 1. Draw Roof Accessory if active
        if (isTop) {
            this.drawRoofAccessory(graphics, width, color, seed);
        }

        // 2. Render Lobby foundation if base block
        if (isBase) {
            const baseColor = 0x3d3c45;
            graphics.fillStyle(baseColor, 1);
            graphics.fillRect(-width / 2, -height / 2, width, height);
            
            // Shadows
            graphics.fillStyle(0x000000, 0.15);
            graphics.fillRect(width / 2 - 10, -height / 2, 10, height);
            graphics.fillRect(-width / 2, height / 2 - 6, width, 6);
            
            // Slab ceiling trim
            graphics.fillStyle(0xffffff, 0.2);
            graphics.fillRect(-width / 2 - 3, -height / 2, width + 6, 5);
            
            // Glowing lobby door in center
            const doorWidth = Math.min(width - 40, 30);
            if (doorWidth > 10) {
                graphics.fillStyle(0xfffae0, 0.95);
                graphics.fillRect(-doorWidth / 2, height / 2 - 30, doorWidth, 24);
                
                graphics.lineStyle(1.5, 0x111115, 0.6);
                graphics.strokeRect(-doorWidth / 2, height / 2 - 30, doorWidth, 24);
                graphics.lineStyle(1, 0x111115, 0.4);
                graphics.lineBetween(0, height / 2 - 30, 0, height / 2 - 6);
            }
            
            // Entrance support columns
            graphics.fillStyle(0x52515b, 1);
            graphics.fillRect(-width / 2 + 10, -height / 2 + 5, 8, height - 11);
            graphics.fillRect(width / 2 - 18, -height / 2 + 5, 8, height - 11);
            return;
        }

        // 3. Render Normal modular apartment unit
        // Base structure
        graphics.fillStyle(color, 1);
        graphics.fillRect(-width / 2, -height / 2, width, height);

        // Shadows
        graphics.fillStyle(0x000000, 0.12);
        graphics.fillRect(width / 2 - 10, -height / 2, 10, height);
        graphics.fillRect(-width / 2, height / 2 - 6, width, 6);

        // White concrete top & bottom architectural trims
        graphics.fillStyle(0xffffff, 0.22);
        graphics.fillRect(-width / 2 - 3, -height / 2, width + 6, 4); // top trim
        graphics.fillRect(-width / 2 - 1, height / 2 - 4, width + 2, 3);  // bottom trim

        // Variation randomizer
        const rand = (offset = 0) => {
            const x = Math.sin(seed + offset) * 10000;
            return x - Math.floor(x);
        };
        const buildingStyle = Math.floor(rand(1) * 3);

        // Dual-row window configuration
        const winWidth = 7;
        const winHeight = 10;
        const spacingX = 9;
        
        const cols = Math.floor((width - 15) / (winWidth + spacingX));
        if (cols > 0) {
            const startX = -((cols - 1) * (winWidth + spacingX)) / 2;
            const rowOffsets = [-12, 10];

            rowOffsets.forEach((rowY, rIndex) => {
                for (let c = 0; c < cols; c++) {
                    const lightNoise = rand(c * 7 + rIndex * 13 + 47);
                    const isLightOn = lightNoise > 0.35; // 65% lit

                    const wx = startX + c * (winWidth + spacingX) - winWidth / 2;
                    const wy = rowY - winHeight / 2;

                    if (isLightOn) {
                        // Cozy glowing window pane
                        graphics.fillStyle(0xffe082, 0.95);
                        graphics.fillRect(wx, wy, winWidth, winHeight);

                        // Window reflection shine
                        graphics.fillStyle(0xffffff, 0.4);
                        graphics.fillRect(wx + 1, wy + 1, 2, winHeight - 2);
                    } else {
                        // Unlit dark window pane
                        graphics.fillStyle(0x181822, 0.85);
                        graphics.fillRect(wx, wy, winWidth, winHeight);
                    }

                    // Window border frame
                    graphics.lineStyle(1, 0x000000, 0.2);
                    graphics.strokeRect(wx, wy, winWidth, winHeight);

                    // Procedural balconies on bottom rows
                    if (buildingStyle === 1 && rIndex === 1 && c % 2 === 0) {
                        graphics.fillStyle(0xdddddd, 0.85);
                        graphics.fillRect(wx - 2, wy + 5, winWidth + 4, 6);
                        
                        graphics.fillStyle(0x444444, 0.5);
                        graphics.fillRect(wx - 2, wy + 5, winWidth + 4, 1.5);
                        graphics.fillRect(wx - 2, wy + 10, winWidth + 4, 1.5);
                    }
                }
            });
        }
    }

    createBuildingBlock(x, y, width, height, color, seed = null) {
        const graphics = this.add.graphics({ x, y });
        graphics.blockColor = color;
        graphics.blockWidth = width;
        graphics.blockSeed = seed !== null ? seed : Math.random() * 10000;
        return graphics;
    }

    setupUI() {
        // Subtle background giant height score
        this.scoreText = this.add.text(225, 230, '0', {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '180px',
            fontWeight: '900',
            color: 'rgba(255, 255, 255, 0.05)'
        }).setOrigin(0.5).setScrollFactor(0);
        this.scoreText.setVisible(false);

        // Logo Title
        this.titleText = this.add.text(225, 290, 'SKYSTACK', {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '44px',
            fontWeight: '900',
            color: '#ffffff',
            letterSpacing: '5px'
        }).setOrigin(0.5).setScrollFactor(0);

        this.subtitleText = this.add.text(225, 360, 'TAP OR SPACE TO BUILD', {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '13px',
            fontWeight: 'bold',
            color: 'rgba(255, 255, 255, 0.45)',
            letterSpacing: '1px'
        }).setOrigin(0.5).setScrollFactor(0);

        this.tweens.add({
            targets: this.subtitleText,
            alpha: 0.25,
            duration: 850,
            yoyo: true,
            loop: -1,
            ease: 'Sine.easeInOut'
        });

        // Top-left dashboard best score
        this.highScoreDashboard = this.add.text(25, 25, `BEST: ${this.highScore}`, {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '13px',
            fontWeight: 'bold',
            color: 'rgba(255, 255, 255, 0.4)'
        }).setScrollFactor(0);
    }

    showStartScreen() {
        this.gameState = 'START';
        this.titleText.setVisible(true);
        this.subtitleText.setVisible(true);
        this.scoreText.setVisible(false);
        this.highScoreDashboard.setVisible(true);
        this.highScoreDashboard.setText(`BEST: ${this.highScore}`);

        // Reset camera positions
        this.cameras.main.scrollY = 0;
        this.cameraTargetScrollY = 0;

        // Clear and redraw starting base
        this.placedBlocks.forEach(b => b.rect.destroy());
        this.placedBlocks = [];
        
        if (this.movingBlock) {
            this.movingBlock.destroy();
            this.movingBlock = null;
        }

        this.currentWidth = 220;
        const color = this.getRandomPastelColor(0);
        this.addPlacedBlock(225, BASE_Y, this.currentWidth, color);
    }

    handleAction() {
        if (this.gameState === 'START') {
            this.startGame();
        } else if (this.gameState === 'PLAYING') {
            this.dropBlock();
        }
    }

    startGame() {
        this.gameState = 'PLAYING';
        this.titleText.setVisible(false);
        this.subtitleText.setVisible(false);
        this.highScoreDashboard.setVisible(false);
        
        // Reset camera and tracking variables cleanly on restart
        this.cameras.main.scrollY = 0;
        this.cameraTargetScrollY = 0;
        this.score = 0;
        this.combo = 0;
        
        this.scoreText.setVisible(true);
        this.scoreText.setText('0');

        // Reset building stacks
        this.placedBlocks.forEach(b => b.rect.destroy());
        this.placedBlocks = [];

        if (this.movingBlock) {
            this.movingBlock.destroy();
            this.movingBlock = null;
        }

        // Add Base concrete lobby block
        this.currentWidth = 220;
        const color = this.getRandomPastelColor(0);
        this.addPlacedBlock(225, BASE_Y, this.currentWidth, color);

        this.spawnBlock();
    }

    spawnBlock() {
        if (this.gameState !== 'PLAYING') return;

        const topBlock = this.placedBlocks[this.placedBlocks.length - 1];
        const targetY = topBlock.y - BLOCK_HEIGHT;
        const spawnY = targetY - DROP_HEIGHT;

        const color = this.getRandomPastelColor(this.placedBlocks.length);

        // Alternating spawn sides
        const startFromLeft = this.placedBlocks.length % 2 === 0;
        const startX = startFromLeft ? -this.currentWidth / 2 : 450 + this.currentWidth / 2;
        this.movingDirection = startFromLeft ? 1 : -1;

        this.movingBlock = this.createBuildingBlock(startX, spawnY, this.currentWidth, BLOCK_HEIGHT, color);
    }

    dropBlock() {
        if (!this.movingBlock || this.gameState !== 'PLAYING') return;

        this.gameState = 'DROPPING';

        const topBlock = this.placedBlocks[this.placedBlocks.length - 1];
        const targetY = topBlock.y - BLOCK_HEIGHT;

        // Snappy vertical drop mimicking gravity acceleration
        this.tweens.add({
            targets: this.movingBlock,
            y: targetY,
            duration: 260,
            ease: 'Quad.easeIn',
            onComplete: () => {
                this.handleBlockLanding();
            }
        });
    }

    handleBlockLanding() {
        const block = this.movingBlock;
        this.movingBlock = null;

        const topBlock = this.placedBlocks[this.placedBlocks.length - 1];
        const success = this.sliceBlock(block, topBlock);

        if (success) {
            this.score++;
            this.scoreText.setText(this.score.toString());

            // Camera follow: tracks tower and centers when top goes above threshold coordinate
            const newTopBlock = this.placedBlocks[this.placedBlocks.length - 1];
            if (newTopBlock.y < VIEWPORT_TARGET_Y) {
                this.cameraTargetScrollY = newTopBlock.y - VIEWPORT_TARGET_Y;
            } else {
                this.cameraTargetScrollY = 0;
            }

            // Return to playing state and spawn next floor
            this.gameState = 'PLAYING';
            this.spawnBlock();
        }
    }

    applyLandingImpact(rect) {
        // Squeeze & stretch impact tween to make landing feel heavy & satisfying
        this.tweens.add({
            targets: rect,
            scaleY: 0.84,
            scaleX: 1.05,
            y: rect.y + 4.0, // Compensates bottom coordinate shift on scale
            yoyo: true,
            duration: 90,
            ease: 'Quad.easeInOut'
        });
    }

    sliceBlock(movingBlock, topBlock) {
        const diff = movingBlock.x - topBlock.x;
        const targetY = topBlock.y - BLOCK_HEIGHT;

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

        // 3. Normal Slice Placement
        const newWidth = this.currentWidth - Math.abs(diff);
        const newX = topBlock.x + (diff / 2);

        const sliceWidth = Math.abs(diff);
        let sliceX = 0;
        if (diff > 0) {
            sliceX = newX + (newWidth / 2) + (sliceWidth / 2);
        } else {
            sliceX = newX - (newWidth / 2) - (sliceWidth / 2);
        }

        // Spawn falling building block debris
        this.createFallingSlice(sliceX, targetY, sliceWidth, movingBlock.blockColor, diff, movingBlock.blockSeed);

        // Tactile hit impact shake
        this.cameras.main.shake(70, 0.005);

        // Reset combo
        this.currentWidth = newWidth;
        this.combo = 0;

        // Add permanent unit segment
        const placed = this.addPlacedBlock(newX, targetY, newWidth, movingBlock.blockColor, movingBlock.blockSeed);
        
        // Trigger squeeze feedback
        this.applyLandingImpact(placed);

        this.playBeep(false);
        movingBlock.destroy();
        return true;
    }

    handlePerfectPlacement(topBlock, movingBlock) {
        const newX = topBlock.x;
        const targetY = topBlock.y - BLOCK_HEIGHT;
        this.combo++;

        this.playBeep(true);
        this.showFloatingText(`PERFECT! x${this.combo}`, newX, targetY - 25, '#00ffcc');

        // Apartment width recovery bonus
        if (this.combo > 0 && this.combo % 3 === 0) {
            const prevWidth = this.currentWidth;
            this.currentWidth = Math.min(220, this.currentWidth + 15);
            if (this.currentWidth > prevWidth) {
                this.showFloatingText('+ WIDER FLOOR', newX, targetY - 48, '#ff79c6');
            }
        }

        // Stack perfect segment
        const placed = this.addPlacedBlock(newX, targetY, this.currentWidth, movingBlock.blockColor, movingBlock.blockSeed);
        
        this.applyLandingImpact(placed);

        // White glowing overlay flash
        const flash = this.add.rectangle(newX, targetY, this.currentWidth, BLOCK_HEIGHT, 0xffffff);
        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 250,
            onComplete: () => flash.destroy()
        });

        movingBlock.destroy();
    }

    handleMissedPlacement(movingBlock) {
        this.playBeep(false);
        
        // Large screen shake on total miss
        this.cameras.main.shake(250, 0.016);
        
        // Building falls down off-screen under simulated gravity
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

    createFallingSlice(x, y, width, color, diff, seed) {
        const slice = this.createBuildingBlock(x, y, width, BLOCK_HEIGHT, color, seed);
        
        this.tweens.add({
            targets: slice,
            y: y + 600,
            x: x + (diff > 0 ? 80 : -80),
            angle: diff > 0 ? 85 : -85,
            alpha: 0,
            duration: 900,
            ease: 'Cubic.easeIn',
            onComplete: () => slice.destroy()
        });
    }

    addPlacedBlock(x, y, width, color, seed = null) {
        const isBase = this.placedBlocks.length === 0;

        // Strip previous top block of its roof accessory
        if (this.placedBlocks.length > 0) {
            const prev = this.placedBlocks[this.placedBlocks.length - 1];
            prev.isTop = false;
            const prevIsBase = this.placedBlocks.length === 1;
            this.drawBuildingSection(prev.rect, prev.width, BLOCK_HEIGHT, prev.color, prev.rect.blockSeed, false, prevIsBase);
        }

        const rect = this.createBuildingBlock(x, y, width, BLOCK_HEIGHT, color, seed);
        this.placedBlocks.push({ x, y, width, color, rect, isTop: true });

        // Draw the newly stacked block with top details active
        this.drawBuildingSection(rect, width, BLOCK_HEIGHT, color, rect.blockSeed, true, isBase);

        return rect;
    }

    showFloatingText(msg, x, y, color) {
        const txt = this.add.text(x, y, msg, {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '15px',
            fontWeight: '900',
            color: color,
            stroke: '#111115',
            strokeThickness: 3
        }).setOrigin(0.5);

        txt.setScale(0.3);

        // Elastic popup bounce
        this.tweens.add({
            targets: txt,
            scale: 1,
            y: y - 30,
            duration: 250,
            ease: 'Back.easeOut'
        });

        // Floating fade away
        this.tweens.add({
            targets: txt,
            y: y - 80,
            alpha: 0,
            delay: 450,
            duration: 450,
            ease: 'Sine.easeIn',
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

        // Semi-transparent dark rounded container
        const modal = this.add.graphics();
        modal.fillStyle(0x13111c, 0.95);
        modal.lineStyle(2, 0xff79c6, 0.15);
        modal.fillRoundedRect(65, 200, 320, 380, 16);
        modal.strokeRoundedRect(65, 200, 320, 380, 16);
        modal.setScrollFactor(0);
        this.gameOverUI.push(modal);

        // Game Over text Header
        const gameOverTitle = this.add.text(225, 250, 'GAME OVER', {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '32px',
            fontWeight: '900',
            color: '#ff5555',
            letterSpacing: '2px'
        }).setOrigin(0.5).setScrollFactor(0);
        this.gameOverUI.push(gameOverTitle);

        // Score display
        const scoreVal = this.add.text(225, 330, this.score.toString(), {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '76px',
            fontWeight: '900',
            color: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0);
        this.gameOverUI.push(scoreVal);

        const scoreLabel = this.add.text(225, 388, 'HEIGHT STACKED', {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '11px',
            fontWeight: 'bold',
            color: 'rgba(255, 255, 255, 0.35)',
            letterSpacing: '1px'
        }).setOrigin(0.5).setScrollFactor(0);
        this.gameOverUI.push(scoreLabel);

        // High Score
        const bestScore = this.add.text(225, 430, `BEST HIGH: ${this.highScore}`, {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#50fa7b',
            letterSpacing: '0.5px'
        }).setOrigin(0.5).setScrollFactor(0);
        this.gameOverUI.push(bestScore);

        // Play Again button
        const restartBtn = this.add.rectangle(225, 510, 200, 50, 0xff79c6)
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: true });

        const restartTxt = this.add.text(225, 510, 'PLAY AGAIN', {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#ffffff',
            letterSpacing: '0.5px'
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
            // Remove GameOver Screen UI components
            this.gameOverUI.forEach(el => el.destroy());
            restartBtn.destroy();
            restartTxt.destroy();
            this.restartBtn = null;

            // Trigger complete clean game reset
            this.startGame();
        });

        this.restartBtn = restartBtn;
        this.gameOverUI.push(restartTxt);

        // Fade in modal
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
            console.warn("AudioContext init skipped.");
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
                osc.frequency.setValueAtTime(659.25, this.audioCtx.currentTime); // E5
                osc.frequency.exponentialRampToValueAtTime(987.77, this.audioCtx.currentTime + 0.12); // B5
                gain.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.14);
                osc.start();
                osc.stop(this.audioCtx.currentTime + 0.14);
            } else {
                osc.frequency.setValueAtTime(329.63, this.audioCtx.currentTime); // E3
                gain.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.08);
                osc.start();
                osc.stop(this.audioCtx.currentTime + 0.08);
            }
        } catch (e) {
            // Silence exceptions
        }
    }

    getRandomPastelColor(index) {
        const hue = (index * 24) % 360;
        const colorObj = Phaser.Display.Color.HSLToColor(hue / 360, 0.75, 0.65);
        return colorObj.color;
    }

    update(time, delta) {
        // Redraw starry background gradient
        this.updateBackground(time);

        // Move active floor horizontally (only when in PLAYING status)
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

        // Linear interpolation for smooth camera follow tracking
        this.cameras.main.scrollY = Phaser.Math.Linear(
            this.cameras.main.scrollY,
            this.cameraTargetScrollY,
            0.08
        );
    }
}
