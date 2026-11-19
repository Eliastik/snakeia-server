# English

* Version 2.3.0 (11/19/2026):
    - Added support for YAML config files (now the recommended config format)
    - The configuration is now validated using a JSON Schema: if the config is invalid, the server won't start and the config error will be displayed
    - Fixed configuration editing in the admin panel: only the effective configuration (local.yaml/json) is editable, and when saving, no values from the default config is copied to the effective configuration
    - Updated dependencies

* Version 2.2.2 (11/15/2026):
    - Update dependencies, update Docker image to Node 26

* Version 2.2.1 (11/2/2026):
    - Update dependencies

* Version 2.2.0 (9/30/2026):
    - Added /healthcheck HTTP/Socket.io endpoint (only accessible on localhost)
    - Added healthcheck in the Docker image

* Version 2.1.3 (9/29/2026):
    - Update dependencies

* Version 2.1.2 (9/7/2026):
    - Update dependencies

* Version 2.1.1 (8/6/2026):
    - Update dependencies

* Version 2.1.0 (6/25/2026):
    - Added "hideVersion" configuration to hide server version
    - Update dependencies

* Version 2.0.1 (5/30/2026):
    - Update dependencies

* Version 2.0.0 (5/8/2026):
    - ⚠️ Breaking Changes:
        - Authentication is no longer compatible with SnakeIA 3.1.0 and earlier versions;
        - Clients must be updated to SnakeIA 3.2.0 to support the new authentication method;
        - An explicit error message is now displayed when an incompatible client attempts to authenticate;
    - Updated to SnakeIA 3.2.0 to benefit from the latest improvements;
    - Matchmaking now automatically restarts 30 seconds after the end of a game (configurable through the `matchmakingWaitTime` setting);
    - Bug fixes and security improvements:
        - Fixed a security issue in the previous authentication system:
            - The socket ID was transmitted through the authentication URL;
            - An attacker could reuse this URL to retrieve the victim's token;
            - The impact remained limited since accounts are currently ephemeral;
        - Improved security by implementing CSRF protection on most endpoints (previously, only a few endpoints were covered);
        - Strengthened the rate limiting system:
            - Stricter rate limiting rules;
            - Added rate limiting for administration actions;
            - Separate configurations for:
                - User authentication;
                - Administrator authentication;
                - Administration actions;
        - Fixed issues related to retrieving usernames from tokens;
        - Fixed a server crash occurring when modifying the configuration from the administration/moderation panel while the configuration file was read-only;
    - Technical improvements:
        - Migrated to the Jose library for authentication token management;
        - Improved HTTP responses to better comply with REST API standards across multiple endpoints;
        - Codebase refactoring;
        - Updated dependencies.

* Version 2.0.0-beta.1 (3/7/2026):
    - ⚠️ Breaking Changes:
    - Authentication is no longer compatible with SnakeIA 3.1.0 and earlier versions.
      An update to SnakeIA will be released soon to restore compatibility.
    - Bug fixes and security improvements
    - Code refactoring
    - Dependency updates

* Version 1.2.7 (2/22/2026):
    - Update dependencies + SnakeIA to version 3.1.0

* Version 1.2.6 (1/26/2026):
    - Added the ability to start the server in HTTPS mode
    - Update dependencies

* Version 1.2.5 (1/4/2026):
    - Update dependencies

* Version 1.2.4 (12/6/2025):
    - Update dependencies

* Version 1.2.3 (11/2/2025):
    - Update to Node 24 LTS
    - Update dependencies

* Version 1.2.2 (10/7/2025):
    - Update SnakeIA to 3.0.1

* Version 1.2.1 (10/7/2025):
    - Fixed a bug where the game could get stuck on the "Loading..." screen when restarting.

* Version 1.2.0 (10/5/2025):
    - Adaptation to version 3.0.0 of SnakeIA and implementation of Ultra AI
    - Bug fixes
    - Updated dependencies

* Version 1.1.7 (7/8/2025):
    - Fixed loop authentication problems (using a Socket.io v4 client)

