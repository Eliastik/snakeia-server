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
const express        = require("express");
const app            = require("express")();
const fs             = require("fs");
const http           = require("http").createServer(app);
const io             = require("socket.io")(http, {
  cors: {
    origin: true,
    credentials: true
  },
  allowEIO3: true
});
const entities       = require("html-entities");
const ejs            = require("ejs");
const jwt            = require("jsonwebtoken");
const fetch          = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const cookieParser   = require("cookie-parser");
const ioCookieParser = require("socket.io-cookie-parser");
const i18n           = require("i18n");
const rateLimit      = require("express-rate-limit");
const winston        = require("winston");
const { doubleCsrf } = require("csrf-csrf");
const bodyParser     = require("body-parser");
const node_config    = require("config");

process.env["ALLOW_CONFIG_MUTATIONS"] = true;
let config = node_config.get("ServerConfig"); // Server configuration (see default config file config.json)

// Load config file
const configSources = node_config.util.getConfigSources();
const configFile = configSources[configSources.length - 1].name;

config.port = process.env.PORT || config.port;
const jsonWebTokenSecretKey = config.jsonWebTokenSecretKey && config.jsonWebTokenSecretKey.trim() != "" ? config.jsonWebTokenSecretKey : generateRandomJsonWebTokenSecretKey();
const jsonWebTokenSecretKeyAdmin = config.jsonWebTokenSecretKeyAdmin && config.jsonWebTokenSecretKeyAdmin.trim() != "" ? config.jsonWebTokenSecretKeyAdmin : generateRandomJsonWebTokenSecretKey(jsonWebTokenSecretKey);

const productionMode = process.env.NODE_ENV === "production";

// Update config to file
function updateConfigToFile() {
  fs.writeFileSync(configFile, JSON.stringify({ "ServerConfig": config }, null, 4), "UTF-8");
  config = node_config.get("ServerConfig");
}

// Logging
const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple(),
    winston.format.errors({ stack: true })
  ),
  transports: config.enableLoggingFile ? [new winston.transports.File({ filename: config.logFile })] : [],
  exceptionHandlers: config.enableLoggingFile ? [new winston.transports.File({ filename: config.errorLogFile })] : []
});

if(!productionMode) {
  logger.add(new winston.transports.Console({
    format: winston.format.colorize()
  }));
}

if(config.proxyMode) {
  app.enable("trust proxy", config.numberOfProxies);
}

// Internationalization
i18n.configure({
  locales:["fr", "en"], 
  directory: __dirname + "/locales", 
  defaultLocale: "en",
  queryParameter: "lang",
  cookie: "lang"
});

// Game modules
const snakeia        = require("snakeia");
const { randomUUID } = require("crypto");
const Snake          = snakeia.Snake;
const Grid           = snakeia.Grid;
const GameConstants  = snakeia.GameConstants;
const GameEngine     = config.enableMultithreading ? require("./GameEngineMultithreadingController")(logger) : snakeia.GameEngine;
const Player         = require("./Player");

const games = {}; // Contains all the games processed by the server
const tokens = []; // User tokens
const invalidatedUserTokens = []; // Invalidated user tokens
const invalidatedAdminTokens = []; // Invalidated admin tokens

function getRoomsData() {
  const rooms = [];
  const keysRooms = Object.keys(games).filter(key => games[key] && !games[key]["private"]);

  for(let i = 0; i < keysRooms.length; i++) {
    const game = games[keysRooms[i]];

    rooms.push({});
    rooms[i]["borderWalls"] = false;
    rooms[i]["generateWalls"] = false;
    rooms[i]["players"] = Object.keys(game["players"]).length + game.numberAIToAdd;
    rooms[i]["width"] = "???";
    rooms[i]["height"] = "???";
    rooms[i]["speed"] = game["gameEngine"].speed;
    rooms[i]["code"] = keysRooms[i];
    rooms[i]["maxPlayers"] = getMaxPlayers(keysRooms[i]);
    rooms[i]["state"] = (game["started"] ? GameConstants.GameState.STARTED : game["timeoutPlay"] != null ? GameConstants.GameState.STARTING : game["searchingPlayers"] ? GameConstants.GameState.SEARCHING_PLAYERS : "");

    if(game["gameEngine"].grid != null) {
      rooms[i]["width"] = game["gameEngine"].grid.width;
      rooms[i]["height"] = game["gameEngine"].grid.height;
      rooms[i]["borderWalls"] = game["gameEngine"].grid.borderWalls;
      rooms[i]["generateWalls"] = game["gameEngine"].grid.generateWalls;
    }

    if(game["gameEngine"].snake != null) {
      rooms[i]["players"] = game["gameEngine"].snake.length;
    }

    if(game["spectators"] != null) {
      rooms[i]["spectators"] = Object.keys(game["spectators"]).length;
    }
  }

  return rooms;
}

function getRandomRoomKey() {
  let r;

  do {
    r = Math.random().toString(36).substring(2, 10);
  } while(r in games);

  return r;
}

function generateRandomJsonWebTokenSecretKey(precValue) {
  let key;

  do {
    key = require("crypto").randomBytes(256).toString("base64");
  } while(precValue && precValue == key);

  return key;
}

function getMaxPlayers(code) {
  const game = games[code].gameEngine;

  const heightGrid = parseInt(game.grid.height);
  const widthGrid = parseInt(game.grid.width);

  let numberEmptyCases = heightGrid * widthGrid;

  if(game.grid.borderWalls) {
    numberEmptyCases -= (((widthGrid + heightGrid) * 2) - 4);
  }

  if(game.grid.generateWalls) {
    if(game.grid.borderWalls) {
      numberEmptyCases -= ((heightGrid * widthGrid) * 0.1);
    } else {
      numberEmptyCases -= ((heightGrid * widthGrid) * 0.1675);
    }
  }

  return Math.min(config.maxPlayers, Math.max(Math.round(numberEmptyCases / 5), 2));
}

