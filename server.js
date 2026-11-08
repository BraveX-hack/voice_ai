require("dotenv").config();
const WebSocket = require("ws");
const http = require("http");
const express=require('express');
const app=express();
const server = http.createServer(app);
const path=require('path');
const PORT = process.env.PORT;
const socket = new WebSocket.Server({ server });
app.use(express.static(path.join(__dirname,'public')));
socket.on("connection", (client) => {
    const audioQueue = [];
    const deepgram = new WebSocket(
        "wss://api.deepgram.com/v1/listen?model=nova-2&language=fr",
        {
            headers: {
                Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`
            }
        }
    );
    client.on("message", (audio) => {
        if (deepgram.readyState === WebSocket.OPEN) {
            deepgram.send(audio);
        } else {
            audioQueue.push(audio);
        }
    });
    deepgram.on("open", () => {
        console.log("Connexion Deepgram établie");
        while (audioQueue.length > 0) {
            deepgram.send(audioQueue.shift());
        }
    });
    deepgram.on("error", (erreur) => {
        console.log("Erreur Deepgram :", erreur.message);
    });
    deepgram.on("message", (data) => {
        const resultat = JSON.parse(data.toString());
        const texte = resultat.channel?.alternatives?.[0]?.transcript;
        if (texte && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                texte,
                statut: resultat.is_final ? "définitif" : "provisoire"
            }));
        }
    });
    const keepAlive = setInterval(() => {
        if (deepgram.readyState === WebSocket.OPEN) {
            deepgram.send(JSON.stringify({
                type: "KeepAlive"
            }));
        }
    }, 8000);
    client.on("close", () => {
        audioQueue.length = 0;
        if (deepgram.readyState === WebSocket.OPEN) {
            deepgram.close();
        }
        clearInterval(keepAlive);
    });
});
server.listen(PORT, () => {
    console.log(`Serveur lancé sur le port ${PORT}`);
});