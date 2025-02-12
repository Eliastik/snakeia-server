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
class Player {
  constructor(token, id, snake, ready, version) {
    this.token = token;
    this.id = id;
    this.snake = snake;
    this.ready = ready;
    this.version = version;
  }

  get username() {
    return Player.getUsername(this);
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
    if (!token) return null;
    for (let i = 0; i < array.length; i++) {
      if (array[i] != null && array[i].token == token) {
        return array[i];
      }
    }

    return null;
  }

  static getPlayerAllGamesToken(token, games) {
    if (!token) return null;
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

  static getUsername(player) {
    try {
      const decoded_token = jwt.verify(player.token, jsonWebTokenSecretKey);
      return decoded_token && decoded_token.username
        ? decoded_token.username
        : null;
    } catch (e) {
      return null;
    }
  }

  static getUsernameSocket(socket) {
    try {
      const decoded_token = jwt.verify(
        socket.handshake.auth.token ||
          socket.handshake.query.token ||
          socket.request.cookies.token,
        jsonWebTokenSecretKey
      );
      return decoded_token && decoded_token.username
        ? decoded_token.username
        : null;
    } catch (e) {
      return null;
    }
  }
}

module.exports = Player;