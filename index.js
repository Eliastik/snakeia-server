var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var snakeia = require("snakeia");

var Snake = snakeia.Snake;
var Grid = snakeia.Grid;
var GameEngine = snakeia.GameEngine;
var GameConstants = snakeia.GameConstants;

var games = {};

var players;

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.get('/rooms', function(req, res) {
  var rooms = [];
  var keysRooms = Object.keys(games);

  for(var i = 0; i < keysRooms.length; i++) {
    rooms.push({});
    rooms[i]["borderWalls"] = false;
    rooms[i]["generateWalls"] = false;
    rooms[i]["players"] = 0;
    rooms[i]["width"] = "???";
    rooms[i]["height"] = "???";
    rooms[i]["speed"] = games[keysRooms[i]].speed;

    if(games[keysRooms[i]].grid != null) {
      rooms[i]["width"] = games[keysRooms[i]].grid.width;
      rooms[i]["height"] = games[keysRooms[i]].grid.height;
      rooms[i]["borderWalls"] = games[keysRooms[i]].grid.borderWalls;
      rooms[i]["generateWalls"] = games[keysRooms[i]].grid.generateWalls;
    }

    if(games[keysRooms[i]].snake != null) {
      rooms[i]["players"] = games[keysRooms[i]].snake.length;
    }
  }

  res.end("callbackDisplayRooms(" + JSON.stringify(rooms) + ");");
});

io.on('connection', function(socket) {
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
  console.log('listening on *:3000');
});
