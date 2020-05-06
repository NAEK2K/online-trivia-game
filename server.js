const app = require("express")()
const http = require("http").createServer(app)
const io = require("socket.io")(http)
const request = require("request")
const port = 8080
let gameIdentifiers = [] // holds game identifiers to ensure they are unique
let userIdentifiers = [] // holds user identifiers to ensure they are unique
let runningGames = [] // holds game objects that are currently running
let questionPool; // holds the 50 questions to make the pool
// request 50 at the start so no more requests need to be made
refreshQuestions()
// game class, each lobby gets their own object
class Game {
    constructor() {
        this.questions = getQuestions()
        this.round = 0
        this.connected = []
        this.index = runningGames.length
        this.identifier = createNewGameIdentifier()
    }
    updateConnected() {
        for (let index = 0; index < this.connected.length; index++) {
            this.connected[index] = userFromSocket(io.sockets.sockets[this.connected[index].id])
        }
    }
    roundCheck() {
        this.updateConnected()
        let allAnswered = true
        for (let index = 0; index < this.connected.length; index++) {
            if(this.connected[index]["answered"] == false) {
                allAnswered = false
                break
            }
        }
        if(allAnswered) {
            this.newRound()
        }
    }
    newRound() { // moves to the next round
        for (let index = 0; index < this.connected.length; index++) {
            io.sockets.sockets[this.connected[index]["id"]].answered = false
        }
        this.updateConnected()
        this.round++
        if (this.round >= 5) {
            this.endGame()
            return
        }
        io.to(this.identifier).emit("game info", this)
    }
    endGame() {
        let winners = [this.connected.pop()]
        for (let index = 0; index < this.connected.length; index++) {
            let temp = this.connected.pop()
            if(temp["score"] > winners[0]["score"]) {
                winners = temp
            } else if(temp["score"] == winners[0]["score"]) {
                winners.push(temp)
            }
        }
        io.to(this.identifier).emit("game over", winners)
        this.connected.forEach(socket => {
            io.sockets.sockets[socket["id"]].disconnect()
        })
        runningGames[this.index] = null
        gameIdentifiers[this.index] = null
    }
    currentQuestion() { // returns the question for the current round
        return this.questions[this.round]
    }
    userDisconnect(socket) { // disconnects the socket from the game object
        let removedIndex;
        for (let index = 0; index < this.connected.length; index++) {
            if(this.connected[index]["id"] == socket.id) {
                removedIndex = index
                break
            }
        }
        this.connected.splice(removedIndex, 1)
    }
}
// generates a random unique lobby ID 
function createNewGameIdentifier() {
    let id = Math.floor(Math.random() * 10000)
    while (gameIdentifiers.includes(String(id))) {
        id = Math.floor(Math.random() * 10000)
    }
    id = String(id)
    gameIdentifiers.push(id)
    return id
}
// generates a random unique user ID
function createNewUserIdentifier() {
    let id = Math.floor(Math.random() * 10000)
    while (userIdentifiers.includes(String(id))) {
        id = Math.floor(Math.random() * 10000)
    }
    id = String(id)
    userIdentifiers.push(id)
    return id
}
// selects 5 unique questions from the previously made pool
function getQuestions() {
    let uniqueNums = []
    let selectedQuestions = []
    let rnd;
    while (uniqueNums.length < 5) {
        rnd = Math.floor(Math.random() * 50)
        if (!uniqueNums.includes(rnd)) {
            uniqueNums.push(rnd)
        }
    }
    uniqueNums.forEach(num => {
        selectedQuestions.push(questionPool[num])
    })
    return selectedQuestions
}
// refreshes the question pool for 50 new questions
function refreshQuestions() {
    // change once online https://opentdb.com/api.php?amount=50
    request("https://opentdb.com/api.php?amount=50", { json: true }, (err, res, body) => {
        if (err) {
            return err
        }
        questionPool = body.results
    })
}
// returns the game object from the identifier
function getGame(id) {
    return runningGames[gameIdentifiers.indexOf(id)]
}
// returns socket info
function userFromSocket(socket) {
    return {username: socket.username, userid: socket.userid, score: socket.score, answer: socket.answer, answered: socket.answered, id: socket.id, lobby: socket.lobby}
}
app.get("/", function (req, res) {
    res.sendFile(__dirname + "/public/index.html")
    if (questionPool == undefined) {
        res.send("error: questions are not loaded")
    }
})

app.get("/index.js", function (req, res) {
    res.sendFile(__dirname + "/public/index.js")
})

app.get("/index.css", function (req, res) {
    res.sendFile(__dirname + "/public/index.css")
})

app.get("/q.json", function(req, res) {
    res.sendFile(__dirname + "/q.json")
})

app.use(function(req, res, next) {
    res.status(404).send('error 404: you broke something');
});

io.on("connection", function (socket) {
    console.log(socket.id + " connected")
    socket.on("register", function (data) {
        socket.username = data["username"] // sets socket username
        socket.userid = createNewUserIdentifier() // generates a unique ID
        socket.score = 0 // tracks their score
        socket.answer // tracks their last answer
        socket.answered = false // tracks if they answered in the current round
        if (data["option"] == "join") {
            if (gameIdentifiers.includes(data["lobby"])) {
                socket.join(data["lobby"]) // connect socket to room
                socket.lobby = data["lobby"] // track which lobby socket is in
                getGame(data["lobby"]).connected.push(userFromSocket(socket)) // let game know socket is connected
                socket.emit("valid lobby", { lobby: data["lobby"], game: getGame(socket.lobby) }) // emit to client game data
                socket.to(socket.lobby).emit("user joined", getGame(socket.lobby))
                socket.emit("game info", getGame(socket.lobby))
                console.log(socket.id + " connected to " + socket.lobby)
            } else {
                socket.emit("invalid lobby")
            }
        } else if (data["option"] == "new") {
            let newGame = new Game()
            socket.lobby = newGame.identifier // track which lobby socket is in
            newGame.connected.push(userFromSocket(socket)) // let game know socket is connected
            runningGames.push(newGame) // push game to an array for later access
            socket.join(newGame.identifier) // connect socket to new game room
            socket.emit("valid lobby", { lobby: socket.lobby, game: getGame(socket.lobby) }) // emit to client game data
            socket.emit("game info", getGame(socket.lobby))
            console.log(socket.id + " connected to " + socket.lobby)
        }
    })
    socket.on("answered", function(answer) {
        if(answer == getGame(socket.lobby).questions[getGame(socket.lobby).round]["correct_answer"]) {
            socket.score += 100
            socket.answered = true
            getGame(socket.lobby).updateConnected()
            socket.emit("right answer", getGame(socket.lobby))
        } else {
            socket.score -= 100
            socket.answered = true
            getGame(socket.lobby).updateConnected()
            socket.emit("wrong answer", getGame(socket.lobby))
        }
        io.to(socket.lobby).emit("update users", getGame(socket.lobby))
        getGame(socket.lobby).roundCheck()
    })
    socket.on("disconnect", function () {
        if (socket.lobby == null) {
            return
        } else {
            try {
                getGame(socket.lobby).userDisconnect(socket) // remove user from connected of game object
            } catch(e) {

            }
            socket.to(socket.lobby).emit("user left", getGame(socket.lobby)) // reupdate players
        }
    })
})

http.listen(port, function () {
    console.log("listening on port " + port)
})