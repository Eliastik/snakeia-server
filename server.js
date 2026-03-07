/*
 * Copyright (C) 2020-2026 Eliastik (eliastiksofts.com)
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
const app            = express();
const fs             = require("fs");
const httpLib        = require("http");
const httpsLib       = require("https");
let server           = null;
let io               = null;
const entities       = require("html-entities");
const ejs            = require("ejs");
const { SignJWT,
  jwtVerify,
  EncryptJWT,
  jwtDecrypt }       = require("jose");
const fetch          = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const cookieParser   = require("cookie-parser");
const ioCookieParser = require("socket.io-cookie-parser");
const i18n           = require("i18n");
const rateLimit      = require("express-rate-limit");
const winston        = require("winston");
const { doubleCsrf } = require("csrf-csrf");
const bodyParser     = require("body-parser");
const node_config    = require("config");
const { randomUUID,
  randomBytes, createSecretKey
}                    = require("crypto");

process.env["ALLOW_CONFIG_MUTATIONS"] = true;
let config = node_config.get("ServerConfig"); // Server configuration (see default config file config.json)

// Load config file
const configSources = node_config.util.getConfigSources();
const configFile = configSources[configSources.length - 1].name;

config.port = process.env.PORT || config.port;

const jsonWebTokenSecretKey = createSecretKey(
  Buffer.from(config.jsonWebTokenSecretKey?.trim() || randomBytes(32))
);

const jsonWebTokenSecretKeyAdmin = createSecretKey(
  Buffer.from(config.jsonWebTokenSecretKeyAdmin?.trim() || randomBytes(32))
);

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

// Initialize server
if(config.enableHttps) {
  const certPath = config.httpsCertFile;
  const keyPath = config.httpsKeyFile;

  try {
    const key = fs.readFileSync(keyPath);
    const cert = fs.readFileSync(certPath);

    server = httpsLib.createServer({ key, cert }, app);
  } catch(e) {
    logger.error("failed to initialize HTTPS server. Fallback to HTTP server.", e);
    server = httpLib.createServer(app);
  }
} else {
  server = httpLib.createServer(app);
}

io = require("socket.io")(server, {
  cors: {
    origin: true,
    credentials: true
  },
  allowEIO3: true
});

// Game modules
const snakeia        = require("snakeia");
const Snake          = snakeia.Snake;
const Grid           = snakeia.Grid;
const GameConstants  = snakeia.GameConstants;
const GameEngine     = config.enableMultithreading ? require("./GameEngineMultithreadingController")(logger) : snakeia.GameEngine;
const Player         = require("./Player");

const games = {}; // Contains all the games processed by the server
const tokens = new Map(); // User tokens
const socketSessions = new Map();
const invalidatedUserTokens = new Set(); // Invalidated user tokens
const invalidatedAdminTokens = new Set(); // Invalidated admin tokens

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
  let roomKey;

  do {
    const length = 8;
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const charsLength = chars.length;
  
    const bytes = randomBytes(length);

    roomKey = "";
    
    for(let i = 0; i < length; i++) {
      roomKey += chars[bytes[i] % charsLength];
    }
  } while(roomKey in games);

  return roomKey;
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

async function createRoom(data, socket) {
  if(Object.keys(games).filter(key => games[key] != null).length < config.maxRooms && !Player.containsTokenAllGames(Player.getSocketToken(socket), games) && !Player.containsIdAllGames(socket.id, games)) {
    let heightGrid = 20;
    let widthGrid = 20;
    let borderWalls = false;
    let generateWalls = false;
    let speed = 8;
    let enableAI = false;
    let levelAI = null;
    let validSettings = true;
    let privateGame = false;
  
    if(data.heightGrid == null || isNaN(data.heightGrid) || !Number.isInteger(data.heightGrid) || data.heightGrid < config.minGridSize || data.heightGrid > config.maxGridSize) {
      validSettings = false;
    } else {
      heightGrid = data.heightGrid;
    }
  
    if(data.widthGrid == null || isNaN(data.widthGrid) || !Number.isInteger(data.widthGrid) || data.widthGrid < config.minGridSize || data.widthGrid > config.maxGridSize) {
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
      if(data.customSpeed == null || isNaN(data.customSpeed) || !Number.isInteger(data.customSpeed) || data.customSpeed < config.minSpeed || data.customSpeed > config.maxSpeed) {
        validSettings = false;
      } else {
        speed = data.customSpeed;
      }
    } else if(data.speed == null || isNaN(data.speed) || !Number.isInteger(data.speed) || data.speed < config.minSpeed || data.speed > config.maxSpeed) {
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
      const game = new GameEngine(grid, [], speed, null, null, null, null, null, {
        modelListAPIURL: config.aiUltraAPIURL,
        modelID: config.aiUltraCustomModelURL ? "custom" : config.aiUltraModelID,
        customURL: config.aiUltraCustomModelURL
      });
      
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

      logger.info("room creation (code: " + code + ") - username: " + (await Player.getUsernameSocket(socket, jsonWebTokenSecretKey)) + " - ip: " + getIPSocketIO(socket.handshake) + " - socket: " + socket.id, {
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
    if(Player.containsTokenAllGames(Player.getSocketToken(socket), games) || Player.containsIdAllGames(socket.id, games)) {
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
          snakeCopy.lastTail = structuredClone(snake.lastTail);
        }
  
        if(snake.lastHead) {
          snakeCopy.lastHead = structuredClone(snake.lastHead);
        }
  
        snakeCopy.lastTailMoved = snake.lastTailMoved;
        snakeCopy.lastHeadMoved = snake.lastHeadMoved;
        snakeCopy.name = snake.name;
        snakeCopy.player = snake.player;
  
        if(snake.queue) {
          snakeCopy.queue = structuredClone(snake.queue);
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
      "getInfosControls": false,
      "getInfosGoal": false,
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
      "getInfosControls": false,
      "getInfosGoal": false,
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
      "getInfosControls": false,
      "getInfosGoal": false,
      "errorOccurred": game.errorOccurred
    });
  });

  game.onContinue(() => {
    io.to("room-" + code).emit("continue", {
      "confirmReset": false,
      "confirmExit": false,
      "getInfos": false,
      "getInfosGame": false,
      "getInfosControls": false,
      "getInfosGoal": false,
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
      "getInfosControls": false,
      "getInfosGoal": false,
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
      "getInfosControls": false,
      "getInfosGoal": false,
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
      "getInfosControls": false,
      "getInfosGoal": false,
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
      const players = Object.keys(game.players).length + Object.keys(game.spectators).length;
  
      if(players <= 0) {
        toRemove.push(keys[i]);

        if(game.gameEngine && game.gameEngine.kill) {
          game.gameEngine.kill();
        }
      }
    }
  }

  for(let i = 0; i < toRemove.length; i++) {
    delete games[toRemove[i]];
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
        "speed": game.gameEngine.speed,
        "errorOccured": game.gameEngine.errorOccured
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
      "errorOccurred": game.gameEngine.errorOccurred,
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

async function exitGame(game, socket, code) {
  if(game) {
    logger.info("exit game (code: " + code + ") - username: " + (await Player.getUsernameSocket(socket, jsonWebTokenSecretKey)) + " - ip: " + getIPSocketIO(socket.handshake) + " - socket: " + socket.id);

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

  return config.ipBan.includes(ip);
}

function usernameBanned(username) {
  for(const usernameBanned of config.usernameBan) {
    if(username.toLowerCase().indexOf(usernameBanned.toLowerCase()) > -1) {
      return true;
    }
  }

  return false;
}

async function getUsernameToken(token, secretKey) {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload.username ?? null;
  } catch {
    return null;
  }
}

async function usernameAlreadyInUse(username) {
  if(!tokens.has(username.toLowerCase())) {
    return false;
  }

  try {
    const token = tokens.get(username.toLowerCase());
    const result = await getUsernameToken(token, jsonWebTokenSecretKey);

    return result != null;
  } catch(e) {
    logger.error(e);
    return false;
  }
}

async function verifyRecaptcha(response) {
  if(config.enableRecaptcha && config.recaptchaPrivateKey && config.recaptchaPrivateKey.trim() != "" && config.recaptchaPublicKey && config.recaptchaPublicKey.trim() != "") {
    const params = new URLSearchParams();

    params.append("secret", config.recaptchaPrivateKey);
    params.append("response", response);

    try {
      const fetchResponse = await fetch(config.recaptchaApiUrl, {
        method: "POST",
        body: params
      });

      const responseBody = await fetchResponse.json();

      if(responseBody && responseBody.success) {
        return Promise.resolve();
      } 
      
      return Promise.reject();
    } catch(e) {
      return Promise.reject();
    }
  }
  
  return Promise.resolve();
}

async function verifyFormAuthentication(body) {
  try {
    await verifyRecaptcha(body["g-recaptcha-response"]);
  } catch {
    throw "INVALID_RECAPTCHA";
  }

  const username = body["username"];

  if(!username || username.trim() === "" || username.length < config.minCharactersUsername || username.length > config.maxCharactersUsername) {
    throw "BAD_USERNAME";
  }

  if(usernameBanned(username)) {
    throw "BANNED_USERNAME";
  }

  if(await usernameAlreadyInUse(username)) {
    throw "USERNAME_ALREADY_IN_USE";
  }
}

app.engine("html", ejs.renderFile);
app.set("view engine", "html");
app.disable("view cache");

app.use(express.static("assets"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(i18n.init);

const csrfSecretAdmin = generateRandomJsonWebTokenSecretKey(jsonWebTokenSecretKeyAdmin);
const { doubleCsrfProtection: doubleCsrfProtectionAdmin, generateCsrfToken: generateCsrfTokenAdmin } = doubleCsrf({
  getSecret: () => csrfSecretAdmin,
  getSessionIdentifier: (req) => req.cookies.tokenAdmin || randomUUID(),
  getCsrfTokenFromRequest: (req) => {
    return (
      req.headers["x-csrf-token"] ||
      req.body?._csrf ||
      req.query?._csrf
    );
  },
  cookieName: productionMode ? "__Host-snakeia-server.x-csrf-token-admin" : "snakeia-server.x-csrf-token-admin",
  cookieOptions: {
    sameSite: productionMode ? "strict" : "lax",
    path: "/",
    secure: productionMode
  }
});

const csrfSecretUser = generateRandomJsonWebTokenSecretKey(jsonWebTokenSecretKeyAdmin);
const { doubleCsrfProtection: doubleCsrfProtectionUserAuthent, generateCsrfToken: generateCsrfTokenUserAuthent } = doubleCsrf({
  getSecret: () => csrfSecretUser,
  getSessionIdentifier: (req) => req.cookies.sessionId || randomUUID(),
  getCsrfTokenFromRequest: (req) => {
    return (
      req.headers["x-csrf-token"] ||
      req.body?._csrf ||
      req.query?._csrf
    );
  },
  cookieName: productionMode ? "__Host-snakeia-server.x-csrf-token-user" : "snakeia-server.x-csrf-token-user",
  cookieOptions: {
    sameSite: productionMode ? "strict" : "lax",
    path: "/authentication",
    secure: productionMode
  }
});

// Rate limiter
app.use("/authentication", rateLimit({
  windowMs: config.authentWindowMs,
  max: config.authentMaxRequest,
  validate: { trustProxy: false }
}));

// IP ban
app.use(function(req, res, next) {
  if(ipBanned(req.ip)) {
    return res.render(__dirname + "/views/banned.html", {
      contact: config.contactBan,
      theme: req.query.theme
    });
  }

  next();
});

app.get("/", function(req, res) {
  res.render(__dirname + "/views/index.html", {
    version: config.version,
    engineVersion: GameConstants.Setting.APP_VERSION,
    theme: req.query.theme
  });
});

app.get("/authentication", async (req, res) => {
  if(!req.cookies || !config.enableAuthentication) {
    return res.end();
  }

  const authenticated = await checkAuthenticationExpress(req).then(() => true).catch(() => false);

  let sessionId = req.cookies.sessionId;

  if(!sessionId) {
    sessionId = randomUUID();

    res.cookie("sessionId", sessionId, {
      httpOnly: true,
      sameSite: "Lax",
      secure: req.protocol === "https"
    });
  }

  res.render(__dirname + "/views/authentication.html", {
    publicKey: config.recaptchaPublicKey,
    enableRecaptcha: config.enableRecaptcha,
    errorRecaptcha: false,
    errorUsername: false,
    errorUsernameBanned: false,
    errorUsernameAlreadyInUse: false,
    success: false,
    authent: authenticated,
    locale: i18n.getLocale(req),
    min: config.minCharactersUsername,
    max: config.maxCharactersUsername,
    enableMaxTimeGame: config.enableMaxTimeGame,
    maxTimeGame: config.maxTimeGame,
    theme: req.query.theme,
    csrfToken: generateCsrfTokenUserAuthent(req, res, { overwrite: true, validateOnReuse: true }),
  });

  if(authenticated) {
    sendTokenToSocket(req, getExpressUserToken(req));
  }
});

app.post("/authentication", doubleCsrfProtectionUserAuthent, async (req, res) => {
  if(!req.cookies || !config.enableAuthentication) {
    return res.end();
  }

  const alreadyAuthenticated = await checkAuthenticationExpress(req).then(() => true).catch(() => false);

  if(alreadyAuthenticated) {
    return res.end();
  }

  let formError = null;

  await verifyFormAuthentication(req.body).catch(e => formError = e);

  if(formError) {
    return res.render(__dirname + "/views/authentication.html", {
      publicKey: config.recaptchaPublicKey,
      enableRecaptcha: config.enableRecaptcha,
      errorRecaptcha: formError == "INVALID_RECAPTCHA",
      errorUsername: formError == "BAD_USERNAME",
      errorUsernameBanned: formError == "BANNED_USERNAME",
      errorUsernameAlreadyInUse: formError == "USERNAME_ALREADY_IN_USE",
      success: false,
      authent: false,
      locale: i18n.getLocale(req),
      min: config.minCharactersUsername,
      max: config.maxCharactersUsername,
      enableMaxTimeGame: config.enableMaxTimeGame,
      maxTimeGame: config.maxTimeGame,
      theme: req.query.theme,
      csrfToken: generateCsrfTokenUserAuthent(req, res, { overwrite: true, validateOnReuse: true })
    });
  }

  const username = req.body["username"];

  const token = await new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor(config.authenticationTime / 1000) + "s")
    .setIssuedAt()
    .sign(jsonWebTokenSecretKey);

  generateTokenCookie(res, token, req);

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
    maxTimeGame: config.maxTimeGame,
    theme: req.query.theme,
    csrfToken: null
  });

  logger.info("authentication - username: " + username + " - ip: " + req.ip);

  sendTokenToSocket(req, token);
});

function generateTokenCookie(res, token, req) {
  res.cookie("token", token, {
    expires: new Date(Date.now() + config.authenticationTime),
    httpOnly: true,
    sameSite: "None",
    secure: req.protocol === "https"
  });
}

function sendTokenToSocket(req, token) {
  const sessionId = req.cookies.sessionId;
  const socketId = socketSessions.get(sessionId);

  if(socketId != null) {
    io.to("" + socketId).emit("token", token);
  }
}

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
  const usernameToken = tokens.get(username.toLowerCase());

  if(usernameToken) {
    invalidateUserToken(username, usernameToken);
  }
}

function invalidateUserToken(username, token) {
  invalidatedUserTokens.add(token);
  tokens.delete(username.toLowerCase());
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

async function banUserName(token) {
  try {
    const { payload } = await jwtVerify(token, jsonWebTokenSecretKey);
    
    if(payload.username) {
      config.usernameBan.push(payload.username);
      logger.info("username banned (" + payload.username + ")");
      updateConfigToFile();
    }
  } catch {}
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

async function verifyFormAuthenticationAdmin(body) {
  try {
    await verifyRecaptcha(body["g-recaptcha-response"]);
  } catch {
    throw "INVALID_RECAPTCHA";
  }

  const { username, password } = body;
  const accounts = config.adminAccounts;

  if(!accounts || !Object.keys(accounts).includes(username)) {
    throw "INVALID";
  }

  const hashPassword = accounts[username]["password"];
  const enteredPasswordHash = require("crypto").createHash("sha512").update(password).digest("hex");

  if(hashPassword !== enteredPasswordHash) {
    throw "INVALID";
  }
}

async function verifyAdminToken(req) {
  const token = req.cookies?.tokenAdmin;

  if(!token || invalidatedAdminTokens.has(token)) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, jsonWebTokenSecretKeyAdmin);
    const usernames = Object.keys(config.adminAccounts);

    if(payload.username && usernames.includes(payload.username)) {
      return payload;
    }

    return null;
  } catch {
    return null;
  }
}

app.get("/admin", doubleCsrfProtectionAdmin, async (req, res) => {
  if(!req.cookies) {
    return res.end();
  }

  const payload = await verifyAdminToken(req);
  const authenticated = payload != null;
  const role = authenticated ? (config.adminAccounts[payload.username]["role"] || "moderator") : "none";

  const [logFile, errorLogFile] = await Promise.all([
    fs.promises.readFile(config.logFile, "UTF-8").catch(() => ""),
    fs.promises.readFile(config.errorLogFile, "UTF-8").catch(() => "")
  ]);
      
  res.render(__dirname + "/views/admin.html", {
    publicKey: config.recaptchaPublicKey,
    enableRecaptcha: config.enableRecaptcha,
    authent: authenticated,
    role: role,
    username: authenticated ? payload.username : "",
    success: false,
    errorAuthent: false,
    errorRecaptcha: false,
    locale: i18n.getLocale(req),
    games: games,
    io: io,
    config: config,
    csrfToken: generateCsrfTokenAdmin(req, res, { overwrite: true, validateOnReuse: true }),
    serverLog: logFile,
    errorLog: errorLogFile,
    getIPSocketIO: getIPSocketIO,
    theme: req.query.theme
  });
});

async function adminAction(req, res, action) {
  if(!req.cookies) {
    return res.end();
  }

  const payload = await verifyAdminToken(req);

  if(!payload) {
    return res.redirect("/admin");
  }

  const role = config.adminAccounts[payload.username]["role"] || "moderator";

  if(action === "disconnect") {
    invalidatedAdminTokens.add(req.cookies.tokenAdmin);
    res.clearCookie("tokenAdmin");

    return res.redirect("/admin");
  }

  const { socket, token, value } = req.body;

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
}

const jsonParser = bodyParser.json();

app.post("/admin/:action", jsonParser, doubleCsrfProtectionAdmin, function(req, res) {
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

app.post("/admin", adminRateLimiter, async (req, res) => {
  if(!req.cookies) {
    return res.end();
  }

  const payload = await verifyAdminToken(req);

  if(payload) {
    return res.redirect("/admin");
  }

  try {
    await verifyFormAuthenticationAdmin(req.body);
  } catch(err) {
    return res.render(__dirname + "/views/admin.html", {
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
      getIPSocketIO: getIPSocketIO,
      theme: req.query.theme
    });
  }

  const username = req.body["username"];

  const token = await new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor(config.authenticationTime / 1000) + "s")
    .setIssuedAt()
    .sign(jsonWebTokenSecretKeyAdmin);

  res.cookie("tokenAdmin", token, {
    expires: new Date(Date.now() + config.authenticationTime),
    httpOnly: true,
    sameSite: "strict",
    secure: req.protocol === "https"
  });

  res.redirect("/admin");

  logger.info("admin authent - username: " + username + " - ip: " + req.ip);
});

io.use(ioCookieParser());

function getIPSocketIO(req) {
  if(req?.headers) {
    const forwardedIpsStr = req.headers["x-forwarded-for"];

    if(forwardedIpsStr && config.proxyMode) {
      const forwardedIps = forwardedIpsStr.split(",").map(ip => ip.trim());
      const index = forwardedIps.length - config.numberOfProxies;

      if(index >= 0) {
        return forwardedIps[index];
      }
    }

    return req.address;
  }
}

async function checkAuthentication(token) {
  if(!config.enableAuthentication) {
    return;
  }

  if(!token || invalidatedUserTokens.has(token)) {
    throw "UNAUTHORIZED";
  }

  try {
    await jwtVerify(token, jsonWebTokenSecretKey);
    return token;
  } catch {
    throw "UNAUTHORIZED";
  }
}

function checkAuthenticationSocket(socket) {
  return checkAuthentication(Player.getSocketToken(socket));
}

function getExpressUserToken(req) {
  return req.cookies.token;
}

function checkAuthenticationExpress(req) {
  return checkAuthentication(getExpressUserToken(req));
}

const checkBanned = function(socket, next) {
  if(ipBanned(getIPSocketIO(socket.handshake))) {
    return next(new Error(GameConstants.Error.BANNED));
  }
  
  next();
};

io.use(checkBanned);

io.of("/rooms").use(ioCookieParser()).use(checkBanned).on("connection", async (socket) => {
  try {
    await checkAuthenticationSocket(socket);

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
  } catch(e) {
    emitAuthenticationRequired(socket);
  }
});

io.of("/createRoom").use(ioCookieParser()).use(checkBanned).on("connection", (socket) => {
  socket.on("create", async (data) => {
    try {
      await checkAuthenticationSocket(socket);
      await createRoom(data, socket);
    } catch {
      emitAuthenticationRequired(socket);
    }
  });
});

io.on("connection", async (socket) => {
  try {
    const token = await checkAuthenticationSocket(socket);
    const username = await Player.getUsernameToken(token, jsonWebTokenSecretKey);

    if(!username) return;

    socket.emit("authent", GameConstants.GameState.AUTHENTICATION_SUCCESS);
    tokens.set(username.toLowerCase(), token);

    socket.on("join-room", async (data) => {
      const { code, version } = data;
      const game = games[code];

      if(game != null
        && !Player.containsId(game.players, socket.id)
        && !Player.containsId(game.spectators, socket.id)
        && !Player.containsToken(game.players, token)
        && !Player.containsToken(game.spectators, token)
        && !Player.containsTokenAllGames(token, games)
        && !Player.containsIdAllGames(socket.id, games)
      ) {
        socket.join("room-" + code);

        if(game.players.length + game.numberAIToAdd >= getMaxPlayers(code) || game.started) {
          game.spectators.push(new Player(token, username, socket.id, null, false, version));
        } else {
          game.players.push(new Player(token, username, socket.id, null, false, version));
        }

        socket.emit("join-room", { success: true });

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
              "getInfosControls": false,
              "getInfosGoal": false,
              "errorOccurred": game.gameEngine.errorOccurred,
              "timerToDisplay": config.enableMaxTimeGame ? (config.maxTimeGame - (Date.now() - game.timeStart)) / 1000 : -1,
              "countBeforePlay": game.gameEngine.countBeforePlay,
              "aiStuck": game.gameEngine.aiStuck,
              "precAiStuck": false,
              "enablePause": game.gameEngine.enablePause,
              "enableRetry": game.gameEngine.enableRetry,
              "progressiveSpeed": game.gameEngine.progressiveSpeed
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
            socket.emit("start", { "paused": false });
          });
        });

        socket.once("exit", () => exitGame(game, socket, code));
        socket.once("kill", () => exitGame(game, socket, code));
        socket.once("error", () => exitGame(game, socket, code));
        socket.once("disconnect", () => exitGame(game, socket, code));

        socket.on("key", (key) => {
          if(game != null && Player.containsId(game.players, socket.id) && Player.getPlayer(game.players, socket.id).snake) {
            Player.getPlayer(game.players, socket.id).snake.lastKey = key;
            sendStatus(code);
          }
        });

        socket.on("pause", () => socket.emit("pause", { "paused": true }));

        socket.on("reset", () => {
          if(!game.started) {
            gameMatchmaking(game, code);
            socket.emit("reset", { "gameOver": false, "gameFinished": false, "scoreMax": false, "gameMazeWin": false });
          }
        });

        socket.on("forceStart", () => {
          if(game != null && Player.containsId(game.players, socket.id) && game.players[0].id == socket.id && !game.started) {
            startGame(code);
          }
        });

        logger.info("join room (code: " + code + ") - username: " + (await Player.getUsernameSocket(socket, jsonWebTokenSecretKey)) + " - ip: " + getIPSocketIO(socket.handshake) + " - socket: " + socket.id);

      } else {
        if(games[code] == null) {
          socket.emit("join-room", { success: false, errorCode: GameConstants.Error.ROOM_NOT_FOUND });
        } else if(
          Player.containsId(game.players, socket.id)
          || Player.containsId(game.spectators, socket.id)
          || Player.containsToken(game.players, token)
          || Player.containsToken(game.spectators, token)
        ) {
          socket.emit("join-room", { success: false, errorCode: GameConstants.Error.ROOM_ALREADY_JOINED });
        } else if(Player.containsTokenAllGames(token, games) || Player.containsIdAllGames(socket.id, games)) {
          socket.emit("join-room", { success: false, errorCode: GameConstants.Error.ALREADY_CREATED_ROOM });
        }
      }
    });
  } catch {
    emitAuthenticationRequired(socket);
  }
});

function emitAuthenticationRequired(socket) {
  const sessionId = socket.request.cookies.sessionId;

  if(sessionId) {
    socketSessions.set(sessionId, socket.id);
  }

  socket.on("disconnect", () => {
    socketSessions.delete(sessionId);
  });

  socket.emit("authent", GameConstants.Error.AUTHENTICATION_REQUIRED);
}

function isTokenExpired(token) {
  try {
    const decoded = decodeJwt(token);
    const now = Math.floor(Date.now() / 1000);

    return !decoded?.exp || decoded.exp < now;
  } catch {
    return true;
  }
}

function cleanMap(map) {
  for(const [key, token] of map.entries()) {
    if(isTokenExpired(token)) {
      map.delete(key);
    }
  }
}

function cleanSet(set) {
  for(const token of set) {
    if(isTokenExpired(token)) {
      set.delete(token);
    }
  }
}

function cleanSocketSessions() {
  for(const [sessionId, socketId] of socketSessions.entries()) {
    if(!io.sockets.sockets.get(socketId)) {
      socketSessions.delete(sessionId);
    }
  }
}

function cleanupTokenMaps() {
  cleanMap(tokens);
  cleanSet(invalidatedUserTokens);
  cleanSet(invalidatedAdminTokens);
  cleanSocketSessions();
}

server.listen(config.port, () => {
  console.log("listening on *:" + config.port);
});

setInterval(cleanupTokenMaps, 60 * 1000);