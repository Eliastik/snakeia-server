/*
 * Copyright (C) 2020-2025 Eliastik (eliastiksofts.com)
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
const { jwtVerify } = require("jose");

class Player {
  constructor(token, name, id, snake, ready, version) {
    this.token = token;
    this.name = name;
    this.id = id;
    this.snake = snake;
    this.ready = ready;
    this.version = version;
  }

  get username() {
    return this.name;
  }

  static getPlayer(array, id) {
    for (let i = 0; i < array.length; i++) {
      if (array[i] != null && array[i].id == id) {
        return array[i];
      }
    }

    return null;
  }

  static getPlayerAllGames(id, games) {
    const keys = Object.keys(games);

    for (let i = 0; i < keys.length; i++) {
      const game = games[keys[i]];

      if (game) {
        const p = this.getPlayer(game.players, id);
        const p2 = this.getPlayer(game.spectators, id);
        if (p) return p;
        if (p2) return p2;
      }
    }

    return null;
  }

  static getPlayerToken(array, token) {
    if(!token) return null;
    for (let i = 0; i < array.length; i++) {
      if (array[i] != null && array[i].token == token) {
        return array[i];
      }
    }

    return null;
  }

  static getPlayerAllGamesToken(token, games) {
    if(!token) return null;
    const keys = Object.keys(games);

    for (let i = 0; i < keys.length; i++) {
      const game = games[keys[i]];

      if (game) {
        const p = this.getPlayerToken(game.players, token);
        const p2 = this.getPlayerToken(game.spectators, token);
        if (p) return p;
        if (p2) return p2;
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

  static containsIdAllGames(id, games) {
    return Player.getPlayerAllGames(id, games) != null;
  }

  static containsTokenAllGames(token, games) {
    return Player.getPlayerAllGamesToken(token, games) != null;
  }

  static getSocketToken(socket) {
    return socket?.handshake?.auth?.token
        || socket?.handshake?.query?.token
        || socket?.request?.cookies?.token;
  }

  static getUsernameSocket(socket, jsonWebTokenSecretKey) {
    try {
      const token = Player.getSocketToken(socket);

      return Player.getUsernameToken(token, jsonWebTokenSecretKey);
    } catch (e) {
      return null;
    }
  }

  static async getUsernameToken(token, jsonWebTokenSecretKey) {
    try {
      const { payload } = await jwtVerify(token, jsonWebTokenSecretKey);

      return payload && payload.username
        ? payload.username
        : null;
    } catch (e) {
      return null;
    }
  }
}

module.exports = Player;