* Version 1.1.6 (7/7/2025):
    - Fix random crashs due to token checking (when using Socket.io client v4)
    - Updated dependencies

* Version 1.1.5 (6/18/2025):
    - Fixed "Error: invalid CSRF token" occurring during certain actions in the administrator panel

* Version 1.1.4.2 (6/18/2025):
    - Updated dependencies

* Version 1.1.4.1 (1/1/2025):
    - Updated dependencies

* Version 1.1.4 (11/23/2024):
    - Switched to csrf-csrf library instead of csurf (no longer maintained) for CSRF protection
    - Added "numberOfProxies" parameter (default 1) to server configuration file
    - Updated dependencies

* Version 1.1.3.8 (9/29/2024) :
    - Updated dependencies

* Version 1.1.3.7 (9/19/2024) :
    - Updated dependencies

* Version 1.1.3.6 (7/25/2024) :
    - Updated dependencies

* Version 1.1.3.5 (6/20/2024) :
    - Updated dependencies

* Version 1.1.3.4 (6/3/2024) :
    - Updated dependencies

* Version 1.1.3.3 (3/30/2024) :
    - Updated dependencies

* Version 1.1.3.2 (3/23/2024) :
    - Updated dependencies

* Version 1.1.3.1 (9/24/2023) :
    - Updated dependencies

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

* Version 2.3.0 (19/11/2026) :
    - Ajout de la prise en charge des fichiers de configuration YAML (désormais le format de configuration recommandé)
    - La configuration est désormais validée à l'aide d'un schéma JSON : si la configuration n'est pas valide, le serveur ne démarre pas et une erreur de configuration s'affiche
    - Correction de l'édition de la configuration dans le panneau d'administration : seule la configuration effective (local.yaml/json) est modifiable, et lors de l'enregistrement, aucune valeur de la configuration par défaut n'est copiée dans la configuration effective
    - Mise à jour des dépendances

* Version 2.2.2 (15/11/2026) :
    - Mise à jour des dépendances, mise à jour de l'image Docker vers Node 26

* Version 2.2.1 (02/11/2026) :
    - Mise à jour des dépendances

* Version 2.2.0 (30/09/2026) :
    - Ajout d'un endpoint /healtcheck HTTP/Socket.io accessible uniquement en localhost
    - Ajout d'un healthcheck à l'image Docker

* Version 2.1.3 (29/09/2026) :
    - Mise à jour des dépendances

* Version 2.1.2 (07/09/2026) :
    - Mise à jour des dépendances

* Version 2.1.1 (06/08/2026) :
    - Mise à jour des dépendances

* Version 2.1.0 (25/06/2026) :
    - Ajout de la configuration "hideVersion" qui permet de masquer la version du serveur
    - Mise à jour des dépendances

* Version 2.0.1 (30/05/2026) :
    - Mise à jour des dépendances

* Version 2.0.0 (08/05/2026) :
    - ⚠️ Breaking Changes :
        - L'authentification n'est plus compatible avec SnakeIA 3.1.0 et versions inférieures ;
        - Le client doit être mis à jour vers SnakeIA 3.2.0 pour être compatible avec la nouvelle méthode d'authentification ;
        - Une erreur explicite est désormais affichée à l'authentification lorsqu'un client incompatible tente de se connecter ;
    - Mise à jour vers SnakeIA 3.2.0 pour profiter des dernières améliorations ;
    - Le matchmaking se relance automatiquement au bout de 30 secondes après la fin d'une partie (paramétrable via la configuration `matchmakingWaitTime`) ;
    - Correction de bugs et améliorations de sécurité :
        - Correction d'une faille de sécurité dans l'ancien système d'authentification :
            - L'ID du socket était transmis dans l'URL d'authentification ;
            - Un attaquant pouvait alors réutiliser cette URL pour récupérer le token de sa victime ;
            - L'impact restait limité car les comptes sont actuellement éphémères ;
        - Amélioration de la sécurité avec la mise en place d'une protection CSRF sur la plupart des endpoints (auparavant, seuls quelques endpoints étaient couverts) ;
        - Renforcement du système de rate limiting :
            - Règles plus restrictives ;
            - Ajout du rate limiting pour les actions d'administration ;
            - Configuration distincte pour :
                - L'authentification utilisateur ;
                - L'authentification administrateur ;
                - Les actions d'administration ;
        - Correction de bugs avec la récupération du nom d'utilisateur des tokens ;
        - Correction d'un crash du serveur lors de la modification de la configuration via le panneau d'administration/modération si le fichier de configuration était en lecture seule ;
    - Améliorations techniques :
        - Migration vers la librairie Jose pour la gestion des tokens d'authentification ;
        - Améliorations des réponses HTTP (respectent les normes API REST) des différents endpoints ;
        - Refactorisation du code ;
        - Mise à jour des dépendances

