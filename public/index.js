let socket = io()
function validate(e) { // checks the forms on register to make sure the user actually put a value
    let username = document.getElementById("username").value
    let lobby = document.getElementById("lobby").value
    let option = e.value
    if (username.length == 0) {
        window.alert("Please enter a valid username")
        return
    }
    if (option == "join") {
        if (lobby.length == 0) {
            window.alert("Please enter a valid lobby")
            return
        }
    }
    socket.emit("register", { username: username, lobby: lobby, option: option })
}

function checkAnswer() { // checks if the user actually clicked something and sends it to the server
    let answers = document.getElementsByName("0")
    let answered = false
    let selected
    answers.forEach(answer => {
        if(answer.checked == true) {
            answered = true
            selected = answer.value
        }
    })
    if(answered == false) {
        window.alert("Please answer the question.")
    } else {
        socket.emit("answered", selected)
    }
}

function answerSwap(answers, one, two) { // randomly swaps answers around, called in answerMix
    let temp = answers[two]
    answers[two] = answers[one]
    answers[one] = temp
    return answers
}

function answerMix(wrong, right) { // mixes the wrong and right answers into a single array and returns it
    let answers = []
    wrong.push(right)
    answers.push(wrong)
    answers = answers[0]
    for (let i = 0; i < 5; i++) {
        let rng1 = Math.floor(Math.random() * answers.length)
        let rng2 = Math.floor(Math.random() * answers.length)
        answers = answerSwap(answers, rng1, rng2)
    }
    return answers
}

function generatePage(gameData) { // creates the page and elements, specifically the questions, reads data given by an emit from the server
    let questionsDiv = document.getElementById("questions")
    questionsDiv.innerHTML = ""
    let answerID = 0;
    let questionDiv = document.createElement("div")
    questionDiv.className = "question"
    let questionTitle = document.createElement("h3")
    questionTitle.innerHTML = gameData["questions"][gameData["round"]]["question"]
    let answerList = document.createElement("ul")
    answerMix(gameData["questions"][gameData["round"]]["incorrect_answers"], gameData["questions"][gameData["round"]]["correct_answer"]).forEach(answer => {
        let answerItem = document.createElement("li")
        let answerRadio = document.createElement("input")
        answerRadio.type = "radio"
        answerRadio.name = answerID
        answerRadio.value = answer
        answerItem.appendChild(answerRadio)
        answerItem.innerHTML += answer
        answerList.appendChild(answerItem)
    });
    answerID++
    questionDiv.appendChild(questionTitle)
    questionDiv.appendChild(answerList)
    questionsDiv.appendChild(questionDiv)
    let finishedButton = document.createElement("button")
    let fbDiv = document.createElement("div")
    fbDiv.id = "fbDiv"
    finishedButton.onclick = checkAnswer
    finishedButton.innerHTML = "Submit"
    finishedButton.id = "finishedButton"
    fbDiv.appendChild(finishedButton)
    questionsDiv.appendChild(fbDiv)
}

function updateUsers(data) { // reloads the users when someone joins/leaves, also updates scores and answer status
    let userDiv = document.getElementById("users")
    let lobInfoDiv = document.getElementById("lobby-info")
    lobInfoDiv.innerHTML = "Lobby ID: " + data.connected[0]["lobby"] + "<br>Round: " + (data.round+1)
    userDiv.innerHTML = ""
    data.connected.forEach(user => {
        let p = document.createElement("p")
        p.innerHTML = user["username"] + "#" + user["userid"] + " - " + user["score"] + " Answered: " + user["answered"]
        userDiv.appendChild(p)
    });
}

socket.on("valid lobby", function (data) { // if user put a good lobby
    let regDiv = document.getElementById("register")
    regDiv.style.display = "none"
    updateUsers(data["game"])
})

socket.on("invalid lobby", function () { // if user put a bad lobby
    window.alert("Lobby does not exist.")
})

socket.on("user joined", function(data) { // if a user joins their lobby
    updateUsers(data)
})

socket.on("user left", function(data) { // if a user leaves a lobby
    updateUsers(data)
})

socket.on("game info", function(data) { // if the server sends new game data
    updateUsers(data)
    generatePage(data)
})

socket.on("right answer", function(data) { // if the user got the right answer
    let ansDiv = document.getElementById("answer-status")
    let ansBut = document.getElementById("finishedButton")
    ansBut.style.display = "none"
    ansDiv.innerHTML = "Your last answer was correct."
})
socket.on("wrong answer", function(data) { // if the user got the wrong answer
    let ansDiv = document.getElementById("answer-status")
    let ansBut = document.getElementById("finishedButton")
    ansBut.style.display = "none"
    ansDiv.innerHTML = "Your last answer was incorrect."
})

socket.on("update users", function(data) { // if the server wants to update the user list
    updateUsers(data)
})

socket.on("game over", function(data) { // if the server deems the game finished
    let questionDiv = document.getElementById("questions")
    let ansDiv = document.getElementById("answer-status")
    let userDiv = document.getElementById("users")
    userDiv.innerHTML = ""
    ansDiv.innerHTML = ""
    questionDiv.innerHTML = "<p>Winner(s)</p>"
    console.log(data)
    data.forEach(winner => { // displays winners in a list
        questionDiv.innerHTML += "<p>" + winner["username"]+"#"+winner["userid"]+" Score: "+winner["score"]+"</p>"
    })
    window.alert("Game over! Refresh the page when you are finished.")
})