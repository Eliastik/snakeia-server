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
const io             = require("socket.io")(http);
const Entities       = require("html-entities").AllHtmlEntities;
const entities       = new Entities();
const ejs            = require("ejs");
const jwt            = require("jsonwebtoken");
const fetch          = require("node-fetch");
const cookieParser   = require("cookie-parser");
const ioCookieParser = require("socket.io-cookie-parser");
const i18n           = require("i18n");

const snakeia        = require("snakeia");
const Snake          = snakeia.Snake;
const Grid           = snakeia.Grid;
const GameEngine     = snakeia.GameEngine;
const GameConstants  = snakeia.GameConstants;

const games = {}; // contains all the games processed by the server
const config = {}; // server configuration (see default config file config.json)

// Load config file
const configFile = process.argv.splice(2)[0] || "config.json";

if(configFile != null) {
  try {
    const file = fs.readFileSync(configFile, "utf-8");
    Object.assign(config, JSON.parse(file));
  } catch(e) {
    console.log("Error while loading config file \"" + configFile + "\": " + e);
  }
}

config.port = process.env.PORT || config.port;
config.jsonWebTokenSecretKey = config.jsonWebTokenSecretKey && config.jsonWebTokenSecretKey.trim() != "" ? config.jsonWebTokenSecretKey : generateRandomJsonWebTokenSecretKey();

i18n.configure({
  locales:["fr", "en"], 
  directory: __dirname + "/locales", 
  defaultLocale: "en",
  queryParameter: "lang",
  cookie: "lang"
});

class Player {
  constructor(token, id, snake, ready, version) {
    this.token = token;
    this.id = id;
    this.snake = snake;
    this.ready = ready;
    this.version = version;
  }

  static getPlayer(array, id) {
    for(let i = 0; i < array.length; i++) {
      if(array[i] != null && array[i].id == id) {
        return array[i];
      }
    }

    return null;
  }

  static getPlayerAllGames(id) {
    const keys = Object.keys(games);

    for(let i = 0; i < keys.length; i++) {
      const game = games[keys[i]];

      if(game) {
        const p = this.getPlayer(game.players, id);
        const p2 = this.getPlayer(game.spectators, id);
        if(p) return p;
        if(p2) return p2;
      }
    }

    return null;
  }

  static getPlayerToken(array, token) {
    for(let i = 0; i < array.length; i++) {
      if(array[i] != null && array[i].token == token) {
        return array[i];
      }
    }

    return null;
  }

  static getPlayerAllGamesToken(token) {
    const keys = Object.keys(games);

    for(let i = 0; i < keys.length; i++) {
      const game = games[keys[i]];

      if(game) {
        const p = this.getPlayerToken(game.players, token);
        const p2 = this.getPlayerToken(game.spectators, token);
        if(p) return p;
        if(p2) return p2;
      }
    }

    return null;
  }

  static containsId(array, id) {
    return Player.getPlayer(array, id) != null;
  }

  static containsToken(array, token) {
    return Player.getPlayerToken(array, token) != null;
  }

  static containsIdAllGames(id) {
    return Player.getPlayerAllGames(id) != null;
  }

  static containsTokenAllGames(token) {
    return Player.getPlayerAllGamesToken(token) != null;
  }
}

