<img src="https://raw.githubusercontent.com/Eliastik/snakeia-server/master/assets/img/logo.png" width="300" alt="SnakeIA Server" />

# English

A server for my [SnakeIA](https://github.com/Eliastik/snakeia) game, written in JavaScript with the Socket.IO library and running on Node.js.

* Github repository: [https://github.com/Eliastik/snakeia-server](https://github.com/Eliastik/snakeia-server)

## About this server

* Version 1.1.3
* Made in France by Eliastik - [eliastiksofts.com](http://eliastiksofts.com) - Contact : [eliastiksofts.com/contact](http://eliastiksofts.com/contact)
* License: GNU GPLv3 (see LICENCE.txt file)

## How to run the server

### NodeJS

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

### Docker

You can also run the server with the Docker image using the docker-compose.yml file.
Don't forget to edit the file to include your local configuration file:

````
volumes:
    - ./config/default.json:/opt/snakeia-server/config/default.json
````

Replace ./config/default.json with the location of your configuration file.
See the section below to know how to configurate the server.

Also, change the running port for the server:

````
ports:
      - "3000:3000"
````

You can specify any port for the first part of the rule, but the second part must be the same port as configured in the config file.

Then run this command in the directory of the docker-compose.yml file to run the server:

````
docker-compose up
````

## Config file explanations (default config)

The server uses [node-config](https://github.com/lorenwest/node-config) for the configuration files.
You can create another configuration file in the **config** directory named **local.json** to override the default config file. [See this doc](https://github.com/lorenwest/node-config/wiki/Configuration-Files).

````
{
    "ServerConfig": {
        "version": "1.1.2", // The server version
        "port": 3000, // The port where the server runs
        "proxyMode": false, // Set this value to true if your server is behind a proxy - defaults to false
        "enableMultithreading": true, // Enabling the use of different threads for the game engine, improves performance / requires a version of Nodejs that supports Worker Threads
        "maxPlayers": 20, // The maximum number of players for each room
        "maxRooms": 20, // The maximum number of room
        "minGridSize": 5, // The minimum size for a grid (width and height)
        "maxGridSize": 50, // The maximum size for a grid (width and height)
        "minSpeed": 1, // The minimum speed
        "maxSpeed": 100, // The maximum speed
        "enableAI": false, // Disable or enable AIs
        "playerWaitTime": 45000, // The time while waiting for players to join a room (ms)
        "enableMaxTimeGame": true, // Enable time limit for each game
        "maxTimeGame": 300000, // The time limit for each game (ms)
        "enableAuthentication": true, // Enable authentification when connecting to the server
        "authenticationTime": 86400000, // The duration of authentication token (ms)
        "jsonWebTokenSecretKey": "", // A private key for signing a token (if not provided, a random key will be generated)
        "jsonWebTokenSecretKeyAdmin": "", // A private key for signing an admin token - should be different from previous value (if not provided, a random key will be generated)
        "minCharactersUsername": 3, // The minimum number of characters for the username
        "maxCharactersUsername": 15, // The maximum number of characters for the username
        "enableRecaptcha": true, // Enable ReCaptcha
        "recaptchaApiUrl": "https://www.google.com/recaptcha/api/siteverify", // ReCaptcha API URL
        "recaptchaPublicKey": "", // ReCaptcha public key (if not provided, the ReCaptcha will be disabled)
        "recaptchaPrivateKey": "", // ReCaptcha private key (if not provided, the ReCaptcha will be disabled)
        "authentMaxRequest": 50, // Maximum request for authentication
        "authentWindowMs": 900000, // Time when the authentication requests are saved (ms)
        "ipBan": [], // A list of IP to ban
        "usernameBan": [], // A list of usernames to ban
        "contactBan": "", // A contact URL displayed when an user is banned
        "enableLoggingFile": true, // Enable logging into file
        "logFile": "logs/server.log", // Log file
        "errorLogFile": "logs/error.log", // Error log file
        "logLevel": "debug" // Log level (see Winston documentation),
        "adminAccounts": { // User accounts of the administrator panel (can be accessed at serverDomain/admin)
            "test": { // Username
                "password": "", // Password SHA-512 hash
                "role": "administrator" // Role (administrator or moderator) - defaults to moderator
            }
        }
    }
}
````

## Changelog

* Version 1.1.3 (3/29/2021) :
    - Using node-config
    - Updated dependencies

* Version 1.1.2 (10/18/2020):
    - Version based on SnakeIA version 2.2.

* Version 1.1.1 (6/1/2020):
    - Worker (multi-threading) errors are now logged ;
    - Version based on SnakeIA version 2.1.1.

* Version 1.1 (5/4/2020):
    - Added an administration panel (can be accessed at serverDomain/admin). The accounts are configurable via the configuration file (two possible roles: moderator or administrator);
    - Games are now multithreaded by default, this improves performance (can be disabled in the configuration file);
    - Maximum time limit per game (configurable);
    - Added the possibility of adding IAs to a game (can be disabled in the configuration file);
    - Bug fixes and other adjustments:
        - The state of a game is sent directly to the spectators;
        - It's now impossible to choose the same username as another user;
        - Corrections of other bugs and adjustments.
    - Version based on SnakeIA version 2.1.

# Français

Un serveur pour mon jeu [SnakeIA](https://github.com/Eliastik/snakeia), écrit en JavaScript avec la bibliothèque logicielle Socket.IO et tournant via Node.js.

* Dépôt Github : [https://github.com/Eliastik/snakeia-server](https://github.com/Eliastik/snakeia-server)

## À propos de ce serveur

* Version 1.1.3
* Made in France by Eliastik - [eliastiksofts.com](http://eliastiksofts.com) - Contact : [eliastiksofts.com/contact](http://eliastiksofts.com/contact)
* Licence : GNU GPLv3 (voir le fichier LICENCE.txt)

## Comment lancer le serveur

### NodeJS

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
npm start
````

Le serveur va se lancer sur le port 3000 par défaut.

### Docker

Vous pouvez aussi lancer le serveur en utilisant l'image Docker avec le fichier docker-compose.yml.
N'oubliez pas de modifier ce fichier avec l'emplacement de votre fichier de configuration :

````
volumes:
    - ./config/default.json:/opt/snakeia-server/config/default.json
````

Remplacez ./config/default.json par l'emplacement du fichier de configuration.
Consultez la section plus bas pour savoir comment configurer le serveur.

Changez également le port sur lequel le serveur écoute :

````
ports:
      - "3000:3000"
````

Vous pouvez indiquer n'importe quel port pour la première partie de la règle, mais la seconde partie doit être cohérente avec la configuration du serveur.

Ensuite, lancez cette commande pour lancer le serveur :

````
docker-compose up
````

## Explications du fichier de configuration (configuration par défaut)

Le serveur utilise [node-config](https://github.com/lorenwest/node-config) pour les fichiers de configuration.
Vous pouvez créer un fichier de configuration **local.json** dans le dossier **config** pour remplacer la configuration par défaut. [Voir cette doc](https://github.com/lorenwest/node-config/wiki/Configuration-Files).

````
{
    "ServerConfig": {
        "version": "1.1.2", // La version du serveur
        "port": 3000, // Le port sur lequel lancer le server
        "proxyMode": false, // Mettez à true si votre serveur est derrière un proxy - par défaut false
        "enableMultithreading": true, // Activer l'utilisation de threads différents pour le moteur de jeu, améliore les performances / nécessite une version de Nodejs qui supporte les Worker Threads
        "maxPlayers": 20, // Le nombre maximal d'utilisateurs par salle
        "maxRooms": 20, // Le nombre maximal de salles
        "minGridSize": 5, // La taille minimale pour une grille (largeur et hauteur)
        "maxGridSize": 50, // La taille maximale pour une grille (largeur et hauteur)
        "minSpeed": 1, // La vitesse minimale
        "maxSpeed": 100, // La vitesse maximale
        "enableAI": false, // Désactiver ou activer les IA
        "playerWaitTime": 45000, // Le temps durant lequel attendre la connexion d'autres joueurs à la salle (ms)
        "enableMaxTimeGame": true, // Activer la limite de temps pour chaque partie
        "maxTimeGame": 300000, // La limite de temps pour chaque partie (ms)
        "enableAuthentication": true, // Activer l'authentification lors de la connexion au serveur
        "authenticationTime": 86400000, // La durée de vie d'un token d'authentification
        "jsonWebTokenSecretKey": "", // Une clée privée pour signer un token (si non fournie, une clé sera générée au hasard)
        "jsonWebTokenSecretKeyAdmin": "", // Une clée privée pour signer un token d'administration - doit être différente de la valeur précédente (si non fournie, une clé sera générée au hasard)
        "minCharactersUsername": 3, // Le nombre minimal de caractères pour le nom d'utilisateur
        "maxCharactersUsername": 15, // Le nombre maximal de caractères pour le nom d'utilisateur
        "enableRecaptcha": true, // Activer le ReCaptcha
        "recaptchaApiUrl": "https://www.google.com/recaptcha/api/siteverify", // URL de l'API ReCaptcha
        "recaptchaPublicKey": "", // Clé publique ReCaptcha (si non fournie, le ReCaptcha sera désactivé)
        "recaptchaPrivateKey": "", // Clé privée ReCaptcha (si non fournie, le ReCaptcha sera désactivé)
        "authentMaxRequest": 50, // Nombre maximal de requêtes lors de l'authentification
        "authentWindowMs": 900000, // Temps durant lequel les tentatives d'authentification seront enregistrées (ms)
        "ipBan": [], // Une liste d'IPs à bannir
        "usernameBan": [], // Une liste de noms d'utilisateur à bannir
        "contactBan": "", // Une URL de contact à afficher lorsque l'utilisateur est banni
        "enableLoggingFile": true, // Activer le log dans un fichier
        "logFile": "logs/server.log", // Fichier de log
        "errorLogFile": "logs/error.log", // Fichier de log d'erreurs
        "logLevel": "debug" // Niveau de log (voir la documentation de Winston),
        "adminAccounts": { // Compte utilisateurs du panel d'administration (peut être accédé à serverDomain/admin)
            "test": { // Nom d'utilisateur
                "password": "", // Hash SHA-512 du mot de passe
                "role": "administrator" // Rôle (administrator ou moderator) - par défaut moderator
            }
        }
    }
}
````

## Journal des changements

* Version 1.1.3 (29/03/2021) :
    - Utilisation de node-config
    - Mise à jour des dépendences

* Version 1.1.2 (18/10/2020) :
    - Version basée sur la version 2.2 de SnakeIA.

* Version 1.1.1 (01/06/2020) :
    - Les erreurs des Worker (multi-threading) sont maintenant loggées ;
    - Version basée sur la version 2.1.1 de SnakeIA.

* Version 1.1 (04/05/2020) :
    - Ajout d'un panel d'administration (accessible à serverDomain/admin). Les comptes sont configurables via le fichier de configuration (deux rôles possibles : moderator ou administrator) ;
    - Multithreading des parties, cela améliore les performances (désactivable dans le fichier de configuration) ;
    - Limite de temps maximale par partie (configurable ou désactivable) ;
    - Ajout de la possibilité de remplir une partie avec des IAs (désactivable dans le fichier de configuration) ;
    - Correction de bugs et autres ajustements :
        - L'état d'une partie est directement envoyée aux spectateurs (avant il y avait un délai) ;
        - Il est désormais impossible de choisir le même nom d'utilisateur qu'un autre utilisateur ;
        - Corrections d'autres bugs et ajustements.
    - Version basée sur la version 2.1 de SnakeIA.

## TO-DO

- [x] Multithreading
- [x] Limite de temps maximale par partie
- [x] Envoyer directement l'état d'une partie aux spectateurs (actuellement il y a un délai)
- [x] Ajouter possibilité de remplir une partie avec des IAs
- [x] Empêcher choix du même nom d'utilisateur qu'un autre utilisateur
- [x] Panel d'administration

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
