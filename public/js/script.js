const boutonDemarrer = document.getElementById("btn-demarrer");
const boutonStoper = document.getElementById("btn-stoper");
let mediaRecorder;
let streamMicro;
const statut = document.getElementById("statut");
const protocole = location.protocol === "https:" ? "wss:" : "ws:";
const socket = new WebSocket(
    `${protocole}//${location.host}`
);
socket.onopen = () => {
    statut.textContent = "Connecter";
    console.log("WebSocket connecté !");
};
socket.onclose = (event) => {
    statut.textContent = "Connexion fermée";
    console.log("Code de fermeture :", event.code);
};
socket.onerror = (erreur) => {
    statut.textContent = "Erreur de connexion";
    console.error("Erreur WebSocket :", erreur);
};
let texteFinal = "";
let texteProvisoire = "";

socket.onmessage = (event) => {
    const resultat = JSON.parse(event.data);

    if (resultat.statut === "définitif") {
        texteFinal += resultat.texte + " ";
        texteProvisoire = "";
    } else {
        texteProvisoire = resultat.texte;
    }

    document.getElementById("transcription").textContent =
        texteFinal + texteProvisoire;
};

boutonDemarrer.addEventListener("click", () => {

    if (socket.readyState !== WebSocket.OPEN) {
        alert("La connexion au serveur n'est pas encore établie.");
        return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {

            streamMicro = stream;
            mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
                    socket.send(event.data);
                }
            };

            mediaRecorder.start(250);
            Orb.connect(stream);
            console.log("Enregistrement démarré !");
        })
        
        .catch((erreur) => {
            console.error("Accès au microphone refusé :", erreur);

            alert("Impossible d'accéder au microphone. Veuillez autoriser son utilisation.");
        });
});

boutonStoper.addEventListener("click", arreter);

function arreter() {
    Orb.disconnect();
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }

    if (streamMicro) {
        streamMicro.getTracks().forEach(track => track.stop());
        streamMicro = null;
    }

    if (socket.readyState === WebSocket.OPEN) {
        socket.close();
    }

    console.log("Enregistrement arrêté et microphone libéré.");
}