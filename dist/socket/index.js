import { Server } from 'socket.io';
import { socketAuth } from './auth.js';
import { handlePresence } from './presence.js';
import { handleChatEvents } from './chat.js';
import { handleSupportEvents } from './support.js';
let io;
const socketOrigins = [
    'https://goexperts.in',
    'https://www.goexperts.in',
    'https://adminai.goexperts.in',
    'https://apiai.goexperts.in',
    'https://mobileapi.goexperts.in',
];
export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: (origin, callback) => {
                if (!origin)
                    return callback(null, true);
                if (socketOrigins.includes(origin) ||
                    origin.startsWith('http://localhost:') ||
                    origin.startsWith('http://127.0.0.1:') ||
                    !origin // allow non-browser clients like Postman in dev
                ) {
                    return callback(null, true);
                }
                return callback(new Error('Not allowed by CORS'));
            },
            credentials: true,
        },
    });
    io.use(socketAuth);
    io.on('connection', (socket) => {
        const userId = socket.user?.id;
        if (userId) {
            socket.join(userId);
        }
        handlePresence(io, socket);
        handleChatEvents(io, socket);
        handleSupportEvents(io, socket);
    });
};
export const getIo = () => {
    return io ?? null;
};
