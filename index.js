const app = require("express")();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const snakeia = require("snakeia");

const Snake = snakeia.Snake;
const Grid = snakeia.Grid;
const GameEngine = snakeia.GameEngine;
const GameConstants = snakeia.GameConstants;

var games = {};

var players;

function getRoomsData() {
  const rooms = [];
  const keysRooms = Object.keys(games).filter(key => !games[key]["private"]);

  for(let i = 0; i < keysRooms.length; i++) {
    rooms.push({});
    rooms[i]["borderWalls"] = false;
    rooms[i]["generateWalls"] = false;
    rooms[i]["players"] = 0;
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
    var game = new GameEngine(grid, [], speed, false, false, false);
    
    games[code] = {
      game: game,
      private: privateGame
    };

    if(socket != null) {
      socket.emit("process", {
        success: true,
        code: code
      });
    }
  } else {
    if(socket != null) {
      socket.emit("process", {
        success: false,
        code: null
      });
    }
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
  var grid = new Grid();
  grid.init();
  var snake = new Snake(null, null, grid);
  var game = new GameEngine(grid, snake);

  socket.emit("init", {
    "snakes": JSON.parse(JSON.stringify(game.snakes)),
    "grid": JSON.parse(JSON.stringify(game.grid)),
    "enablePause": game.enablePause,
    "enableRetry": game.enableRetry,
    "progressiveSpeed": game.progressiveSpeed,
    "offsetFrame": game.speed * GameConstants.Setting.TIME_MULTIPLIER,
    "errorOccurred": game.errorOccurred
  });

  game.onReset(function() {
    socket.emit("reset", {
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
    socket.emit("start", {
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
    socket.emit("pause", {
      "paused": game.paused,
      "confirmReset": false,
      "confirmExit": false,
      "getInfos": false,
      "getInfosGame": false,
      "errorOccurred": game.errorOccurred
    });
  });

  game.onContinue(function() {
    socket.emit("continue", {
      "confirmReset": false,
      "confirmExit": false,
      "getInfos": false,
      "getInfosGame": false,
      "errorOccurred": game.errorOccurred
    });
  });

  game.onStop(function() {
    socket.emit("stop", {
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
    socket.emit("exit", {
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
    socket.emit("kill", {
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
    socket.emit("scoreIncreased", {
      "snakes": JSON.parse(JSON.stringify(game.snakes)),
      "grid": JSON.parse(JSON.stringify(game.grid)),
      "scoreMax": game.scoreMax,
      "gameFinished": game.gameFinished,
      "errorOccurred": game.errorOccurred
    });
  });
  
  game.onUpdate(function() {
    socket.emit("update", {
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
      "offsetFrame": 0,
      "errorOccurred": game.errorOccurred
    });
  });

  game.onUpdateCounter(function() {
    socket.emit("updateCounter", {
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

  socket.on("reset", function() {
    game.reset();
  });

  socket.on("start", function() {
    game.start();
  });

  socket.on("finish", function() {
    game.stop(true);
  });

  socket.on("stop", function() {
    game.stop(false);
  });

  socket.on("pause", function() {
    game.pause();
  });

  socket.on("kill", function() {
    game.kill();
  });

  socket.on("exit", function() {
    game.exit();
  });

  socket.on("key", function(key) {
    game.lastKey = key;
  });
});

http.listen(3000, function(){
  console.log("listening on *:3000");
});