function getRoomsData() {
  const rooms = [];
  const keysRooms = Object.keys(games).filter(key => games[key] && !games[key]["private"]);

  for(let i = 0; i < keysRooms.length; i++) {
    const game = games[keysRooms[i]];

    rooms.push({});
    rooms[i]["borderWalls"] = false;
    rooms[i]["generateWalls"] = false;
    rooms[i]["players"] = Object.keys(game["players"]).length;
    rooms[i]["width"] = "???";
    rooms[i]["height"] = "???";
    rooms[i]["speed"] = game["game"].speed;
    rooms[i]["code"] = keysRooms[i];
    rooms[i]["maxPlayers"] = getMaxPlayers(keysRooms[i]);
    rooms[i]["state"] = (game["started"] ? GameConstants.GameState.STARTED : game["timeoutPlay"] != null ? GameConstants.GameState.STARTING : game["searchingPlayers"] ? GameConstants.GameState.SEARCHING_PLAYERS : "");

    if(game["game"].grid != null) {
      rooms[i]["width"] = game["game"].grid.width;
      rooms[i]["height"] = game["game"].grid.height;
      rooms[i]["borderWalls"] = game["game"].grid.borderWalls;
      rooms[i]["generateWalls"] = game["game"].grid.generateWalls;
    }

    if(game["game"].snake != null) {
      rooms[i]["players"] = game["game"].snake.length;
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

function generateRandomJsonWebTokenSecretKey() {
  return require("crypto").randomBytes(256).toString("base64");
}

function getMaxPlayers(code) {
  const game = games[code].game;

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
  if(Object.keys(games).filter(key => games[key] != null).length < config.maxRooms && !Player.containsTokenAllGames(socket.request.cookies.token) && !Player.containsIdAllGames(socket.id)) {
    let heightGrid = 20;
    let widthGrid = 20;
    let borderWalls = false;
    let generateWalls = false;
    let speed = 8;
    let enableAI = false;
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
  
    if(data.speed == null && data.speed == "custom") {
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
  
    if(validSettings) {
      const code = getRandomRoomKey();
      const grid = new Grid(widthGrid, heightGrid, generateWalls, borderWalls, false, null, false);
      grid.init();
      const game = new GameEngine(grid, [], speed);
      
      games[code] = {
        game: game,
        private: privateGame,
        players: [],
        spectators: [],
        searchingPlayers: true,
        started: false,
        alreadyInit: false,
        timeoutPlay: null,
        timeStart: null
      };
  
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
    if(Player.containsTokenAllGames(socket.request.cookies.token) || Player.containsIdAllGames(socket.id)) {
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

function setupRoom(code) {
  const game = games[code].game;

  game.onReset(function() {
    io.to("room-" + code).emit("reset", {
      "paused": game.paused,
      "isReseted": game.isReseted,
      "exited": game.exited,
      "grid": JSON.parse(JSON.stringify(game.grid)),
      "numFruit": game.numFruit,
      "ticks": game.ticks,
      "scoreMax": game.scoreMax,
      "gameOver": game.gameOver,
      "gameFinished": game.gameFinished,
      "gameMazeWin": game.gameMazeWin,
      "starting": game.starting,
      "initialSpeed": game.initialSpeed,
      "speed": game.speed,
      "snakes": JSON.parse(JSON.stringify(game.snakes)),
      "offsetFrame": game.speed * GameConstants.Setting.TIME_MULTIPLIER,
      "confirmReset": false,
      "confirmExit": false,
      "getInfos": false,
      "getInfosGame": false,
      "errorOccurred": game.errorOccurred
    });
  });

  game.onStart(function() {
    io.to("room-" + code).emit("start", {
      "snakes": JSON.parse(JSON.stringify(game.snakes)),
      "grid": JSON.parse(JSON.stringify(game.grid)),
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

  game.onPause(function() {
    io.to("room-" + code).emit("pause", {
      "paused": game.paused,
      "confirmReset": false,
      "confirmExit": false,
      "getInfos": false,
      "getInfosGame": false,
      "errorOccurred": game.errorOccurred
    });
  });

  game.onContinue(function() {
    io.to("room-" + code).emit("continue", {
      "confirmReset": false,
      "confirmExit": false,
      "getInfos": false,
      "getInfosGame": false,
      "errorOccurred": game.errorOccurred
    });
  });

  game.onStop(function() {
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
    }
  });

  game.onExit(function() {
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

  game.onKill(function() {
    io.to("room-" + code).emit("kill", {
      "paused": game.paused,
      "gameOver": game.gameOver,
      "killed": game.killed,
      "snakes": JSON.parse(JSON.stringify(game.snakes)),
      "gameFinished": game.gameFinished,
      "grid": JSON.parse(JSON.stringify(game.grid)),
      "confirmReset": false,
      "confirmExit": false,
      "getInfos": false,
      "getInfosGame": false,
      "errorOccurred": game.errorOccurred
    });
  });

  game.onScoreIncreased(function() {
    io.to("room-" + code).emit("scoreIncreased", {
      "snakes": JSON.parse(JSON.stringify(game.snakes)),
      "grid": JSON.parse(JSON.stringify(game.grid)),
      "scoreMax": game.scoreMax,
      "gameFinished": game.gameFinished,
      "errorOccurred": game.errorOccurred
    });
  });
  
  game.onUpdate(function() {
    io.to("room-" + code).emit("update", {
      "isReseted": game.isReseted,
      "exited": game.exited,
      "grid": JSON.parse(JSON.stringify(game.grid)),
      "numFruit": game.numFruit,
      "ticks": game.ticks,
      "scoreMax": game.scoreMax,
      "gameOver": game.gameOver,
      "gameFinished": game.gameFinished,
      "gameMazeWin": game.gameMazeWin,
      "starting": game.starting,
      "initialSpeed": game.initialSpeed,
      "speed": game.speed,
      "snakes": JSON.parse(JSON.stringify(game.snakes)),
      "countBeforePlay": game.countBeforePlay,
      "numFruit": game.numFruit,
      "offsetFrame": 0,
      "errorOccurred": game.errorOccurred
    });
  });

  game.onUpdateCounter(function() {
    io.to("room-" + code).emit("updateCounter", {
      "paused": game.paused,
      "isReseted": game.isReseted,
      "exited": game.exited,
      "grid": JSON.parse(JSON.stringify(game.grid)),
      "numFruit": game.numFruit,
      "ticks": game.ticks,
      "scoreMax": game.scoreMax,
      "gameOver": game.gameOver,
      "gameFinished": game.gameFinished,
      "gameMazeWin": game.gameMazeWin,
      "starting": game.starting,
      "initialSpeed": game.initialSpeed,
      "speed": game.speed,
      "snakes": JSON.parse(JSON.stringify(game.snakes)),
      "countBeforePlay": game.countBeforePlay,
      "numFruit": game.numFruit,
      "errorOccurred": game.errorOccurred,
      "searchingPlayers": false
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
      }
    }
  }

  for(let i = 0; i < toRemove.length; i++) {
    games[toRemove[i]] = null;
  }
}

function gameMatchmaking(game, code) {
  if(game != null && games[code] != null && games[code].searchingPlayers) {
    let numberPlayers = game.players.length;

    if(numberPlayers < getMaxPlayers(code)) {
      const toAdd = getMaxPlayers(code) - numberPlayers;

      for(let i = 0; i < game.spectators.length && i < toAdd; i++) {
        game.spectators[i].ready = true;
        game.players.push(game.spectators[i]);
        game.spectators[i] = null;
      }

      game.spectators = game.spectators.filter(spectator => spectator != null);
    }

    numberPlayers = game.players.length;

    if(numberPlayers > 0) {
      if(numberPlayers > 1 && game.timeoutPlay == null) {
        game.timeStart = Date.now() + config.playerWaitTime + 1000;
    
        game.timeoutPlay = setTimeout(function() {
          game.timeoutPlay = null;
          startGame(code);
        }, config.playerWaitTime);
      } else if(numberPlayers <= 1 && game.timeoutPlay != null) {
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
        "errorOccurred": game.game.errorOccurred,
        "onlineMaster": false,
        "onlineMode": true,
        "enableRetryPauseMenu": false
      });

      io.to(game.players[0].id).emit("init", {
        "onlineMaster": true
      });
    }
  }
  
  setupSpectators(code);
}

function startGame(code) {
  const game = games[code];

  if(game != null) {
    if(game.timeoutPlay != null) {
      clearTimeout(game.timeoutPlay);
      game.timeoutPlay = null;
    }

    game.searchingPlayers = false;
    game.started = true;
    game.game.snakes = [];
    game.game.grid.init();
  
    for(let i = 0; i < game.players.length; i++) {
      game.players[i].snake = new Snake(null, null, game.game.grid);
      game.game.snakes.push(game.players[i].snake);

      io.to(game.players[i].id).emit("init", {
        "currentPlayer": (i + 1),
        "spectatorMode": false
      });
    }
  
    if(!game.alreadyInit) {
      game.game.init();
      game.game.start();
      game.alreadyInit = true;
    } else {
      game.game.init();
      game.game.reset();
    }

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
        "enableRetryPauseMenu": false
      });
    }
  }
}

function exitGame(game, socket, code) {
  if(game) {
    if(Player.containsId(game.players, socket.id) && Player.getPlayer(game.players, socket.id).snake != null) {
      Player.getPlayer(game.players, socket.id).snake.gameOver = true;
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
        resolve();
      }

      reject("BAD_USERNAME");
    }, () => {
      reject("INVALID_RECAPTCHA");
    });
  });
}

app.engine("html", ejs.renderFile);
app.set("view engine", "html");

app.use(express.static("assets"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(i18n.init);

app.get("/", function(req, res) {
  res.render(__dirname + "/index.html", {
    version: config.version,
    engineVersion: GameConstants.Setting.APP_VERSION
  });
});

app.get("/authentication", function(req, res) {
  if(req.cookies && config.enableAuthentication) {
    jwt.verify(req.cookies.token, config.jsonWebTokenSecretKey, function(err, data) {
      res.render(__dirname + "/authentication.html", {
        publicKey: config.recaptchaPublicKey,
        enableRecaptcha: config.enableRecaptcha,
        errorRecaptcha: false,
        errorUsername: false,
        success: false,
        authent: !err,
        locale: i18n.getLocale(req),
        min: config.minCharactersUsername,
        max: config.maxCharactersUsername
      });
    });
  } else {
    res.end();
  }
});

app.post("/authentication", function(req, res) {
  if(req.cookies && config.enableAuthentication) {
    jwt.verify(req.cookies.token, config.jsonWebTokenSecretKey, function(err, data) {
      if(err) {
        verifyFormAuthentication(req.body).then(() => {
          const token = jwt.sign({
            username: req.body["username"]
          }, config.jsonWebTokenSecretKey, { expiresIn: config.authenticationTime });
      
          res.cookie("token", token, { maxAge: config.authenticationTime, httpOnly: true });
          res.render(__dirname + "/authentication.html", {
            publicKey: config.recaptchaPublicKey,
            enableRecaptcha: config.enableRecaptcha,
            errorRecaptcha: false,
            errorUsername: false,
            success: true,
            authent: false,
            locale: i18n.getLocale(req),
            min: config.minCharactersUsername,
            max: config.maxCharactersUsername
          });
        }, (err) => {
          res.render(__dirname + "/authentication.html", {
            publicKey: config.recaptchaPublicKey,
            enableRecaptcha: config.enableRecaptcha,
            errorRecaptcha: err == "INVALID_RECAPTCHA",
            errorUsername: err == "BAD_USERNAME",
            success: false,
            authent: false,
            locale: i18n.getLocale(req),
            min: config.minCharactersUsername,
            max: config.maxCharactersUsername
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

io.use(ioCookieParser());

io.use(function(socket, next) {
  if(!config.enableAuthentication) return next();
  jwt.verify(socket.request.cookies.token, config.jsonWebTokenSecretKey, function(err, data) {
    if(socket.request.cookies && socket.request.cookies.token && !err) return next();
    next(new Error(GameConstants.Error.AUTHENTICATION_REQUIRED));
  });
});

io.of("/rooms").on("connection", function(socket) {
  socket.emit("rooms", {
    rooms: getRoomsData(),
    serverVersion: config.version,
    engineVersion: GameConstants.Setting.APP_VERSION,
    settings: {
      maxRooms: config.maxRooms,
      minGridSize: config.minGridSize,
      maxGridSize: config.maxGridSize,
      minSpeed: config.minSpeed,
      maxSpeed: config.maxSpeed
    }
  });
});

io.of("/createRoom").on("connection", function(socket) {
  socket.on("create", function(data) {
    createRoom(data, socket);
  });
});

io.on("connection", function(socket) {
  socket.on("join-room", function(data) {
    const code = data.code;
    const version = data.version;
    const game = games[code];

    if(game != null && !Player.containsId(game.players, socket.id) && !Player.containsId(game.spectators, socket.id) && !Player.containsToken(game.players, socket.request.cookies.token) && !Player.containsToken(game.spectators, socket.request.cookies.token) && !Player.containsTokenAllGames(socket.request.cookies.token) && !Player.containsIdAllGames(socket.id)) {
      socket.join("room-" + code);

      if(game.players.length >= getMaxPlayers(code) || game.started) {
        game.spectators.push(new Player(socket.request.cookies.token, socket.id, null, false, version));
      } else {
        game.players.push(new Player(socket.request.cookies.token, socket.id, null, false, version));
      }

      socket.emit("join-room", {
        success: true
      });
    
      socket.once("start", function() {
        if(Player.containsId(game.players, socket.id)) {
          Player.getPlayer(game.players, socket.id).ready = true;
        }

        socket.emit("init", {
          "enablePause": game.game.enablePause,
          "enableRetry": game.game.enableRetry,
          "progressiveSpeed": game.game.progressiveSpeed,
          "offsetFrame": game.game.speed * GameConstants.Setting.TIME_MULTIPLIER
        });

        gameMatchmaking(game, code);

        socket.on("start", function() {
          socket.emit("start", {
            "paused": false
          });
        });
      });
    
      socket.once("exit", function() {
        exitGame(game, socket, code);
      });
    
      socket.once("kill", function() {
        exitGame(game, socket, code);
      });
    
      socket.on("key", function(key) {
        if(game != null && Player.containsId(game.players, socket.id) && Player.getPlayer(game.players, socket.id).snake) {
          Player.getPlayer(game.players, socket.id).snake.lastKey = key;
        }
      });

      socket.on("pause", function() {
        socket.emit("pause", {
          "paused": true
        });
      });

      socket.on("reset", function() {
        if(!game.started) {
          gameMatchmaking(game, code);

          socket.emit("reset", {
            "gameOver": false,
            "gameFinished": false
          });
        }
      });

      socket.once("error", function() {
        exitGame(game, socket, code);
      });

      socket.once("disconnect", function() {
        exitGame(game, socket, code);
      });

      socket.on("forceStart", function() {
        if(game != null && Player.containsId(game.players, socket.id) && game.players[0].id == socket.id) {
          startGame(code);
        }
      });
    } else {
      if(games[code] == null) {
        socket.emit("join-room", {
          success: false,
          errorCode: GameConstants.Error.ROOM_NOT_FOUND
        });
      } else if(Player.containsId(game.players, socket.id) || Player.containsId(game.spectators, socket.id) || Player.containsToken(game.players, socket.request.cookies.token) || Player.containsToken(game.spectators, socket.request.cookies.token)) {
        socket.emit("join-room", {
          success: false,
          errorCode: GameConstants.Error.ROOM_ALREADY_JOINED
        });
      } else if(Player.containsTokenAllGames(socket.request.cookies.token) || Player.containsIdAllGames(socket.id)) {
        socket.emit("join-room", {
          success: false,
          errorCode: GameConstants.Error.ALREADY_CREATED_ROOM
        });
      }
    }
  });
});

http.listen(config.port, function(){
  console.log("listening on *:" + config.port);
});