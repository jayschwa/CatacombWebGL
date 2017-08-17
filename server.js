const express = require('express')

const port = 8080

const server = express()
server.use(express.static('build'))
server.listen(port, () => console.log(`Serving on port ${port}...`))