* Version 2.0.0-beta.1 (07/03/2026) :
    - ⚠️ Breaking Changes :
        - L'authentification n'est plus compatible avec SnakeIA 3.1.0 et versions inférieures
          Une mise à jour de SnakeIA sera publiée prochainement pour rétablir la compatibilité.
    - Correction de bugs et améliorations de sécurité
    - Refactorisation du code
    - Mise à jour des dépendances

* Version 1.2.7 (22/02/2026) :
    - Mise à jour des dépendences + SnakeIA vers 3.1.0

* Version 1.2.6 (26/01/2026) :
    - Ajout de la possibilité de démarrer le serveur en HTTPS
    - Mise à jour des dépendences

* Version 1.2.5 (04/01/2026) :
    - Mise à jour des dépendences

* Version 1.2.4 (06/12/2025) :
    - Mise à jour des dépendances

* Version 1.2.3 (02/11/2025) :
    - Mise à jour vers Node 24 LTS
    - Mise à jour des dépendances

* Version 1.2.2 (07/10/2025):
    - Mise à jour de SnakeIA vers la version 3.0.1

* Version 1.2.1 (07/10/2025):
    - Correction d'un bug où le jeu restait bloqué sur le message "Chargement..." lorsque la partie était recommencée

* Version 1.2.0 (05/10/2025) :
    - Adaptation à la version 3.0.0 de SnakeIA et à la mise en place de l'IA Ultra
    - Correction de bugs
    - Mise à jour des dépendences

* Version 1.1.7 (08/07/2025):
    - Correction de problèmes d'authentification en boucle (en utilisant un client Socket.io v4)

* Version 1.1.6 (07/07/2025):
    - Correction de crashs aléatoires lors de la vérification des tokens (en utilisant Socket.io v4)
    - Mise à jour des dépendences

* Version 1.1.5 (18/06/2025) :
    - Correction de l’erreur "Error: invalid CSRF token" lors de certaines actions dans le panneau d’administration

* Version 1.1.4.2 (18/06/2025) :
    - Mise à jour des dépendences

* Version 1.1.4.1 (1/1/2025) :
    - Mise à jour des dépendences

* Version 1.1.4 (23/11/2024) :
    - Passage à la bibliothèque logicielle csrf-csrf au lieu de csurf (qui n'était plus maintenue) pour la protection CSRF
    - Ajout du paramètre "numberOfProxies" (par défaut à 1) dans le fichier de configuration du serveur
    - Mise à jour des dépendences

* Version 1.1.3.8 (29/09/2024) :
    - Mise à jour des dépendences

* Version 1.1.3.7 (19/09/2024) :
    - Mise à jour des dépendences

* Version 1.1.3.6 (25/07/2024) :
    - Mise à jour des dépendences

* Version 1.1.3.5 (20/06/2024) :
    - Mise à jour des dépendences

* Version 1.1.3.4 (03/06/2024) :
    - Mise à jour des dépendences

* Version 1.1.3.3 (30/03/2024) :
    - Mise à jour des dépendences

* Version 1.1.3.2 (23/03/2024) :
    - Mise à jour des dépendences

* Version 1.1.3.1 (24/09/2023) :
    - Mise à jour des dépendences

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