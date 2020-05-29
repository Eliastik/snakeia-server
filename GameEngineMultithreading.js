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
const { isMainThread, parentPort } = require('worker_threads');
const snakeia                      = require("snakeia");
const GameConstants                = snakeia.GameConstants;
const Position                     = snakeia.Position;
const Grid                         = snakeia.Grid;
const Snake                        = snakeia.Snake;
const GameEngine                   = snakeia.GameEngine;
const seedrandom                   = require("seedrandom");

let game;

function copySnakes(snakes) {
  var copy = JSON.parse(JSON.stringify(snakes));

  if(copy) {
    for(var i = 0; i < copy.length; i++) {
      delete copy[i]["grid"];
    }
  }

  return copy;
}

function copyGrid(grid) {
  var copy = JSON.parse(JSON.stringify(grid));

  if(copy) {
    copy.rngGrid = null;
    copy.rngGame = null;
  }

  return copy;
}

function parseSnakes(snakes, grid) {
  if(game) {
    var grid = grid || game.grid;
  }

  grid = Object.assign(new Grid(), grid);

  grid.rngGrid = seedrandom(grid.seedGrid);
  grid.rngGame = seedrandom(grid.seedGame);

  if(!snakes && game) {
    snakes = game.snakes;
  }
  
  for(var i = 0; i < snakes.length; i++) {
    snakes[i].grid = grid;
    snakes[i] = Object.assign(new Snake(), snakes[i]);

    for(var j = 0; j < snakes[i].queue.length; j++) {
      snakes[i].queue[j] = Object.assign(new Position(), snakes[i].queue[j]);
    }

    snakes[i].initAI();
  }

  return {
    grid: grid,
    snakes: snakes
  };
}