function createRoom(data, socket) {
  if(Object.keys(games).filter(key => games[key] != null).length < config.maxRooms && !Player.containsTokenAllGames(socket?.handshake?.auth?.token || socket?.handshake?.query?.token || socket?.request?.cookies?.token, games) && !Player.containsIdAllGames(socket.id, games)) {
    let heightGrid = 20;
    let widthGrid = 20;
    let borderWalls = false;
    let generateWalls = false;
    let speed = 8;
    let enableAI = false;
    let levelAI = null;
    let validSettings = true;
    let privateGame = false;
  
    if(data.heightGrid == null || isNaN(data.heightGrid) || data.heightGrid < config.minGridSize || data.heightGrid > config.maxGridSize) {
      validSettings = false;
    } else {
      heightGrid = data.heightGrid;
    }
  
    if(data.widthGrid == null || isNaN(data.widthGrid) || data.widthGrid < config.minGridSize || data.widthGrid > config.maxGridSize) {
      validSettings = false;
    } else {
      widthGrid = data.widthGrid;
    }
  
    if(data.borderWalls == null) {
      validSettings = false;
    } else {
      borderWalls = data.borderWalls ? true : false;
    }
  
    if(data.generateWalls == null) {
      validSettings = false;
    } else {
      generateWalls = data.generateWalls ? true : false;
    }
  
    if(data.private == null) {
      validSettings = false;
    } else {
      privateGame = data.private ? true : false;
    }
  
    if(data.speed == "custom") {
      if(data.customSpeed == null || isNaN(data.customSpeed) || data.customSpeed < config.minSpeed || data.customSpeed > config.maxSpeed) {
        validSettings = false;
      } else {
        speed = data.customSpeed;
      }
    } else if(data.speed == null || isNaN(data.speed) || data.speed < config.minSpeed || data.speed > config.maxSpeed) {
      validSettings = false;
    } else {
      speed = data.speed;
    }

    if(data.enableAI && config.enableAI) {
      enableAI = true;

      if(data.levelAI && ["AI_LEVEL_RANDOM", "AI_LEVEL_LOW", "AI_LEVEL_DEFAULT", "AI_LEVEL_HIGH", "AI_LEVEL_ULTRA"].includes(data.levelAI)) {
        levelAI = data.levelAI;
      } else {
        validSettings = false;
      }
    } else if(data.enableAI && !config.enableAI) {
      validSettings = false;
    }
  
    if(validSettings) {
      const code = getRandomRoomKey();
      const grid = new Grid(widthGrid, heightGrid, generateWalls, borderWalls, false, null, false);
      grid.reset();
      grid.init();
      const game = new GameEngine(grid, [], speed);
      
      games[code] = {
        gameEngine: game,
        private: privateGame,
        players: [],
        spectators: [],
        enableAI: enableAI,
        levelAI: levelAI,
        searchingPlayers: true,
        started: false,
        alreadyInit: false,
        timeoutPlay: null,
        timeStart: null,
        timeoutMaxTimePlay: null
      };

      games[code].numberAIToAdd = enableAI ? Math.round(getMaxPlayers(code) / 2 - 1) : 0;

      logger.info("room creation (code: " + code + ") - username: " + (Player.getUsernameSocket(socket)) + " - ip: " + getIPSocketIO(socket.handshake) + " - socket: " + socket.id, {
        "widthGrid": widthGrid,
        "heightGrid": heightGrid,
        "generateWalls": generateWalls,
        "borderWalls": borderWalls,
        "speed": speed,
        "enableAI": enableAI,
        "private": privateGame
      });
  
      if(socket != null) {
        socket.emit("process", {
          success: true,
          code: code
        });
  
        setupRoom(code);
      }
    } else if(socket != null) {
      socket.emit("process", {
        success: false,
        code: null,
        errorCode: GameConstants.Error.INVALID_SETTINGS
      });
    }
  } else if(socket != null) {
    if(Player.containsTokenAllGames(socket?.handshake?.auth?.token || socket?.handshake?.query?.token || socket?.request?.cookies?.token, games) || Player.containsIdAllGames(socket.id, games)) {
      socket.emit("process", {
        success: false,
        code: null,
        errorCode: "ALREADY_CREATED_ROOM"
      });
    } else {
      socket.emit("process", {
        success: false,
        code: null,
        errorCode: GameConstants.Error.MAX_ROOM_LIMIT_REACHED
      });
    }
  }
}

function copySnakes(snakes) {
  const snakesCopy = [];

  if(snakes) {
    snakes.forEach(snake => {
      if(snake) {
        const snakeCopy = new Snake();
  
        snakeCopy.color = snake.color;
        snakeCopy.direction = snake.direction;
        snakeCopy.errorInit = snake.errorInit;
        snakeCopy.gameOver = snake.gameOver;
        snakeCopy.autoRetry = snake.autoRetry;
        snakeCopy.aiLevel = snake.aiLevel;
  
        if(snake.lastTail) {
          snakeCopy.lastTail = JSON.parse(JSON.stringify(snake.lastTail));
        }
  
        if(snake.lastHead) {
          snakeCopy.lastHead = JSON.parse(JSON.stringify(snake.lastHead));
        }
  
        snakeCopy.lastTailMoved = snake.lastTailMoved;
        snakeCopy.lastHeadMoved = snake.lastHeadMoved;
        snakeCopy.name = snake.name;
        snakeCopy.player = snake.player;
  
        if(snake.queue) {
          snakeCopy.queue = JSON.parse(JSON.stringify(snake.queue));
        }
  
        snakeCopy.score = snake.score;
        snakeCopy.scoreMax = snake.scoreMax;
        snakeCopy.ticksDead = snake.ticksDead;
        snakeCopy.ticksWithoutAction = snake.ticksWithoutAction;
        snakeCopy.grid = null;
  
        if(snake.snakeAI && snake.snakeAI.aiLevelText) {
          snakeCopy.snakeAI.aiLevelText = snake.snakeAI.aiLevelText;
        }
  
        snakesCopy.push(snakeCopy);
      }
    });
  }

  return snakesCopy;
}

