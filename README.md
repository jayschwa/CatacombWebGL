# CatacombWebGL

CatacombWebGL is a project that [I](https://jayschwa.net) worked on at the [Recurse Center](https://recurse.com) in 2017. [Catacomb 3-D](https://catacomb.games) is a first-person shooter from the early 1990s that I used to play as a kid. I thought it would be fun to attempt to recreate it using WebGL.

The project is unfinished and unlikely to be completed. Shortly after my stint at the Recurse Center, I bought the rights to the original game series and have been working on modernizing the original code base.

## Licensing

Source code is open sourced under the GPLv2 license. Data assets like art and sound are not open sourced (yet).

## Setup

### Prerequisites

You must have [Node.js](https://nodejs.org) installed.

### Setup

After cloning the repository, run `npm install`.

### How to Run

`npm start` will run a local web server that serves built assets at http://localhost:8080.

### How to Build

`npm run dev` will run a process that monitors the source code for changes and rebuilds the assets that get served.
