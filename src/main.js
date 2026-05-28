import './style.css';
import Phaser from 'phaser';
import MainScene from './scenes/MainScene.js';

const config = {
    type: Phaser.AUTO,
    width: 450,
    height: 800,
    parent: 'app',
    scene: [MainScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

// Create the Phaser game instance
new Phaser.Game(config);
