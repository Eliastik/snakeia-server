const app = require("express")();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const snakeia = require("snakeia");

const Snake = snakeia.Snake;
const Grid = snakeia.Grid;
const GameEngine = snakeia.GameEngine;
const GameConstants = snakeia.GameConstants;

var games = {};

function getRoomsData() {
  const rooms = [];
  const keysRooms = Object.keys(games).filter(key => games[key] && !games[key]["private"]);

  for(let i = 0; i < keysRooms.length; i++) {
    rooms.push({});
    rooms[i]["borderWalls"] = false;
    rooms[i]["generateWalls"] = false;
    rooms[i]["players"] = Object.keys(games[keysRooms[i]]["players"]).length;
    rooms[i]["width"] = "???";
    rooms[i]["height"] = "???";
    rooms[i]["speed"] = games[keysRooms[i]]["game"].speed;
    rooms[i]["code"] = keysRooms[i];

    if(games[keysRooms[i]]["game"].grid != null) {
      rooms[i]["width"] = games[keysRooms[i]]["game"].grid.width;
      rooms[i]["height"] = games[keysRooms[i]]["game"].grid.height;
      rooms[i]["borderWalls"] = games[keysRooms[i]]["game"].grid.borderWalls;
      rooms[i]["generateWalls"] = games[keysRooms[i]]["game"].grid.generateWalls;
    }

    if(games[keysRooms[i]]["game"].snake != null) {
      rooms[i]["players"] = games[keysRooms[i]]["game"].snake.length;
    }
  }

  return rooms;
}

function getRandomRoomKey() {
  let r;

  do {
    r = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  } while(r in games);

  return r;
}

function createRoom(data, socket) {
  var heightGrid = 20;
  var widthGrid = 20;
  var borderWalls = false;
  var generateWalls = false;
  var speed = 8;
  var enableAI = false;
  var validSettings = true;
  var privateGame = false;

  if(data.heightGrid == null || isNaN(data.heightGrid) || data.heightGrid < 5 || data.heightGrid > 100) {
    validSettings = false;
  } else {
    heightGrid = data.heightGrid;
  }

  if(data.widthGrid == null || isNaN(data.widthGrid) || data.widthGrid < 5 || data.widthGrid > 100) {
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
    if(data.customSpeed == null || isNaN(data.customSpeed) || data.customSpeed < 1 || data.customSpeed > 100) {
      validSettings = false;
    } else {
      speed = data.customSpeed;
    }
  } else if(data.speed == null || isNaN(data.speed) || data.speed < 1 || data.speed > 100) {
    validSettings = false;
  } else {
    speed = data.speed;
  }

  if(validSettings) {
    var code = getRandomRoomKey();
    var grid = new Grid(widthGrid, heightGrid, generateWalls, borderWalls, false, null, false);
    grid.init();
    var game = new GameEngine(grid, [], speed);
    
    games[code] = {
      game: game,
      private: privateGame,
      players: []
    };

    if(socket != null) {
      socket.emit("process", {
        success: true,
        code: code
      });

      setupRoom(code);
    }
  } else {
    if(socket != null) {
      socket.emit("process", {
        success: false,
        code: null,
        errorCode: "INVALID_SETTINGS"
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
      "errorOccurred": game.errorOccurred
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
      "errorOccurred": game.errorOccurred
    });
  });
}

function cleanRooms() {
  const keys = Object.keys(games);
  const toRemove = [];

  for(let i = 0; i < keys.length; i++) {
    const game = games[keys[i]];

    if(game != null) {
      const players = game.game.snakes;
      let nb = 0;
  
      for(let j = 0; j < players.length; j++) {
        if(players[j] != null && !players[j].gameOver) {
          nb++;
        }
      }
  
      if(nb <= 0) {
        toRemove.push(keys[i]);
      }
    }
  }

  for(let i = 0; i < toRemove.length; i++) {
    games[toRemove[i]] = null;
  }
}

app.get("/", function(req, res) {
  res.end("<h1>SnakeIA server</h1><p><a href=\"https://github.com/Eliastik/snakeia-server/\">Github page</a>");
});

app.get("/rooms", function(req, res) {
  res.end("callbackDisplayRooms(" + JSON.stringify(getRoomsData()) + ");");
});

io.of("/rooms").on("connection", function(socket) {
  socket.emit("rooms", getRoomsData());
});

io.of("/createRoom").on("connection", function(socket) {
  socket.on("create", function(data) {
    createRoom(data, socket);
  });
});

io.on("connection", function(socket) {
  socket.on("join-room", function(code) {
    if(games[code] != null && games[code].players[socket.id] == null) {
      var game = games[code];

      socket.join("room-" + code);

      game.players[socket.id] = {
        snake: new Snake(null, null, game.game.grid),
        ready: false
      };

      socket.emit("join-room", {
        success: true
      });
    
      socket.once("start", function() {
        game.players[socket.id].ready = true;
        game.game.snakes.push(game.players[socket.id].snake);
        game.game.init();
        game.game.start();

        socket.emit("init", {
          "enablePause": game.game.enablePause,
          "enableRetry": game.game.enableRetry,
          "progressiveSpeed": game.game.progressiveSpeed,
          "offsetFrame": game.game.speed * GameConstants.Setting.TIME_MULTIPLIER,
          "errorOccurred": game.game.errorOccurred
        });

        socket.on("start", function() {
          socket.emit("start", {
            "paused": false
          });
        });
      });
    
      socket.once("exit", function() {
        game.players[socket.id].snake.gameOver = true;
        socket.emit("kill", {
          "killed": true
        });
        socket.leave("room-" + code);
        cleanRooms();
      });
    
      socket.once("kill", function() {
        game.players[socket.id].snake.gameOver = true;
        socket.emit("kill", {
          "killed": true
        });
        socket.leave("room-" + code);
        cleanRooms();
      });
    
      socket.on("key", function(key) {
        game.players[socket.id].snake.lastKey = key;
      });

      socket.on("pause", function() {
        socket.emit("pause", {
          "paused": true
        });
      });

      socket.once("error", function() {
        game.players[socket.id].snake.gameOver = true;
        cleanRooms();
      });
    } else {
      if(games[code] == null) {
        socket.emit("join-room", {
          success: false,
          errorCode: "ROOM_NOT_FOUND"
        });
      } else if(games[code].players[socket.id] == null) {
        socket.emit("join-room", {
          success: false,
          errorCode: "ROOM_ALREADY_JOINED"
        });
      }
    }
  });
});

http.listen(3000, function(){
  console.log("listening on *:3000");
});