function setupRoom(code) {
  const game = games[code].gameEngine;

  game.onReset(() => {
    io.to("room-" + code).emit("reset", {
      "paused": game.paused,
      "isReseted": game.isReseted,
      "exited": game.exited,
      "grid": game.grid,
      "numFruit": game.numFruit,
      "ticks": game.ticks,
      "scoreMax": game.scoreMax,
      "gameOver": game.gameOver,
      "gameFinished": game.gameFinished,
      "gameMazeWin": game.gameMazeWin,
      "starting": game.starting,
      "initialSpeed": game.initialSpeed,
      "speed": game.speed,
      "snakes": copySnakes(game.snakes),
      "offsetFrame": game.speed * GameConstants.Setting.TIME_MULTIPLIER,
      "confirmReset": false,
      "confirmExit": false,
      "getInfos": false,
      "getInfosGame": false,
      "errorOccurred": game.errorOccurred,
      "timerToDisplay": config.enableMaxTimeGame ? (config.maxTimeGame - (Date.now() - game.timeStart)) / 1000 : -1,
      "aiStuck": game.aiStuck,
      "precAiStuck": false
    });
  });

  game.onStart(() => {
    io.to("room-" + code).emit("start", {
      "snakes": copySnakes(game.snakes),
      "grid": game.grid,
      "starting": game.starting,
      "countBeforePlay": game.countBeforePlay,
      "paused": game.paused,
      "isReseted": game.isReseted,
      "confirmReset": false,
      "confirmExit": false,
      "getInfos": false,
      "getInfosGame": false,
      "errorOccurred": game.errorOccurred,
      "searchingPlayers": false
    });
  });

  game.onPause(() => {
    io.to("room-" + code).emit("pause", {
      "paused": game.paused,
      "confirmReset": false,
      "confirmExit": false,
      "getInfos": false,
      "getInfosGame": false,
      "errorOccurred": game.errorOccurred
    });
  });

  game.onContinue(() => {
    io.to("room-" + code).emit("continue", {
      "confirmReset": false,
      "confirmExit": false,
      "getInfos": false,
      "getInfosGame": false,
      "errorOccurred": game.errorOccurred
    });
  });

  game.onStop(() => {
    io.to("room-" + code).emit("stop", {
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

    if(games[code] != null) {
      games[code].started = false;
      games[code].searchingPlayers = true;
      clearTimeout(games[code].timeoutMaxTimePlay);
    }
  });

  game.onExit(() => {
    io.to("room-" + code).emit("exit", {
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
    io.to("room-" + code).emit("kill", {
      "paused": game.paused,
      "gameOver": game.gameOver,
      "killed": game.killed,
      "snakes": copySnakes(game.snakes),
      "gameFinished": game.gameFinished,
      "grid": game.grid,
      "confirmReset": false,
      "confirmExit": false,
      "getInfos": false,
      "getInfosGame": false,
      "errorOccurred": game.errorOccurred
    });
  });

  game.onScoreIncreased(() => {
    io.to("room-" + code).emit("scoreIncreased", {
      "snakes": copySnakes(game.snakes),
      "grid": game.grid,
      "scoreMax": game.scoreMax,
      "gameFinished": game.gameFinished,
      "errorOccurred": game.errorOccurred
    });
  });
  
  game.onUpdate(() => {
    io.to("room-" + code).emit("update", {
      "isReseted": game.isReseted,
      "exited": game.exited,
      "grid": game.grid,
      "numFruit": game.numFruit,
      "ticks": game.ticks,
      "scoreMax": game.scoreMax,
      "gameOver": game.gameOver,
      "gameFinished": game.gameFinished,
      "gameMazeWin": game.gameMazeWin,
      "starting": game.starting,
      "initialSpeed": game.initialSpeed,
      "speed": game.speed,
      "snakes": copySnakes(game.snakes),
      "countBeforePlay": game.countBeforePlay,
      "numFruit": game.numFruit,
      "errorOccurred": game.errorOccurred,
      "timerToDisplay": config.enableMaxTimeGame ? (config.maxTimeGame - (Date.now() - game.timeStart)) / 1000 : -1,
      "aiStuck": game.aiStuck
    });
  });

  game.onUpdateCounter(() => {
    io.to("room-" + code).emit("updateCounter", {
      "paused": game.paused,
      "isReseted": game.isReseted,
      "exited": game.exited,
      "grid": game.grid,
      "numFruit": game.numFruit,
      "ticks": game.ticks,
      "scoreMax": game.scoreMax,
      "gameOver": game.gameOver,
      "gameFinished": game.gameFinished,
      "gameMazeWin": game.gameMazeWin,
      "starting": game.starting,
      "initialSpeed": game.initialSpeed,
      "speed": game.speed,
      "snakes": copySnakes(game.snakes),
      "countBeforePlay": game.countBeforePlay,
      "numFruit": game.numFruit,
      "errorOccurred": game.errorOccurred,
      "searchingPlayers": false,
      "timerToDisplay": config.enableMaxTimeGame ? config.maxTimeGame / 1000 : -1
    });
  });
}

function cleanRooms() {
  const keys = Object.keys(games);
  const toRemove = [];

  for(let i = 0; i < keys.length; i++) {
    const game = games[keys[i]];

    if(game != null) {
      const players = Object.keys(game.players) + Object.keys(game.spectators);
      const nb = players.length;
  
      if(nb <= 0) {
        toRemove.push(keys[i]);

        if(game.gameEngine && game.gameEngine.kill) {
          game.gameEngine.kill();
        }
      }
    }
  }

  for(let i = 0; i < toRemove.length; i++) {
    games[toRemove[i]] = null;
  }
}

function gameMatchmaking(game, code) {
  if(game != null && games[code] != null && games[code].searchingPlayers) {
    let numberPlayers = game.players.length + games[code].numberAIToAdd;

    if(numberPlayers < getMaxPlayers(code)) {
      const toAdd = getMaxPlayers(code) - numberPlayers;

      for(let i = 0; i < game.spectators.length && i < toAdd; i++) {
        game.spectators[i].ready = true;
        game.players.push(game.spectators[i]);
        game.spectators[i] = null;
      }

      game.spectators = game.spectators.filter(spectator => spectator != null);
    }

    numberPlayers = game.players.length + games[code].numberAIToAdd;

    if(numberPlayers - games[code].numberAIToAdd > 0) {
      if(numberPlayers - games[code].numberAIToAdd > 1 && game.timeoutPlay == null) {
        game.timeStart = Date.now() + config.playerWaitTime + 1000;
    
        game.timeoutPlay = setTimeout(() => {
          game.timeoutPlay = null;
          startGame(code);
        }, config.playerWaitTime);
      } else if(numberPlayers - games[code].numberAIToAdd <= 1 && game.timeoutPlay != null) {
        clearTimeout(game.timeoutPlay);
        game.timeoutPlay = null;
        game.timeStart = 0;
      }
    
      io.to("room-" + code).emit("init", {
        "searchingPlayers": games[code].searchingPlayers,
        "timeStart": game.timeStart != null ? game.timeStart - Date.now() : 0,
        "playerNumber": numberPlayers,
        "maxPlayers": getMaxPlayers(code),
        "spectatorMode": false,
        "errorOccurred": game.gameEngine.errorOccurred,
        "onlineMaster": false,
        "onlineMode": true,
        "enableRetryPauseMenu": false,
        "countBeforePlay": game.countBeforePlay,
        "initialSpeed": game.gameEngine.initialSpeed,
        "speed": game.gameEngine.speed
      });

      io.to(game.players[0].id).emit("init", {
        "onlineMaster": true
      });
    }
  }
  
  setupSpectators(code);
}

async function startGame(code) {
  const game = games[code];

  if(game != null) {
    if(game.timeoutPlay != null) {
      clearTimeout(game.timeoutPlay);
      game.timeoutPlay = null;
    }

    game.searchingPlayers = false;
    game.started = true;
    game.gameEngine.snakes = [];
    game.gameEngine.grid.reset();
    game.gameEngine.grid.init();
  
    for(let i = 0; i < game.players.length; i++) {
      const username = game.players[i].username;

      game.players[i].snake = new Snake(null, null, game.gameEngine.grid, null, null, null, username);
      game.gameEngine.snakes.push(game.players[i].snake);

      io.to(game.players[i].id).emit("init", {
        "currentPlayer": (i + 1),
        "spectatorMode": false
      });
    }

    if(game.enableAI) {
      for(let i = 0; i < game.numberAIToAdd; i++) {
        const snakeAI = new Snake(null, null, game.gameEngine.grid, GameConstants.PlayerType.AI, game.levelAI);
        game.gameEngine.snakes.push(snakeAI);
      }
    }

    if(config.enableMaxTimeGame) {
      clearTimeout(game.timeoutMaxTimePlay);
      game.gameEngine.timeStart = Date.now() + 5000;
      game.timeoutMaxTimePlay = setTimeout(() => {
        game.gameEngine.stop(true);
      }, config.maxTimeGame + 5000);
    }

    io.to("room-" + code).emit("init", {
      "engineLoading": true
    });
  
    if(!game.alreadyInit) {
      await game.gameEngine.init();
      game.gameEngine.start();
      game.alreadyInit = true;
    } else {
      game.gameEngine.countBeforePlay = 3;
      await game.gameEngine.init();
      game.gameEngine.reset();
    }

    io.to("room-" + code).emit("init", {
      "engineLoading": false
    });

    setupSpectators(code);
  }
}

function setupSpectators(code) {
  const game = games[code];

  if(game != null) {
    for(let i = 0; i < game.spectators.length; i++) {
      io.to(game.spectators[i].id).emit("init", {
        "spectatorMode": true,
        "onlineMode": true,
        "enableRetryPauseMenu": false,
        "engineLoading": false
      });
    }
  }
}

function sendStatus(code) {
  if(config.enableMultithreading) {
    const game = games[code];

    if(game != null) {
      for(let i = 0; i < game.players.length; i++) {
        game.gameEngine.key(game.players[i].snake.lastKey, i + 1);
        if(game.players[i].snake.gameOver) game.gameEngine.setGameOver(i + 1);
      }
    }
  }
}

function exitGame(game, socket, code) {
  if(game) {
    logger.info("exit game (code: " + code + ") - username: " + Player.getUsernameSocket(socket) + " - ip: " + getIPSocketIO(socket.handshake) + " - socket: " + socket.id);

    if(Player.containsId(game.players, socket.id) && Player.getPlayer(game.players, socket.id).snake != null) {
      Player.getPlayer(game.players, socket.id).snake.gameOver = true;
      sendStatus(code);
    }
  
    socket.emit("kill", {
      "killed": true
    });
  
    socket.leave("room-" + code);
  
    if(Player.containsId(game.players, socket.id)) {
      game.players = game.players.filter(player => player.id != socket.id);
    }
  
    if(Player.containsId(game.spectators, socket.id)) {
      game.spectators = game.spectators.filter(spectator => spectator.id != socket.id);
    }

    cleanRooms();
    gameMatchmaking(game, code);
  }
}

function ipBanned(ip) {
  if(ip.substr(0, 7) == "::ffff:") {
    ip = ip.substr(7, ip.length);
  }

  return new Promise((resolve, reject) => {
    config.ipBan.forEach(ipBanned => {
      if(ipBanned == ip) {
        resolve();
      }
    });

    reject();
  });
}

function usernameBanned(username) {
  return new Promise((resolve, reject) => {
    config.usernameBan.forEach(usernameBanned => {
      if(username.toLowerCase().indexOf(usernameBanned.toLowerCase()) > -1) {
        resolve();
      }
    });

    reject();
  });
}

function usernameAlreadyInUse(username) {
  return new Promise((resolve, reject) => {
    tokens.forEach(token => {
      try {
        const otherUsername = jwt.verify(token, jsonWebTokenSecretKey).username;

        if(otherUsername) {
          if(otherUsername.toLowerCase().indexOf(username.toLowerCase()) > -1) {
            resolve();
          }
        }
      } catch(e) {}
    });

    reject();
  });
}

function verifyRecaptcha(response) {
  if(config.enableRecaptcha && config.recaptchaPrivateKey && config.recaptchaPrivateKey.trim() != "" && config.recaptchaPublicKey && config.recaptchaPublicKey.trim() != "") {
    const params = new URLSearchParams();
    params.append("secret", config.recaptchaPrivateKey);
    params.append("response", response);
  
    return new Promise((resolve, reject) => {
      fetch(config.recaptchaApiUrl, {
        method: "POST",
        body: params
      }).then(res => res.json()).then(json => {
        if(json && json.success) {
          resolve();
        } else {
          reject();
        }
      });
    });
  } else {
    return new Promise((resolve, reject) => {
      resolve();
    });
  }
}

function verifyFormAuthentication(body) {
  return new Promise((resolve, reject) => {
    verifyRecaptcha(body["g-recaptcha-response"]).then(() => {
      const username = body["username"];

      if(username && username.trim() != "" && username.length >= config.minCharactersUsername && username.length <= config.maxCharactersUsername) {
        usernameBanned(username).then(() => {
          reject("BANNED_USERNAME");
        }, () => {
          usernameAlreadyInUse(username).then(() => {
            reject("USERNAME_ALREADY_IN_USE");
          }, () => {
            resolve();
          });
        });
      } else {
        reject("BAD_USERNAME");
      }
    }, () => {
      reject("INVALID_RECAPTCHA");
    });
  });
}

app.engine("html", ejs.renderFile);
app.set("view engine", "html");
app.disable("view cache");

app.use(express.static("assets"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(i18n.init);

// Rate limiter
app.use("/authentication", rateLimit({
  windowMs: config.authentWindowMs,
  max: config.authentMaxRequest,
  validate: { trustProxy: false }
}));

// IP ban
app.use(function(req, res, next) {
  ipBanned(req.ip).then(() => {
    res.render(__dirname + "/views/banned.html", {
      contact: config.contactBan
    });
    res.end();
  }, () => {
    next()
  });
});

app.get("/", function(req, res) {
  res.render(__dirname + "/views/index.html", {
    version: config.version,
    engineVersion: GameConstants.Setting.APP_VERSION
  });
});

app.get("/authentication", function(req, res) {
  if(req.cookies && config.enableAuthentication) {
    let err = false;

    checkAuthenticationExpress(req).catch(() => err = true).finally(() => {
      res.render(__dirname + "/views/authentication.html", {
        publicKey: config.recaptchaPublicKey,
        enableRecaptcha: config.enableRecaptcha,
        errorRecaptcha: false,
        errorUsername: false,
        errorUsernameBanned: false,
        errorUsernameAlreadyInUse: false,
        success: false,
        authent: !err,
        locale: i18n.getLocale(req),
        min: config.minCharactersUsername,
        max: config.maxCharactersUsername,
        enableMaxTimeGame: config.enableMaxTimeGame,
        maxTimeGame: config.maxTimeGame
      });
    });
  } else {
    res.end();
  }
});

app.post("/authentication", function(req, res) {
  if(req.cookies && config.enableAuthentication) {
    let err = false;
    
    checkAuthenticationExpress(req).catch(() => err = true).finally(() => {
      if(err) {
        verifyFormAuthentication(req.body).then(() => {
          const username = req.body["username"];
          const id = req.query.id;

          const token = jwt.sign({
            username: username
          }, jsonWebTokenSecretKey, { expiresIn: config.authenticationTime / 1000 });
      
          res.cookie("token", token, { expires: new Date(Date.now() + config.authenticationTime), httpOnly: true, sameSite: "None", secure: (req.protocol == "https" ? true : false)  });

          res.render(__dirname + "/views/authentication.html", {
            publicKey: config.recaptchaPublicKey,
            enableRecaptcha: config.enableRecaptcha,
            errorRecaptcha: false,
            errorUsername: false,
            errorUsernameBanned: false,
            errorUsernameAlreadyInUse: false,
            success: true,
            authent: false,
            locale: i18n.getLocale(req),
            min: config.minCharactersUsername,
            max: config.maxCharactersUsername,
            enableMaxTimeGame: config.enableMaxTimeGame,
            maxTimeGame: config.maxTimeGame
          });

          logger.info("authentication - username: " + username + " - ip: " + req.ip);

          if(id != null) {
            io.to("" + id).emit("token", token);
          }
        }, (err) => {
          res.render(__dirname + "/views/authentication.html", {
            publicKey: config.recaptchaPublicKey,
            enableRecaptcha: config.enableRecaptcha,
            errorRecaptcha: err == "INVALID_RECAPTCHA",
            errorUsername: err == "BAD_USERNAME",
            errorUsernameBanned: err == "BANNED_USERNAME",
            errorUsernameAlreadyInUse: err == "USERNAME_ALREADY_IN_USE",
            success: false,
            authent: false,
            locale: i18n.getLocale(req),
            min: config.minCharactersUsername,
            max: config.maxCharactersUsername,
            enableMaxTimeGame: config.enableMaxTimeGame,
            maxTimeGame: config.maxTimeGame
          });
        });
      }
    });
  } else {
    res.end();
  }
});

app.get("/rooms", function(req, res) {
  const callbackName = req.query.callback;
  res.charset = "UTF-8";

  if(callbackName != null) {
    res.end(entities.encode(req.query.callback) + "(" + JSON.stringify(getRoomsData()) + ");");
  } else {
    res.json(getRoomsData());
  }
});

// Admin panel
function kickUser(socketId, token) {
  const sockets = io.of("/").sockets;

  if(sockets.get(socketId)) {
    logger.info("user kicked (socket: " + socketId + ") - ip: " + getIPSocketIO(sockets.get(socketId).handshake));
    sockets.get(socketId).disconnect(true);
    invalidateUserToken(token);
  }
}

function kickUsername(username) {
  tokens.forEach(token => {
    jwt.verify(token, jsonWebTokenSecretKey, function(err, data) {
      if(!err && data && data.username && data.username == username) {
        invalidateUserToken(token);
      }
    });
  });
}

function invalidateUserToken(token) {
  invalidatedUserTokens.push(token);

  for(let i = tokens.length - 1; i >= 0; i--) {
    if(tokens[i] == token) {
      tokens.splice(i, 1);
    }
  }
}

function banUserIP(socketId) {
  const sockets = io.of("/").sockets;

  if(sockets.get(socketId)) {
    let ip = getIPSocketIO(sockets.get(socketId).handshake);

    if(ip && ip.substr(0, 7) == "::ffff:") {
      ip = ip.substr(7, ip.length);
    }

    if(ip) {
      config.ipBan.push(ip);
      logger.info("user banned (socket: " + socketId + ") - ip: " + ip);
    }

    updateConfigToFile();
  }
}

function banUserName(token) {
  jwt.verify(token, jsonWebTokenSecretKey, function(err, data) {
    if(!err && data) {
      if(data.username) {
        config.usernameBan.push(data.username);
        logger.info("username banned (" + data.username + ")");
      }

      updateConfigToFile();
    }
  });
}

function unbanUsername(value) {
  config.usernameBan = config.usernameBan.filter(username => username != value);
  logger.info("username unbanned (" + value + ")");
  updateConfigToFile();
}

function unbanIP(value) {
  config.ipBan = config.ipBan.filter(ip => ip != value);
  logger.info("ip unbanned (" + value + ")");
  updateConfigToFile();
}

function manualUsernameBan(value) {
  config.usernameBan.push(value);
  logger.info("username banned (" + value + ")");
  updateConfigToFile();
}

function manualIPBan(value) {
  config.ipBan.push(value);
  logger.info("ip banned (" + value + ")");
  updateConfigToFile();
}

function resetLog() {
  fs.writeFileSync(config.logFile, "", "UTF-8");
  logger.info("log file reseted");
}

function resetErrorLog() {
  fs.writeFileSync(config.errorLogFile, "", "UTF-8");
  logger.info("error log file reseted");
}

function updateConfig(value) {
  try {
    const parsed = JSON.parse(value);
    const keys = Object.keys(parsed);

    for(let i = 0; i < keys.length; i++) {
      config[keys[i]] = parsed[keys[i]];
    }

    updateConfigToFile();
    logger.info("updated config file");
  } catch(e) {
    logger.info("update config file - exception: " + e);
  }
}

function verifyFormAuthenticationAdmin(body) {
  return new Promise((resolve, reject) => {
    verifyRecaptcha(body["g-recaptcha-response"]).then(() => {
      const username = body["username"];
      const password = body["password"];
      
      const accounts = config.adminAccounts;

      if(accounts) {
        const usernames = Object.keys(accounts);

        if(usernames.includes(username)) {
          const hashPassword = accounts[username]["password"];
          const enteredPasswordHash = require("crypto").createHash("sha512").update(password).digest("hex");

          if(hashPassword === enteredPasswordHash) {
            resolve();
          } else {
            reject("INVALID");
          }
        } else {
          reject("INVALID");
        }
      }
    }, () => {
      reject("INVALID_RECAPTCHA");
    });
  });
}

const csrfSecret = generateRandomJsonWebTokenSecretKey(jsonWebTokenSecretKeyAdmin);
const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => csrfSecret,
  getSessionIdentifier: (req) => req.cookies.tokenAdmin || randomUUID(),
  getCsrfTokenFromRequest: (req) => {
    return (
      req.headers["x-csrf-token"] ||
      req.body?._csrf ||
      req.query?._csrf
    );
  },
  cookieName: productionMode ? "__Host-snakeia-server.x-csrf-token" : "snakeia-server.x-csrf-token",
  cookieOptions: {
    sameSite: productionMode ? "strict" : "lax",
    path: "/",
    secure: productionMode
  }
});

app.get("/admin", doubleCsrfProtection, function(req, res) {
  if(req.cookies) {
    jwt.verify(req.cookies.tokenAdmin, jsonWebTokenSecretKeyAdmin, function(err, data) {
      if(invalidatedAdminTokens.includes(req.cookies.tokenAdmin)) err = true;
      
      const usernames = Object.keys(config.adminAccounts);
      const authenticated = !err && data && data.username && usernames.includes(data.username);
      let role = "none";

      if(authenticated) {
        role = config.adminAccounts[data.username]["role"] || "moderator";
      }
      
      fs.readFile(config.logFile, "UTF-8", function(e1, logFile) {
        fs.readFile(config.errorLogFile, "UTF-8", function(e2, errorLogFile) {
          res.render(__dirname + "/views/admin.html", {
            publicKey: config.recaptchaPublicKey,
            enableRecaptcha: config.enableRecaptcha,
            authent: authenticated,
            role: role,
            username: authenticated ? data.username : "",
            success: false,
            errorAuthent: false,
            errorRecaptcha: false,
            locale: i18n.getLocale(req),
            games: games,
            io: io,
            config: config,
            csrfToken: generateCsrfToken(req, res, { overwrite: true, validateOnReuse: true }),
            serverLog: logFile,
            errorLog: errorLogFile,
            getIPSocketIO: getIPSocketIO
          });
        });
      });
    });
  } else {
    res.end();
  }
});

function adminAction(req, res, action) {
  if(req.cookies) {
    jwt.verify(req.cookies.tokenAdmin, jsonWebTokenSecretKeyAdmin, function(err, data) {
      if(invalidatedAdminTokens.includes(req.cookies.tokenAdmin)) err = true;

      const usernames = Object.keys(config.adminAccounts);
      const authenticated = !err && data && data.username && usernames.includes(data.username);

      if(authenticated) {
        const username = data.username;
        const role = config.adminAccounts[username]["role"] || "moderator";

        if(action == "disconnect") {
          invalidatedAdminTokens.push(req.cookies.tokenAdmin);
          res.cookie("tokenAdmin", { expires: -1 });
          res.redirect("/admin");
          return;
        } else if(action) {
          const socket = req.body.socket;
          const token = req.body.token;
          const value = req.body.value;

          switch(action) {
            case "kick":
              kickUser(socket, token);
              break;
            case "banIP":
              if(value) {
                manualIPBan(value);
              } else {
                banUserIP(socket);
                kickUser(socket, token);
              }
              break;
            case "banUserName":
              if(value) {
                manualUsernameBan(value);
                kickUsername(value);
              } else {
                banUserName(token);
                kickUser(socket, token);
              }
              break;
            case "banIPUserName":
              banUserIP(socket);
              banUserName(token);
              kickUser(socket, token);
              break;
            case "unbanUsername":
              unbanUsername(value);
              break;
            case "unbanIP":
              unbanIP(value);
              break;
            case "resetLog":
              if(role === "administrator") resetLog();
              break;
            case "resetErrorLog":
              if(role === "administrator") resetErrorLog();
              break;
            case "updateConfig":
              if(role === "administrator") updateConfig(value);
              break;
          }

          res.redirect("/admin");
          return;
        }
      }

      res.redirect("/admin");
      return;
    });
  } else {
    res.end();
  }
}

const jsonParser = bodyParser.json();

app.post("/admin/:action", jsonParser, doubleCsrfProtection, function(req, res) {
  adminAction(req, res, req.params.action);
});

app.use(function (err, req, res, next) {
  if(err.code !== "EBADCSRFTOKEN") return next(err);
  res.status(403);
  res.send("Error: invalid CSRF token");
});

const adminRateLimiter = rateLimit({
  windowMs: config.authentWindowMs,
  max: config.authentMaxRequest,
  validate: { trustProxy: false }
});

app.post("/admin", adminRateLimiter, function(req, res) {
  if(req.cookies) {
    jwt.verify(req.cookies.tokenAdmin, jsonWebTokenSecretKeyAdmin, function(err, data) {
      if(invalidatedAdminTokens.includes(req.cookies.tokenAdmin)) res = true;

      if(err) {
        verifyFormAuthenticationAdmin(req.body).then(() => {
          const username = req.body["username"];

          const token = jwt.sign({
            username: username
          }, jsonWebTokenSecretKeyAdmin, { expiresIn: config.authenticationTime / 1000 });
      
          res.cookie("tokenAdmin", token, { expires: new Date(Date.now() + config.authenticationTime), httpOnly: true, sameSite: "strict", secure: (req.protocol == "https" ? true : false)  });
          res.redirect("/admin");
          logger.info("admin authent - username: " + username + " - ip: " + req.ip);
          return;
        }, (err) => {
          res.render(__dirname + "/views/admin.html", {
            publicKey: config.recaptchaPublicKey,
            enableRecaptcha: config.enableRecaptcha,
            authent: false,
            errorAuthent: true,
            errorRecaptcha: err == "INVALID_RECAPTCHA",
            locale: i18n.getLocale(req),
            games: null,
            io: null,
            config: null,
            csrfToken: null,
            serverLog: null,
            errorLog: null,
            getIPSocketIO: getIPSocketIO
          });
        });
      }
    });
  } else {
    res.end();
  }
});

io.use(ioCookieParser());

function getIPSocketIO(req) {
  let ipAddress;

  if(req && req.headers) {
    const forwardedIpsStr = req.headers["x-forwarded-for"];
  
    if(forwardedIpsStr && forwardedIpsStr !== undefined && config.proxyMode) {
      const forwardedIps = forwardedIpsStr.split(",");
      ipAddress = forwardedIps[0];
    }
  
    if(!ipAddress) {
      ipAddress = req.address;
    }
  }

  return ipAddress;
}

function checkAuthentication(token) {
  return new Promise((resolve, reject) => {
    if(!config.enableAuthentication) {
      resolve();
    } else {
      if(token && invalidatedUserTokens.includes(token)) reject();
  
      jwt.verify(token, jsonWebTokenSecretKey, function(err, data) {
        if(!err) {
          resolve(token);
        } else {
          reject();
        }
      });
    }
  });
}

function checkAuthenticationSocket(socket) {
  return checkAuthentication(socket?.handshake?.auth?.token || socket?.handshake?.query?.token || socket?.request?.cookies?.token);
}

function checkAuthenticationExpress(req) {
  return checkAuthentication(req.cookies.token);
}

const checkBanned = function(socket, next) {
  ipBanned(getIPSocketIO(socket.handshake)).then(() => {
    next(new Error(GameConstants.Error.BANNED));
  }, () => {
    next();
  });
};

io.use(checkBanned);

io.of("/rooms").use(ioCookieParser()).use(checkBanned).on("connection", function(socket) {
  checkAuthenticationSocket(socket).then(() => {
    socket.emit("rooms", {
      rooms: getRoomsData(),
      serverVersion: config.version,
      version: GameConstants.Setting.APP_VERSION,
      settings: {
        maxRooms: config.maxRooms,
        minGridSize: config.minGridSize,
        maxGridSize: config.maxGridSize,
        minSpeed: config.minSpeed,
        maxSpeed: config.maxSpeed,
        enableAI: config.enableAI
      }
    });
  }, () => {
    socket.emit("authent", GameConstants.Error.AUTHENTICATION_REQUIRED);
  });
});

io.of("/createRoom").use(ioCookieParser()).use(checkBanned).on("connection", function(socket) {
  socket.on("create", function(data) {
    checkAuthenticationSocket(socket).then(() => {
      createRoom(data, socket);
    }, () => {
      socket.emit("authent", GameConstants.Error.AUTHENTICATION_REQUIRED);
    });
  });
});

io.on("connection", function(socket) {
  checkAuthenticationSocket(socket).then((token) => {
    socket.emit("authent", GameConstants.GameState.AUTHENTICATION_SUCCESS);
    tokens.push(token);

    socket.on("join-room", function(data) {
      const code = data.code;
      const version = data.version;
      const game = games[code];
  
      if(game != null && !Player.containsId(game.players, socket.id) && !Player.containsId(game.spectators, socket.id) && !Player.containsToken(game.players, token) && !Player.containsToken(game.spectators, token) && !Player.containsTokenAllGames(token, games) && !Player.containsIdAllGames(socket.id, games)) {
        socket.join("room-" + code);
  
        if(game.players.length + game.numberAIToAdd >= getMaxPlayers(code) || game.started) {
          game.spectators.push(new Player(token, socket.id, null, false, version));
        } else {
          game.players.push(new Player(token, socket.id, null, false, version));
        }
  
        socket.emit("join-room", {
          success: true
        });
      
        socket.once("start", () => {
          if(Player.containsId(game.players, socket.id)) {
            Player.getPlayer(game.players, socket.id).ready = true;
          }
        
          if(game.started) {
            socket.emit("init", {
              "paused": game.gameEngine.paused,
              "isReseted": game.gameEngine.isReseted,
              "exited": game.gameEngine.exited,
              "snakes": copySnakes(game.gameEngine.snakes),
              "grid": game.gameEngine.grid,
              "numFruit": game.gameEngine.numFruit,
              "ticks": game.gameEngine.ticks,
              "scoreMax": game.gameEngine.scoreMax,
              "gameOver": game.gameEngine.gameOver,
              "gameFinished": game.gameEngine.gameFinished,
              "gameMazeWin": game.gameEngine.gameMazeWin,
              "starting": game.gameEngine.starting,
              "initialSpeed": game.gameEngine.initialSpeed,
              "speed": game.gameEngine.speed,
              "offsetFrame": game.gameEngine.speed * GameConstants.Setting.TIME_MULTIPLIER,
              "confirmReset": false,
              "confirmExit": false,
              "getInfos": false,
              "getInfosGame": false,
              "errorOccurred": game.gameEngine.errorOccurred,
              "timerToDisplay": config.enableMaxTimeGame ? (config.maxTimeGame - (Date.now() - game.timeStart)) / 1000 : -1,
              "countBeforePlay": game.gameEngine.countBeforePlay,
              "aiStuck": game.gameEngine.aiStuck,
              "precAiStuck": false
            });
          } else {
            socket.emit("init", {
              "enablePause": game.gameEngine.enablePause,
              "enableRetry": game.gameEngine.enableRetry,
              "progressiveSpeed": game.gameEngine.progressiveSpeed,
              "offsetFrame": game.gameEngine.speed * GameConstants.Setting.TIME_MULTIPLIER
            });
          }
  
          gameMatchmaking(game, code);
  
          socket.on("start", () => {
            socket.emit("start", {
              "paused": false
            });
          });
        });
      
        socket.once("exit", () => {
          exitGame(game, socket, code);
        });
      
        socket.once("kill", () => {
          exitGame(game, socket, code);
        });
      
        socket.on("key", function(key) {
          if(game != null && Player.containsId(game.players, socket.id) && Player.getPlayer(game.players, socket.id).snake) {
            Player.getPlayer(game.players, socket.id).snake.lastKey = key;
            sendStatus(code);
          }
        });
  
        socket.on("pause", () => {
          socket.emit("pause", {
            "paused": true
          });
        });
  
        socket.on("reset", () => {
          if(!game.started) {
            gameMatchmaking(game, code);
  
            socket.emit("reset", {
              "gameOver": false,
              "gameFinished": false,
              "scoreMax": false,
              "gameMazeWin": false
            });
          }
        });
  
        socket.once("error", () => {
          exitGame(game, socket, code);
        });
  
        socket.once("disconnect", () => {
          exitGame(game, socket, code);
        });
  
        socket.on("forceStart", () => {
          if(game != null && Player.containsId(game.players, socket.id) && game.players[0].id == socket.id && !game.started) {
            startGame(code);
          }
        });
  
        logger.info("join room (code: " + code + ") - username: " + Player.getUsernameSocket(socket) + " - ip: " + getIPSocketIO(socket.handshake) + " - socket: " + socket.id);
      } else {
        if(games[code] == null) {
          socket.emit("join-room", {
            success: false,
            errorCode: GameConstants.Error.ROOM_NOT_FOUND
          });
        } else if(Player.containsId(game.players, socket.id) || Player.containsId(game.spectators, socket.id) || Player.containsToken(game.players, token) || Player.containsToken(game.spectators, token)) {
          socket.emit("join-room", {
            success: false,
            errorCode: GameConstants.Error.ROOM_ALREADY_JOINED
          });
        } else if(Player.containsTokenAllGames(token, games) || Player.containsIdAllGames(socket.id, games)) {
          socket.emit("join-room", {
            success: false,
            errorCode: GameConstants.Error.ALREADY_CREATED_ROOM
          });
        }
      }
    });
  }, () => {
    socket.emit("authent", GameConstants.Error.AUTHENTICATION_REQUIRED);
  });
});

http.listen(config.port, () => {
  console.log("listening on *:" + config.port);
});