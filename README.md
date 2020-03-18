<img src="https://raw.githubusercontent.com/Eliastik/snakeia-server/master/assets/img/logo.png" width="300" alt="SnakeIA Server" />

# English

A server for my [SnakeIA](https://github.com/Eliastik/snakeia) game, written in JavaScript with the Socket.IO library and running on Node.js.

* Github repository: [https://github.com/Eliastik/snakeia-server](https://github.com/Eliastik/snakeia-server)

## About this server

* Version 1.0.1
* Made in France by Eliastik - [eliastiksofts.com](http://eliastiksofts.com) - Contact : [eliastiksofts.com/contact](http://eliastiksofts.com/contact)
* License: GNU GPLv3 (see LICENCE.txt file)

## How to run the server

You can run the server on your machine. To do this, you have to install Node.js and npm.

To install Node.js and npm for your OS, read this page: https://docs.npmjs.com/getting-started/installing-node

Git clone the repository and cd to the project directory (or download it directly from Github):
````
git clone https://github.com/Eliastik/snakeia-server.git
cd snakeia-server
````

Install the dependencies:
````
npm install
````

Then to run the server:
````
npm start
````

The server will by default run on the port 3000.

You can load a config file (example in config.json file) when you run the server. For example:
````
npm start config.json
````

## Config file explanations (default config)

````
{
    "version": "1.0", // The server version
    "port": 3000, // The port where the server runs
    "maxPlayers": 20, // The maximum number of players for each room
    "maxRooms": 20, // The maximum number of room
    "minGridSize": 5, // The minimum size for a grid (width and height)
    "maxGridSize": 50, // The maximum size for a grid (width and height)
    "minSpeed": 1, // The minimum speed
    "maxSpeed": 100, // The maximum speed
    "playerWaitTime": 45000, // The time while waiting for players to join a room
    "enableAuthentication": true, // Enable authentification when connecting to the server
    "authenticationTime": 86400000, // The duration of authentication token
    "jsonWebTokenSecretKey": "", // A private key for signing a token (if not provided, a random key will be generated)
    "minCharactersUsername": 3, // The minimum number of characters for the username
    "maxCharactersUsername": 15, // The maximum number of characters for the username
    "enableRecaptcha": true, // Enable ReCaptcha
    "recaptchaApiUrl": "https://www.google.com/recaptcha/api/siteverify", // ReCaptcha API URL
    "recaptchaPublicKey": "", // ReCaptcha public key (if not provided, the ReCaptcha will be disabled)
    "recaptchaPrivateKey": "", // ReCaptcha private key (if not provided, the ReCaptcha will be disabled)
    "authentMaxRequest": 50, // Maximum request for authentication
    "authentWindowMs": 900000, // Time when the authentication requests are saved
    "ipBan": [], // A list of IP to ban
    "usernameBan": [], // A list of usernames to ban
    "contactBan": "", // A contact URL displayed when an user is banned
    "enableLoggingFile": true, // Enable logging into file
    "logFile": "logs/server.log", // Log file
    "errorLogFile": "logs/error.log", // Error log file
    "logLevel": "debug" // Log level (see Winston documentation)
}
````

# Français

Un serveur pour mon jeu [SnakeIA](https://github.com/Eliastik/snakeia), écrit en JavaScript avec la bibliothèque logicielle Socket.IO et tournant via Node.js.

* Dépôt Github : [https://github.com/Eliastik/snakeia-server](https://github.com/Eliastik/snakeia-server)

## À propos de ce serveur

* Version 1.0.1
* Made in France by Eliastik - [eliastiksofts.com](http://eliastiksofts.com) - Contact : [eliastiksofts.com/contact](http://eliastiksofts.com/contact)
* Licence : GNU GPLv3 (voir le fichier LICENCE.txt)

## Comment lancer le serveur

Vous pouvez lancer le serveur sur votre machine. Pour cela, vous devez avoir installé Node.js et npm.

Pour installer Node.js et npm sur votre système, suivez le guide : https://docs.npmjs.com/getting-started/installing-node

Effectuez un clonage du dépôt et déplacez-vous dedans (ou téléchargez-le directement depuis Github) :
````
git clone https://github.com/Eliastik/snakeia-server.git
cd snakeia-server
````

Puis lancez cette commande pour installer les dépendances :
````
npm install
````

Puis pour lancer le serveur :
````
npm run server
````

Le serveur va se lancer sur le port 3000 par défaut.

Vous pouvez charger un fichier de configuration (un exemple dans le fichier config.json) lorsque vous lancez le serveur. Par exemple :
````
npm start config.json
````

## Explications du fichier de configuration (configuration par défaut)

````
{
    "version": "1.0", // La version du serveur
    "port": 3000, // Le port sur lequel lancer le server
    "maxPlayers": 20, // Le nombre maximal d'utilisateur par salle
    "maxRooms": 20, // Le nombre maximal de salles
    "minGridSize": 5, // La taille minimale pour une grille (largeur et hauteur)
    "maxGridSize": 50, // La taille maximale pour une grille (largeur et hauteur)
    "minSpeed": 1, // La vitesse minimale
    "maxSpeed": 100, // La vitesse maximale
    "playerWaitTime": 45000, // Le temps durant lequel attendre la connexion d'autres joueurs à la salle
    "enableAuthentication": true, // Activer l'authentification lors de la connexion au serveur
    "authenticationTime": 86400000, // La durée de vie d'un token d'authentification
    "jsonWebTokenSecretKey": "", // Une clée privée pour signer un token (si non fournie, une clée sera générée au hasard)
    "minCharactersUsername": 3, // Le nombre minimal de caractères pour le nom d'utilisateur
    "maxCharactersUsername": 15, // Le nombre maximal de caractères pour le nom d'utilisateur
    "enableRecaptcha": true, // Activer le ReCaptcha
    "recaptchaApiUrl": "https://www.google.com/recaptcha/api/siteverify", // URL de l'API ReCaptcha
    "recaptchaPublicKey": "", // Clé publique ReCaptcha (si non fournie, le ReCaptcha sera désactivé)
    "recaptchaPrivateKey": "", // Clé privée ReCaptcha (si non fournie, le ReCaptcha sera désactivé)
    "authentMaxRequest": 50, // Nombre maximal de requêtes lors de l'authentification
    "authentWindowMs": 900000, // Temps durant lequel les tentatives d'authentification seront enregistrée
    "ipBan": [], // Une liste d'IPs à bannir
    "usernameBan": [], // Une liste de noms d'utilisateur à bannir
    "contactBan": "", // Une URL de contact à afficher lorsque l'utilisateur est banni
    "enableLoggingFile": true, // Activer le log dans un fichier
    "logFile": "logs/server.log", // Fichier de log
    "errorLogFile": "logs/error.log", // Fichier de log d'erreurs
    "logLevel": "debug" // Niveau de log (voir la documentation de Winston)
}
````

## Déclaration de licence

Copyright (C) 2020 Eliastik (eliastiksofts.com)

Ce programme est un logiciel libre ; vous pouvez le redistribuer ou le modifier suivant les termes de la GNU General Public License telle que publiée par la Free Software Foundation ; soit la version 3 de la licence, soit (à votre gré) toute version ultérieure.

Ce programme est distribué dans l'espoir qu'il sera utile, mais SANS AUCUNE GARANTIE ; sans même la garantie tacite de QUALITÉ MARCHANDE ou d'ADÉQUATION à UN BUT PARTICULIER. Consultez la GNU General Public License pour plus de détails.

Vous devez avoir reçu une copie de la GNU General Public License en même temps que ce programme ; si ce n'est pas le cas, consultez http://www.gnu.org/licenses.

----

Copyright (C) 2020 Eliastik (eliastiksofts.com)

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see http://www.gnu.org/licenses/.