if(!isMainThread) {
  parentPort.on("message", (data) => {
    const type = data.type;
    const keys = Object.keys(data);

    if(type == "init") {
      const parsed = parseSnakes(data.snakes, data.grid);
      const grid = parsed["grid"];
      const snakes = parsed["snakes"];

      if(!game) {
        game = new GameEngine(grid, snakes, data.speed, data.enablePause, data.enableRetry, data.progressiveSpeed);
        game.init();
  
        parentPort.postMessage({
          type: "init",
          "snakes": copySnakes(game.snakes),
          "grid": copyGrid(game.grid),
          "enablePause": game.enablePause,
          "enableRetry": game.enableRetry,
          "progressiveSpeed": game.progressiveSpeed,
          "offsetFrame": game.speed * GameConstants.Setting.TIME_MULTIPLIER,
          "errorOccurred": game.errorOccurred
        });
    
        game.onReset(() => {
          parentPort.postMessage({
            type: "reset",
            "paused": game.paused,
            "isReseted": game.isReseted,
            "exited": game.exited,
            "snakes": copySnakes(game.snakes),
            "grid": copyGrid(game.grid),
            "numFruit": game.numFruit,
            "ticks": game.ticks,
            "scoreMax": game.scoreMax,
            "gameOver": game.gameOver,
            "gameFinished": game.gameFinished,
            "gameMazeWin": game.gameMazeWin,
            "starting": game.starting,
            "initialSpeed": game.initialSpeed,
            "speed": game.speed,
            "offsetFrame": game.speed * GameConstants.Setting.TIME_MULTIPLIER,
            "confirmReset": false,
            "confirmExit": false,
            "getInfos": false,
            "getInfosGame": false,
            "errorOccurred": game.errorOccurred
          });
        });
    
        game.onStart(() => {
          parentPort.postMessage({
            type: "start",
            "snakes": copySnakes(game.snakes),
            "grid": copyGrid(game.grid),
            "starting": game.starting,
            "countBeforePlay": game.countBeforePlay,
            "paused": game.paused,
            "isReseted": game.isReseted,
            "confirmReset": false,
            "confirmExit": false,
            "getInfos": false,
            "getInfosGame": false,
            "errorOccurred": game.errorOccurred
          });
        });
    
        game.onPause(() => {
          parentPort.postMessage({
            type: "pause",
            "paused": game.paused,
            "confirmReset": false,
            "confirmExit": false,
            "getInfos": false,
            "getInfosGame": false,
            "errorOccurred": game.errorOccurred
          });
        });
    
        game.onContinue(() => {
          parentPort.postMessage({
            type: "continue",
            "confirmReset": false,
            "confirmExit": false,
            "getInfos": false,
            "getInfosGame": false,
            "errorOccurred": game.errorOccurred
          });
        });
    
        game.onStop(() => {
          parentPort.postMessage({
            type: "stop",
            "paused": game.paused,
            "scoreMax": game.scoreMax,
            "gameOver": game.gameOver,
            "gameFinished": game.gameFinished,
            "confirmReset": false,
            "confirmExit": false,
            "getInfos": false,
            "getInfosGame": false,
            "errorOccurred": game.errorOccurred
          });
        });
    
        game.onExit(() => {
          parentPort.postMessage({
            type: "exit",
            "paused": game.paused,
            "gameOver": game.gameOver,
            "gameFinished": game.gameFinished,
            "exited": game.exited,
            "confirmReset": false,
            "confirmExit": false,
            "getInfos": false,
            "getInfosGame": false,
            "errorOccurred": game.errorOccurred
          });
        });
    
        game.onKill(() => {
          parentPort.postMessage({
            type: "kill",
            "paused": game.paused,
            "gameOver": game.gameOver,
            "killed": game.killed,
            "snakes": copySnakes(game.snakes),
            "grid": copyGrid(game.grid),
            "gameFinished": game.gameFinished,
            "confirmReset": false,
            "confirmExit": false,
            "getInfos": false,
            "getInfosGame": false,
            "errorOccurred": game.errorOccurred
          });
        });
    
        game.onScoreIncreased(() => {
          parentPort.postMessage({ type: "scoreIncreased" });
        });
        
        game.onUpdate(() => {
          parentPort.postMessage({
            type: "update",
            "paused": game.paused,
            "isReseted": game.isReseted,
            "exited": game.exited,
            "snakes": copySnakes(game.snakes),
            "grid": copyGrid(game.grid),
            "numFruit": game.numFruit,
            "ticks": game.ticks,
            "scoreMax": game.scoreMax,
            "gameOver": game.gameOver,
            "gameFinished": game.gameFinished,
            "gameMazeWin": game.gameMazeWin,
            "starting": game.starting,
            "initialSpeed": game.initialSpeed,
            "speed": game.speed,
            "countBeforePlay": game.countBeforePlay,
            "numFruit": game.numFruit,
            "offsetFrame": 0,
            "errorOccurred": game.errorOccurred
          });
        });
    
        game.onUpdateCounter(() => {
          parentPort.postMessage({
            type: "updateCounter",
            "paused": game.paused,
            "isReseted": game.isReseted,
            "exited": game.exited,
            "snakes": copySnakes(game.snakes),
            "grid": copyGrid(game.grid),
            "numFruit": game.numFruit,
            "ticks": game.ticks,
            "scoreMax": game.scoreMax,
            "gameOver": game.gameOver,
            "gameFinished": game.gameFinished,
            "gameMazeWin": game.gameMazeWin,
            "starting": game.starting,
            "initialSpeed": game.initialSpeed,
            "speed": game.speed,
            "countBeforePlay": game.countBeforePlay,
            "numFruit": game.numFruit,
            "errorOccurred": game.errorOccurred
          });
        });
      } else {
        game.snakes = snakes;
        game.grid = grid;
        game.countBeforePlay = 3;
        game.init();
      }
    } else if(game) {
      switch(type) {
        case "reset":
          game.reset();
          break;
        case "start":
          game.start();
          break;
        case "stop":
          game.stop();
          break;
        case "finish":
          game.stop(true);
          break;
        case "stop":
          game.stop(false);
          break;
        case "pause":
          game.pause();
          break;
        case "kill":
          game.kill();
          break;
        case "tick":
          game.paused = false;
          game.countBeforePlay = -1;
          game.tick();
          break;
        case "exit":
          game.exit();
          break;
        case "forceStart":
          game.forceStart();
          break;
        case "key":
          if(keys.length > 1) {
            const key = data.key;
            const numSnake = data.numSnake;
  
            var playerSnake = game.getPlayer(numSnake, GameConstants.PlayerType.HUMAN) || game.getPlayer(numSnake, GameConstants.PlayerType.HYBRID_HUMAN_AI);
  
            if(playerSnake) {
              playerSnake.lastKey = key;
            }
          }
          break;
        case "setGameOver":
          if(keys.length > 1) {
            const numSnake = data.numSnake;
  
            var playerSnake = game.getPlayer(numSnake, GameConstants.PlayerType.HUMAN) || game.getPlayer(numSnake, GameConstants.PlayerType.HYBRID_HUMAN_AI);
  
            if(playerSnake) {
              playerSnake.gameOver = true;
            }
          }
        case "init":
          if(data.length > 1) {
            if(data.key == "snakes") {
              var d = parseSnakes(data.data);
              game.snakes = d.snakes;
            } else if(data.key == "grid") {
              var d = parseSnakes(null, data.data);
              game.grid = d.grid;
            } else {
              game[data.key] = data.data;
            }
          }
          break;
      }
    }
  });
}