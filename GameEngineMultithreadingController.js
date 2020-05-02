/*
 * Copyright (C) 2020 Eliastik (eliastiksofts.com)
 *
 * This file is part of "SnakeIA Server".
 *
 * "SnakeIA Server" is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * "SnakeIA Server" is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with "SnakeIA Server".  If not, see <http://www.gnu.org/licenses/>.
 */
const { Worker } = require('worker_threads');
const snakeia    = require("snakeia");
const GameEngine = snakeia.GameEngine;
const Grid       = snakeia.Grid;
const Snake      = snakeia.Snake;
const Position   = snakeia.Position;

class GameEngineMultithreadingController extends GameEngine {
  constructor(grid, snakes, speed, enablePause, enableRetry, progressiveSpeed) {
    super(grid, snakes, speed, enablePause, enableRetry, progressiveSpeed);
    this.worker = new Worker("./GameEngineMultithreading.js");
    this.eventsInit = false;
  }

  init() {
    if(!this.eventsInit) {
      this.worker.on("message", (data) => {
        const type = data.type;
        const dataKeys = Object.keys(data);

        if(dataKeys.length > 1) {
          let grid = this.grid;
          let snakes = this.snakes;

          if(data.grid) {
            grid = Object.assign(new Grid(), data.grid);
            data.grid = grid;
          }
          
          if(data.snakes) {
            for(let i = 0; i < data.snakes.length; i++) {
              data.snakes[i].grid = grid;
              data.snakes[i] = Object.assign(new Snake(), data.snakes[i]);

              for(let j = 0; j < data.snakes[i].queue.length; j++) {
                data.snakes[i].queue[j] = Object.assign(new Position(), data.snakes[i].queue[j]);
              }
            }

            snakes = data.snakes;
          }

          this.snakes = snakes;
          this.grid = grid;

          for(let i = 0; i < dataKeys.length; i++) {
            if(dataKeys[i] != "snakes" && dataKeys[i] != "grid") {
              this[dataKeys[i]] = data[dataKeys[i]];
            }
          }
        }

        switch(type) {
          case "reset":
            this.reactor.dispatchEvent("onReset");
            break;
          case "start":
            this.reactor.dispatchEvent("onStart");
            break;
          case "pause":
            this.reactor.dispatchEvent("onPause");
            break;
          case "continue":
            this.reactor.dispatchEvent("onContinue");
            break;
          case "stop":
            this.reactor.dispatchEvent("onStop");
            break;
          case "exit":
            this.reactor.dispatchEvent("onExit");
            break;
          case "kill":
            this.reactor.dispatchEvent("onKill");
            this.worker.terminate();
            break;
          case "scoreIncreased":
            this.reactor.dispatchEvent("onScoreIncreased");
            break;
          case "update":
            this.reactor.dispatchEvent("onUpdate");
            break;
          case "updateCounter":
            this.reactor.dispatchEvent("onUpdateCounter");
            break;
        }
      });

      this.eventsInit = true;
    }

    if(this.grid) {
      this.grid.rngGrid = null;
      this.grid.rngGame = null;
    }

    this.worker.postMessage({
      type: "init",
      grid: this.grid,
      snakes: this.snakes,
      speed: this.speed,
      enablePause: this.enablePause,
      enableRetry: this.enableRetry,
      progressiveSpeed: this.progressiveSpeed
    });
  }

  reset() {
    if(this.worker) this.worker.postMessage({ type: "reset" });
  }

  start() {
    if(this.worker) this.worker.postMessage({ type: "start" });
  }

  stop(finish) {
    if(this.worker) this.worker.postMessage({ type: finish ? "finish" : "stop" });
  }

  finish(finish) {
    if(this.worker) this.worker.postMessage({ type: finish ? "finish" : "stop" });
  }

  pause() {
    if(this.worker) this.worker.postMessage({ type: "pause" });
  }

  kill() {
    if(this.worker) {
      this.worker.postMessage({ type: "kill" });
      this.worker.terminate();
      this.worker = null;
    }
  }

  tick() {
    if(this.worker) this.worker.postMessage({ type: "tick" });
  }

  exit() {
    if(this.worker) this.worker.postMessage({ type: "exit" });
  }

  key(key, numSnake) {
    if(this.worker) this.worker.postMessage({ type: "key", key: key, numSnake: numSnake });
  }
  
  forceStart() {
    if(this.worker) this.worker.postMessage({ type: "forceStart" });
  }

  updateEngine(key, data) {
    if(this.worker) this.worker.postMessage({ type: "update", key: key, data: data });
  }

  onReset(callback) {
    this.reactor.addEventListener("onReset", callback);
  }

  onStart(callback) {
    this.reactor.addEventListener("onStart", callback);
  }

  onContinue(callback) {
    this.reactor.addEventListener("onContinue", callback);
  }

  onStop(callback) {
    this.reactor.addEventListener("onStop", callback);
  }

  onPause(callback) {
    this.reactor.addEventListener("onPause", callback);
  }

  onExit(callback) {
    this.reactor.addEventListener("onExit", callback);
  }

  onKill(callback) {
    this.reactor.addEventListener("onKill", callback);
  }

  onScoreIncreased(callback) {
    this.reactor.addEventListener("onScoreIncreased", callback);
  }

  onUpdate(callback) {
    this.reactor.addEventListener("onUpdate", callback);
  }

  onUpdateCounter(callback) {
    this.reactor.addEventListener("onUpdateCounter", callback);
  }
}

module.exports = GameEngineMultithreadingController;